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

    // アニメーション・バックハンド・飛びつき・カメラ用
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
        diveTime: -1, diveDuration: 0.40, diveDir: 0, recoveryTime: 0, idleTime: 0
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
        this.setCharacterColors(false);
        if (this.playerGroup) {
            this.playerGroup.position.set(0, 0, 3.8);
            this.prevPlayerPos.copy(this.playerGroup.position);
            TableTennisCharacter.resetPose(this.activePlayerBody);
        }
        if (this.npcGroup) {
            this.npcGroup.position.set(0, 0, -3.8);
            this.prevNpcPos.copy(this.npcGroup.position);
            TableTennisCharacter.resetPose(this.activeNpcBody);
        }
        this.ballPos.set(-0.34, 1.18, 3.40);
        if (this.ballGroup) this.ballGroup.position.copy(this.ballPos);
        if (this.ballShadow) this.ballShadow.position.set(this.ballPos.x, 0.025, this.ballPos.z);
        this.resetTrail();
    },

    // 卓球専用の軽い「ポンッ」というバウンド音を生成（ミュート連動）
    playBounceSound(isPaddle = false) {
        if (typeof BadmintonAudio !== 'undefined' && BadmintonAudio.isMuted) return;
        try {
            let ctx = (typeof BadmintonAudio !== 'undefined' && typeof BadmintonAudio.getContext === 'function')
                ? BadmintonAudio.getContext()
                : null;
            if (!ctx) {
                if (!this.audioCtx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (!AudioCtx) return;
                    this.audioCtx = new AudioCtx();
                }
                ctx = this.audioCtx;
            }
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            const startFreq = isPaddle ? 950 : 1280;
            const endFreq = isPaddle ? 420 : 680;
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.045);

            gain.gain.setValueAtTime(isPaddle ? 0.22 : 0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
        } catch (e) {
            // Audioエラーは無視
        }
    },

    buildTable() {
        const w = this.tableWidth;
        const l = this.tableLength;
        const h = this.tableHeight;
        const topThickness = 0.1;

        const tableGroup = new THREE.Group();

        // 天板（深緑〜ネイビーブルーの競技用卓球台カラー）
        const topGeo = new THREE.BoxGeometry(w, topThickness, l);
        const topMat = new THREE.MeshStandardMaterial({
            color: 0x0e3b6e,
            roughness: 0.35,
            metalness: 0.08
        });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(0, h - topThickness / 2, 0);
        tableGroup.add(topMesh);

        // 天板の白枠線・センターライン
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lineY = h + 0.004;
        const lw = 0.04;

        const sideLineGeo = new THREE.PlaneGeometry(lw, l);
        [-w / 2 + lw / 2, w / 2 - lw / 2].forEach(lx => {
            const sl = new THREE.Mesh(sideLineGeo, lineMat);
            sl.rotation.x = -Math.PI / 2;
            sl.position.set(lx, lineY, 0);
            tableGroup.add(sl);
        });

        const endLineGeo = new THREE.PlaneGeometry(w, lw);
        [-l / 2 + lw / 2, l / 2 - lw / 2].forEach(lz => {
            const el = new THREE.Mesh(endLineGeo, lineMat);
            el.rotation.x = -Math.PI / 2;
            el.position.set(0, lineY, lz);
            tableGroup.add(el);
        });

        const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.02, l), lineMat);
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.set(0, lineY, 0);
        tableGroup.add(centerLine);

        // 側面フレーム（ブラック）
        const apronMat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.5 });
        const apron = new THREE.Mesh(new THREE.BoxGeometry(w - 0.14, 0.14, l - 0.14), apronMat);
        apron.position.set(0, h - topThickness - 0.07, 0);
        tableGroup.add(apron);

        // 4本の脚と補強フレーム
        const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.6, roughness: 0.35 });
        const legH = h - topThickness - 0.08;
        const legGeo = new THREE.BoxGeometry(0.1, legH, 0.1);
        const legX = w / 2 - 0.32;
        const legZ = l / 2 - 0.45;
        [
            [-legX, -legZ],
            [legX, -legZ],
            [-legX, legZ],
            [legX, legZ]
        ].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, legH / 2, lz);
            tableGroup.add(leg);
        });

        // 中央の横連結フレーム
        const barGeo = new THREE.BoxGeometry(0.08, 0.08, legZ * 2);
        [-legX, legX].forEach(bx => {
            const bar = new THREE.Mesh(barGeo, legMat);
            bar.position.set(bx, 0.32, 0);
            tableGroup.add(bar);
        });

        // 卓球ネットとサポート支柱
        const postGeo = new THREE.CylinderGeometry(0.025, 0.025, this.netHeight + 0.04, 10);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
        [-w / 2 - 0.14, w / 2 + 0.14].forEach(px => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(px, h + this.netHeight / 2, 0);
            tableGroup.add(post);
        });

        const netMeshGeo = new THREE.PlaneGeometry(w + 0.28, this.netHeight);
        const netMeshMat = new THREE.MeshBasicMaterial({
            color: 0x162230,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide
        });
        const netMesh = new THREE.Mesh(netMeshGeo, netMeshMat);
        netMesh.position.set(0, h + this.netHeight / 2, 0);
        tableGroup.add(netMesh);

        const topTape = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.28, 0.028, 0.015),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        topTape.position.set(0, h + this.netHeight - 0.014, 0);
        tableGroup.add(topTape);

        this.rootGroup.add(tableGroup);
    },

    createTableTennisRacket(rubberColor, accentColor) {
        const racket = new THREE.Group();

        // 木製グリップ
        const gripGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.17, 10);
        const gripMat = new THREE.MeshStandardMaterial({ color: 0xc98f58, roughness: 0.7 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.y = 0.09;
        racket.add(grip);

        // グリップ装飾ライン
        const tapeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.025, 10);
        const tapeMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4 });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.y = 0.16;
        racket.add(tape);

        // ブレード（木板）
        const bladeGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.016, 24);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe3b886, roughness: 0.6 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.x = Math.PI / 2;
        blade.scale.set(0.92, 1.0, 1.06);
        blade.position.y = 0.30;
        racket.add(blade);

        // 表面ラバー（赤・黒）
        const rubberFrontMat = new THREE.MeshStandardMaterial({ color: rubberColor, roughness: 0.45 });
        const rubberBackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 });
        const rubberGeo = new THREE.CircleGeometry(0.144, 24);

        const frontRubber = new THREE.Mesh(rubberGeo, rubberFrontMat);
        frontRubber.scale.set(0.92, 1.06, 1);
        frontRubber.position.set(0, 0.30, 0.009);
        racket.add(frontRubber);

        const backRubber = new THREE.Mesh(rubberGeo, rubberBackMat);
        backRubber.rotation.y = Math.PI;
        backRubber.scale.set(0.92, 1.06, 1);
        backRubber.position.set(0, 0.30, -0.009);
        racket.add(backRubber);

        // スイング軌跡アーク
        const arcGeo = new THREE.RingGeometry(0.32, 0.62, 20, 1, -Math.PI * 0.35, Math.PI * 0.7);
        const arcMat = new THREE.MeshBasicMaterial({
            color: accentColor,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const swingArc = new THREE.Mesh(arcGeo, arcMat);
        swingArc.rotation.y = Math.PI / 2;
        swingArc.rotation.z = Math.PI * 0.25;
        swingArc.name = "swingArc";
        swingArc.visible = false;
        racket.add(swingArc);

        return racket;
    },

    swapToTableTennisRacket(bodyMesh, rubberColor, accentColor) {
        const visualRoot = bodyMesh.getObjectByName("visualRoot");
        if (!visualRoot) return;
        const racketArm = visualRoot.getObjectByName("racket");
        if (!racketArm) return;

        const oldRacket = racketArm.getObjectByName("racketMesh");
        if (oldRacket) {
            racketArm.remove(oldRacket);
        }

        const ttRacket = this.createTableTennisRacket(rubberColor, accentColor);
        ttRacket.name = "racketMesh";
        ttRacket.position.set(-0.11, 0.16, 0.13);
        ttRacket.rotation.set(0.35, 0.2, 0.15);
        racketArm.add(ttRacket);
    },

    buildCharacters() {
        const shadowGeo = new THREE.RingGeometry(0, 0.62, 28);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide
        });

        const redPreset = {
            primaryColor: 0xff3b30,
            accentColor: 0xffd700,
            rubberColor: 0xd92626,
            shortsColor: 0x1c1c1e,
            hairColor: 0x2b1d14,
            hasCap: true
        };
        const bluePreset = {
            primaryColor: 0x007aff,
            accentColor: 0x00d4ff,
            rubberColor: 0xd92626,
            shortsColor: 0x182235,
            hairColor: 0x1f242d,
            hasCap: false
        };

        // 手前プレイヤーキャラ（赤：親/通常、青：ゲスト）
        this.playerGroup = new THREE.Group();
        const playerRed = TableTennisCharacter.createCharacter({ ...redPreset, faceBack: true });
        playerRed.scale.setScalar(this.characterScale);
        this.playerGroup.add(playerRed);

        const playerBlue = TableTennisCharacter.createCharacter({ ...bluePreset, faceBack: true });
        playerBlue.scale.setScalar(this.characterScale);
        playerBlue.visible = false;
        this.playerGroup.add(playerBlue);

        this.playerBodies = { red: playerRed, blue: playerBlue };
        this.activePlayerBody = playerRed;

        const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
        playerShadow.rotation.x = -Math.PI / 2;
        playerShadow.position.y = 0.025;
        this.playerGroup.add(playerShadow);

        const chargeRingGeo = new THREE.RingGeometry(0.68, 0.84, 36);
        const chargeRingMat = new THREE.MeshBasicMaterial({
            color: 0x00d8ff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.chargeRing = new THREE.Mesh(chargeRingGeo, chargeRingMat);
        this.chargeRing.rotation.x = -Math.PI / 2;
        this.chargeRing.position.y = 0.03;
        this.chargeRing.visible = false;
        this.playerGroup.add(this.chargeRing);

        this.playerGroup.position.set(0, 0, 3.8);
        this.rootGroup.add(this.playerGroup);

        // 奥の相手キャラ（青：ゲスト/CPU、赤：ホスト）
        this.npcGroup = new THREE.Group();
        const npcBlue = TableTennisCharacter.createCharacter({ ...bluePreset, faceBack: false });
        npcBlue.scale.setScalar(this.characterScale);
        this.npcGroup.add(npcBlue);

        const npcRed = TableTennisCharacter.createCharacter({ ...redPreset, faceBack: false });
        npcRed.scale.setScalar(this.characterScale);
        npcRed.visible = false;
        this.npcGroup.add(npcRed);

        this.npcBodies = { red: npcRed, blue: npcBlue };
        this.activeNpcBody = npcBlue;

        const npcShadow = playerShadow.clone();
        this.npcGroup.add(npcShadow);

        this.npcGroup.position.set(0, 0, -3.8);
        this.rootGroup.add(this.npcGroup);
    },

    buildBall() {
        this.ballGroup = new THREE.Group();
        const ballGeo = new THREE.SphereGeometry(this.ballRadius, 18, 18);
        const ballMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x222222,
            roughness: 0.25,
            metalness: 0.05
        });
        const ballMesh = new THREE.Mesh(ballGeo, ballMat);
        this.ballGroup.add(ballMesh);
        this.rootGroup.add(this.ballGroup);

        this.ballShadow = new THREE.Mesh(
            new THREE.RingGeometry(0, 0.11, 24),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
        );
        this.ballShadow.rotation.x = -Math.PI / 2;
        this.ballShadow.position.y = this.tableHeight + 0.01;
        this.rootGroup.add(this.ballShadow);
    },

    initTrail() {
        this.trailPointPool = [];
        for (let i = 0; i < this.trailMaxPoints; i++) {
            this.trailPointPool.push(new THREE.Vector3());
        }
        const count = this.trailMaxPoints;
        const positions = new Float32Array(count * 2 * 3);
        const indices = [];
        for (let i = 0; i < count - 1; i++) {
            const a = i * 2;
            const b = i * 2 + 1;
            const c = (i + 1) * 2;
            const d = (i + 1) * 2 + 1;
            indices.push(a, b, c, b, d, c);
        }
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        trailGeo.setIndex(indices);

        const trailMat = new THREE.MeshBasicMaterial({
            color: 0x80e5ff,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.trailMesh = new THREE.Mesh(trailGeo, trailMat);
        this.trailMesh.frustumCulled = false;
        this.trailMesh.visible = false;
        this.rootGroup.add(this.trailMesh);
    },

    resetTrail() {
        while (this.trailPoints.length > 0) {
            this.trailPointPool.push(this.trailPoints.pop());
        }
        this.trailIsSmash = false;
        this.trailMode = 'normal';
        if (this.trailMesh) this.trailMesh.visible = false;
    },

    updateTrail(active) {
        if (!this.trailMesh) return;
        if (!active) {
            while (this.trailPoints.length > 0) {
                this.trailPointPool.push(this.trailPoints.pop());
            }
            this.trailMesh.visible = false;
            return;
        }

        let ptObj;
        if (this.trailPoints.length >= this.trailMaxPoints) {
            ptObj = this.trailPoints.pop();
        } else {
            ptObj = this.trailPointPool.pop() || new THREE.Vector3();
        }
        ptObj.copy(this.ballPos);
        this.trailPoints.unshift(ptObj);

        if (this.trailPoints.length < 2) {
            this.trailMesh.visible = false;
            return;
        }

        this.trailMesh.visible = true;
        let trailColor = 0x99ebff;
        let trailOpacity = 0.42;
        let maxHalfWidth = 0.045;
        if (this.trailMode === 'smash') {
            trailColor = 0xff7b00;
            trailOpacity = 0.78;
            maxHalfWidth = 0.095;
        } else if (this.trailMode === 'cut') {
            trailColor = 0x00d8ff;
            trailOpacity = 0.76;
            maxHalfWidth = 0.088;
        }
        this.trailMesh.material.color.setHex(trailColor);
        this.trailMesh.material.opacity = trailOpacity;
        const posAttr = this.trailMesh.geometry.attributes.position;
        const arr = posAttr.array;

        const camPos = this.core.camera.position;
        const dir = this._tmpVec3A;
        const toCam = this._tmpVec3B;
        const side = this._tmpVec3C;

        for (let i = 0; i < this.trailMaxPoints; i++) {
            const pt = this.trailPoints[Math.min(i, this.trailPoints.length - 1)];
            const nextPt = this.trailPoints[Math.min(i + 1, this.trailPoints.length - 1)];
            const prevPt = this.trailPoints[Math.max(i - 1, 0)];

            dir.subVectors(prevPt, nextPt);
            if (dir.lengthSq() < 0.00001) dir.set(0, 0, 1);
            else dir.normalize();

            toCam.subVectors(camPos, pt).normalize();
            side.crossVectors(dir, toCam);
            if (side.lengthSq() < 0.00001) side.set(1, 0, 0);
            else side.normalize();

            const t = i / (this.trailMaxPoints - 1);
            const hw = (1 - t) * maxHalfWidth * (i < this.trailPoints.length ? 1 : 0);

            const idx = i * 6;
            arr[idx] = pt.x + side.x * hw;
            arr[idx + 1] = pt.y + side.y * hw;
            arr[idx + 2] = pt.z + side.z * hw;

            arr[idx + 3] = pt.x - side.x * hw;
            arr[idx + 4] = pt.y - side.y * hw;
            arr[idx + 5] = pt.z - side.z * hw;
        }
        posAttr.needsUpdate = true;
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
        TableTennisCharacter.resetPose(this.activePlayerBody);
        TableTennisCharacter.resetPose(this.activeNpcBody);
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
            this.ballPos.set(this.playerGroup.position.x - 0.34, 1.18, this.playerGroup.position.z - 0.40);
            this.ballVel.set(0, 0, 0);
        } else {
            gameState = 'serve-npc';
            this.lastHitter = 'npc';
            this.playerCanHit = false;
            this.npcCanHit = true;
            this.ballPos.set(this.npcGroup.position.x + 0.34, 1.18, this.npcGroup.position.z + 0.40);
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

    // ターゲット地点へ指定時間 T で着弾する初速ベクトルを計算（縦スピン・水平減衰・横回転カーブ対応）
    computeBallVelocity(start, target, duration, spinAccel = 0, horizDrag = 0, curveAccelX = 0) {
        const totalGravity = this.gravity + spinAccel;
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const dz = target.z - start.z;

        let vx, vz;
        if (horizDrag > 0.0001) {
            const effTime = (1 - Math.exp(-horizDrag * duration)) / horizDrag;
            vx = (dx - (curveAccelX / horizDrag) * (duration - effTime)) / effTime;
            vz = dz / effTime;
        } else {
            vx = (dx - 0.5 * curveAccelX * duration * duration) / duration;
            vz = dz / duration;
        }
        const vy = (dy - 0.5 * totalGravity * duration * duration) / duration;
        return this._tmpVelOut.set(vx, vy, vz);
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

    serveBall(server, servePower = 30, mode = 'up') {
        const isCutServe = (server === 'player' && mode === 'down');
        const isLongServe = (!isCutServe && servePower >= 50);
        const pRatio = isLongServe ? Math.max(0, Math.min(1, (servePower - 50) / 50)) : 0;

        if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(isLongServe);
        this.trailIsSmash = isLongServe;
        this.trailMode = isCutServe ? 'cut' : (isLongServe ? 'smash' : 'normal');
        this.ballSpinAccel = 0;
        this.ballHorizDrag = 0;
        this.ballCurveAccelX = 0;
        this.serveFlightHorizDrag = 0;
        this.serveFlightCurveX = 0;
        this.ballBounceScaleY = 0.82;
        this.ballBounceScaleZ = 0.97;
        this.netFault = false;
        this.receiverBounces = 0;
        this.lastReceiverBounceZ = null;
        this.isServeFirstBounce = true;
        this.isShortServeActive = (server === 'player' && !isLongServe);
        this.servePhase = 'idle';
        this.lastHitter = server;
        this.npcReactionTimer = 0;
        const effectType = isCutServe ? 'cut' : (isLongServe ? 'smash' : 'lob');
        this.core.spawnHitEffect(this.ballPos, effectType);

        const targetY = this.tableHeight + this.ballRadius;

        if (server === 'player') {
            this.playerHitType = isCutServe ? 'cut' : 'fore';
            this.playerSwingTime = 0;

            const aimDir = keys.a ? -1 : (keys.d ? 1 : 0);
            const firstX = aimDir !== 0
                ? aimDir * (0.35 + (isLongServe ? 0.25 : 0.15))
                : this.playerGroup.position.x * 0.35 + (Math.random() - 0.5) * 0.25;

            if (isCutServe) {
                const cutRatio = Math.max(0, Math.min(1, servePower / 100));
                const curveDir = keys.a ? -1 : (keys.d ? 1 : -1);
                const firstZ = 1.18 + cutRatio * 0.28;
                this.serveDestX = (aimDir !== 0 ? aimDir : curveDir) * (0.35 + cutRatio * 0.65);
                this.serveDestZ = -(1.35 + cutRatio * 0.45);
                this.serveFlightDuration = 0.54 + cutRatio * 0.08;
                this.serveFlightSpin = 1.0 + cutRatio * 2.0;
                this.serveFlightHorizDrag = cutRatio * 0.55;
                this.serveFlightCurveX = curveDir * (cutRatio * 3.0);
                this.serveNextBounceY = 0.92 - cutRatio * 0.10;
                this.serveNextBounceZ = 0.90 - cutRatio * 0.16;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.24, 0));
            } else if (isLongServe) {
                const firstZ = 2.10 + pRatio * 0.25;
                this.serveDestX = aimDir !== 0 ? aimDir * (1.15 + pRatio * 0.32) : (Math.random() - 0.5) * 0.45;
                this.serveDestZ = -(2.15 + pRatio * 0.42);
                this.serveFlightDuration = 0.50 - pRatio * 0.05;
                this.serveFlightSpin = -4.5 - pRatio * 3.0;
                this.serveNextBounceY = 0.75;
                this.serveNextBounceZ = 1.06 + pRatio * 0.06;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.26, 0));
            } else {
                const firstZ = 1.15 + Math.random() * 0.15;
                this.serveDestX = aimDir !== 0 ? aimDir * 1.05 : (Math.random() - 0.5) * 0.35;
                this.serveDestZ = -(1.05 + Math.random() * 0.18);
                this.serveFlightDuration = 0.56;
                this.serveFlightSpin = 0;
                this.serveNextBounceY = 0.84;
                this.serveNextBounceZ = 0.88;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.25, 0));
            }

            this.playerCanHit = false;
            this.npcCanHit = false;

            if (this.onlineMode && typeof TTNetwork !== 'undefined') {
                this.onlineSeq++;
                const payload = {
                    seq: this.onlineSeq,
                    isServe: true,
                    pos: { x: this.mirrorX(this.ballPos.x), y: this.ballPos.y, z: this.mirrorZ(this.ballPos.z) },
                    vel: { x: this.mirrorX(this.ballVel.x), y: this.ballVel.y, z: this.mirrorZ(this.ballVel.z) },
                    serveDestX: this.mirrorX(this.serveDestX),
                    serveDestZ: this.mirrorZ(this.serveDestZ),
                    serveFlightDuration: this.serveFlightDuration,
                    serveFlightSpin: this.serveFlightSpin,
                    serveFlightHorizDrag: this.serveFlightHorizDrag,
                    serveFlightCurveX: this.mirrorX(this.serveFlightCurveX),
                    serveNextBounceY: this.serveNextBounceY,
                    serveNextBounceZ: this.serveNextBounceZ,
                    hitType: this.playerHitType,
                    trailMode: this.trailMode,
                    effectType,
                    isSmashSound: isLongServe
                };
                TTNetwork.send(this.onlineRole === 'host' ? 'host_serve' : 'guest_serve', payload);
            }
        } else {
            this.npcHitType = 'fore';
            this.npcSwingTime = 0;

            const aimDir = npcLevel >= 3 ? (Math.random() > 0.5 ? 1 : -1) : 0;
            const firstX = aimDir !== 0 ? aimDir * 0.45 : (Math.random() - 0.5) * 0.4;

            if (isLongServe) {
                const firstZ = -(2.10 + pRatio * 0.25);
                this.serveDestX = aimDir !== 0 ? aimDir * (1.10 + pRatio * 0.25) : (Math.random() - 0.5) * 0.6;
                this.serveDestZ = 2.10 + pRatio * 0.35;
                this.serveFlightDuration = 0.51 - pRatio * 0.04;
                this.serveFlightSpin = -4.5 - pRatio * 2.5;
                this.serveNextBounceY = 0.76;
                this.serveNextBounceZ = 1.05;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.26, 0));
            } else {
                const firstZ = -(1.15 + Math.random() * 0.15);
                this.serveDestX = aimDir !== 0 ? aimDir * 0.95 : (Math.random() - 0.5) * 0.5;
                this.serveDestZ = 1.05 + Math.random() * 0.18;
                this.serveFlightDuration = 0.56;
                this.serveFlightSpin = 0;
                this.serveNextBounceY = 0.84;
                this.serveNextBounceZ = 0.88;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.25, 0));
            }

            this.playerCanHit = true;
            this.npcCanHit = false;
        }
        gameState = 'rally';
    },

    getReachInfo(charPos, ballPos, isPlayer, maxReachXOverride = null) {
        if (ballPos.y < 0.4 || ballPos.y > 2.9) {
            return { inRange: false, isDive: false, dir: 0 };
        }
        const dx = ballPos.x - charPos.x;
        const absX = Math.abs(dx);
        const maxX = maxReachXOverride !== null ? maxReachXOverride : this.maxReachX;

        const forwardDist = isPlayer ? (charPos.z - ballPos.z) : (ballPos.z - charPos.z);
        if (forwardDist < -this.reachBackZ || forwardDist > this.reachFrontZ || absX > maxX) {
            return { inRange: false, isDive: false, dir: 0 };
        }

        const isDive = absX > this.normalReachX;
        return { inRange: true, isDive, dir: dx >= 0 ? 1 : -1 };
    },

    checkInRange(charPos, ballPos, isPlayer = true, maxReachXOverride = null) {
        return this.getReachInfo(charPos, ballPos, isPlayer, maxReachXOverride).inRange;
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

    hitBall(hitter, hitPower, reachInfo = null, mode = 'up') {
        const isStop = (hitter === 'player' && keys.s);
        const isDownBtn = (hitter === 'player' && mode === 'down' && !isStop);
        const isCut = (isDownBtn && hitPower >= 50);
        const isPush = (isDownBtn && hitPower < 50);
        const isDrive = (!isStop && !isDownBtn && hitPower >= 50);

        const targetY = this.tableHeight + this.ballRadius;
        this.isServeFirstBounce = false;
        this.isShortServeActive = false;
        this.netFault = false;
        this.receiverBounces = 0;
        this.lastReceiverBounceZ = null;
        this.lastHitter = hitter;

        if (hitter === 'player') {
            const reach = reachInfo || this.getReachInfo(this.playerGroup.position, this.ballPos, true);
            const relX = this.ballPos.x - this.playerGroup.position.x;
            const isMiddle = !reach.isDive && Math.abs(relX) <= this.middleThresholdX;

            this.playerHitType = isStop ? 'stop' : (isDownBtn ? 'cut' : (relX < -this.middleThresholdX ? 'back' : 'fore'));
            this.playerSwingTime = 0;
            this.playerCanHit = false;
            this.npcCanHit = true;
            this.npcReactionTimer = 0;

            let tx = keys.a ? -1.10 : (keys.d ? 1.10 : (Math.random() - 0.5) * 0.65);
            let tz = -1.65 - Math.random() * 0.55;
            let duration = 0.78;
            let spinAccel = 0;
            let horizDrag = 0;
            let bounceY = 0.84;
            let bounceZ = 0.96;
            let isSmashSound = false;
            let effectType = 'lob';

            if (reach.isDive) {
                this.playerDiveTime = 0;
                this.playerDiveDir = reach.dir;
                this.playerRecoveryTime = this.recoveryDuration;

                if (isDownBtn) {
                    if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                    const pRatio = Math.max(0, Math.min(1, hitPower / 100));
                    tx = keys.a ? -0.85 : (keys.d ? 0.85 : (Math.random() - 0.5) * 0.6);
                    tz = -1.55 - pRatio * 0.35 - Math.random() * 0.25;
                    duration = 0.76;
                    spinAccel = 3.6 + pRatio * 1.2;
                    horizDrag = 0.65 + pRatio * 0.25;
                    bounceY = 0.62 - pRatio * 0.06;
                    bounceZ = 0.75 - pRatio * 0.06;
                    this.trailIsSmash = false;
                    this.trailMode = 'cut';
                    effectType = 'cut';
                    this.core.spawnHitEffect(this.ballPos, 'cut');
                    this.core.spawnRing(new THREE.Vector3(this.playerGroup.position.x, 0.05, this.playerGroup.position.z), 0x00d8ff, 0.4, 1.8, 0.28, true, 0.7);
                } else {
                    if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                    tx = (Math.random() - 0.5) * 0.6;
                    tz = -1.35 - Math.random() * 0.45;
                    duration = 1.12;
                    bounceY = 0.96;
                    bounceZ = 0.84;
                    this.trailIsSmash = false;
                    this.trailMode = 'normal';
                    effectType = 'lob';
                    this.core.spawnHitEffect(this.ballPos, 'lob');
                    this.core.spawnRing(new THREE.Vector3(this.playerGroup.position.x, 0.05, this.playerGroup.position.z), 0xffffff, 0.4, 1.8, 0.28, true, 0.65);
                }
            } else if (isMiddle) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tx *= 0.4;
                tz = -1.25 - Math.random() * 0.45;
                duration = 0.94;
                bounceY = 0.92;
                bounceZ = 0.90;
                this.trailIsSmash = false;
                this.trailMode = 'normal';
                effectType = 'drop';
                this.core.spawnHitEffect(this.ballPos, 'drop');
            } else if (isStop) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tz = -0.82 - Math.random() * 0.25;
                duration = 0.64;
                this.trailIsSmash = false;
                this.trailMode = 'normal';
                effectType = 'drop';
                this.core.spawnHitEffect(this.ballPos, 'drop');
            } else if (isCut) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                const pRatio = Math.max(0, Math.min(1, (hitPower - 50) / 50));
                if (keys.a) {
                    tx = -(1.05 + pRatio * 0.35);
                } else if (keys.d) {
                    tx = (1.05 + pRatio * 0.35);
                } else {
                    tx = (Math.random() - 0.5) * 0.75;
                }
                tz = -1.35 - pRatio * 0.45 - Math.random() * 0.30;
                duration = 0.72 + pRatio * 0.10;
                spinAccel = 3.8 + pRatio * 1.4;
                horizDrag = 0.75 + pRatio * 0.35;
                bounceY = 0.60 - pRatio * 0.08;
                bounceZ = 0.74 - pRatio * 0.08;
                this.trailIsSmash = false;
                this.trailMode = 'cut';
                effectType = 'cut';
                this.core.spawnHitEffect(this.ballPos, 'cut');
            } else if (isPush) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tz = -1.30 - Math.random() * 0.40;
                duration = 0.52;
                spinAccel = 2.0;
                horizDrag = 0.35;
                bounceY = 0.70;
                bounceZ = 0.84;
                this.trailIsSmash = false;
                this.trailMode = 'normal';
                effectType = 'drop';
                this.core.spawnHitEffect(this.ballPos, 'drop');
            } else if (isDrive) {
                isSmashSound = true;
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(true);
                const pRatio = Math.max(0, Math.min(1, (hitPower - 50) / 50));
                if (keys.a) {
                    tx = -(1.15 + pRatio * 0.40);
                } else if (keys.d) {
                    tx = (1.15 + pRatio * 0.40);
                } else {
                    tx = (Math.random() - 0.5) * (0.65 + pRatio * 0.90);
                }
                duration = 0.46 - pRatio * 0.19;
                tz = -1.75 - pRatio * 0.35 - Math.random() * 0.25;
                spinAccel = -14.0 - pRatio * 12.0;
                bounceY = 0.70 - pRatio * 0.08;
                bounceZ = 1.08 + pRatio * 0.14;
                this.trailIsSmash = true;
                this.trailMode = 'smash';
                effectType = 'smash';
                this.core.spawnHitEffect(this.ballPos, 'smash');
            } else {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                const lowRatio = Math.max(0, Math.min(1, hitPower / 50));
                duration = 0.86 - lowRatio * 0.18;
                tz = -1.50 - Math.random() * 0.50;
                bounceY = 0.86;
                this.trailIsSmash = false;
                this.trailMode = 'normal';
                effectType = 'lob';
                this.core.spawnHitEffect(this.ballPos, 'lob');
            }

            this.ballSpinAccel = spinAccel;
            this.ballHorizDrag = horizDrag;
            this.ballCurveAccelX = 0;
            this.ballBounceScaleY = bounceY;
            this.ballBounceScaleZ = bounceZ;
            const target = new THREE.Vector3(tx, targetY, tz);
            this.ballVel.copy(this.computeBallVelocity(this.ballPos, target, duration, spinAccel, horizDrag, 0));

            if (this.onlineMode && typeof TTNetwork !== 'undefined') {
                this.onlineSeq++;
                const payload = {
                    seq: this.onlineSeq,
                    pos: { x: this.mirrorX(this.ballPos.x), y: this.ballPos.y, z: this.mirrorZ(this.ballPos.z) },
                    vel: { x: this.mirrorX(this.ballVel.x), y: this.ballVel.y, z: this.mirrorZ(this.ballVel.z) },
                    spin: this.ballSpinAccel,
                    horizDrag: this.ballHorizDrag,
                    curveX: this.mirrorX(this.ballCurveAccelX),
                    bounceY: this.ballBounceScaleY,
                    bounceZ: this.ballBounceScaleZ,
                    hitType: this.playerHitType,
                    trailMode: this.trailMode,
                    effectType,
                    isSmashSound,
                    isDive: reach.isDive,
                    diveDir: this.mirrorX(reach.dir)
                };
                TTNetwork.send(this.onlineRole === 'host' ? 'host_hit' : 'guest_hit', payload);
            }
        } else {
            const reach = reachInfo || this.getReachInfo(this.npcGroup.position, this.ballPos, false);
            const relX = this.ballPos.x - this.npcGroup.position.x;
            const isMiddle = !reach.isDive && Math.abs(relX) <= this.middleThresholdX;

            this.npcHitType = relX > this.middleThresholdX ? 'back' : 'fore';
            this.npcSwingTime = 0;
            this.npcCanHit = false;
            this.playerCanHit = true;
            this.npcReactionTimer = 0;

            let tx = this.playerGroup.position.x > 0 ? -0.95 : 0.95;
            if (npcLevel >= 3) {
                tx = this.playerGroup.position.x > 0.35 ? -1.15 : (this.playerGroup.position.x < -0.35 ? 1.15 : (Math.random() > 0.5 ? 1.1 : -1.1));
            }

            let tz = 1.55 + Math.random() * 0.55;
            let duration = 0.78;
            let spinAccel = 0;
            let bounceY = 0.84;
            let bounceZ = 0.96;
            let shotType = 'lob';

            if (reach.isDive) {
                this.npcDiveTime = 0;
                this.npcDiveDir = reach.dir;
                this.npcRecoveryTime = this.recoveryDuration;

                tx = (Math.random() - 0.5) * 0.6;
                tz = 1.35 + Math.random() * 0.45;
                duration = 1.12;
                bounceY = 0.96;
                bounceZ = 0.84;
                shotType = 'lob';
                this.core.spawnRing(new THREE.Vector3(this.npcGroup.position.x, 0.05, this.npcGroup.position.z), 0xffffff, 0.4, 1.8, 0.28, true, 0.65);
            } else if (isMiddle) {
                tx = (Math.random() - 0.5) * 0.65;
                tz = 1.25 + Math.random() * 0.45;
                duration = 0.96;
                bounceY = 0.93;
                bounceZ = 0.90;
                shotType = 'drop';
            } else if (npcLevel === 4) {
                const isHighBall = this.ballPos.y >= this.tableHeight + 0.35;
                if (isHighBall) {
                    duration = 0.36;
                    tz = 1.90 + Math.random() * 0.35;
                    spinAccel = -18.0;
                    bounceY = 0.68;
                    bounceZ = 1.14;
                    shotType = 'smash';
                } else if (Math.random() < 0.25) {
                    duration = 0.65;
                    tz = 0.82 + Math.random() * 0.25;
                    shotType = 'drop';
                } else {
                    duration = 0.64;
                }
            } else if (npcLevel === 3) {
                const isHighBall = this.ballPos.y >= this.tableHeight + 0.38;
                if (isHighBall && Math.random() < 0.5) {
                    duration = 0.44;
                    tz = 1.80 + Math.random() * 0.4;
                    spinAccel = -14.0;
                    bounceY = 0.72;
                    bounceZ = 1.08;
                    shotType = 'smash';
                } else {
                    duration = 0.70;
                }
            } else if (npcLevel === 2) {
                duration = 0.76;
            } else {
                tx = (Math.random() - 0.5) * 1.25;
                duration = 0.86;
            }

            if (typeof BadmintonAudio !== 'undefined') {
                BadmintonAudio.playHit(shotType === 'smash');
            }
            this.ballSpinAccel = spinAccel;
            this.ballHorizDrag = 0;
            this.ballCurveAccelX = 0;
            this.ballBounceScaleY = bounceY;
            this.ballBounceScaleZ = bounceZ;
            this.trailIsSmash = (shotType === 'smash');
            this.trailMode = (shotType === 'smash') ? 'smash' : 'normal';
            this.core.spawnHitEffect(this.ballPos, shotType);
            const target = new THREE.Vector3(tx, targetY, tz);
            this.ballVel.copy(this.computeBallVelocity(this.ballPos, target, duration, spinAccel));
        }
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

    updateNPC(dt) {
        if (this.onlineMode) {
            this.updateRemoteOpponent(dt);
            return;
        }
        if (gameState !== 'rally') return;

        // 飛びつきジャンプ中は横方向へ飛び込み、終了後はリカバリー遅延に入る
        if (this.npcDiveTime >= 0) {
            this.npcGroup.position.x += this.npcDiveDir * 2.6 * dt;
            this.npcGroup.position.x = Math.max(-this.limitX, Math.min(this.limitX, this.npcGroup.position.x));
            return;
        }

        let speed = this.npcBaseSpeed;
        if (npcLevel === 2) speed = this.npcBaseSpeed * 1.18;
        if (npcLevel === 3) speed = this.npcBaseSpeed * 1.32;
        if (npcLevel === 4) speed = this.npcBaseSpeed * 1.50;
        if (this.npcRecoveryTime > 0) speed *= 0.30;

        let targetX = 0;
        let targetZ = -3.8;

        if (this.lastHitter === 'player') {
            this.npcReactionTimer += dt;
            const reactionDelay = (npcLevel === 1) ? 0.46 : (npcLevel === 2) ? 0.40 : (npcLevel === 3) ? 0.37 : 0.29;

            if (this.npcReactionTimer < reactionDelay) {
                targetX = this.npcGroup.position.x;
                targetZ = this.npcGroup.position.z;
            } else if (npcLevel >= 3) {
                if (this.isShortServeActive) {
                    const aimX = this.isServeFirstBounce ? this.serveDestX : this.ballPos.x;
                    targetX = Math.max(-this.limitX, Math.min(this.limitX, aimX + 0.42));
                    targetZ = this.npcZMax;
                } else if (this.isServeFirstBounce) {
                    targetX = Math.max(-this.limitX, Math.min(this.limitX, this.serveDestX + 0.48));
                    targetZ = Math.max(this.npcZMin, Math.min(this.npcZMax, this.serveDestZ - 1.75));
                } else {
                    const info = this.predictBallInfo(-2.3);
                    const bz = (this.receiverBounces >= 1 && this.lastReceiverBounceZ !== null)
                        ? this.lastReceiverBounceZ
                        : (info.bounce ? info.bounce.z : (info.hit ? info.hit.z : this.ballPos.z));
                    const px = info.hit ? info.hit.x : (info.bounce ? info.bounce.x : this.ballPos.x);
                    targetX = Math.max(-this.limitX, Math.min(this.limitX, px + 0.48));
                    targetZ = Math.max(this.npcZMin, Math.min(this.npcZMax, bz - 1.75));
                }
            } else {
                targetX = Math.max(-this.limitX, Math.min(this.limitX, this.ballPos.x + 0.42));
                targetZ = Math.max(this.npcZMin, Math.min(this.npcZMax, this.ballPos.z - 0.65));
            }
        } else {
            this.npcReactionTimer = 0;
            if (npcLevel === 1) {
                targetX = this.npcGroup.position.x;
                targetZ = this.npcGroup.position.z;
            } else if (npcLevel === 2) {
                targetX = 0;
                targetZ = -3.8;
                speed *= 0.4;
            } else {
                targetX = 0;
                targetZ = -3.8;
            }
        }

        const dx = targetX - this.npcGroup.position.x;
        const dz = targetZ - this.npcGroup.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.14) {
            this.npcGroup.position.x += (dx / dist) * speed * dt;
            this.npcGroup.position.z += (dz / dist) * speed * dt;
            this.npcGroup.position.x = Math.max(-this.limitX, Math.min(this.limitX, this.npcGroup.position.x));
            this.npcGroup.position.z = Math.max(this.npcZMin, Math.min(this.npcZMax, this.npcGroup.position.z));
        }

        if (this.npcCanHit && this.receiverBounces === 1 && this.ballPos.z < -0.2) {
            const npcMaxX = npcLevel >= 3 ? this.maxReachX * 0.96 : this.maxReachX * 0.88;
            const reach = this.getReachInfo(this.npcGroup.position, this.ballPos, false, npcMaxX);
            if (reach.inRange) {
                this.hitBall('npc', 70, reach);
            }
        }
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

    predictBallInfo(targetZ) {
        const p = this._predPos.copy(this.ballPos);
        const v = this._predVel.copy(this.ballVel);
        let spin = this.ballSpinAccel;
        let horizDrag = this.ballHorizDrag;
        let curveX = this.ballCurveAccelX;
        const step = 0.03;
        let hasBounce = false;
        let hasHit = false;

        for (let i = 0; i < 80; i++) {
            v.x += curveX * step;
            v.y += (this.gravity + spin) * step;
            if (horizDrag > 0) {
                const hf = Math.exp(-horizDrag * step);
                v.x *= hf;
                v.z *= hf;
            }
            p.addScaledVector(v, step);
            if (p.y <= this.tableHeight + this.ballRadius && v.y < 0 && Math.abs(p.x) <= this.tableWidth / 2 && Math.abs(p.z) <= this.tableLength / 2) {
                p.y = this.tableHeight + this.ballRadius;
                if (!hasBounce && p.z < 0) {
                    this._predBounce.copy(p);
                    hasBounce = true;
                }
                v.y = Math.abs(v.y) * this.ballBounceScaleY;
                v.z *= this.ballBounceScaleZ;
                spin = 0;
                horizDrag = 0;
                curveX *= 0.25;
            }
            if (!hasHit && p.z <= targetZ) {
                this._predHit.copy(p);
                hasHit = true;
            }
            if (hasBounce && hasHit) break;
        }
        this._predResult.bounce = hasBounce ? this._predBounce : null;
        this._predResult.hit = hasHit ? this._predHit : null;
        return this._predResult;
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

    updateChargeVFX(dt) {
        if (!this.chargeRing) return;
        if (isCharging && (gameState === 'rally' || gameState === 'serve-player')) {
            const isCutMode = (chargeMode === 'down');
            if (isCutMode) {
                this.chargeRing.visible = true;
                this.chargeRing.material.color.setHex(power >= 50 ? 0x00e5ff : 0x70f0ff);
                this.chargeRing.material.opacity = power >= 50 ? 0.92 : 0.50;
                const pulse = 1 + Math.sin(this.core.idleTime * 12) * 0.06;
                this.chargeRing.scale.setScalar(pulse);

                this.chargeSparkTimer += dt;
                if (this.chargeSparkTimer >= (power >= 50 ? 0.045 : 0.09)) {
                    this.chargeSparkTimer = 0;
                    const angle = Math.random() * Math.PI * 2;
                    const rad = 0.35 + Math.random() * 0.5;
                    this._tmpVec3D.set(
                        this.playerGroup.position.x + Math.cos(angle) * rad,
                        0.12,
                        this.playerGroup.position.z + Math.sin(angle) * rad
                    );
                    this.core.spawnSparks(this._tmpVec3D, power >= 50 ? 0x00d8ff : 0x8ef5ff, 1, 2.0, 4.2, 0.34, 0.85, 1.0);
                }
            } else if (power >= 50) {
                this.chargeRing.visible = true;
                this.chargeRing.material.color.setHex(power >= 95 ? 0xff3b30 : 0xff9500);
                this.chargeRing.material.opacity = 0.85;
                const pulse = 1 + Math.sin(this.core.idleTime * 12) * 0.06;
                this.chargeRing.scale.setScalar(pulse);

                this.chargeSparkTimer += dt;
                if (this.chargeSparkTimer >= 0.045) {
                    this.chargeSparkTimer = 0;
                    const angle = Math.random() * Math.PI * 2;
                    const rad = 0.35 + Math.random() * 0.5;
                    this._tmpVec3D.set(
                        this.playerGroup.position.x + Math.cos(angle) * rad,
                        0.12,
                        this.playerGroup.position.z + Math.sin(angle) * rad
                    );
                    this.core.spawnSparks(this._tmpVec3D, power >= 95 ? 0xff4500 : 0xffd700, 1, 2.0, 4.2, 0.34, 0.85, 1.0);
                }
            } else {
                this.chargeRing.visible = false;
                this.chargeSparkTimer = 0;
            }
        } else {
            this.chargeRing.visible = false;
            this.chargeSparkTimer = 0;
        }
    },

    update(dt) {
        const menuBlockingInput = (typeof UIManager !== 'undefined' && UIManager.isMenuOpen);
        const isPlayerTossing = (gameState === 'serve-player' && this.servePhase === 'toss');

        if (this.playerDiveTime >= 0) {
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
                this.ballPos.set(this.playerGroup.position.x - 0.34, 1.18, this.playerGroup.position.z - 0.40);
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
                this.ballPos.x += (targetBallX - this.ballPos.x) * 3.5 * dt;
                this.ballPos.z = this.playerGroup.position.z - 0.40;

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
                this.ballPos.set(this.npcGroup.position.x + 0.34, 1.18, this.npcGroup.position.z + 0.40);
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
                this.ballPos.x += (targetBallX - this.ballPos.x) * 3.5 * dt;
                this.ballPos.z = this.npcGroup.position.z + 0.40;

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
        this.updateNPC(dt);

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

        // ボールと影の更新
        this.ballGroup.position.copy(this.ballPos);
        const overTable = Math.abs(this.ballPos.x) <= this.tableWidth / 2 && Math.abs(this.ballPos.z) <= this.tableLength / 2;
        this.ballShadow.position.set(this.ballPos.x, overTable ? this.tableHeight + 0.012 : 0.025, this.ballPos.z);

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