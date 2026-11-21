const TableTennisGame = {
    core: null,
    rootGroup: null,
    playerGroup: null,
    npcGroup: null,
    playerBodies: null,
    npcBodies: null,
    activePlayerBody: null,
    activeNpcBody: null,
    ballGroup: null,
    ballShadow: null,

    // 卓球台のサイズ（ゲームプレイに適したスケール）
    tableWidth: 3.4,
    tableLength: 5.8,
    tableHeight: 1.05,
    netHeight: 0.25,
    ballRadius: 0.065,

    // プレイヤー移動範囲・打撃範囲（前後を狭め、左右端は飛びつき範囲として設定）
    playerSpeed: 4.2,
    npcBaseSpeed: 3.3,
    limitX: 2.75,
    playerZMin: 3.38,
    playerZMax: 5.5,
    npcZMin: -5.5,
    npcZMax: -3.38,
    hitRadius: 1.25,
    normalReachX: 0.78,
    maxReachX: 1.25,
    reachFrontZ: 1.53,
    reachBackZ: 0.30,
    middleThresholdX: 0.12,
    characterScale: 1.62,

    // 物理・ボール状態
    ballPos: new THREE.Vector3(0, 1.35, 3.2),
    ballVel: new THREE.Vector3(0, 0, 0),
    gravity: -12.5,
    ballSpinAccel: 0,
    ballHorizDrag: 0,
    ballCurveAccelX: 0,
    ballBounceScaleY: 0.82,
    ballBounceScaleZ: 0.97,
    airDrag: 0.015,

    // ルール進行状態（卓球は11点先取・デュース対応・2本交代/デュース時1本交代サーブ）
    ttMatchPoint: 11,
    lastHitter: 'player',
    receiverBounces: 0,
    lastReceiverBounceZ: null,
    isServeFirstBounce: false,
    isShortServeActive: false,
    netFault: false,
    incomingCutMissProb: 0,
    playerCanHit: true,
    npcCanHit: false,
    npcReactionTimer: 0,

    // 通信対戦用状態
    onlineMode: false,
    onlineRole: null, // 'host' | 'guest'
    onlineSeq: 0,
    onlineSyncTimer: 0,
    onlineBallSyncTimer: 0,
    remoteState: {
        targetX: 0,
        targetZ: -3.8,
        vx: 0,
        vz: 0,
        isCharging: false,
        chargeMode: 'up',
        chargeRatio: 0,
        hasSync: false
    },

    // サーブ・トス管理用
    servePhase: 'idle',
    serveTossVelY: 0,
    serveArmTime: 0,
    serveAutoFired: false,
    npcTossDelayTimer: 0,
    serveDestX: 0,
    serveDestZ: -1.5,
    serveFlightDuration: 0.50,
    serveFlightSpin: 0,
    serveFlightHorizDrag: 0,
    serveFlightCurveX: 0,
    serveNextBounceY: 0.82,
    serveNextBounceZ: 0.97,

    // アニメーション・バックハンド・飛びつき・感情表現・カメラ用
    playerSwingTime: -1,
    npcSwingTime: -1,
    playerHitType: 'fore',
    npcHitType: 'fore',
    playerDiveTime: -1,
    playerDiveDir: 0,
    playerRecoveryTime: 0,
    npcDiveTime: -1,
    npcDiveDir: 0,
    npcRecoveryTime: 0,
    playerEmotion: 'none',
    npcEmotion: 'none',
    emotionTime: 0,
    diveDuration: 0.40,
    recoveryDuration: 0.55,
    prevPlayerPos: new THREE.Vector3(0, 0, 3.8),
    prevNpcPos: new THREE.Vector3(0, 0, -3.8),
    playerStepPhase: 0,
    npcStepPhase: 0,
    cameraBasePos: new THREE.Vector3(0, 4.4, 8.6),
    chargeRing: null,
    chargeSparkTimer: 0,
    trailPoints: [],
    trailPointPool: [],
    trailMesh: null,
    trailIsSmash: false,
    trailMode: 'normal',
    trailMaxPoints: 14,

    // GC抑制用再利用オブジェクト
    _tmpVec3A: new THREE.Vector3(),
    _tmpVec3B: new THREE.Vector3(),
    _tmpVec3C: new THREE.Vector3(),
    _tmpVec3D: new THREE.Vector3(),
    _tmpVelOut: new THREE.Vector3(),
    _tmpPrevBallPos: new THREE.Vector3(),
    _predPos: new THREE.Vector3(),
    _predVel: new THREE.Vector3(),
    _predBounce: new THREE.Vector3(),
    _predHit: new THREE.Vector3(),
    _predResult: { bounce: null, hit: null },
    _animState: {
        isPlayer: true, vx: 0, vz: 0, isCharging: false, chargeMode: 'up', chargeRatio: 0,
        swingTime: -1, stepPhase: 0, hitType: 'fore', armMode: 'none',
        diveTime: -1, diveDuration: 0.40, diveDir: 0, recoveryTime: 0, idleTime: 0,
        emotion: 'none', emotionTime: 0
    },

    // WebAudio ピンポン音用コンテキスト
    audioCtx: null,

    init(core) {
        this.core = core;
        this.rootGroup = new THREE.Group();
        this.rootGroup.visible = false;

        this.buildTable();
        this.buildCharacters();
        this.buildBall();
        this.initTrail();

        this.core.scene.add(this.rootGroup);
    },

    setVisible(visible) {
        if (this.rootGroup) {
            this.rootGroup.visible = visible;
        }
        if (!visible) {
            this.resetTrail();
        }
    },

    setCharacterColors(playerIsBlue) {
        if (this.playerBodies) {
            this.playerBodies.red.visible = !playerIsBlue;
            this.playerBodies.blue.visible = playerIsBlue;
            this.activePlayerBody = playerIsBlue ? this.playerBodies.blue : this.playerBodies.red;
            TableTennisCharacter.resetPose(this.activePlayerBody);
        }
        if (this.npcBodies) {
            this.npcBodies.red.visible = playerIsBlue;
            this.npcBodies.blue.visible = !playerIsBlue;
            this.activeNpcBody = playerIsBlue ? this.npcBodies.red : this.npcBodies.blue;
            TableTennisCharacter.resetPose(this.activeNpcBody);
        }
        if (typeof UIManager !== 'undefined' && typeof UIManager.setTeamColors === 'function') {
            UIManager.setTeamColors(playerIsBlue);
        }
    },

    resetTitlePreview() {
        this.onlineMode = false;
        this.onlineRole = null;
        this.playerEmotion = 'none';
        this.npcEmotion = 'none';
        this.emotionTime = 0;
        this.setCharacterColors(false);
        if (this.playerGroup) {
            this.playerGroup.position.set(0, 0, 3.8);
            this.prevPlayerPos.copy(this.playerGroup.position);
            TableTennisCharacter.applyServeHoldPose(this.activePlayerBody);
        }
        if (this.npcGroup) {
            this.npcGroup.position.set(0, 0, -3.8);
            this.prevNpcPos.copy(this.npcGroup.position);
            TableTennisCharacter.resetPose(this.activeNpcBody);
        }
        if (this.activePlayerBody && TableTennisCharacter.getLeftHandWorldPosition(this.activePlayerBody, this._tmpVec3A)) {
            this.ballPos.set(this._tmpVec3A.x, this._tmpVec3A.y + 0.095, this._tmpVec3A.z);
        } else {
            this.ballPos.set(-0.34, 1.18, 3.40);
        }
        if (this.ballGroup) this.ballGroup.position.copy(this.ballPos);
        if (this.ballShadow) this.ballShadow.position.set(this.ballPos.x, 0.025, this.ballPos.z);
        this.resetTrail();
    },

    // TTVisual への委譲ラッパー
    playBounceSound(isPaddle = false) {
        TTVisual.playBounceSound(this, isPaddle);
    },
    buildTable() {
        TTVisual.buildTable(this);
    },
    createTableTennisRacket(rubberColor, accentColor) {
        return TTVisual.createTableTennisRacket(rubberColor, accentColor);
    },
    swapToTableTennisRacket(bodyMesh, rubberColor, accentColor) {
        TTVisual.swapToTableTennisRacket(bodyMesh, rubberColor, accentColor);
    },
    buildCharacters() {
        TTVisual.buildCharacters(this);
    },
    buildBall() {
        TTVisual.buildBall(this);
    },
    initTrail() {
        TTVisual.initTrail(this);
    },
    resetTrail() {
        TTVisual.resetTrail(this);
    },
    updateTrail(active) {
        TTVisual.updateTrail(this, active);
    },
    updateChargeVFX(dt) {
        TTVisual.updateChargeVFX(this, dt);
    },

    // TTPhysics への委譲ラッパー
    computeBallVelocity(start, target, duration, spinAccel = 0, horizDrag = 0, curveAccelX = 0) {
        return TTPhysics.computeBallVelocity(this, start, target, duration, spinAccel, horizDrag, curveAccelX);
    },
    serveBall(server, servePower = 30, mode = 'up') {
        TTPhysics.serveBall(this, server, servePower, mode);
    },
    getReachInfo(charPos, ballPos, isPlayer, maxReachXOverride = null) {
        return TTPhysics.getReachInfo(this, charPos, ballPos, isPlayer, maxReachXOverride);
    },
    checkInRange(charPos, ballPos, isPlayer = true, maxReachXOverride = null) {
        return TTPhysics.checkInRange(this, charPos, ballPos, isPlayer, maxReachXOverride);
    },
    hitBall(hitter, hitPower, reachInfo = null, mode = 'up') {
        TTPhysics.hitBall(this, hitter, hitPower, reachInfo, mode);
    },
    updateNPC(dt) {
        TTPhysics.updateNPC(this, dt);
    },
    predictBallInfo(targetZ) {
        return TTPhysics.predictBallInfo(this, targetZ);
    },

    // ホスト空間 ⇔ ゲスト空間の座標変換（X/Z符号反転で両者が手前視点になる）
    mirrorX(x) {
        return (this.onlineMode && this.onlineRole === 'guest') ? -x : x;
    },
    mirrorZ(z) {
        return (this.onlineMode && this.onlineRole === 'guest') ? -z : z;
    },

    getNextServerAfterPoint(pScore, nScore) {
        const totalPoints = pScore + nScore;
        if (totalPoints < 20) {
            return (Math.floor(totalPoints / 2) % 2 === 0) ? 'player' : 'npc';
        }
        // 10-10以降のデュースは1本交代サーブ
        return (totalPoints % 2 === 0) ? 'player' : 'npc';
    },

    isMatchFinished(pScore, nScore) {
        const maxS = Math.max(pScore, nScore);
        const minS = Math.min(pScore, nScore);
        return maxS >= this.ttMatchPoint && (maxS - minS >= 2);
    },

    startMatch(selectedCourtType, level, pts) {
        this.onlineMode = false;
        this.onlineRole = null;
        this.setCharacterColors(false);
        if (typeof UIManager !== 'undefined') UIManager.setOpponentLabel('NPC');

        if (typeof EnvironmentManager !== 'undefined') {
            EnvironmentManager.buildCourt(this.core.scene, selectedCourtType, {
                courtWidth: this.core.courtWidth,
                courtLength: this.core.courtLength,
                netHeight: this.core.netHeight,
                isTableTennis: true
            });
        }

        this.setVisible(true);
        this.cameraBasePos.set(0, 4.4, 8.6);
        this.core.camera.position.copy(this.cameraBasePos);
        this.core.camera.lookAt(0, 1.05, 0);

        playerScore = 0;
        npcScore = 0;
        const pVal = document.getElementById('player-score');
        const nVal = document.getElementById('npc-score');
        if (pVal) pVal.innerText = "0";
        if (nVal) nVal.innerText = "0";

        this.resetToServe('player');
    },

    startOnlineMatch(role, selectedCourtType) {
        this.onlineMode = true;
        this.onlineRole = role;
        // 親(host)=赤、ID入力側(guest)=青
        this.setCharacterColors(role === 'guest');
        this.onlineSeq = 0;
        this.onlineSyncTimer = 0;
        this.onlineBallSyncTimer = 0;
        this.remoteState.targetX = 0;
        this.remoteState.targetZ = -3.8;
        this.remoteState.vx = 0;
        this.remoteState.vz = 0;
        this.remoteState.isCharging = false;
        this.remoteState.chargeMode = 'up';
        this.remoteState.chargeRatio = 0;
        this.remoteState.hasSync = false;

        if (typeof UIManager !== 'undefined') UIManager.setOpponentLabel('RIVAL');

        if (typeof EnvironmentManager !== 'undefined') {
            EnvironmentManager.buildCourt(this.core.scene, selectedCourtType, {
                courtWidth: this.core.courtWidth,
                courtLength: this.core.courtLength,
                netHeight: this.core.netHeight,
                isTableTennis: true
            });
        }

        this.setVisible(true);
        this.cameraBasePos.set(0, 4.4, 8.6);
        this.core.camera.position.copy(this.cameraBasePos);
        this.core.camera.lookAt(0, 1.05, 0);

        playerScore = 0;
        npcScore = 0;
        const pVal = document.getElementById('player-score');
        const nVal = document.getElementById('npc-score');
        if (pVal) pVal.innerText = "0";
        if (nVal) nVal.innerText = "0";

        // ホスト先攻サーブで開始（ゲスト側は相手サーブ表示）
        this.resetToServe(role === 'host' ? 'player' : 'npc');
        if (this.core && typeof this.core.showBanner === 'function') {
            this.core.showBanner(role === 'host' ? "YOUR SERVE!" : "RIVAL SERVE!", "#0a84ff");
        }
    },

    resetToServe(nextServer) {
        if (this.core.activeSport !== 'tabletennis') return;

        this.playerGroup.position.set(0, 0, 3.8);
        this.npcGroup.position.set(0, 0, -3.8);
        this.prevPlayerPos.copy(this.playerGroup.position);
        this.prevNpcPos.copy(this.npcGroup.position);
        this.remoteState.targetX = 0;
        this.remoteState.targetZ = -3.8;
        this.remoteState.vx = 0;
        this.remoteState.vz = 0;
        this.remoteState.isCharging = false;
        this.remoteState.chargeRatio = 0;

        this.playerSwingTime = -1;
        this.npcSwingTime = -1;
        this.playerHitType = 'fore';
        this.npcHitType = 'fore';
        this.playerDiveTime = -1;
        this.playerDiveDir = 0;
        this.playerRecoveryTime = 0;
        this.npcDiveTime = -1;
        this.npcDiveDir = 0;
        this.npcRecoveryTime = 0;
        this.playerEmotion = 'none';
        this.npcEmotion = 'none';
        this.emotionTime = 0;
        this.resetTrail();

        power = 0;
        chargeMode = 'up';
        if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', 'tabletennis');
        isCharging = false;
        if (this.chargeRing) this.chargeRing.visible = false;
        this.chargeSparkTimer = 0;

        this.ballSpinAccel = 0;
        this.ballHorizDrag = 0;
        this.ballCurveAccelX = 0;
        this.serveFlightHorizDrag = 0;
        this.serveFlightCurveX = 0;
        this.ballBounceScaleY = 0.82;
        this.ballBounceScaleZ = 0.97;
        this.receiverBounces = 0;
        this.lastReceiverBounceZ = null;
        this.isServeFirstBounce = false;
        this.isShortServeActive = false;
        this.netFault = false;
        this.incomingCutMissProb = 0;
        this.npcReactionTimer = 0;
        this.servePhase = 'idle';
        this.serveTossVelY = 0;
        this.serveArmTime = 0;
        this.serveAutoFired = false;
        this.npcTossDelayTimer = 0;

        if (nextServer === 'player') {
            gameState = 'serve-player';
            this.lastHitter = 'player';
            this.playerCanHit = true;
            this.npcCanHit = false;
            TableTennisCharacter.applyServeHoldPose(this.activePlayerBody);
            TableTennisCharacter.resetPose(this.activeNpcBody);
            if (TableTennisCharacter.getLeftHandWorldPosition(this.activePlayerBody, this._tmpVec3A)) {
                this.ballPos.set(this._tmpVec3A.x, this._tmpVec3A.y + 0.095, this._tmpVec3A.z);
            } else {
                this.ballPos.set(this.playerGroup.position.x - 0.34, 1.18, this.playerGroup.position.z - 0.40);
            }
            this.ballVel.set(0, 0, 0);
        } else {
            gameState = 'serve-npc';
            this.lastHitter = 'npc';
            this.playerCanHit = false;
            this.npcCanHit = true;
            TableTennisCharacter.resetPose(this.activePlayerBody);
            TableTennisCharacter.applyServeHoldPose(this.activeNpcBody);
            if (TableTennisCharacter.getLeftHandWorldPosition(this.activeNpcBody, this._tmpVec3A)) {
                this.ballPos.set(this._tmpVec3A.x, this._tmpVec3A.y + 0.095, this._tmpVec3A.z);
            } else {
                this.ballPos.set(this.npcGroup.position.x + 0.34, 1.18, this.npcGroup.position.z + 0.40);
            }
            this.ballVel.set(0, 0, 0);
        }
    },

    resetVisualYaw(group, isPlayer) {
        const bodyM = group === this.playerGroup ? this.activePlayerBody : (group === this.npcGroup ? this.activeNpcBody : null);
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        if (visualRoot) {
            visualRoot.rotation.y = isPlayer ? Math.PI : 0;
        }
    },

    resetTossArm(group) {
        const bodyM = group === this.playerGroup ? this.activePlayerBody : (group === this.npcGroup ? this.activeNpcBody : null);
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        const leftArm = visualRoot ? visualRoot.getObjectByName("leftArm") : null;
        if (leftArm) {
            leftArm.rotation.set(0, 0, 0);
        }
    },

    updateTossArm(group, mode, dt) {
        const bodyM = group === this.playerGroup ? this.activePlayerBody : (group === this.npcGroup ? this.activeNpcBody : null);
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        const leftArm = visualRoot ? visualRoot.getObjectByName("leftArm") : null;
        if (!leftArm) return;
        let targetRotX = 0;
        if (mode === 'hold') targetRotX = -1.05;
        else if (mode === 'toss') targetRotX = -2.45;
        leftArm.rotation.x += (targetRotX - leftArm.rotation.x) * 16 * dt;
    },

    stopCharging(mode = 'up') {
        if (gameState === 'serve-player') {
            this.serveBall('player', power, mode);
        } else if (this.serveAutoFired) {
            this.serveAutoFired = false;
        } else if (gameState === 'rally' && this.playerCanHit && this.receiverBounces === 1) {
            const reach = this.getReachInfo(this.playerGroup.position, this.ballPos, true);
            if (reach.inRange && this.ballPos.z > 0.2) {
                this.hitBall('player', power, reach, mode);
            } else if (this.playerSwingTime < 0) {
                this.playerHitType = (mode === 'down')
                    ? 'cut'
                    : ((this.ballPos.x < this.playerGroup.position.x - this.middleThresholdX) ? 'back' : 'fore');
                this.playerSwingTime = 0;
            }
        } else if (gameState === 'rally' && this.playerSwingTime < 0) {
            this.playerHitType = (mode === 'down')
                ? 'cut'
                : ((this.ballPos.x < this.playerGroup.position.x - this.middleThresholdX) ? 'back' : 'fore');
            this.playerSwingTime = 0;
        }
        power = 0;
        if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', 'tabletennis');
    },

    // 通信対戦：相手からのデータ受信ハンドラ
    handleNetworkData(data) {
        if (!this.onlineMode || !data || !data.t) return;

        switch (data.t) {
            case 'player_state': {
                this.remoteState.targetX = this.mirrorX(data.x);
                this.remoteState.targetZ = this.mirrorZ(data.z);
                this.remoteState.vx = this.mirrorX(data.vx);
                this.remoteState.vz = this.mirrorZ(data.vz);
                this.remoteState.isCharging = Boolean(data.isCharging);
                this.remoteState.chargeMode = data.chargeMode || 'up';
                this.remoteState.chargeRatio = data.chargeRatio || 0;
                this.remoteState.hasSync = true;
                break;
            }

            case 'toss': {
                if (gameState === 'serve-npc' && this.servePhase !== 'toss') {
                    this.servePhase = 'toss';
                    this.serveTossVelY = 5.4;
                    this.serveArmTime = 0.35;
                    this.core.spawnRing(this.ballPos, 0xffffff, 0.15, 0.65, 0.22, false, 0.6);
                }
                break;
            }

            case 'host_serve':
            case 'guest_serve': {
                if (data.t === 'host_serve' && this.onlineRole !== 'guest') return;
                if (data.t === 'guest_serve' && this.onlineRole !== 'host') return;
                if (data.seq <= this.onlineSeq) return;
                this.onlineSeq = data.seq;

                this.ballPos.set(this.mirrorX(data.pos.x), data.pos.y, this.mirrorZ(data.pos.z));
                this.ballVel.set(this.mirrorX(data.vel.x), data.vel.y, this.mirrorZ(data.vel.z));
                this.serveDestX = this.mirrorX(data.serveDestX);
                this.serveDestZ = this.mirrorZ(data.serveDestZ);
                this.serveFlightDuration = data.serveFlightDuration;
                this.serveFlightSpin = data.serveFlightSpin;
                this.serveFlightHorizDrag = data.serveFlightHorizDrag || 0;
                this.serveFlightCurveX = this.mirrorX(data.serveFlightCurveX || 0);
                this.serveNextBounceY = data.serveNextBounceY;
                this.serveNextBounceZ = data.serveNextBounceZ;

                this.ballSpinAccel = 0;
                this.ballHorizDrag = 0;
                this.ballCurveAccelX = 0;
                this.ballBounceScaleY = 0.82;
                this.ballBounceScaleZ = 0.97;
                this.netFault = false;
                this.incomingCutMissProb = data.cutMissProb || 0;
                this.receiverBounces = 0;
                this.lastReceiverBounceZ = null;
                this.isServeFirstBounce = true;
                this.isShortServeActive = false;
                this.servePhase = 'idle';
                this.lastHitter = 'npc';
                this.playerCanHit = true;
                this.npcCanHit = false;
                this.npcHitType = data.hitType || 'fore';
                this.npcSwingTime = 0;
                this.trailMode = data.trailMode || 'normal';
                this.trailIsSmash = (this.trailMode === 'smash');
                gameState = 'rally';

                if (typeof BadmintonAudio !== 'undefined') {
                    BadmintonAudio.playHit(Boolean(data.isSmashSound));
                }
                this.core.spawnHitEffect(this.ballPos, data.effectType || 'lob');
                break;
            }

            case 'host_hit':
            case 'guest_hit': {
                if (data.t === 'host_hit' && this.onlineRole !== 'guest') return;
                if (data.t === 'guest_hit' && this.onlineRole !== 'host') return;
                if (data.seq <= this.onlineSeq) return;
                if (gameState !== 'rally') return;

                this.onlineSeq = data.seq;
                this.ballPos.set(this.mirrorX(data.pos.x), data.pos.y, this.mirrorZ(data.pos.z));
                this.ballVel.set(this.mirrorX(data.vel.x), data.vel.y, this.mirrorZ(data.vel.z));
                this.ballSpinAccel = data.spin || 0;
                this.ballHorizDrag = data.horizDrag || 0;
                this.ballCurveAccelX = this.mirrorX(data.curveX || 0);
                this.ballBounceScaleY = data.bounceY || 0.82;
                this.ballBounceScaleZ = data.bounceZ || 0.97;

                this.isServeFirstBounce = false;
                this.isShortServeActive = false;
                this.netFault = false;
                this.incomingCutMissProb = data.cutMissProb || 0;
                this.receiverBounces = 0;
                this.lastReceiverBounceZ = null;
                this.lastHitter = 'npc';
                this.playerCanHit = true;
                this.npcCanHit = false;
                this.npcHitType = data.hitType || 'fore';
                this.npcSwingTime = 0;
                this.trailMode = data.trailMode || 'normal';
                this.trailIsSmash = (this.trailMode === 'smash');

                if (data.isDive) {
                    this.npcDiveTime = 0;
                    this.npcDiveDir = this.mirrorX(data.diveDir || 0);
                    this.npcRecoveryTime = this.recoveryDuration;
                    this.core.spawnRing(new THREE.Vector3(this.npcGroup.position.x, 0.05, this.npcGroup.position.z), 0xffffff, 0.4, 1.8, 0.28, true, 0.65);
                }

                if (typeof BadmintonAudio !== 'undefined') {
                    BadmintonAudio.playHit(Boolean(data.isSmashSound));
                }
                this.core.spawnHitEffect(this.ballPos, data.effectType || 'lob');
                break;
            }

            case 'ball_sync': {
                if (this.onlineRole !== 'guest') return;
                if (data.seq !== this.onlineSeq || gameState !== 'rally') return;

                const sx = this.mirrorX(data.pos.x);
                const sy = data.pos.y;
                const sz = this.mirrorZ(data.pos.z);
                const errDist = Math.hypot(sx - this.ballPos.x, sy - this.ballPos.y, sz - this.ballPos.z);

                if (errDist > 0.45) {
                    this.ballPos.set(sx, sy, sz);
                } else {
                    this.ballPos.x += (sx - this.ballPos.x) * 0.45;
                    this.ballPos.y += (sy - this.ballPos.y) * 0.45;
                    this.ballPos.z += (sz - this.ballPos.z) * 0.45;
                }
                this.ballVel.set(this.mirrorX(data.vel.x), data.vel.y, this.mirrorZ(data.vel.z));
                this.ballSpinAccel = data.spin || 0;
                this.ballHorizDrag = data.horizDrag || 0;
                this.ballCurveAccelX = this.mirrorX(data.curveX || 0);
                this.receiverBounces = data.receiverBounces;
                this.isServeFirstBounce = Boolean(data.isServeFirstBounce);
                this.netFault = Boolean(data.netFault);
                break;
            }

            case 'score': {
                if (this.onlineRole !== 'guest') return;
                this._applyRemoteScore(data);
                break;
            }
        }
    },

    _applyRemoteScore(data) {
        if (gameState === 'ended' || gameState === 'waiting') return;
        gameState = 'ended';
        this.trailIsSmash = false;
        this.trailMode = 'normal';
        if (this.chargeRing) this.chargeRing.visible = false;

        if (typeof BadmintonAudio !== 'undefined') {
            BadmintonAudio.playCheer();
        }

        playerScore = data.guestScore;
        npcScore = data.hostScore;

        const pEl = document.getElementById('player-score');
        const nEl = document.getElementById('npc-score');
        if (pEl) pEl.innerText = playerScore;
        if (nEl) nEl.innerText = npcScore;

        const youWonPoint = (data.winner === 'guest');
        this.playerEmotion = youWonPoint ? 'win' : 'lose';
        this.npcEmotion = youWonPoint ? 'lose' : 'win';
        this.emotionTime = 0;

        const prefix = data.prefix ? `${data.prefix} ` : '';
        const bannerText = youWonPoint ? `${prefix}POINT FOR YOU!` : `${prefix}POINT FOR RIVAL!`;
        this.core.showBanner(bannerText, youWonPoint ? "#34c759" : "#ff3b30");

        if (data.isMatchEnd) {
            if (typeof UIManager !== 'undefined') {
                setTimeout(() => {
                    if (this.core.activeSport === 'tabletennis' && gameState === 'ended' && this.onlineMode) {
                        UIManager.showResult(playerScore, npcScore);
                    }
                }, 1400);
            }
        } else {
            const nextServerLocal = (data.nextServer === 'guest') ? 'player' : 'npc';
            setTimeout(() => {
                if (this.core.activeSport === 'tabletennis' && gameState === 'ended' && this.onlineMode) {
                    this.resetToServe(nextServerLocal);
                }
            }, 2000);
        }
    },

    updateRemoteOpponent(dt) {
        if (this.npcDiveTime >= 0) {
            this.npcGroup.position.x += this.npcDiveDir * 2.6 * dt;
            this.npcGroup.position.x = Math.max(-this.limitX, Math.min(this.limitX, this.npcGroup.position.x));
            return;
        }
        if (!this.remoteState.hasSync) return;

        const factor = Math.min(1, 18 * dt);
        this.npcGroup.position.x += (this.remoteState.targetX - this.npcGroup.position.x) * factor;
        this.npcGroup.position.z += (this.remoteState.targetZ - this.npcGroup.position.z) * factor;
    },

    resetDivePose(group) {
        const bodyM = group === this.playerGroup ? this.activePlayerBody : (group === this.npcGroup ? this.activeNpcBody : null);
        if (bodyM) {
            bodyM.position.y = 0.5 * this.characterScale;
            bodyM.rotation.z = 0;
        }
    },

    updateDiveAnimation(group, diveTimeKey, diveDir, recoveryTimeKey, dt) {
        const bodyM = group === this.playerGroup ? this.activePlayerBody : (group === this.npcGroup ? this.activeNpcBody : null);
        const baseY = 0.5 * this.characterScale;

        if (this[diveTimeKey] >= 0) {
            this[diveTimeKey] += dt;
            const t = this[diveTimeKey] / this.diveDuration;
            if (t >= 1) {
                this[diveTimeKey] = -1;
                if (bodyM) {
                    bodyM.position.y = baseY;
                    bodyM.rotation.z = 0;
                }
            } else {
                const arc = Math.sin(t * Math.PI);
                if (bodyM) {
                    bodyM.position.y = baseY + arc * 0.45;
                    bodyM.rotation.z = -diveDir * arc * 0.48;
                }
            }
        } else {
            if (this[recoveryTimeKey] > 0) {
                this[recoveryTimeKey] = Math.max(0, this[recoveryTimeKey] - dt);
            }
            if (bodyM) {
                bodyM.position.y += (baseY - bodyM.position.y) * 14 * dt;
                bodyM.rotation.z += (0 - bodyM.rotation.z) * 14 * dt;
            }
        }
    },

    applyBackhandSwingAnimation(group, isPlayer, swingTime, dt) {
        const bodyM = group === this.playerGroup ? this.activePlayerBody : (group === this.npcGroup ? this.activeNpcBody : null);
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        if (!visualRoot) return;

        const baseYaw = isPlayer ? Math.PI : 0;
        const racketArm = visualRoot.getObjectByName("racket");
        const swingArc = racketArm ? racketArm.getObjectByName("swingArc") : null;

        if (swingTime >= 0) {
            const duration = 0.25;
            const t = Math.min(1, swingTime / duration);
            const ease = Math.sin(t * Math.PI * 0.65);

            visualRoot.rotation.y = baseYaw + (-0.38 + ease * 0.52);

            if (racketArm) {
                racketArm.rotation.x = 0.82 + ease * 0.36;
                racketArm.rotation.y = 0.58 - ease * 1.38;
                racketArm.rotation.z = -1.25 + ease * 1.62;
            }
            if (swingArc) {
                swingArc.visible = true;
                swingArc.material.opacity = (1 - t) * 0.55;
            }
        } else {
            visualRoot.rotation.y += (baseYaw - visualRoot.rotation.y) * 12 * dt;
            if (racketArm) {
                racketArm.rotation.y += (0 - racketArm.rotation.y) * 12 * dt;
            }
        }
    },

    scorePoint(winner, reasonText, prefixTag = '') {
        if (gameState === 'ended' || gameState === 'waiting') return;
        // 通信対戦時はホストが最終得点判定を行う（ゲスト側はホストからの 'score' 受信で反映）
        if (this.onlineMode && this.onlineRole === 'guest') {
            this.ballVel.set(0, 0, 0);
            return;
        }

        gameState = 'ended';
        this.trailIsSmash = false;
        this.trailMode = 'normal';
        if (this.chargeRing) this.chargeRing.visible = false;

        if (typeof BadmintonAudio !== 'undefined') {
            BadmintonAudio.playCheer();
        }

        this.playerEmotion = (winner === 'player') ? 'win' : 'lose';
        this.npcEmotion = (winner === 'player') ? 'lose' : 'win';
        this.emotionTime = 0;

        const oppName = this.onlineMode ? 'RIVAL' : 'NPC';
        if (winner === 'player') {
            playerScore++;
            const pEl = document.getElementById('player-score');
            if (pEl) pEl.innerText = playerScore;
            this.core.showBanner(reasonText || "POINT FOR YOU!", "#34c759");
        } else {
            npcScore++;
            const nEl = document.getElementById('npc-score');
            if (nEl) nEl.innerText = npcScore;
            this.core.showBanner(reasonText || `POINT FOR ${oppName}!`, "#ff3b30");
        }

        const isMatchEnd = this.isMatchFinished(playerScore, npcScore);
        const nextServer = this.getNextServerAfterPoint(playerScore, npcScore);

        if (this.onlineMode && this.onlineRole === 'host' && typeof TTNetwork !== 'undefined') {
            TTNetwork.send('score', {
                hostScore: playerScore,
                guestScore: npcScore,
                winner: winner === 'player' ? 'host' : 'guest',
                prefix: prefixTag,
                nextServer: nextServer === 'player' ? 'host' : 'guest',
                isMatchEnd
            });
        }

        if (isMatchEnd) {
            if (typeof UIManager !== 'undefined') {
                setTimeout(() => {
                    if (this.core.activeSport === 'tabletennis' && gameState === 'ended') {
                        UIManager.showResult(playerScore, npcScore);
                    }
                }, 1400);
            }
        } else {
            setTimeout(() => {
                if (this.core.activeSport === 'tabletennis' && gameState === 'ended') {
                    this.resetToServe(nextServer);
                }
            }, 2000);
        }
    },

    update(dt) {
        const menuBlockingInput = (typeof UIManager !== 'undefined' && UIManager.isMenuOpen);
        const isPlayerTossing = (gameState === 'serve-player' && this.servePhase === 'toss');
        const isPointEnded = (gameState === 'ended');

        if (isPointEnded) {
            this.emotionTime += dt;
        } else if (this.playerDiveTime >= 0) {
            this.playerGroup.position.x += this.playerDiveDir * 2.6 * dt;
            this.playerGroup.position.x = Math.max(-this.limitX, Math.min(this.limitX, this.playerGroup.position.x));
        } else if (!isPlayerTossing && !menuBlockingInput) {
            let moveSpeed = this.playerSpeed;
            if (this.playerRecoveryTime > 0) moveSpeed *= 0.30;
            if (isCharging) moveSpeed *= 0.6;

            let mx = 0, mz = 0;
            const useJoy = (typeof FloatingJoystick !== 'undefined' && FloatingJoystick.active);
            if (useJoy) {
                mx = FloatingJoystick.dir.x;
                mz = FloatingJoystick.dir.y;
            } else {
                if (keys.w) mz -= 1;
                if (keys.s) mz += 1;
                if (keys.a) mx -= 1;
                if (keys.d) mx += 1;
            }

            const mag = Math.hypot(mx, mz);
            if (mag > 0.001) {
                const scale = (useJoy && mag <= 1) ? mag : 1;
                this.playerGroup.position.x += (mx / mag) * moveSpeed * scale * dt;
                this.playerGroup.position.z += (mz / mag) * moveSpeed * scale * dt;
                this.playerGroup.position.x = Math.max(-this.limitX, Math.min(this.limitX, this.playerGroup.position.x));
                this.playerGroup.position.z = Math.max(this.playerZMin, Math.min(this.playerZMax, this.playerGroup.position.z));
            }
        }

        // サーブ構え＆トス処理
        if (gameState === 'serve-player') {
            if (this.servePhase !== 'toss') {
                this.servePhase = 'idle';
                this.ballVel.set(0, 0, 0);
                if (isCharging) {
                    this.servePhase = 'toss';
                    this.serveTossVelY = 5.4;
                    this.serveArmTime = 0.35;
                    this.serveAutoFired = false;
                    const tossRingColor = (chargeMode === 'down') ? 0x00d8ff : 0xffffff;
                    this.core.spawnRing(this.ballPos, tossRingColor, 0.15, 0.65, 0.22, false, 0.65);
                    if (this.onlineMode && typeof TTNetwork !== 'undefined') {
                        TTNetwork.send('toss', { seq: this.onlineSeq });
                    }
                }
            } else {
                this.serveTossVelY += this.gravity * dt;
                this.ballPos.y += this.serveTossVelY * dt;
                const targetBallX = this.playerGroup.position.x + 0.14;
                const targetBallZ = this.playerGroup.position.z - 0.42;
                this.ballPos.x += (targetBallX - this.ballPos.x) * 3.5 * dt;
                this.ballPos.z += (targetBallZ - this.ballPos.z) * 5.0 * dt;

                if (this.serveTossVelY < 0 && this.ballPos.y <= 1.25) {
                    this.serveBall('player', power, chargeMode);
                    this.serveAutoFired = true;
                    isCharging = false;
                    power = 0;
                    chargeMode = 'up';
                    if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', 'tabletennis');
                }
            }
        } else if (gameState === 'serve-npc') {
            if (this.servePhase !== 'toss') {
                this.servePhase = 'idle';
                this.ballVel.set(0, 0, 0);
                if (!this.onlineMode) {
                    this.npcTossDelayTimer += dt;
                    if (this.npcTossDelayTimer >= 0.55) {
                        this.servePhase = 'toss';
                        this.serveTossVelY = 5.3;
                        this.serveArmTime = 0.35;
                        this.core.spawnRing(this.ballPos, 0xffffff, 0.15, 0.65, 0.22, false, 0.6);
                    }
                }
            } else {
                this.serveTossVelY += this.gravity * dt;
                this.ballPos.y += this.serveTossVelY * dt;
                const targetBallX = this.npcGroup.position.x - 0.14;
                const targetBallZ = this.npcGroup.position.z + 0.42;
                this.ballPos.x += (targetBallX - this.ballPos.x) * 3.5 * dt;
                this.ballPos.z += (targetBallZ - this.ballPos.z) * 5.0 * dt;

                if (!this.onlineMode && this.serveTossVelY < 0 && this.ballPos.y <= 1.35) {
                    const npcServePower = (npcLevel >= 3 && Math.random() < 0.55) ? (60 + Math.random() * 35) : 30;
                    this.serveBall('npc', npcServePower);
                }
            }
        }

        if (this.serveArmTime > 0) {
            this.serveArmTime = Math.max(0, this.serveArmTime - dt);
        }
        const playerArmMode = gameState === 'serve-player'
            ? (this.serveArmTime > 0 ? 'toss' : (this.servePhase === 'idle' ? 'hold' : 'none'))
            : 'none';
        const npcArmMode = gameState === 'serve-npc'
            ? (this.serveArmTime > 0 ? 'toss' : (this.servePhase === 'idle' ? 'hold' : 'none'))
            : 'none';

        // チャージ更新＆自動ヒット（ワンバウンド後）
        if (isCharging && !menuBlockingInput) {
            power = Math.min(MAX_POWER, power + POWER_CHARGE_SPEED * dt);
            if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(power, chargeMode, 'tabletennis');

            if (gameState === 'rally' && this.playerCanHit && this.receiverBounces === 1 && this.ballPos.z > 0.2) {
                const reach = this.getReachInfo(this.playerGroup.position, this.ballPos, true);
                if (reach.inRange) {
                    this.hitBall('player', power, reach, chargeMode);
                    isCharging = false;
                    power = 0;
                    chargeMode = 'up';
                    if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', 'tabletennis');
                }
            }
        }

        // NPCまたはオンライン相手の位置更新
        if (!isPointEnded) {
            this.updateNPC(dt);
        }

        // ラリー物理更新
        if (gameState === 'rally') {
            const prevPos = this._tmpPrevBallPos.copy(this.ballPos);

            this.ballVel.x += this.ballCurveAccelX * dt;
            this.ballVel.y += (this.gravity + this.ballSpinAccel) * dt;
            if (this.ballHorizDrag > 0) {
                const hFactor = Math.exp(-this.ballHorizDrag * dt);
                this.ballVel.x *= hFactor;
                this.ballVel.z *= hFactor;
            }
            const sp = this.ballVel.length();
            if (sp > 0.01) {
                this.ballVel.multiplyScalar(Math.max(0, 1 - this.airDrag * dt));
            }
            this.ballPos.addScaledVector(this.ballVel, dt);

            // ネット通過判定
            const crossedNet = (prevPos.z > 0 && this.ballPos.z <= 0) || (prevPos.z < 0 && this.ballPos.z >= 0);
            if (crossedNet && !this.netFault) {
                const dz = this.ballPos.z - prevPos.z;
                if (Math.abs(dz) > 0.0001) {
                    const t = -prevPos.z / dz;
                    const yAtNet = prevPos.y + t * (this.ballPos.y - prevPos.y);
                    const xAtNet = prevPos.x + t * (this.ballPos.x - prevPos.x);
                    const netTopY = this.tableHeight + this.netHeight + this.ballRadius * 0.5;

                    if (Math.abs(xAtNet) <= this.tableWidth / 2 + 0.14 && yAtNet < netTopY) {
                        this.netFault = true;
                        this.ballSpinAccel = 0;
                        this.ballHorizDrag = 0;
                        this.ballCurveAccelX = 0;
                        this.ballPos.z = prevPos.z > 0 ? 0.06 : -0.06;
                        this.ballPos.y = yAtNet;
                        this.ballVel.set(this.ballVel.x * 0.2, 0.4, prevPos.z > 0 ? -0.9 : 0.9);
                        this.trailIsSmash = false;
                        this.trailMode = 'normal';
                        this.core.spawnRing(new THREE.Vector3(xAtNet, yAtNet, 0), 0xff453a, 0.25, 1.4, 0.25, false, 0.85);
                        this.playBounceSound(false);
                    }
                }
            }

            // 卓球台天板とのバウンド判定
            const onTableArea = Math.abs(this.ballPos.x) <= this.tableWidth / 2 + 0.03 &&
                                Math.abs(this.ballPos.z) <= this.tableLength / 2 + 0.03;
            const tableSurfaceY = this.tableHeight + this.ballRadius;

            if (onTableArea && !this.netFault && prevPos.y >= tableSurfaceY - 0.08 && this.ballPos.y <= tableSurfaceY && this.ballVel.y < 0) {
                this.ballPos.y = tableSurfaceY;
                this.playBounceSound(false);
                const bounceRingColor = (this.trailMode === 'cut') ? 0x00d8ff : 0xffffff;
                this.core.spawnRing(new THREE.Vector3(this.ballPos.x, this.tableHeight + 0.015, this.ballPos.z), bounceRingColor, 0.18, 0.85, 0.24, true, 0.75);

                if (this.isServeFirstBounce) {
                    const isPlayerServe = (this.lastHitter === 'player');
                    const onServerHalf = isPlayerServe ? (this.ballPos.z > 0) : (this.ballPos.z < 0);
                    if (onServerHalf) {
                        this.isServeFirstBounce = false;
                        this.ballSpinAccel = this.serveFlightSpin;
                        this.ballHorizDrag = this.serveFlightHorizDrag;
                        this.ballCurveAccelX = this.serveFlightCurveX;
                        this.ballBounceScaleY = this.serveNextBounceY;
                        this.ballBounceScaleZ = this.serveNextBounceZ;
                        this.ballVel.copy(this.computeBallVelocity(
                            this.ballPos,
                            new THREE.Vector3(this.serveDestX, tableSurfaceY, this.serveDestZ),
                            this.serveFlightDuration,
                            this.serveFlightSpin,
                            this.serveFlightHorizDrag,
                            this.serveFlightCurveX
                        ));
                        if (!isPlayerServe) this.playerCanHit = true;
                        else this.npcCanHit = true;
                    }
                } else {
                    const hitOwnSide = (this.lastHitter === 'player' && this.ballPos.z > 0) ||
                                       (this.lastHitter === 'npc' && this.ballPos.z < 0);
                    if (hitOwnSide) {
                        if (!this.onlineMode || this.onlineRole === 'host') {
                            const winner = this.lastHitter === 'player' ? 'npc' : 'player';
                            const oppName = this.onlineMode ? 'RIVAL' : 'NPC';
                            this.scorePoint(winner, winner === 'player' ? "POINT FOR YOU!" : `POINT FOR ${oppName}!`);
                        } else {
                            this.ballVel.set(0, 0, 0);
                        }
                    } else {
                        this.receiverBounces++;
                        this.lastReceiverBounceZ = this.ballPos.z;
                        this.ballVel.y = Math.abs(this.ballVel.y) * this.ballBounceScaleY;
                        this.ballVel.x *= 0.96;
                        this.ballVel.z *= this.ballBounceScaleZ;
                        this.ballSpinAccel = 0;
                        this.ballHorizDrag = 0;
                        this.ballCurveAccelX *= 0.25;

                        if (this.receiverBounces >= 2) {
                            if (!this.onlineMode || this.onlineRole === 'host') {
                                const winner = this.lastHitter;
                                const oppName = this.onlineMode ? 'RIVAL' : 'NPC';
                                this.scorePoint(winner, winner === 'player' ? "POINT FOR YOU!" : `POINT FOR ${oppName}!`);
                            } else {
                                this.ballVel.set(0, 0, 0);
                            }
                        }
                    }
                }

                // ホストはバウンドの瞬間にゲストへ軽量補正を送り、軌道ズレを防止
                if (this.onlineMode && this.onlineRole === 'host' && gameState === 'rally' && typeof TTNetwork !== 'undefined') {
                    TTNetwork.send('ball_sync', {
                        seq: this.onlineSeq,
                        pos: { x: this.ballPos.x, y: this.ballPos.y, z: this.ballPos.z },
                        vel: { x: this.ballVel.x, y: this.ballVel.y, z: this.ballVel.z },
                        spin: this.ballSpinAccel,
                        horizDrag: this.ballHorizDrag,
                        curveX: this.ballCurveAccelX,
                        receiverBounces: this.receiverBounces,
                        isServeFirstBounce: this.isServeFirstBounce,
                        netFault: this.netFault
                    });
                }
            }

            // 床落下（またはネットミス後に台より下に落下）で得点確定
            const droppedBelowTable = !onTableArea && this.ballPos.y <= 0.12;
            const netDropped = this.netFault && this.ballPos.y <= this.tableHeight + this.ballRadius;

            if (gameState === 'rally' && (droppedBelowTable || netDropped || this.ballPos.y <= 0.08)) {
                if (!this.onlineMode || this.onlineRole === 'host') {
                    const oppName = this.onlineMode ? 'RIVAL' : 'NPC';
                    if (this.netFault) {
                        const winner = this.lastHitter === 'player' ? 'npc' : 'player';
                        this.scorePoint(winner, winner === 'player' ? "NET! POINT FOR YOU!" : `NET! POINT FOR ${oppName}!`, 'NET!');
                    } else if (this.receiverBounces === 1) {
                        const winner = this.lastHitter;
                        this.scorePoint(winner, winner === 'player' ? "ACE! POINT FOR YOU!" : `POINT FOR ${oppName}!`, winner === 'player' ? 'ACE!' : '');
                    } else {
                        const winner = this.lastHitter === 'player' ? 'npc' : 'player';
                        this.scorePoint(winner, winner === 'player' ? "OUT! POINT FOR YOU!" : `OUT! POINT FOR ${oppName}!`, 'OUT!');
                    }
                } else {
                    this.ballVel.set(0, 0, 0);
                }
            }

            // ホストから定期ボール補正送信（約10Hz）
            if (this.onlineMode && this.onlineRole === 'host' && gameState === 'rally' && typeof TTNetwork !== 'undefined') {
                this.onlineBallSyncTimer += dt;
                if (this.onlineBallSyncTimer >= 0.10) {
                    this.onlineBallSyncTimer = 0;
                    TTNetwork.send('ball_sync', {
                        seq: this.onlineSeq,
                        pos: { x: this.ballPos.x, y: this.ballPos.y, z: this.ballPos.z },
                        vel: { x: this.ballVel.x, y: this.ballVel.y, z: this.ballVel.z },
                        spin: this.ballSpinAccel,
                        horizDrag: this.ballHorizDrag,
                        curveX: this.ballCurveAccelX,
                        receiverBounces: this.receiverBounces,
                        isServeFirstBounce: this.isServeFirstBounce,
                        netFault: this.netFault
                    });
                }
            }
        }

        // チャージVFX・トレイル・VFX更新
        this.updateChargeVFX(dt);
        this.updateTrail(gameState === 'rally');
        this.core.updateVFX(dt);

        // 飛びつき・リカバリータイマー更新
        if (this.playerDiveTime >= 0) {
            this.playerDiveTime += dt;
            if (this.playerDiveTime >= this.diveDuration) this.playerDiveTime = -1;
        } else if (this.playerRecoveryTime > 0) {
            this.playerRecoveryTime = Math.max(0, this.playerRecoveryTime - dt);
        }

        if (this.npcDiveTime >= 0) {
            this.npcDiveTime += dt;
            if (this.npcDiveTime >= this.diveDuration) this.npcDiveTime = -1;
        } else if (this.npcRecoveryTime > 0) {
            this.npcRecoveryTime = Math.max(0, this.npcRecoveryTime - dt);
        }

        // 卓球専用関節アニメーション更新
        const invDt = dt > 0.0001 ? 1 / dt : 0;
        const pVx = (this.playerGroup.position.x - this.prevPlayerPos.x) * invDt;
        const pVz = (this.playerGroup.position.z - this.prevPlayerPos.z) * invDt;
        this.prevPlayerPos.copy(this.playerGroup.position);

        // 通信対戦時は自分の位置・速度・チャージ状態を約30Hzで相手へ送信
        if (this.onlineMode && typeof TTNetwork !== 'undefined' && TTNetwork.isOnline) {
            this.onlineSyncTimer += dt;
            if (this.onlineSyncTimer >= 0.033) {
                this.onlineSyncTimer = 0;
                TTNetwork.send('player_state', {
                    x: this.mirrorX(this.playerGroup.position.x),
                    z: this.mirrorZ(this.playerGroup.position.z),
                    vx: this.mirrorX(pVx),
                    vz: this.mirrorZ(pVz),
                    isCharging: Boolean(isCharging && !menuBlockingInput),
                    chargeMode,
                    chargeRatio: Math.min(1, power / MAX_POWER)
                });
            }
        }

        const playerBodyMesh = this.activePlayerBody;

        const st = this._animState;
        st.isPlayer = true;
        st.vx = pVx;
        st.vz = pVz;
        st.isCharging = isCharging && !menuBlockingInput;
        st.chargeMode = chargeMode;
        st.chargeRatio = Math.min(1, power / MAX_POWER);
        st.swingTime = this.playerSwingTime;
        st.stepPhase = this.playerStepPhase;
        st.hitType = this.playerHitType;
        st.armMode = playerArmMode;
        st.diveTime = this.playerDiveTime;
        st.diveDuration = this.diveDuration;
        st.diveDir = this.playerDiveDir;
        st.recoveryTime = this.playerRecoveryTime;
        st.idleTime = this.core ? this.core.idleTime : 0;
        st.emotion = isPointEnded ? this.playerEmotion : 'none';
        st.emotionTime = this.emotionTime;

        if (playerBodyMesh) {
            const pAnimRes = TableTennisCharacter.updateAnimation(
                playerBodyMesh,
                st,
                dt
            );
            if (pAnimRes) {
                this.playerSwingTime = pAnimRes.swingTime;
                this.playerStepPhase = pAnimRes.stepPhase;
            }
        }

        const nVx = this.onlineMode ? this.remoteState.vx : (this.npcGroup.position.x - this.prevNpcPos.x) * invDt;
        const nVz = this.onlineMode ? this.remoteState.vz : (this.npcGroup.position.z - this.prevNpcPos.z) * invDt;
        this.prevNpcPos.copy(this.npcGroup.position);

        const npcBodyMesh = this.activeNpcBody;

        st.isPlayer = false;
        st.vx = nVx;
        st.vz = nVz;
        st.isCharging = this.onlineMode ? this.remoteState.isCharging : false;
        st.chargeMode = this.onlineMode ? this.remoteState.chargeMode : 'up';
        st.chargeRatio = this.onlineMode ? this.remoteState.chargeRatio : 0;
        st.swingTime = this.npcSwingTime;
        st.stepPhase = this.npcStepPhase;
        st.hitType = this.npcHitType;
        st.armMode = npcArmMode;
        st.diveTime = this.npcDiveTime;
        st.diveDir = this.npcDiveDir;
        st.recoveryTime = this.npcRecoveryTime;
        st.emotion = isPointEnded ? this.npcEmotion : 'none';
        st.emotionTime = this.emotionTime;

        if (npcBodyMesh) {
            const nAnimRes = TableTennisCharacter.updateAnimation(
                npcBodyMesh,
                st,
                dt
            );
            if (nAnimRes) {
                this.npcSwingTime = nAnimRes.swingTime;
                this.npcStepPhase = nAnimRes.stepPhase;
            }
        }

        // サーブ待機時は左手のひらのワールド座標にボールを追従させる
        if ((gameState === 'serve-player' || gameState === 'serve-npc') && this.servePhase === 'idle') {
            const serverBody = (gameState === 'serve-player') ? this.activePlayerBody : this.activeNpcBody;
            if (serverBody && TableTennisCharacter.getLeftHandWorldPosition(serverBody, this._tmpVec3A)) {
                this.ballPos.set(this._tmpVec3A.x, this._tmpVec3A.y + 0.095, this._tmpVec3A.z);
            }
        }

        // ボールと影の更新
        this.ballGroup.position.copy(this.ballPos);
        const overTable = Math.abs(this.ballPos.x) <= this.tableWidth / 2 && Math.abs(this.ballPos.z) <= this.tableLength / 2;
        this.ballShadow.position.set(this.ballPos.x, overTable ? this.tableHeight + 0.012 : 0.025, this.ballPos.z);

        // カメラ追従＆シェイク
        this.cameraBasePos.x += (this.playerGroup.position.x * 0.48 - this.cameraBasePos.x) * 4.5 * dt;
        this.cameraBasePos.z += (8.6 + (this.playerGroup.position.z - 3.8) * 0.35 - this.cameraBasePos.z) * 4.5 * dt;

        this.core.camera.position.copy(this.cameraBasePos);
        if (this.core.cameraShakeDuration > 0) {
            this.core.cameraShakeTime += dt;
            if (this.core.cameraShakeTime < this.core.cameraShakeDuration) {
                const decay = 1 - (this.core.cameraShakeTime / this.core.cameraShakeDuration);
                const mag = this.core.cameraShakeIntensity * decay;
                this.core.camera.position.x += (Math.random() - 0.5) * 2 * mag;
                this.core.camera.position.y += (Math.random() - 0.5) * 2 * mag;
            } else {
                this.core.cameraShakeDuration = 0;
                this.core.cameraShakeIntensity = 0;
            }
        }
        this.core.camera.lookAt(this.playerGroup.position.x * 0.2, 1.05, 0);
    }
};