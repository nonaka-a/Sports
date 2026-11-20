const BadmintonAudio = {
    ctx: null,
    isUnlocked: false,
    buffers: {},
    fallbackPools: {},
    fallbackIndex: {},
    smashPaths: ['sounds/Hit1.mp3', 'sounds/hit2.mp3', 'sounds/hit3.mp3'],
    cheerPaths: ['sounds/kansei1.mp3', 'sounds/kansei2.mp3'],
    softHitPath: 'sounds/hit_soft1.mp3',
    bgm: null,
    bgmTracks: {},
    currentBgmKey: 'default',
    _isMuted: false,

    get isMuted() {
        return this._isMuted;
    },
    set isMuted(val) {
        this._isMuted = val;
        if (this.bgm) {
            if (val) {
                this.bgm.pause();
            } else {
                this.bgm.play().catch(e => console.warn("BGM resume error:", e));
            }
        }
    },

    getContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    },

    createFallbackPool(path, poolSize = 4) {
        const pool = [];
        for (let i = 0; i < poolSize; i++) {
            const a = new Audio(path);
            a.preload = 'auto';
            pool.push(a);
        }
        this.fallbackPools[path] = pool;
        this.fallbackIndex[path] = 0;
    },

    loadSoundBuffer(path) {
        const ctx = this.getContext();
        if (!ctx || typeof fetch !== 'function') return;

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.arrayBuffer();
            })
            .then(arr => new Promise((resolve, reject) => {
                const p = ctx.decodeAudioData(arr, resolve, reject);
                if (p && typeof p.then === 'function') p.then(resolve, reject);
            }))
            .then(buf => {
                this.buffers[path] = buf;
            })
            .catch(() => {
                // file:// 等で fetch/decode に失敗した場合はフォールバックプールを使用
            });
    },

    playBufferOrFallback(path, volume = 1.0) {
        if (this.isMuted) return;

        const ctx = this.getContext();
        const buf = this.buffers[path];
        if (ctx && buf) {
            try {
                const source = ctx.createBufferSource();
                source.buffer = buf;
                const gainNode = ctx.createGain();
                gainNode.gain.value = volume;
                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                source.start(0);
                return;
            } catch (e) {
                // フォールバックへ
            }
        }

        const pool = this.fallbackPools[path];
        if (pool && pool.length > 0) {
            const idx = this.fallbackIndex[path] || 0;
            this.fallbackIndex[path] = (idx + 1) % pool.length;
            const audio = pool[idx];
            try {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = volume;
                audio.play().catch(() => {});
            } catch (err) {
                // 無視
            }
        }
    },

    init() {
        const allPaths = [this.softHitPath, ...this.smashPaths, ...this.cheerPaths];
        allPaths.forEach(path => {
            this.createFallbackPool(path, 4);
            this.loadSoundBuffer(path);
        });

        // BGM の初期化 (通常: BGM.mp3 / LV.2-3: BGM2.mp3 / LV.MAX: BGM3.mp3)
        const bgmPaths = {
            default: 'sounds/BGM.mp3',
            lv23: 'sounds/BGM2.mp3',
            lvMax: 'sounds/BGM3.mp3'
        };
        Object.keys(bgmPaths).forEach(key => {
            const track = new Audio(bgmPaths[key]);
            track.loop = true;
            track.preload = 'auto';
            track.volume = 0.15;
            this.bgmTracks[key] = track;
        });
        this.currentBgmKey = 'default';
        this.bgm = this.bgmTracks.default;

        // iOS / iPad Safari 対応のオーディオアンロック処理
        const unlock = () => {
            const ctx = this.getContext();
            if (ctx) {
                if (ctx.state === 'suspended') {
                    ctx.resume().catch(() => {});
                }
                if (!this.isUnlocked) {
                    try {
                        const silentBuf = ctx.createBuffer(1, 1, 22050);
                        const src = ctx.createBufferSource();
                        src.buffer = silentBuf;
                        src.connect(ctx.destination);
                        src.start(0);
                    } catch (e) {
                        // 無視
                    }
                    // まだデコードされていないSEがあれば再試行
                    allPaths.forEach(path => {
                        if (!this.buffers[path]) this.loadSoundBuffer(path);
                    });
                }
            }
            this.isUnlocked = true;

            if (!this.isMuted && this.bgm && this.bgm.paused) {
                this.bgm.play().catch(e => console.warn("BGM play error on unlock:", e));
            }
        };

        window.addEventListener('touchstart', unlock, { passive: true });
        window.addEventListener('touchend', unlock, { passive: true });
        window.addEventListener('mousedown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
    },

    playHit(isSmash = false) {
        if (this.isMuted) return;

        let path;
        if (isSmash) {
            if (this.smashPaths.length > 0) {
                const idx = Math.floor(Math.random() * this.smashPaths.length);
                path = this.smashPaths[idx];
            }
        } else {
            path = this.softHitPath;
        }

        if (!path) return;
        this.playBufferOrFallback(path, isSmash ? 1.0 : 0.85);
    },

    setBGMByLevel(level) {
        let nextKey = 'default';
        if (level === 4) {
            nextKey = 'lvMax';
        } else if (level === 2 || level === 3) {
            nextKey = 'lv23';
        }

        if (this.currentBgmKey === nextKey && this.bgm) {
            if (!this.isMuted && this.bgm.paused) {
                this.bgm.play().catch(e => console.warn("BGM play error:", e));
            }
            return;
        }

        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }

        this.currentBgmKey = nextKey;
        this.bgm = this.bgmTracks[nextKey] || this.bgmTracks.default;

        if (!this.isMuted && this.bgm) {
            this.bgm.currentTime = 0;
            this.bgm.play().catch(e => console.warn("BGM switch play error:", e));
        }
    },

    playCheer() {
        if (this.isMuted) return;
        if (this.cheerPaths.length > 0) {
            const idx = Math.floor(Math.random() * this.cheerPaths.length);
            this.playBufferOrFallback(this.cheerPaths[idx], 0.75);
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    BadmintonAudio.init();
});