const TTVisual = {
    // 卓球専用の軽い「ポンッ」というバウンド音を生成（ミュート連動）
    playBounceSound(game, isPaddle = false) {
        if (typeof BadmintonAudio !== 'undefined' && BadmintonAudio.isMuted) return;
        try {
            let ctx = (typeof BadmintonAudio !== 'undefined' && typeof BadmintonAudio.getContext === 'function')
                ? BadmintonAudio.getContext()
                : null;
            if (!ctx) {
                if (!game.audioCtx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (!AudioCtx) return;
                    game.audioCtx = new AudioCtx();
                }
                ctx = game.audioCtx;
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

    buildTable(game) {
        const w = game.tableWidth;
        const l = game.tableLength;
        const h = game.tableHeight;
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
        const postGeo = new THREE.CylinderGeometry(0.025, 0.025, game.netHeight + 0.04, 10);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
        [-w / 2 - 0.14, w / 2 + 0.14].forEach(px => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(px, h + game.netHeight / 2, 0);
            tableGroup.add(post);
        });

        const netMeshGeo = new THREE.PlaneGeometry(w + 0.28, game.netHeight);
        const netMeshMat = new THREE.MeshBasicMaterial({
            color: 0x162230,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide
        });
        const netMesh = new THREE.Mesh(netMeshGeo, netMeshMat);
        netMesh.position.set(0, h + game.netHeight / 2, 0);
        tableGroup.add(netMesh);

        const topTape = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.28, 0.028, 0.015),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        topTape.position.set(0, h + game.netHeight - 0.014, 0);
        tableGroup.add(topTape);

        game.rootGroup.add(tableGroup);
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

    buildCharacters(game) {
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
        game.playerGroup = new THREE.Group();
        const playerRed = TableTennisCharacter.createCharacter({ ...redPreset, faceBack: true });
        playerRed.scale.setScalar(game.characterScale);
        game.playerGroup.add(playerRed);

        const playerBlue = TableTennisCharacter.createCharacter({ ...bluePreset, faceBack: true });
        playerBlue.scale.setScalar(game.characterScale);
        playerBlue.visible = false;
        game.playerGroup.add(playerBlue);

        game.playerBodies = { red: playerRed, blue: playerBlue };
        game.activePlayerBody = playerRed;

        const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
        playerShadow.rotation.x = -Math.PI / 2;
        playerShadow.position.y = 0.025;
        game.playerGroup.add(playerShadow);

        const chargeRingGeo = new THREE.RingGeometry(0.68, 0.84, 36);
        const chargeRingMat = new THREE.MeshBasicMaterial({
            color: 0x00d8ff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        game.chargeRing = new THREE.Mesh(chargeRingGeo, chargeRingMat);
        game.chargeRing.rotation.x = -Math.PI / 2;
        game.chargeRing.position.y = 0.03;
        game.chargeRing.visible = false;
        game.playerGroup.add(game.chargeRing);

        game.playerGroup.position.set(0, 0, 3.8);
        game.rootGroup.add(game.playerGroup);

        // 奥の相手キャラ（青：ゲスト/CPU、赤：ホスト）
        game.npcGroup = new THREE.Group();
        const npcBlue = TableTennisCharacter.createCharacter({ ...bluePreset, faceBack: false });
        npcBlue.scale.setScalar(game.characterScale);
        game.npcGroup.add(npcBlue);

        const npcRed = TableTennisCharacter.createCharacter({ ...redPreset, faceBack: false });
        npcRed.scale.setScalar(game.characterScale);
        npcRed.visible = false;
        game.npcGroup.add(npcRed);

        game.npcBodies = { red: npcRed, blue: npcBlue };
        game.activeNpcBody = npcBlue;

        const npcShadow = playerShadow.clone();
        game.npcGroup.add(npcShadow);

        game.npcGroup.position.set(0, 0, -3.8);
        game.rootGroup.add(game.npcGroup);
    },

    buildBall(game) {
        game.ballGroup = new THREE.Group();
        const ballGeo = new THREE.SphereGeometry(game.ballRadius, 18, 18);
        const ballMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x222222,
            roughness: 0.25,
            metalness: 0.05
        });
        const ballMesh = new THREE.Mesh(ballGeo, ballMat);
        game.ballGroup.add(ballMesh);
        game.rootGroup.add(game.ballGroup);

        game.ballShadow = new THREE.Mesh(
            new THREE.RingGeometry(0, 0.11, 24),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
        );
        game.ballShadow.rotation.x = -Math.PI / 2;
        game.ballShadow.position.y = game.tableHeight + 0.01;
        game.rootGroup.add(game.ballShadow);
    },

    initTrail(game) {
        game.trailPointPool = [];
        for (let i = 0; i < game.trailMaxPoints; i++) {
            game.trailPointPool.push(new THREE.Vector3());
        }
        const count = game.trailMaxPoints;
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
        game.trailMesh = new THREE.Mesh(trailGeo, trailMat);
        game.trailMesh.frustumCulled = false;
        game.trailMesh.visible = false;
        game.rootGroup.add(game.trailMesh);
    },

    resetTrail(game) {
        while (game.trailPoints.length > 0) {
            game.trailPointPool.push(game.trailPoints.pop());
        }
        game.trailIsSmash = false;
        game.trailMode = 'normal';
        if (game.trailMesh) game.trailMesh.visible = false;
    },

    updateTrail(game, active) {
        if (!game.trailMesh) return;
        if (!active) {
            while (game.trailPoints.length > 0) {
                game.trailPointPool.push(game.trailPoints.pop());
            }
            game.trailMesh.visible = false;
            return;
        }

        let ptObj;
        if (game.trailPoints.length >= game.trailMaxPoints) {
            ptObj = game.trailPoints.pop();
        } else {
            ptObj = game.trailPointPool.pop() || new THREE.Vector3();
        }
        ptObj.copy(game.ballPos);
        game.trailPoints.unshift(ptObj);

        if (game.trailPoints.length < 2) {
            game.trailMesh.visible = false;
            return;
        }

        game.trailMesh.visible = true;
        let trailColor = 0x99ebff;
        let trailOpacity = 0.42;
        let maxHalfWidth = 0.045;
        if (game.trailMode === 'smash') {
            trailColor = 0xff7b00;
            trailOpacity = 0.78;
            maxHalfWidth = 0.095;
        } else if (game.trailMode === 'cut') {
            trailColor = 0x00d8ff;
            trailOpacity = 0.76;
            maxHalfWidth = 0.088;
        }
        game.trailMesh.material.color.setHex(trailColor);
        game.trailMesh.material.opacity = trailOpacity;
        const posAttr = game.trailMesh.geometry.attributes.position;
        const arr = posAttr.array;

        const camPos = game.core.camera.position;
        const dir = game._tmpVec3A;
        const toCam = game._tmpVec3B;
        const side = game._tmpVec3C;

        for (let i = 0; i < game.trailMaxPoints; i++) {
            const pt = game.trailPoints[Math.min(i, game.trailPoints.length - 1)];
            const nextPt = game.trailPoints[Math.min(i + 1, game.trailPoints.length - 1)];
            const prevPt = game.trailPoints[Math.max(i - 1, 0)];

            dir.subVectors(prevPt, nextPt);
            if (dir.lengthSq() < 0.00001) dir.set(0, 0, 1);
            else dir.normalize();

            toCam.subVectors(camPos, pt).normalize();
            side.crossVectors(dir, toCam);
            if (side.lengthSq() < 0.00001) side.set(1, 0, 0);
            else side.normalize();

            const t = i / (game.trailMaxPoints - 1);
            const hw = (1 - t) * maxHalfWidth * (i < game.trailPoints.length ? 1 : 0);

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

    updateChargeVFX(game, dt) {
        if (!game.chargeRing) return;
        if (isCharging && (gameState === 'rally' || gameState === 'serve-player')) {
            const isCutMode = (chargeMode === 'down');
            if (isCutMode) {
                game.chargeRing.visible = true;
                game.chargeRing.material.color.setHex(power >= 50 ? 0x00e5ff : 0x70f0ff);
                game.chargeRing.material.opacity = power >= 50 ? 0.92 : 0.50;
                const pulse = 1 + Math.sin(game.core.idleTime * 12) * 0.06;
                game.chargeRing.scale.setScalar(pulse);

                game.chargeSparkTimer += dt;
                if (game.chargeSparkTimer >= (power >= 50 ? 0.045 : 0.09)) {
                    game.chargeSparkTimer = 0;
                    const angle = Math.random() * Math.PI * 2;
                    const rad = 0.35 + Math.random() * 0.5;
                    game._tmpVec3D.set(
                        game.playerGroup.position.x + Math.cos(angle) * rad,
                        0.12,
                        game.playerGroup.position.z + Math.sin(angle) * rad
                    );
                    game.core.spawnSparks(game._tmpVec3D, power >= 50 ? 0x00d8ff : 0x8ef5ff, 1, 2.0, 4.2, 0.34, 0.85, 1.0);
                }
            } else if (power >= 50) {
                game.chargeRing.visible = true;
                game.chargeRing.material.color.setHex(power >= 95 ? 0xff3b30 : 0xff9500);
                game.chargeRing.material.opacity = 0.85;
                const pulse = 1 + Math.sin(game.core.idleTime * 12) * 0.06;
                game.chargeRing.scale.setScalar(pulse);

                game.chargeSparkTimer += dt;
                if (game.chargeSparkTimer >= 0.045) {
                    game.chargeSparkTimer = 0;
                    const angle = Math.random() * Math.PI * 2;
                    const rad = 0.35 + Math.random() * 0.5;
                    game._tmpVec3D.set(
                        game.playerGroup.position.x + Math.cos(angle) * rad,
                        0.12,
                        game.playerGroup.position.z + Math.sin(angle) * rad
                    );
                    game.core.spawnSparks(game._tmpVec3D, power >= 95 ? 0xff4500 : 0xffd700, 1, 2.0, 4.2, 0.34, 0.85, 1.0);
                }
            } else {
                game.chargeRing.visible = false;
                game.chargeSparkTimer = 0;
            }
        } else {
            game.chargeRing.visible = false;
            game.chargeSparkTimer = 0;
        }
    }
};