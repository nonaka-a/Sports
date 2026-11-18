const TableTennisGame = {
    core: null,
    rootGroup: null,
    playerGroup: null,
    npcGroup: null,
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
    playerZMin: 3.10,
    playerZMax: 5.5,
    npcZMin: -5.5,
    npcZMax: -3.10,
    hitRadius: 1.25,
    normalReachX: 0.78,
    maxReachX: 1.25,
    reachFrontZ: 1.25,
    reachBackZ: 0.30,
    middleThresholdX: 0.12,
    characterScale: 1.35,

    // 物理・ボール状態
    ballPos: new THREE.Vector3(0, 1.35, 3.2),
    ballVel: new THREE.Vector3(0, 0, 0),
    gravity: -12.5,
    ballSpinAccel: 0,
    ballBounceScaleY: 0.82,
    ballBounceScaleZ: 0.97,
    airDrag: 0.015,

    // ルール進行状態（卓球は常に11点先取・2球交代サーブ）
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
    trailPoints: [],
    trailMesh: null,
    trailIsSmash: false,
    trailMaxPoints: 14,

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

    // 卓球専用の軽い「ポンッ」というバウンド音を生成（ミュート連動）
    playBounceSound(isPaddle = false) {
        if (typeof BadmintonAudio !== 'undefined' && BadmintonAudio.isMuted) return;
        try {
            if (!this.audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                this.audioCtx = new AudioCtx();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            const startFreq = isPaddle ? 950 : 1280;
            const endFreq = isPaddle ? 420 : 680;
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.045);

            gain.gain.setValueAtTime(isPaddle ? 0.22 : 0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
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
        const dummyTex = this.core.createStringBedTexture('#ffffff');

        const shadowGeo = new THREE.RingGeometry(0, 0.56, 28);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide
        });

        // プレイヤーキャラ（サイズ拡大＋接地位置補正）
        this.playerGroup = new THREE.Group();
        const playerBody = this.core.createSportsCharacter({
            primaryColor: 0xff3b30,
            accentColor: 0xffd700,
            shortsColor: 0x1c1c1e,
            hairColor: 0x2b1d14,
            faceBack: true,
            hasCap: true,
            stringTex: dummyTex
        });
        playerBody.scale.setScalar(this.characterScale);
        playerBody.position.y = 0.5 * this.characterScale;
        this.swapToTableTennisRacket(playerBody, 0xd92626, 0xffd700);
        this.playerGroup.add(playerBody);

        const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
        playerShadow.rotation.x = -Math.PI / 2;
        playerShadow.position.y = 0.025;
        this.playerGroup.add(playerShadow);

        // 足元ヒット可能範囲リング
        const rangeGeo = new THREE.RingGeometry(this.hitRadius - 0.07, this.hitRadius, 48);
        const rangeMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.42,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1.0,
            polygonOffsetUnits: -1.0
        });
        const rangeMesh = new THREE.Mesh(rangeGeo, rangeMat);
        rangeMesh.name = "ttRangeRing";
        rangeMesh.rotation.x = -Math.PI / 2;
        rangeMesh.position.y = 0.028;
        rangeMesh.visible = false;
        this.playerGroup.add(rangeMesh);

        this.playerGroup.position.set(0, 0, 3.8);
        this.rootGroup.add(this.playerGroup);

        // NPCキャラ（サイズ拡大＋接地位置補正）
        this.npcGroup = new THREE.Group();
        const npcBody = this.core.createSportsCharacter({
            primaryColor: 0x007aff,
            accentColor: 0x00d4ff,
            shortsColor: 0x182235,
            hairColor: 0x1f242d,
            faceBack: false,
            hasCap: false,
            stringTex: dummyTex
        });
        npcBody.scale.setScalar(this.characterScale);
        npcBody.position.y = 0.5 * this.characterScale;
        this.swapToTableTennisRacket(npcBody, 0xd92626, 0x00d4ff);
        this.npcGroup.add(npcBody);

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
        this.trailPoints = [];
        this.trailIsSmash = false;
        if (this.trailMesh) this.trailMesh.visible = false;
    },

    updateTrail(active) {
        if (!this.trailMesh) return;
        if (!active) {
            this.trailPoints = [];
            this.trailMesh.visible = false;
            return;
        }

        this.trailPoints.unshift(this.ballPos.clone());
        if (this.trailPoints.length > this.trailMaxPoints) {
            this.trailPoints.pop();
        }
        if (this.trailPoints.length < 2) {
            this.trailMesh.visible = false;
            return;
        }

        this.trailMesh.visible = true;
        this.trailMesh.material.color.setHex(this.trailIsSmash ? 0xff7b00 : 0x99ebff);
        this.trailMesh.material.opacity = this.trailIsSmash ? 0.78 : 0.42;

        const maxHalfWidth = this.trailIsSmash ? 0.095 : 0.045;
        const posAttr = this.trailMesh.geometry.attributes.position;
        const arr = posAttr.array;

        const camPos = this.core.camera.position;
        const dir = new THREE.Vector3();
        const toCam = new THREE.Vector3();
        const side = new THREE.Vector3();

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

    startMatch(selectedCourtType, level, pts) {
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

    resetToServe(nextServer) {
        if (this.core.activeSport !== 'tabletennis') return;

        this.playerGroup.position.set(0, 0, 3.8);
        this.npcGroup.position.set(0, 0, -3.8);
        this.prevPlayerPos.copy(this.playerGroup.position);
        this.prevNpcPos.copy(this.npcGroup.position);

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
        this.resetDivePose(this.playerGroup);
        this.resetDivePose(this.npcGroup);
        this.resetVisualYaw(this.playerGroup, true);
        this.resetVisualYaw(this.npcGroup, false);
        this.resetTrail();

        power = 0;
        if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0);
        isCharging = false;

        this.ballSpinAccel = 0;
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
        this.resetTossArm(this.playerGroup);
        this.resetTossArm(this.npcGroup);

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
        const bodyM = group ? group.getObjectByName("bodyMesh") : null;
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        if (visualRoot) {
            visualRoot.rotation.y = isPlayer ? Math.PI : 0;
        }
    },

    // ターゲット地点へ指定時間 T で着弾する初速ベクトルを計算（トップスピンによる追加加速度対応）
    computeBallVelocity(start, target, duration, spinAccel = 0) {
        const totalGravity = this.gravity + spinAccel;
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const dz = target.z - start.z;
        const vx = dx / duration;
        const vz = dz / duration;
        const vy = (dy - 0.5 * totalGravity * duration * duration) / duration;
        return new THREE.Vector3(vx, vy, vz);
    },

    resetTossArm(group) {
        const bodyM = group ? group.getObjectByName("bodyMesh") : null;
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        const leftArm = visualRoot ? visualRoot.getObjectByName("leftArm") : null;
        if (leftArm) {
            leftArm.rotation.set(0, 0, 0);
        }
    },

    updateTossArm(group, mode, dt) {
        const bodyM = group ? group.getObjectByName("bodyMesh") : null;
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        const leftArm = visualRoot ? visualRoot.getObjectByName("leftArm") : null;
        if (!leftArm) return;
        let targetRotX = 0;
        if (mode === 'hold') targetRotX = -1.05;
        else if (mode === 'toss') targetRotX = -2.45;
        leftArm.rotation.x += (targetRotX - leftArm.rotation.x) * 16 * dt;
    },

    serveBall(server, servePower = 30) {
        const isLongServe = (servePower >= 50);
        const pRatio = isLongServe ? Math.max(0, Math.min(1, (servePower - 50) / 50)) : 0;

        if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(isLongServe);
        this.trailIsSmash = isLongServe;
        this.ballSpinAccel = 0;
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
        this.core.spawnHitEffect(this.ballPos, isLongServe ? 'smash' : 'lob');

        const targetY = this.tableHeight + this.ballRadius;

        if (server === 'player') {
            this.playerHitType = 'fore';
            this.playerSwingTime = 0;

            // 十字キーで左右方向を打ち分け（無入力時は中央寄り）
            const aimDir = keys.a ? -1 : (keys.d ? 1 : 0);
            const firstX = aimDir !== 0
                ? aimDir * (0.35 + (isLongServe ? 0.25 : 0.15))
                : this.playerGroup.position.x * 0.35 + (Math.random() - 0.5) * 0.25;

            if (isLongServe) {
                // 長めチャージ：自陣奥バウンドから相手エンドライン付近へ伸びるロングサーブ
                const firstZ = 2.10 + pRatio * 0.25;
                this.serveDestX = aimDir !== 0 ? aimDir * (1.15 + pRatio * 0.32) : (Math.random() - 0.5) * 0.45;
                this.serveDestZ = -(2.15 + pRatio * 0.42);
                this.serveFlightDuration = 0.42 - pRatio * 0.05;
                this.serveFlightSpin = -6.0 - pRatio * 4.0;
                this.serveNextBounceY = 0.72;
                this.serveNextBounceZ = 1.10 + pRatio * 0.08;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.22, 0));
            } else {
                // 少なめチャージ：少し距離を出しつつエンドライン際で収まるショートサーブ
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
        } else {
            this.npcHitType = 'fore';
            this.npcSwingTime = 0;

            const aimDir = npcLevel >= 3 ? (Math.random() > 0.5 ? 1 : -1) : 0;
            const firstX = aimDir !== 0 ? aimDir * 0.45 : (Math.random() - 0.5) * 0.4;

            if (isLongServe) {
                const firstZ = -(2.10 + pRatio * 0.25);
                this.serveDestX = aimDir !== 0 ? aimDir * (1.10 + pRatio * 0.25) : (Math.random() - 0.5) * 0.6;
                this.serveDestZ = 2.10 + pRatio * 0.35;
                this.serveFlightDuration = 0.44 - pRatio * 0.04;
                this.serveFlightSpin = -6.0 - pRatio * 3.0;
                this.serveNextBounceY = 0.74;
                this.serveNextBounceZ = 1.08;
                this.ballVel.copy(this.computeBallVelocity(this.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.23, 0));
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

        // キャラクターの正面方向を正、背面（振り遅れ）を負として前後リーチを判定
        const forwardDist = isPlayer ? (charPos.z - ballPos.z) : (ballPos.z - charPos.z);
        if (forwardDist < -this.reachBackZ || forwardDist > this.reachFrontZ) {
            return { inRange: false, isDive: false, dir: 0 };
        }
        if (absX > maxX) {
            return { inRange: false, isDive: false, dir: 0 };
        }

        const isDive = absX > this.normalReachX;
        return { inRange: true, isDive, dir: dx >= 0 ? 1 : -1 };
    },

    checkInRange(charPos, ballPos, isPlayer = true, maxReachXOverride = null) {
        return this.getReachInfo(charPos, ballPos, isPlayer, maxReachXOverride).inRange;
    },

    stopCharging() {
        if (gameState === 'serve-player') {
            this.serveBall('player', power);
        } else if (this.serveAutoFired) {
            this.serveAutoFired = false;
        } else if (gameState === 'rally' && this.playerCanHit && this.receiverBounces === 1) {
            const reach = this.getReachInfo(this.playerGroup.position, this.ballPos, true);
            if (reach.inRange && this.ballPos.z > 0.2) {
                this.hitBall('player', power, reach);
            } else if (this.playerSwingTime < 0) {
                this.playerHitType = (this.ballPos.x < this.playerGroup.position.x - this.middleThresholdX) ? 'back' : 'fore';
                this.playerSwingTime = 0;
            }
        } else if (gameState === 'rally' && this.playerSwingTime < 0) {
            this.playerHitType = (this.ballPos.x < this.playerGroup.position.x - this.middleThresholdX) ? 'back' : 'fore';
            this.playerSwingTime = 0;
        }
        power = 0;
        if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0);
    },

    hitBall(hitter, hitPower, reachInfo = null) {
        const isStop = (hitter === 'player' && keys.s);
        const isDrive = (!isStop && hitPower >= 50);

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

            this.playerHitType = relX < -this.middleThresholdX ? 'back' : 'fore';
            this.playerSwingTime = 0;
            this.playerCanHit = false;
            this.npcCanHit = true;
            this.npcReactionTimer = 0;

            let tx = keys.a ? -1.10 : (keys.d ? 1.10 : (Math.random() - 0.5) * 0.65);
            let tz = -1.65 - Math.random() * 0.55;
            let duration = 0.78;
            let spinAccel = 0;
            let bounceY = 0.84;
            let bounceZ = 0.96;

            if (reach.isDive) {
                // 左右隅への飛びつき返球：ジャンプアクション＆硬直＋高いチャンスボールのロビング
                this.playerDiveTime = 0;
                this.playerDiveDir = reach.dir;
                this.playerRecoveryTime = this.recoveryDuration;

                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tx = (Math.random() - 0.5) * 0.6;
                tz = -1.35 - Math.random() * 0.45;
                duration = 1.12;
                bounceY = 0.96;
                bounceZ = 0.84;
                this.trailIsSmash = false;
                this.core.spawnHitEffect(this.ballPos, 'lob');
                this.core.spawnRing(new THREE.Vector3(this.playerGroup.position.x, 0.05, this.playerGroup.position.z), 0xffffff, 0.4, 1.8, 0.28, true, 0.65);
            } else if (isMiddle) {
                // ミドルに詰まった時は、ために関わらず遅く高い山なりのチャンスボールになる
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tx *= 0.4;
                tz = -1.25 - Math.random() * 0.45;
                duration = 0.94;
                bounceY = 0.92;
                bounceZ = 0.90;
                this.trailIsSmash = false;
                this.core.spawnHitEffect(this.ballPos, 'drop');
            } else if (isStop) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tz = -0.82 - Math.random() * 0.25;
                duration = 0.64;
                this.trailIsSmash = false;
                this.core.spawnHitEffect(this.ballPos, 'drop');
            } else if (isDrive) {
                // ため50%以上：ためるほどスピードが増し、左右コースもサイドライン際(最大±1.55)まで厳しく打てるドライブ
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
                this.core.spawnHitEffect(this.ballPos, 'smash');
            } else {
                // ためが少ない時：山なり気味でゆっくりな返球（ため量に応じて少しずつ速くなる）
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                const lowRatio = Math.max(0, Math.min(1, hitPower / 50));
                duration = 0.86 - lowRatio * 0.18;
                tz = -1.50 - Math.random() * 0.50;
                bounceY = 0.86;
                this.trailIsSmash = false;
                this.core.spawnHitEffect(this.ballPos, 'lob');
            }

            this.ballSpinAccel = spinAccel;
            this.ballBounceScaleY = bounceY;
            this.ballBounceScaleZ = bounceZ;
            const target = new THREE.Vector3(tx, targetY, tz);
            this.ballVel.copy(this.computeBallVelocity(this.ballPos, target, duration, spinAccel));
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
                // NPCも左右隅で打つ時は飛びつきアクション＆ゆっくりなロビング
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
            this.ballBounceScaleY = bounceY;
            this.ballBounceScaleZ = bounceZ;
            this.trailIsSmash = (shotType === 'smash');
            this.core.spawnHitEffect(this.ballPos, shotType);
            const target = new THREE.Vector3(tx, targetY, tz);
            this.ballVel.copy(this.computeBallVelocity(this.ballPos, target, duration, spinAccel));
        }
    },

    updateNPC(dt) {
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

        // プレイヤーが打ってから一瞬間（反応遅延）を置いて動き出す
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

        // ワンバウンド後に範囲内へ入ったら打ち返す
        if (this.npcCanHit && this.receiverBounces === 1 && this.ballPos.z < -0.2) {
            const npcMaxX = npcLevel >= 3 ? this.maxReachX * 0.96 : this.maxReachX * 0.88;
            const reach = this.getReachInfo(this.npcGroup.position, this.ballPos, false, npcMaxX);
            if (reach.inRange) {
                this.hitBall('npc', 70, reach);
            }
        }
    },

    resetDivePose(group) {
        const bodyM = group ? group.getObjectByName("bodyMesh") : null;
        if (bodyM) {
            bodyM.position.y = 0.5 * this.characterScale;
            bodyM.rotation.z = 0;
        }
    },

    updateDiveAnimation(group, diveTimeKey, diveDir, recoveryTimeKey, dt) {
        const bodyM = group ? group.getObjectByName("bodyMesh") : null;
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
        const p = this.ballPos.clone();
        const v = this.ballVel.clone();
        let spin = this.ballSpinAccel;
        const step = 0.03;
        let firstBounce = null;
        let targetHit = null;

        for (let i = 0; i < 80; i++) {
            v.y += (this.gravity + spin) * step;
            p.addScaledVector(v, step);
            if (p.y <= this.tableHeight + this.ballRadius && v.y < 0 && Math.abs(p.x) <= this.tableWidth / 2 && Math.abs(p.z) <= this.tableLength / 2) {
                p.y = this.tableHeight + this.ballRadius;
                if (!firstBounce && p.z < 0) {
                    firstBounce = p.clone();
                }
                v.y = Math.abs(v.y) * this.ballBounceScaleY;
                v.z *= this.ballBounceScaleZ;
                spin = 0;
            }
            if (!targetHit && p.z <= targetZ) {
                targetHit = p.clone();
            }
            if (firstBounce && targetHit) break;
        }
        return { bounce: firstBounce, hit: targetHit };
    },

    // バックハンド時の腕・体のひねりアニメーション上書き処理
    applyBackhandSwingAnimation(group, isPlayer, swingTime, dt) {
        const bodyM = group ? group.getObjectByName("bodyMesh") : null;
        const visualRoot = bodyM ? bodyM.getObjectByName("visualRoot") : null;
        if (!visualRoot) return;

        const baseYaw = isPlayer ? Math.PI : 0;
        const racketArm = visualRoot.getObjectByName("racket");
        const swingArc = racketArm ? racketArm.getObjectByName("swingArc") : null;

        if (swingTime >= 0) {
            const duration = 0.25;
            const t = Math.min(1, swingTime / duration);
            const ease = Math.sin(t * Math.PI * 0.65);

            // 体を少し左ひねりから右前へ開くバックハンドモーション
            visualRoot.rotation.y = baseYaw + (-0.38 + ease * 0.52);

            if (racketArm) {
                // 胸の前(-Z)から右手前方(+Z)へ押し出すようにスイング
                racketArm.rotation.x = 0.82 + ease * 0.36;
                racketArm.rotation.y = 0.58 - ease * 1.38;
                racketArm.rotation.z = -1.25 + ease * 1.62;
            }
            if (swingArc) {
                swingArc.visible = true;
                swingArc.material.opacity = (1 - t) * 0.55;
            }
        } else {
            // スイング終了後は基準の正面向きとラケットY回転を滑らかに戻す
            visualRoot.rotation.y += (baseYaw - visualRoot.rotation.y) * 12 * dt;
            if (racketArm) {
                racketArm.rotation.y += (0 - racketArm.rotation.y) * 12 * dt;
            }
        }
    },

    scorePoint(winner, reasonText) {
        if (gameState === 'ended' || gameState === 'waiting') return;
        gameState = 'ended';
        this.trailIsSmash = false;

        if (typeof BadmintonAudio !== 'undefined') {
            BadmintonAudio.playCheer();
        }

        if (winner === 'player') {
            playerScore++;
            const pEl = document.getElementById('player-score');
            if (pEl) pEl.innerText = playerScore;
            this.core.showBanner(reasonText || "POINT FOR YOU!", "#34c759");
        } else {
            npcScore++;
            const nEl = document.getElementById('npc-score');
            if (nEl) nEl.innerText = npcScore;
            this.core.showBanner(reasonText || "POINT FOR NPC!", "#ff3b30");
        }

        if (playerScore >= this.ttMatchPoint || npcScore >= this.ttMatchPoint) {
            if (typeof UIManager !== 'undefined') {
                setTimeout(() => {
                    if (this.core.activeSport === 'tabletennis' && gameState === 'ended') {
                        UIManager.showResult(playerScore, npcScore);
                    }
                }, 1400);
            }
        } else {
            const totalPoints = playerScore + npcScore;
            const nextServer = (Math.floor(totalPoints / 2) % 2 === 0) ? 'player' : 'npc';
            setTimeout(() => {
                if (this.core.activeSport === 'tabletennis' && gameState === 'ended') {
                    this.resetToServe(nextServer);
                }
            }, 2000);
        }
    },

    update(dt) {
        // プレイヤー移動（飛びつきジャンプ中・サーブトス中は移動をロックし、トス中は十字キーを方向指定に使用）
        const isPlayerTossing = (gameState === 'serve-player' && this.servePhase === 'toss');
        if (this.playerDiveTime >= 0) {
            this.playerGroup.position.x += this.playerDiveDir * 2.6 * dt;
            this.playerGroup.position.x = Math.max(-this.limitX, Math.min(this.limitX, this.playerGroup.position.x));
        } else if (!isPlayerTossing) {
            let moveSpeed = this.playerSpeed;
            if (this.playerRecoveryTime > 0) moveSpeed *= 0.30;
            if (isCharging) moveSpeed *= 0.6;

            let mx = 0, mz = 0;
            if (keys.w) mz -= 1;
            if (keys.s) mz += 1;
            if (keys.a) mx -= 1;
            if (keys.d) mx += 1;

            if (mx !== 0 || mz !== 0) {
                const len = Math.hypot(mx, mz);
                this.playerGroup.position.x += (mx / len) * moveSpeed * dt;
                this.playerGroup.position.z += (mz / len) * moveSpeed * dt;
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
                    // チャージ開始と同時にボールを高くトスアップ
                    this.servePhase = 'toss';
                    this.serveTossVelY = 5.4;
                    this.serveArmTime = 0.35;
                    this.serveAutoFired = false;
                    this.core.spawnRing(this.ballPos, 0xffffff, 0.15, 0.65, 0.22, false, 0.6);
                }
            } else {
                this.serveTossVelY += this.gravity * dt;
                this.ballPos.y += this.serveTossVelY * dt;
                // 左手前からラケット側打点へ寄せる
                const targetBallX = this.playerGroup.position.x + 0.14;
                this.ballPos.x += (targetBallX - this.ballPos.x) * 3.5 * dt;
                this.ballPos.z = this.playerGroup.position.z - 0.40;

                if (this.serveTossVelY < 0 && this.ballPos.y <= 1.25) {
                    // トスが打点まで落ちてきたら自動サーブ（最大ためロング）
                    this.serveBall('player', power);
                    this.serveAutoFired = true;
                    isCharging = false;
                    power = 0;
                    if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0);
                }
            }
        } else if (gameState === 'serve-npc') {
            if (this.servePhase !== 'toss') {
                this.servePhase = 'idle';
                this.ballPos.set(this.npcGroup.position.x + 0.34, 1.18, this.npcGroup.position.z + 0.40);
                this.ballVel.set(0, 0, 0);
                this.npcTossDelayTimer += dt;
                if (this.npcTossDelayTimer >= 0.55) {
                    this.servePhase = 'toss';
                    this.serveTossVelY = 5.3;
                    this.serveArmTime = 0.35;
                    this.core.spawnRing(this.ballPos, 0xffffff, 0.15, 0.65, 0.22, false, 0.6);
                }
            } else {
                this.serveTossVelY += this.gravity * dt;
                this.ballPos.y += this.serveTossVelY * dt;
                const targetBallX = this.npcGroup.position.x - 0.14;
                this.ballPos.x += (targetBallX - this.ballPos.x) * 3.5 * dt;
                this.ballPos.z = this.npcGroup.position.z + 0.40;

                if (this.serveTossVelY < 0 && this.ballPos.y <= 1.35) {
                    const npcServePower = (npcLevel >= 3 && Math.random() < 0.55) ? (60 + Math.random() * 35) : 30;
                    this.serveBall('npc', npcServePower);
                }
            }
        }

        // トス腕アニメーション更新
        if (this.serveArmTime > 0) {
            this.serveArmTime = Math.max(0, this.serveArmTime - dt);
        }
        const playerArmMode = gameState === 'serve-player'
            ? (this.serveArmTime > 0 ? 'toss' : (this.servePhase === 'idle' ? 'hold' : 'none'))
            : 'none';
        const npcArmMode = gameState === 'serve-npc'
            ? (this.serveArmTime > 0 ? 'toss' : (this.servePhase === 'idle' ? 'hold' : 'none'))
            : 'none';
        this.updateTossArm(this.playerGroup, playerArmMode, dt);
        this.updateTossArm(this.npcGroup, npcArmMode, dt);

        // チャージ更新＆自動ヒット（ワンバウンド後）
        if (isCharging) {
            power = Math.min(MAX_POWER, power + POWER_CHARGE_SPEED);
            if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(power);

            if (gameState === 'rally' && this.playerCanHit && this.receiverBounces === 1 && this.ballPos.z > 0.2) {
                const reach = this.getReachInfo(this.playerGroup.position, this.ballPos, true);
                if (reach.inRange) {
                    this.hitBall('player', power, reach);
                    isCharging = false;
                    power = 0;
                    if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0);
                }
            }
        }

        // NPC更新
        this.updateNPC(dt);

        // ラリー物理更新
        if (gameState === 'rally') {
            const prevPos = this.ballPos.clone();

            this.ballVel.y += (this.gravity + this.ballSpinAccel) * dt;
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
                        this.ballPos.z = prevPos.z > 0 ? 0.06 : -0.06;
                        this.ballPos.y = yAtNet;
                        this.ballVel.set(this.ballVel.x * 0.2, 0.4, prevPos.z > 0 ? -0.9 : 0.9);
                        this.trailIsSmash = false;
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
                this.core.spawnRing(new THREE.Vector3(this.ballPos.x, this.tableHeight + 0.015, this.ballPos.z), 0xffffff, 0.18, 0.85, 0.24, true, 0.75);

                if (this.isServeFirstBounce) {
                    const isPlayerServe = (this.lastHitter === 'player');
                    const onServerHalf = isPlayerServe ? (this.ballPos.z > 0) : (this.ballPos.z < 0);
                    if (onServerHalf) {
                        this.isServeFirstBounce = false;
                        this.ballSpinAccel = this.serveFlightSpin;
                        this.ballBounceScaleY = this.serveNextBounceY;
                        this.ballBounceScaleZ = this.serveNextBounceZ;
                        this.ballVel.copy(this.computeBallVelocity(
                            this.ballPos,
                            new THREE.Vector3(this.serveDestX, tableSurfaceY, this.serveDestZ),
                            this.serveFlightDuration,
                            this.serveFlightSpin
                        ));
                        if (!isPlayerServe) this.playerCanHit = true;
                        else this.npcCanHit = true;
                    }
                } else {
                    const hitOwnSide = (this.lastHitter === 'player' && this.ballPos.z > 0) ||
                                       (this.lastHitter === 'npc' && this.ballPos.z < 0);
                    if (hitOwnSide) {
                        const winner = this.lastHitter === 'player' ? 'npc' : 'player';
                        this.scorePoint(winner, winner === 'player' ? "POINT FOR YOU!" : "POINT FOR NPC!");
                    } else {
                        this.receiverBounces++;
                        this.ballVel.y = Math.abs(this.ballVel.y) * this.ballBounceScaleY;
                        this.ballVel.x *= 0.96;
                        this.ballVel.z *= this.ballBounceScaleZ;
                        this.ballSpinAccel = 0;

                        if (this.receiverBounces >= 2) {
                            const winner = this.lastHitter;
                            this.scorePoint(winner, winner === 'player' ? "POINT FOR YOU!" : "POINT FOR NPC!");
                        }
                    }
                }
            }

            // 床落下（またはネットミス後に台より下に落下）で得点確定
            const droppedBelowTable = !onTableArea && this.ballPos.y <= 0.12;
            const netDropped = this.netFault && this.ballPos.y <= this.tableHeight + this.ballRadius;

            if (gameState === 'rally' && (droppedBelowTable || netDropped || this.ballPos.y <= 0.08)) {
                if (this.netFault) {
                    const winner = this.lastHitter === 'player' ? 'npc' : 'player';
                    this.scorePoint(winner, winner === 'player' ? "NET! POINT FOR YOU!" : "NET! POINT FOR NPC!");
                } else if (this.receiverBounces === 1) {
                    const winner = this.lastHitter;
                    this.scorePoint(winner, winner === 'player' ? "ACE! POINT FOR YOU!" : "POINT FOR NPC!");
                } else {
                    const winner = this.lastHitter === 'player' ? 'npc' : 'player';
                    this.scorePoint(winner, winner === 'player' ? "OUT! POINT FOR YOU!" : "OUT! POINT FOR NPC!");
                }
            }
        }

        // ボールと影の更新
        this.ballGroup.position.copy(this.ballPos);
        const overTable = Math.abs(this.ballPos.x) <= this.tableWidth / 2 && Math.abs(this.ballPos.z) <= this.tableLength / 2;
        this.ballShadow.position.set(this.ballPos.x, overTable ? this.tableHeight + 0.012 : 0.025, this.ballPos.z);

        // トレイル・VFX更新
        this.updateTrail(gameState === 'rally');
        this.core.updateVFX(dt);

        // 飛びつきジャンプ・姿勢更新
        this.updateDiveAnimation(this.playerGroup, 'playerDiveTime', this.playerDiveDir, 'playerRecoveryTime', dt);
        this.updateDiveAnimation(this.npcGroup, 'npcDiveTime', this.npcDiveDir, 'npcRecoveryTime', dt);

        // キャラクターアニメーション更新（バックハンド時は専用モーションで上書き）
        this.playerSwingTime = this.core.updateCharacterAnimation(
            this.playerGroup,
            this.prevPlayerPos,
            'playerStepPhase',
            this.playerDiveTime >= 0,
            isCharging,
            this.playerSwingTime,
            dt
        );
        if (this.playerSwingTime >= 0 && this.playerHitType === 'back') {
            this.applyBackhandSwingAnimation(this.playerGroup, true, this.playerSwingTime, dt);
        } else {
            this.applyBackhandSwingAnimation(this.playerGroup, true, -1, dt);
        }

        this.npcSwingTime = this.core.updateCharacterAnimation(
            this.npcGroup,
            this.prevNpcPos,
            'npcStepPhase',
            this.npcDiveTime >= 0,
            false,
            this.npcSwingTime,
            dt
        );
        if (this.npcSwingTime >= 0 && this.npcHitType === 'back') {
            this.applyBackhandSwingAnimation(this.npcGroup, false, this.npcSwingTime, dt);
        } else {
            this.applyBackhandSwingAnimation(this.npcGroup, false, -1, dt);
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