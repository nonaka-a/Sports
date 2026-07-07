const BadmintonAudio = {
    hitSound: null,
    smashSound: null,
    init() {
        this.hitSound = new Audio('sounds/hit_soft1.mp3');
        this.hitSound.preload = 'auto';
        this.smashSound = new Audio('sounds/hit3.mp3');
        this.smashSound.preload = 'auto';
        
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
        const sound = isSmash ? this.smashSound : this.hitSound;
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