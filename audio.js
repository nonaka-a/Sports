const BadmintonAudio = {
    hitSound: null,
    smashSounds: [],
    isMuted: false,
    init() {
        this.hitSound = new Audio('sounds/hit_soft1.mp3');
        this.hitSound.preload = 'auto';
        
        const fileNames = ['sounds/Hit1.mp3', 'sounds/hit2.mp3', 'sounds/hit3.mp3'];
        this.smashSounds = fileNames.map(path => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            return audio;
        });
        
        const unlock = () => {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') context.resume();
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
    }
};

window.addEventListener('DOMContentLoaded', () => {
    BadmintonAudio.init();
});