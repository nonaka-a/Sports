const TTNetwork = {
    peer: null,
    conn: null,
    isOnline: false,
    role: null, // 'host' | 'guest'
    roomId: '',
    status: 'idle', // 'idle' | 'creating' | 'waiting' | 'connecting' | 'connected'
    prefix: 'ggsports-tt-',
    callbacks: {},
    _connectTimeout: null,
    _retryCount: 0,

    generateRoomCode() {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    getPeerConfig() {
        return {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        };
    },

    createRoom(callbacks = {}) {
        this.disconnect();
        if (typeof Peer === 'undefined') {
            if (callbacks.onError) callbacks.onError('通信ライブラリの読み込みに失敗しました。');
            return;
        }

        this.callbacks = callbacks;
        this.role = 'host';
        this.status = 'creating';
        this._retryCount = 0;
        this._openHostPeer();
    },

    _openHostPeer() {
        const code = this.generateRoomCode();
        this.roomId = code;

        try {
            this.peer = new Peer(this.prefix + code, this.getPeerConfig());
        } catch (e) {
            if (this.callbacks.onError) this.callbacks.onError('通信の初期化に失敗しました。');
            this.disconnect();
            return;
        }

        this.peer.on('open', () => {
            if (this.role !== 'host') return;
            this.status = 'waiting';
            if (this.callbacks.onRoomCreated) {
                this.callbacks.onRoomCreated(this.roomId);
            }
        });

        this.peer.on('connection', (conn) => {
            if (this.conn && this.conn.open) {
                conn.close();
                return;
            }
            this._setupConnection(conn);
        });

        this.peer.on('error', (err) => {
            if (err && err.type === 'unavailable-id' && this._retryCount < 3) {
                this._retryCount++;
                if (this.peer) {
                    try { this.peer.destroy(); } catch (_) {}
                    this.peer = null;
                }
                this._openHostPeer();
                return;
            }
            const msg = this._formatError(err);
            if (this.callbacks.onError) this.callbacks.onError(msg);
            if (!this.isOnline) this.disconnect();
        });
    },

    joinRoom(rawCode, callbacks = {}) {
        this.disconnect();
        if (typeof Peer === 'undefined') {
            if (callbacks.onError) callbacks.onError('通信ライブラリの読み込みに失敗しました。');
            return;
        }

        const cleanCode = String(rawCode || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanCode.length !== 6) {
            if (callbacks.onError) callbacks.onError('6桁のルームIDを入力してください。');
            return;
        }

        this.callbacks = callbacks;
        this.role = 'guest';
        this.roomId = cleanCode;
        this.status = 'connecting';

        try {
            this.peer = new Peer(this.getPeerConfig());
        } catch (e) {
            if (this.callbacks.onError) this.callbacks.onError('通信の初期化に失敗しました。');
            this.disconnect();
            return;
        }

        this._connectTimeout = setTimeout(() => {
            if (!this.isOnline && this.status === 'connecting') {
                if (this.callbacks.onError) {
                    this.callbacks.onError('接続がタイムアウトしました。IDを確認してください。');
                }
                this.disconnect();
            }
        }, 12000);

        this.peer.on('open', () => {
            if (this.role !== 'guest' || !this.peer) return;
            const conn = this.peer.connect(this.prefix + cleanCode, {
                reliable: true
            });
            this._setupConnection(conn);
        });

        this.peer.on('error', (err) => {
            const msg = this._formatError(err);
            if (this.callbacks.onError) this.callbacks.onError(msg);
            if (!this.isOnline) this.disconnect();
        });
    },

    _setupConnection(conn) {
        this.conn = conn;

        conn.on('open', () => {
            if (this._connectTimeout) {
                clearTimeout(this._connectTimeout);
                this._connectTimeout = null;
            }
            this.isOnline = true;
            this.status = 'connected';
            if (this.callbacks.onConnected) {
                this.callbacks.onConnected(this.role, this.roomId);
            }
        });

        conn.on('data', (data) => {
            if (this.callbacks.onData && data && typeof data === 'object') {
                this.callbacks.onData(data);
            }
        });

        const handleClose = () => {
            const wasOnline = this.isOnline;
            const cb = this.callbacks.onDisconnected;
            this.disconnect();
            if (wasOnline && cb) {
                cb();
            }
        };

        conn.on('close', handleClose);
        conn.on('error', handleClose);
    },

    _formatError(err) {
        if (!err || !err.type) return '通信エラーが発生しました。';
        switch (err.type) {
            case 'peer-unavailable':
                return '指定されたIDの部屋が見つかりません。';
            case 'network':
            case 'server-error':
            case 'socket-error':
                return '通信サーバーに接続できませんでした。';
            case 'webrtc':
                return 'P2P接続に失敗しました（ネットワーク環境を確認してください）。';
            default:
                return '通信エラーが発生しました。';
        }
    },

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            try {
                this.conn.send({ t: type, ...payload });
            } catch (e) {
                // 送信エラー時は切断ハンドラに任せる
            }
        }
    },

    disconnect() {
        if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
        }
        this.isOnline = false;
        this.role = null;
        this.roomId = '';
        this.status = 'idle';

        if (this.conn) {
            try { this.conn.close(); } catch (_) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (_) {}
            this.peer = null;
        }
    }
};