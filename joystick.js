const FloatingJoystick = {
    active: false,
    dir: { x: 0, y: 0 },
    joyKeys: { w: false, a: false, s: false, d: false },

    maxRadius: 56,
    deadZone: 0.16,
    directionThreshold: 0.30,

    originX: 0,
    originY: 0,
    activeTouchId: null,
    isMouseActive: false,

    baseEl: null,
    knobEl: null,
    onChangeCallback: null,

    init(options = {}) {
        this.onChangeCallback = typeof options.onChange === 'function' ? options.onChange : null;

        // レイアウト位置（HITボタンを右端に保つ幅）を維持したまま左下D-Padを非表示・無効化
        const dpadZone = document.getElementById('dpad-zone');
        if (dpadZone) {
            dpadZone.style.visibility = 'hidden';
            dpadZone.style.pointerEvents = 'none';
            dpadZone.querySelectorAll('.dpad-btn').forEach(btn => {
                btn.style.pointerEvents = 'none';
            });
        }

        this.createDOM();
        this.bindEvents();
    },

    createDOM() {
        if (this.baseEl) return;

        const base = document.createElement('div');
        base.id = 'floating-joystick-base';
        Object.assign(base.style, {
            position: 'fixed',
            left: '0px',
            top: '0px',
            width: `${this.maxRadius * 2}px`,
            height: `${this.maxRadius * 2}px`,
            marginLeft: `-${this.maxRadius}px`,
            marginTop: `-${this.maxRadius}px`,
            borderRadius: '50%',
            background: 'rgba(16, 22, 34, 0.68)',
            border: '2px solid rgba(255, 255, 255, 0.42)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45), inset 0 0 14px rgba(255, 255, 255, 0.08)',
            pointerEvents: 'none',
            zIndex: '1500',
            display: 'none',
            boxSizing: 'border-box'
        });

        const knobSize = 48;
        const knob = document.createElement('div');
        knob.id = 'floating-joystick-knob';
        Object.assign(knob.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            marginLeft: `-${knobSize / 2}px`,
            marginTop: `-${knobSize / 2}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #ffbe55, #ff8c00 72%, #c95f00 100%)',
            border: '2px solid rgba(255, 255, 255, 0.85)',
            boxShadow: '0 4px 12px rgba(255, 140, 0, 0.55)',
            transform: 'translate3d(0px, 0px, 0px)',
            boxSizing: 'border-box'
        });

        base.appendChild(knob);
        document.body.appendChild(base);

        this.baseEl = base;
        this.knobEl = knob;
    },

    canActivate(clientX, target) {
        const uiLayer = document.getElementById('ui-layer');
        if (!uiLayer || uiLayer.style.display === 'none') return false;
        if (typeof UIManager !== 'undefined' && UIManager.isPaused) return false;
        if (typeof gameState !== 'undefined' && (gameState === 'waiting' || gameState === 'ended')) return false;

        // 画面の左半分のみ反応
        if (clientX > window.innerWidth * 0.5) return false;

        // ボタン・スコアボード・メニュー上の操作は除外
        if (target && target.closest('#settings-btn, #hit-button, #scoreboard, #settings-menu, #start-screen, #result-screen')) {
            return false;
        }
        return true;
    },

    startAt(clientX, clientY) {
        this.active = true;
        this.originX = clientX;
        this.originY = clientY;

        if (this.baseEl) {
            this.baseEl.style.left = `${clientX}px`;
            this.baseEl.style.top = `${clientY}px`;
            this.baseEl.style.display = 'block';
        }
        this.updateStick(clientX, clientY);
    },

    updateStick(clientX, clientY) {
        if (!this.active) return;

        const dx = clientX - this.originX;
        const dy = clientY - this.originY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, this.maxRadius);

        let offsetX = 0;
        let offsetY = 0;
        if (dist > 0.0001) {
            offsetX = (dx / dist) * clamped;
            offsetY = (dy / dist) * clamped;
        }

        if (this.knobEl) {
            this.knobEl.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0px)`;
        }

        const ratio = clamped / this.maxRadius;
        if (ratio < this.deadZone || dist < 0.0001) {
            this.dir.x = 0;
            this.dir.y = 0;
        } else {
            const adjusted = (ratio - this.deadZone) / (1 - this.deadZone);
            this.dir.x = (dx / dist) * adjusted;
            this.dir.y = (dy / dist) * adjusted;
        }

        this.joyKeys.a = this.dir.x < -this.directionThreshold;
        this.joyKeys.d = this.dir.x > this.directionThreshold;
        this.joyKeys.w = this.dir.y < -this.directionThreshold;
        this.joyKeys.s = this.dir.y > this.directionThreshold;

        if (this.onChangeCallback) this.onChangeCallback();
    },

    reset() {
        this.active = false;
        this.activeTouchId = null;
        this.isMouseActive = false;
        this.dir.x = 0;
        this.dir.y = 0;
        this.joyKeys.w = false;
        this.joyKeys.a = false;
        this.joyKeys.s = false;
        this.joyKeys.d = false;

        if (this.baseEl) {
            this.baseEl.style.display = 'none';
        }
        if (this.knobEl) {
            this.knobEl.style.transform = 'translate3d(0px, 0px, 0px)';
        }
        if (this.onChangeCallback) this.onChangeCallback();
    },

    bindEvents() {
        // タッチ操作（右手のHITボタンとのマルチタッチ対応）
        window.addEventListener('touchstart', (e) => {
            if (this.activeTouchId !== null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (this.canActivate(t.clientX, e.target)) {
                    e.preventDefault();
                    this.activeTouchId = t.identifier;
                    this.isMouseActive = false;
                    this.startAt(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === this.activeTouchId) {
                    e.preventDefault();
                    this.updateStick(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            if (this.activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.activeTouchId) {
                    this.reset();
                    break;
                }
            }
        };
        window.addEventListener('touchend', endTouch, { passive: true });
        window.addEventListener('touchcancel', endTouch, { passive: true });

        // マウスクリック＆ドラッグ操作
        window.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || this.activeTouchId !== null) return;
            if (this.canActivate(e.clientX, e.target)) {
                this.isMouseActive = true;
                this.startAt(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isMouseActive) return;
            this.updateStick(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            if (this.isMouseActive) {
                this.reset();
            }
        });

        window.addEventListener('blur', () => {
            this.reset();
        });
    }
};