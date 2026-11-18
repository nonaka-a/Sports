const BadmintonAudio = {
    hitSound: null,
    smashSounds: [],
    cheerSounds: [],
    bgm: null,
    bgmTracks: {},
    currentBgmKey: 'default',
    _isMuted: false,

    // 既存の UI 側の properties 直接参照を維持しつつ、BGMの再生制御を連動
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

    init() {
        // 効果音の初期化
        this.hitSound = new Audio('sounds/hit_soft1.mp3');
        this.hitSound.preload = 'auto';
        
        const fileNames = ['sounds/Hit1.mp3', 'sounds/hit2.mp3', 'sounds/hit3.mp3'];
        this.smashSounds = fileNames.map(path => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            return audio;
        });

        // 歓声（歓声1, 歓声2）の初期化
        const cheerNames = ['sounds/kansei1.mp3', 'sounds/kansei2.mp3'];
        this.cheerSounds = cheerNames.map(path => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            return audio;
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
        
        // 初回画面インタラクション時にブラウザのオーディオ制限を解除
        const unlock = () => {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') context.resume();
            
            // ミュート状態でなければBGMの再生をここで開始
            if (!this.isMuted && this.bgm) {
                this.bgm.play().catch(e => console.warn("BGM play error on unlock:", e));
            }

            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('click', unlock);
        };
        window.addEventListener('touchstart', unlock);
        window.addEventListener('click', unlock);
    },

    playHit(isSmash = false) {
        if (this.isMuted) return;
        
        let sound;
        if (isSmash) {
            if (this.smashSounds.length > 0) {
                const idx = Math.floor(Math.random() * this.smashSounds.length);
                sound = this.smashSounds[idx];
            }
        } else {
            sound = this.hitSound;
        }
        
        if (!sound) return;
        try {
            const clone = sound.cloneNode();
            clone.volume = isSmash ? 1.0 : 0.85;
            clone.play().catch(e => console.warn("Audio play error:", e));
        } catch (err) {
            console.warn("Audio error:", err);
        }
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

    // 歓声のランダム再生用メソッド
    playCheer() {
        if (this.isMuted) return;
        if (this.cheerSounds.length > 0) {
            const idx = Math.floor(Math.random() * this.cheerSounds.length);
            const sound = this.cheerSounds[idx];
            try {
                const clone = sound.cloneNode();
                clone.volume = 0.75; // 歓声の音量をやや抑えめに調整
                clone.play().catch(e => console.warn("Cheer play error:", e));
            } catch (err) {
                console.warn("Cheer clone play error:", err);
            }
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    BadmintonAudio.init();
});