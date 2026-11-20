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
                    audioBtn.classList.toggle('is-off', BadmintonAudio.isMuted);
                }
            });
        }

        // フルスクリーン切り替え
        const fullscreenBtn = document.getElementById('toggle-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
            const updateFSBtnText = () => {
                const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
                fullscreenBtn.innerText = isFS ? "窓表示" : "全画面";
                fullscreenBtn.classList.toggle('is-off', Boolean(isFS));
            };
            document.addEventListener('fullscreenchange', updateFSBtnText);
            document.addEventListener('webkitfullscreenchange', updateFSBtnText);
            document.addEventListener('mozfullscreenchange', updateFSBtnText);
            document.addEventListener('MSFullscreenChange', updateFSBtnText);
        }

        // タイトル初期表示のセットアップフロー
        const playBadmintonBtn = document.getElementById('play-badminton-btn');
        const playTableTennisBtn = document.getElementById('play-tabletennis-btn');
        const setupBackBtn = document.getElementById('setup-back-btn');
        const titleMainZone = document.getElementById('title-main-zone');
        const gameSetupZone = document.getElementById('game-setup-zone');
        const setupHeader = document.querySelector('.setup-header');
        const pointContainer = document.querySelector('.point-select-container');
        const pointGroup = pointContainer ? pointContainer.closest('.setup-group') : null;

        const openSetupForSport = (sport) => {
            if (this.callbacks && typeof this.callbacks.onSelectSport === 'function') {
                this.callbacks.onSelectSport(sport);
            }
            if (setupHeader) {
                setupHeader.innerText = sport === 'tabletennis'
                    ? 'TABLE TENNIS - MATCH SETUP'
                    : 'BADMINTON - MATCH SETUP';
            }
            if (pointGroup) {
                pointGroup.style.display = sport === 'tabletennis' ? 'none' : 'flex';
            }
            if (titleMainZone) titleMainZone.style.display = 'none';
            if (gameSetupZone) gameSetupZone.style.display = 'flex';
        };

        if (playBadmintonBtn) {
            playBadmintonBtn.addEventListener('click', () => openSetupForSport('badminton'));
        }

        if (playTableTennisBtn) {
            playTableTennisBtn.addEventListener('click', () => openSetupForSport('tabletennis'));
        }

        if (setupBackBtn && titleMainZone && gameSetupZone) {
            setupBackBtn.addEventListener('click', () => {
                gameSetupZone.style.display = 'none';
                titleMainZone.style.display = 'flex';
            });
        }

        // 設定の選択状態の更新トグル
        const courtOpts = document.querySelectorAll('.court-opt');
        courtOpts.forEach(btn => {
            btn.addEventListener('click', () => {
                courtOpts.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        const levelOpts = document.querySelectorAll('.level-opt');
        levelOpts.forEach(btn => {
            btn.addEventListener('click', () => {
                levelOpts.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        const pointOpts = document.querySelectorAll('.point-opt');
        pointOpts.forEach(btn => {
            btn.addEventListener('click', () => {
                pointOpts.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    },

    toggleSettings(show) {
        const isWaiting = (typeof gameState !== 'undefined' && gameState === 'waiting');
        this.isPaused = show && !isWaiting;

        const menu = document.getElementById('settings-menu');
        if (menu) {
            const tag = menu.querySelector('.panel-header-tag');
            const title = menu.querySelector('h2');
            const resumeBtn = document.getElementById('resume-btn');
            const backBtn = document.getElementById('menu-back-to-title');

            if (tag) tag.innerText = isWaiting ? 'SYSTEM SETTINGS' : 'MATCH PAUSED';
            if (title) title.innerText = isWaiting ? 'SETTINGS' : 'PAUSED';
            if (resumeBtn) resumeBtn.innerText = isWaiting ? '閉じる' : '試合を再開';
            if (backBtn) backBtn.style.display = isWaiting ? 'none' : 'block';

            menu.style.display = show ? 'flex' : 'none';
        }
        if (this.callbacks && typeof this.callbacks.onPauseToggle === 'function') {
            this.callbacks.onPauseToggle(this.isPaused);
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
        const titleMainZone = document.getElementById('title-main-zone');
        const gameSetupZone = document.getElementById('game-setup-zone');

        if (start) start.style.display = show ? 'flex' : 'none';
        if (ui) ui.style.display = show ? 'none' : 'flex';

        if (show) {
            if (titleMainZone) titleMainZone.style.display = 'flex';
            if (gameSetupZone) gameSetupZone.style.display = 'none';
        }
    },

    showResult(playerScore, npcScore) {
        const resultScreen = document.getElementById('result-screen');
        const resultContent = resultScreen ? resultScreen.querySelector('.result-content') : null;
        const resultTitle = document.getElementById('result-title');
        const resultScore = document.getElementById('result-score');
        const ui = document.getElementById('ui-layer');

        const isWin = playerScore > npcScore;
        if (resultTitle) {
            if (isWin) {
                resultTitle.innerText = "YOU WIN!";
                resultTitle.style.color = "#34c759";
            } else {
                resultTitle.innerText = "YOU LOSE...";
                resultTitle.style.color = "#ff3b30";
            }
        }
        if (resultContent) {
            resultContent.classList.toggle('lose', !isWin);
        }

        if (resultScore) resultScore.innerText = `${playerScore} - ${npcScore}`;
        if (resultScreen) resultScreen.style.display = 'flex';
        if (ui) ui.style.display = 'none';
    },

    hideResult() {
        const resultScreen = document.getElementById('result-screen');
        if (resultScreen) resultScreen.style.display = 'none';
    },

    setSportUI(sport) {
        const uiLayer = document.getElementById('ui-layer');
        const hitLabel = document.getElementById('hit-btn-label');
        const cutBtn = document.getElementById('cut-button');
        const modeTag = document.getElementById('power-mode-tag');
        const isTT = (sport === 'tabletennis');

        if (uiLayer) uiLayer.classList.toggle('sport-tabletennis', isTT);
        if (hitLabel) hitLabel.innerText = isTT ? 'UP' : 'HIT';
        if (cutBtn) cutBtn.style.display = isTT ? 'flex' : 'none';
        if (modeTag) {
            modeTag.innerText = isTT ? 'DRIVE' : 'SMASH';
            modeTag.classList.remove('is-cut');
        }
    },

    updatePowerBar(percent, chargeMode = 'up', sport = 'badminton') {
        const fill = document.getElementById('power-fill');
        const meter = document.getElementById('power-meter');
        const modeTag = document.getElementById('power-mode-tag');
        const isTT = (sport === 'tabletennis');
        const isCut = (isTT && chargeMode === 'down');

        if (fill) fill.style.width = `${percent}%`;
        if (meter) {
            meter.classList.toggle('cut-mode', isCut);
            meter.classList.toggle('smash-ready', !isCut && percent >= 50);
            meter.classList.toggle('cut-ready', isCut && percent >= 50);
            meter.classList.toggle('max-power', percent >= 95);
        }
        if (modeTag) {
            modeTag.innerText = isTT ? (isCut ? 'CUT' : 'DRIVE') : 'SMASH';
            modeTag.classList.toggle('is-cut', isCut);
        }
    }
};