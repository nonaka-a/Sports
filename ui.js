const UIManager = {
    isPaused: false,
    isMenuOpen: false,
    currentSport: 'tabletennis',
    currentPlayMode: 'cpu',
    currentOnlineTab: 'host',
    callbacks: null,
    _powerFillEl: null,
    _powerMeterEl: null,
    _powerModeTagEl: null,
    _lastPowerPercent: -1,
    _lastPowerIsCut: null,
    _lastPowerSport: null,

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

        const openSetupForSport = (sport) => {
            this.currentSport = sport;
            if (sport !== 'tabletennis') {
                this.setPlayMode('cpu');
            } else {
                this.refreshSetupVisibility();
            }
            if (this.callbacks && typeof this.callbacks.onSelectSport === 'function') {
                this.callbacks.onSelectSport(sport);
            }
            if (setupHeader) {
                setupHeader.innerText = sport === 'tabletennis'
                    ? 'TABLE TENNIS - MATCH SETUP'
                    : 'BADMINTON - MATCH SETUP';
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
                if (typeof TTNetwork !== 'undefined') {
                    TTNetwork.disconnect();
                }
                this.resetOnlinePanelUI();
                gameSetupZone.style.display = 'none';
                titleMainZone.style.display = 'flex';
            });
        }

        // PLAY MODE (CPU対戦 / 通信対戦)
        const playModeOpts = document.querySelectorAll('.playmode-opt');
        playModeOpts.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setPlayMode(btn.dataset.playmode);
            });
        });

        // 通信対戦タブ (部屋を作る / 部屋に入る)
        const onlineTabBtns = document.querySelectorAll('.online-tab-btn');
        onlineTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof TTNetwork !== 'undefined' && TTNetwork.status !== 'idle') {
                    TTNetwork.disconnect();
                    this.resetOnlinePanelUI();
                }
                this.setOnlineTab(btn.dataset.onlinetab);
            });
        });

        // IDコピー
        const copyBtn = document.getElementById('online-copy-btn');
        const roomIdText = document.getElementById('online-room-id-text');
        if (copyBtn && roomIdText) {
            copyBtn.addEventListener('click', () => {
                const txt = roomIdText.innerText.trim();
                if (!txt || txt === '------') return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(txt).then(() => {
                        copyBtn.innerText = 'コピー済';
                        setTimeout(() => { copyBtn.innerText = 'コピー'; }, 1500);
                    }).catch(() => {});
                }
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

    setPlayMode(mode) {
        this.currentPlayMode = (mode === 'online' && this.currentSport === 'tabletennis') ? 'online' : 'cpu';
        document.querySelectorAll('.playmode-opt').forEach(b => {
            b.classList.toggle('active', b.dataset.playmode === this.currentPlayMode);
        });
        if (this.currentPlayMode === 'cpu' && typeof TTNetwork !== 'undefined') {
            TTNetwork.disconnect();
            this.resetOnlinePanelUI();
        }
        this.refreshSetupVisibility();
    },

    setOnlineTab(tab) {
        this.currentOnlineTab = tab === 'guest' ? 'guest' : 'host';
        document.querySelectorAll('.online-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.onlinetab === this.currentOnlineTab);
        });
        const hostPane = document.getElementById('online-host-pane');
        const guestPane = document.getElementById('online-guest-pane');
        if (hostPane) hostPane.style.display = this.currentOnlineTab === 'host' ? 'flex' : 'none';
        if (guestPane) guestPane.style.display = this.currentOnlineTab === 'guest' ? 'flex' : 'none';
        this.refreshSetupVisibility();
    },

    refreshSetupVisibility() {
        const isTT = (this.currentSport === 'tabletennis');
        const isOnline = (isTT && this.currentPlayMode === 'online');

        const playModeGroup = document.getElementById('playmode-setup-group');
        const courtGroup = document.getElementById('court-setup-group');
        const levelGroup = document.getElementById('level-setup-group');
        const pointGroup = document.getElementById('point-setup-group');
        const onlinePanel = document.getElementById('online-setup-panel');
        const finalStartBtn = document.getElementById('final-start-btn');

        if (playModeGroup) playModeGroup.style.display = isTT ? 'flex' : 'none';
        if (pointGroup) pointGroup.style.display = isTT ? 'none' : 'flex';
        if (levelGroup) levelGroup.style.display = isOnline ? 'none' : 'flex';
        if (courtGroup) {
            courtGroup.style.display = (isOnline && this.currentOnlineTab === 'guest') ? 'none' : 'flex';
        }
        if (onlinePanel) onlinePanel.style.display = isOnline ? 'flex' : 'none';
        if (finalStartBtn) finalStartBtn.style.display = isOnline ? 'none' : 'inline-block';
    },

    setOnlineStatus(msg, isError = false) {
        const el = document.getElementById('online-status-text');
        if (el) {
            el.innerText = msg || '';
            el.classList.toggle('is-error', Boolean(isError));
        }
    },

    resetOnlinePanelUI() {
        const createBtn = document.getElementById('online-create-btn');
        const joinBtn = document.getElementById('online-join-btn');
        const roomBox = document.getElementById('online-room-box');
        const roomIdText = document.getElementById('online-room-id-text');
        if (createBtn) createBtn.disabled = false;
        if (joinBtn) joinBtn.disabled = false;
        if (roomBox) roomBox.style.display = 'none';
        if (roomIdText) roomIdText.innerText = '------';
        this.setOnlineStatus('');
    },

    setOpponentLabel(labelText) {
        const npcScoreLabel = document.getElementById('npc-score-label');
        const resultOppLabel = document.getElementById('result-opponent-label');
        if (npcScoreLabel) npcScoreLabel.innerText = labelText;
        if (resultOppLabel) resultOppLabel.innerText = labelText;
    },

    toggleSettings(show) {
        const isWaiting = (typeof gameState !== 'undefined' && gameState === 'waiting');
        const isOnlineMatch = (typeof TTNetwork !== 'undefined' && TTNetwork.isOnline);
        this.isMenuOpen = Boolean(show);
        this.isPaused = show && !isWaiting && !isOnlineMatch;

        const menu = document.getElementById('settings-menu');
        if (menu) {
            const tag = menu.querySelector('.panel-header-tag');
            const title = menu.querySelector('h2');
            const resumeBtn = document.getElementById('resume-btn');
            const backBtn = document.getElementById('menu-back-to-title');

            if (tag) {
                tag.innerText = isWaiting
                    ? 'SYSTEM SETTINGS'
                    : (isOnlineMatch ? 'ONLINE MENU' : 'MATCH PAUSED');
            }
            if (title) {
                title.innerText = isWaiting ? 'SETTINGS' : (isOnlineMatch ? 'MENU' : 'PAUSED');
            }
            if (resumeBtn) {
                resumeBtn.innerText = isWaiting ? '閉じる' : (isOnlineMatch ? '試合に戻る' : '試合を再開');
            }
            if (backBtn) backBtn.style.display = isWaiting ? 'none' : 'block';

            menu.style.display = show ? 'flex' : 'none';
        }
        if (this.callbacks && typeof this.callbacks.onPauseToggle === 'function') {
            this.callbacks.onPauseToggle(this.isPaused, this.isMenuOpen);
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
            this.resetOnlinePanelUI();
            if (titleMainZone) titleMainZone.style.display = 'flex';
            if (gameSetupZone) gameSetupZone.style.display = 'none';
        }
    },

    showResult(playerScore, npcScore, customTitle = null) {
        const resultScreen = document.getElementById('result-screen');
        const resultContent = resultScreen ? resultScreen.querySelector('.result-content') : null;
        const resultTitle = document.getElementById('result-title');
        const resultScore = document.getElementById('result-score');
        const ui = document.getElementById('ui-layer');

        const isWin = playerScore > npcScore;
        if (resultTitle) {
            if (customTitle) {
                resultTitle.innerText = customTitle;
                resultTitle.style.color = "#ff9500";
            } else if (isWin) {
                resultTitle.innerText = "YOU WIN!";
                resultTitle.style.color = "#34c759";
            } else {
                resultTitle.innerText = "YOU LOSE...";
                resultTitle.style.color = "#ff3b30";
            }
        }
        if (resultContent) {
            resultContent.classList.toggle('lose', Boolean(customTitle) || !isWin);
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
        const isTT = (sport === 'tabletennis');
        const isCut = (isTT && chargeMode === 'down');

        if (this._lastPowerPercent === percent && this._lastPowerIsCut === isCut && this._lastPowerSport === sport) {
            return;
        }

        if (!this._powerFillEl) this._powerFillEl = document.getElementById('power-fill');
        if (!this._powerMeterEl) this._powerMeterEl = document.getElementById('power-meter');
        if (!this._powerModeTagEl) this._powerModeTagEl = document.getElementById('power-mode-tag');

        const fill = this._powerFillEl;
        const meter = this._powerMeterEl;
        const modeTag = this._powerModeTagEl;

        if (fill && this._lastPowerPercent !== percent) {
            fill.style.width = `${percent}%`;
        }
        if (meter) {
            meter.classList.toggle('cut-mode', isCut);
            meter.classList.toggle('smash-ready', !isCut && percent >= 50);
            meter.classList.toggle('cut-ready', isCut && percent >= 50);
            meter.classList.toggle('max-power', percent >= 95);
        }
        if (modeTag && (this._lastPowerIsCut !== isCut || this._lastPowerSport !== sport)) {
            modeTag.innerText = isTT ? (isCut ? 'CUT' : 'DRIVE') : 'SMASH';
            modeTag.classList.toggle('is-cut', isCut);
        }

        this._lastPowerPercent = percent;
        this._lastPowerIsCut = isCut;
        this._lastPowerSport = sport;
    }
};