const UIManager = {
    isPaused: false,
    callbacks: null,

    init(callbacks) {
        this.callbacks = callbacks;
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggleSettings(true));
        }
        
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => this.toggleSettings(false));
        }

        const menuBackBtn = document.getElementById('menu-back-to-title');
        if (menuBackBtn) {
            menuBackBtn.addEventListener('click', () => {
                if (this.callbacks && this.callbacks.onBackToTitle) {
                    this.callbacks.onBackToTitle();
                }
            });
        }

        const resultBackBtn = document.getElementById('result-back-to-title');
        if (resultBackBtn) {
            resultBackBtn.addEventListener('click', () => {
                if (this.callbacks && this.callbacks.onBackToTitle) {
                    this.callbacks.onBackToTitle();
                }
            });
        }

        // 音のオン・オフ切り替え
        const audioBtn = document.getElementById('toggle-audio-btn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                if (typeof BadmintonAudio !== 'undefined') {
                    BadmintonAudio.isMuted = !BadmintonAudio.isMuted;
                    audioBtn.innerText = BadmintonAudio.isMuted ? "音 OFF" : "音 ON";
                    audioBtn.style.background = BadmintonAudio.isMuted ? "#555" : "#333";
                }
            });
        }

        // フルスクリーン切り替え
        const fullscreenBtn = document.getElementById('toggle-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
            // フルスクリーン状態が変わった時にボタンの見た目を調整するイベントリスナー
            const updateFSBtnText = () => {
                const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
                fullscreenBtn.innerText = isFS ? "窓表示" : "全画面";
                fullscreenBtn.style.background = isFS ? "#555" : "#333";
            };
            document.addEventListener('fullscreenchange', updateFSBtnText);
            document.addEventListener('webkitfullscreenchange', updateFSBtnText);
            document.addEventListener('mozfullscreenchange', updateFSBtnText);
            document.addEventListener('MSFullscreenChange', updateFSBtnText);
        }
    },

    toggleSettings(show) {
        this.isPaused = show;
        const menu = document.getElementById('settings-menu');
        if (menu) menu.style.display = show ? 'flex' : 'none';
        if (this.callbacks && typeof this.callbacks.onPauseToggle === 'function') {
            this.callbacks.onPauseToggle(show);
        }
    },

    toggleFullscreen() {
        const docEl = document.documentElement;
        const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
        const exitFS = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;

        const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

        if (!isFS) {
            if (requestFS) {
                requestFS.call(docEl).catch(err => console.warn("Fullscreen error:", err));
            }
        } else {
            if (exitFS) {
                exitFS.call(document);
            }
        }
    },

    showStartScreen(show) {
        const start = document.getElementById('start-screen');
        const ui = document.getElementById('ui-layer');
        if (start) start.style.display = show ? 'flex' : 'none';
        if (ui) ui.style.display = show ? 'none' : 'flex';
    },

    showResult(playerScore, npcScore) {
        const resultScreen = document.getElementById('result-screen');
        const resultTitle = document.getElementById('result-title');
        const resultScore = document.getElementById('result-score');
        const ui = document.getElementById('ui-layer');
        
        if (resultTitle) {
            if (playerScore > npcScore) {
                resultTitle.innerText = "YOU WIN!";
                resultTitle.style.color = "#34c759";
            } else {
                resultTitle.innerText = "YOU LOSE...";
                resultTitle.style.color = "#ff3b30";
            }
        }
        
        if (resultScore) resultScore.innerText = `${playerScore} - ${npcScore}`;
        if (resultScreen) resultScreen.style.display = 'flex';
        // リザルト表示中はUI（十字キーや設定ボタン）を隠す
        if (ui) ui.style.display = 'none'; 
    },

    hideResult() {
        const resultScreen = document.getElementById('result-screen');
        if (resultScreen) resultScreen.style.display = 'none';
    },

    updatePowerBar(percent) {
        const fill = document.getElementById('power-fill');
        if (fill) fill.style.width = `${percent}%`;
    }
};