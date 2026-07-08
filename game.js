// Global State Variables
const keys = { w: false, a: false, s: false, d: false, Space: false };
let isCharging = false;
let power = 0;
const MAX_POWER = 100;
const POWER_CHARGE_SPEED = 2.5;

let playerScore = 0;
let npcScore = 0;
let gameState = 'waiting';
let npcLevel = 1;
const MATCH_POINT = 21;

const GameCore = {
    courtWidth: 12, courtLength: 20, netHeight: 2.2, hitRadius: 2.0,
    scene: null, camera: null, renderer: null, clock: null,
    playerGroup: null, npcGroup: null, shuttleGroup: null, shuttleShadow: null,
    
    shuttlePhys: { 
        pos: new THREE.Vector3(0, 3, -6), 
        vel: new THREE.Vector3(0, 0, 0) 
    },
    
    playerSwingTime: -1, npcSwingTime: -1,

    init() {
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x3a7d44);
        this.scene.fog = new THREE.FogExp2(0x3a7d44, 0.015);
        
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 8, 16);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = false;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight.position.set(10, 25, 10);
        this.scene.add(dirLight);

        this.buildField();
        this.buildCharacters();
        this.buildShuttle();

        if (typeof UIManager !== 'undefined') {
            UIManager.init({
                onBackToTitle: () => {
                    UIManager.toggleSettings(false);
                    UIManager.hideResult();
                    UIManager.showStartScreen(true);
                    gameState = 'waiting';
                },
                onPauseToggle: (isPaused) => {
                    if (isPaused) {
                        isCharging = false;
                        power = 0;
                        UIManager.updatePowerBar(0);
                    }
                }
            });
        }

        this.initInputs();

        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                npcLevel = parseInt(e.target.dataset.level);
                if (typeof UIManager !== 'undefined') UIManager.showStartScreen(false);
                this.resetGame();
                this.resetToServe('player');
            });
        });

        window.addEventListener('resize', () => this.onResize());
        
        this.animate();
    },

  buildField() {
        // グラウンド（体育館の床）
        const groundGeo = new THREE.PlaneGeometry(120, 120);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x1d3a24, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // バドミントンコート床面
        const courtGeo = new THREE.PlaneGeometry(this.courtWidth, this.courtLength);
        const courtMat = new THREE.MeshStandardMaterial({ color: 0x1b5e3a, roughness: 0.6, metalness: 0.1 });
        const court = new THREE.Mesh(courtGeo, courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.01;
        this.scene.add(court);

        // 白線描画ユーティリティ
        const createLineMesh = (w, h, x, z) => {
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = -Math.PI / 2; 
            m.position.set(x, 0.015, z);
            this.scene.add(m);
        };

        const lw = 0.08; // 実際の白線の太さ比率に合わせた調整
        const halfW = this.courtWidth / 2;
        const halfL = this.courtLength / 2;

        // 1. バックバウンダリーライン（エンドライン）
        createLineMesh(this.courtWidth, lw, 0, -halfL);
        createLineMesh(this.courtWidth, lw, 0, halfL);

        // 2. サイドライン（ダブルス用：一番外側）
        createLineMesh(lw, this.courtLength, -halfW, 0);
        createLineMesh(lw, this.courtLength, halfW, 0);

        // 3. サイドライン（シングルス用：ダブルスの内側、実際の比率 0.46m / 6.1m ≒ 幅の約7.5%内側）
        const singleLineOffset = halfW * 0.15;
        createLineMesh(lw, this.courtLength, -halfW + singleLineOffset, 0);
        createLineMesh(lw, this.courtLength, halfW - singleLineOffset, 0);

        // 4. ショートサービスライン（ネットから実際の比率 1.98m / 13.4m ≒ 長さの約14.8%）
        const shortServiceZ = halfL * 0.295;
        createLineMesh(this.courtWidth, lw, 0, -shortServiceZ);
        createLineMesh(this.courtWidth, lw, 0, shortServiceZ);

        // 5. ロングサービスライン（ダブルス用：バックラインの内側、実際の比率 0.76m / 13.4m ≒ 長さの約5.6%内側）
        const doubleLongServiceOffset = halfL * 0.113;
        createLineMesh(this.courtWidth, lw, 0, -halfL + doubleLongServiceOffset);
        createLineMesh(this.courtWidth, lw, 0, halfL - doubleLongServiceOffset);

        // 6. センターライン（ショートサービスラインからエンドラインまでを繋ぐ）
        const centerLineLength = halfL - shortServiceZ;
        const centerLineZNorth = -shortServiceZ - (centerLineLength / 2);
        const centerLineZSouth = shortServiceZ + (centerLineLength / 2);
        createLineMesh(lw, centerLineLength, 0, centerLineZNorth);
        createLineMesh(lw, centerLineLength, 0, centerLineZSouth);

        // 7. センターネット下のライン（センター位置確認用）
        createLineMesh(this.courtWidth, lw, 0, 0);

        // ネットポスト
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, this.netHeight);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(-halfW - 0.1, this.netHeight/2, 0);
        const postR = postL.clone(); 
        postR.position.x = halfW + 0.1;
        this.scene.add(postL); 
        this.scene.add(postR);

        // ネット
        const netHeight = 0.75;
        const netGeo = new THREE.PlaneGeometry(this.courtWidth, netHeight, 40, 5);
        const netMat = new THREE.MeshPhongMaterial({ color: 0x4e2715, wireframe: true, transparent: true, opacity: 0.75 });
        const net = new THREE.Mesh(netGeo, netMat);
        net.position.set(0, this.netHeight - netHeight / 2, 0);
        this.scene.add(net);

        // ネット上部の白テープ
        const tapeGeo = new THREE.PlaneGeometry(this.courtWidth, 0.08);
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.set(0, this.netHeight - 0.04, 0.005);
        this.scene.add(tape);

        // --- 衝突用クッションパネル（角の重なりを精密に解消し、すべて黄色で統一） ---
        const panelHeight = 0.8;
        const panelThickness = 0.2;
        const cushionColor = 0xc5b13c; // 黄色で統一

        const boundaryX = halfW + 3.0; // 9.0 (左右フェンスの位置)
        const boundaryZ = halfL + 4.0; // 14.0 (前後フェンスの位置)

        // 縦（左右）壁用の設定：Zの範囲は -14.0 から 14.0 (全長28) とし、幅 3.5 のパネルを 8 枚並べる
        const panelWidthZ = 3.5;
        const panelGeoZ = new THREE.BoxGeometry(panelWidthZ, panelHeight, panelThickness);

        // 横（奥・手前）壁用の設定：内側の幅 17.8 に収まるよう、幅 4.45 のパネルを 4 枚並べる
        const panelWidthX = 4.45;
        const panelGeoX = new THREE.BoxGeometry(panelWidthX, panelHeight, panelThickness);

        const createCushionPanel = (x, z, rotationY, isXPanel) => {
            const panelGeo = isXPanel ? panelGeoX : panelGeoZ;
            const currentWidth = isXPanel ? panelWidthX : panelWidthZ;

            const panelMat = new THREE.MeshStandardMaterial({ color: cushionColor, roughness: 0.5 });
            const panelMesh = new THREE.Mesh(panelGeo, panelMat);
            panelMesh.position.set(x, panelHeight / 2, z);
            panelMesh.rotation.y = rotationY;
            this.scene.add(panelMesh);

            // 看板のテキストエリア風ホワイトフレーム
            const faceGeo = new THREE.PlaneGeometry(currentWidth - 0.1, panelHeight - 0.1);
            const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
            const faceMesh = new THREE.Mesh(faceGeo, faceMat);
            faceMesh.position.set(0, 0, panelThickness / 2 + 0.01);
            panelMesh.add(faceMesh);
        };

        // 左右のフェンスを配置 (z = -12.25 から 12.25 まで 3.5 刻み、計8枚で全長28.0を隙間なくカバー)
        for (let z = -boundaryZ + (panelWidthZ / 2); z <= boundaryZ - (panelWidthZ / 2); z += panelWidthZ) {
            createCushionPanel(-boundaryX, z, Math.PI / 2, false);
            createCushionPanel(boundaryX, z, -Math.PI / 2, false);
        }

        // 奥と手前のフェンスを配置 (x = -6.675 から 6.675 まで 4.45 刻み、計4枚で隙間なくカバー)
        const startX = -boundaryX + panelThickness / 2 + (panelWidthX / 2); // -9.0 + 0.1 + 2.225 = -6.675
        const endX = boundaryX - panelThickness / 2 - (panelWidthX / 2);   // 9.0 - 0.1 - 2.225 = 6.675
        for (let x = startX; x <= endX + 0.01; x += panelWidthX) {
            createCushionPanel(x, -boundaryZ, 0, true);
            createCushionPanel(x, boundaryZ, Math.PI, true);
        }

        // --- 観客席の構築（スタンド位置を奥に下げてクッションが埋もれないように調整） ---
        const standRows = 4;
        const standStepHeight = 0.6;
        const standStepDepth = 1.2;
        const standWidth = 45;

        const buildStands = (posX, posZ, rotY) => {
            const standGroup = new THREE.Group();
            for (let i = 0; i < standRows; i++) {
                const stepW = standWidth;
                const stepH = standStepHeight * (i + 1);
                const stepD = standStepDepth;

                const stepGeo = new THREE.BoxGeometry(stepW, stepH, stepD);
                const stepMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.8 });
                const stepMesh = new THREE.Mesh(stepGeo, stepMat);

                // 階段状にずらして配置
                stepMesh.position.set(0, stepH / 2, i * stepD);
                standGroup.add(stepMesh);

                // 観客のポリゴンモデルをランダム配置
                const spectatorCount = 18;
                const spectatorColors = [0xdd3333, 0x3333dd, 0x33dd33, 0xdddd33, 0xdd33dd, 0x33dddd, 0xeeeeee];
                for (let j = 0; j < spectatorCount; j++) {
                    const specX = (Math.random() - 0.5) * (stepW - 2);
                    const specY = stepH + 0.3; // 階段の上面
                    const specZ = (i * stepD) + (Math.random() - 0.5) * 0.4;

                    const bodyGeo = new THREE.BoxGeometry(0.35, 0.5, 0.35);
                    const headGeo = new THREE.SphereGeometry(0.18, 8, 8);

                    const specColor = spectatorColors[Math.floor(Math.random() * spectatorColors.length)];
                    const specMat = new THREE.MeshStandardMaterial({ color: specColor, roughness: 0.7 });
                    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 }); // 肌色

                    const specBody = new THREE.Mesh(bodyGeo, specMat);
                    specBody.position.set(specX, specY, specZ);

                    const specHead = new THREE.Mesh(headGeo, headMat);
                    specHead.position.set(0, 0.35, 0);
                    specBody.add(specHead);

                    standGroup.add(specBody);
                }
            }
            standGroup.position.set(posX, 0, posZ);
            standGroup.rotation.y = rotY;
            this.scene.add(standGroup);
        };

        // 奥（北側）の観客席スタンドを Z = -19.0 から Z = -21.0 へ後退させて隙間を確保
        buildStands(0, -halfL - 11.0, 0);
        // 手前（南側）の観客席スタンドも Z = 19.0 から Z = 21.0 へ後退
        buildStands(0, halfL + 11.0, Math.PI);

        // --- 天井ライトアップ効果（ライト強度を半分以下に抑え、コーンの透明度も調整） ---
        const lightFixtureGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 16);
        const lightFixtureMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });

        const lightConeGeo = new THREE.CylinderGeometry(0.4, 4.5, 15, 32, 1, true);
        const lightConeMat = new THREE.MeshBasicMaterial({
            color: 0xfffbe0,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const setupCeilingLight = (x, z) => {
            const fixture = new THREE.Mesh(lightFixtureGeo, lightFixtureMat);
            fixture.position.set(x, 15, z);
            this.scene.add(fixture);

            // 光のコーン（ライトビーム）
            const cone = new THREE.Mesh(lightConeGeo, lightConeMat);
            cone.position.set(x, 7.5, z);
            this.scene.add(cone);

            // 実際の光源（強度を 0.85 から 0.35 に変更して半分以下に）
            const spotLight = new THREE.SpotLight(0xffffff, 0.35);
            spotLight.position.set(x, 14.8, z);
            spotLight.target.position.set(x, 0, z);
            spotLight.angle = Math.PI / 4;
            spotLight.penumbra = 0.8;
            spotLight.distance = 25;
            this.scene.add(spotLight);
            this.scene.add(spotLight.target);
        };

        // コートの四隅および中央付近の天井にライトを設置
        setupCeilingLight(-halfW + 1, -halfL + 2);
        setupCeilingLight(halfW - 1, -halfL + 2);
        setupCeilingLight(-halfW + 1, halfL - 2);
        setupCeilingLight(halfW - 1, halfL - 2);
    },

    buildCharacters() {
        this.playerGroup = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.name = "bodyMesh"; 
        body.position.y = 0.5;
        this.playerGroup.add(body);

        // プレイヤーの影（コート表面の上に重なるようにy座標を調整）
        const shadowGeo = new THREE.RingGeometry(0, 0.45, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.4, 
            side: THREE.DoubleSide 
        });
        const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
        playerShadow.rotation.x = -Math.PI / 2;
        playerShadow.position.y = 0.025; // コート(0.01)や白線(0.015)の上に重なるように修正
        this.playerGroup.add(playerShadow);

        const rangeGeo = new THREE.RingGeometry(this.hitRadius - 0.08, this.hitRadius, 64);
        const rangeMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.45, 
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1.0,
            polygonOffsetUnits: -1.0
        });
        const rangeMesh = new THREE.Mesh(rangeGeo, rangeMat);
        rangeMesh.rotation.x = -Math.PI / 2; 
        rangeMesh.position.y = 0.028; // コート上に綺麗に描画されるよう調整
        this.playerGroup.add(rangeMesh);
        
        this.playerGroup.position.set(0, 0, 6);
        this.scene.add(this.playerGroup);

        const pRacket = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        shaft.position.y = 0.45; pRacket.add(shaft);
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffdd00 }));
        frame.position.y = 1.08; frame.scale.set(0.7, 1.0, 1.0); pRacket.add(frame);
        pRacket.position.set(0.6, 0.4, 0.2); pRacket.rotation.set(0.2, 0, -0.3); pRacket.name = "racket";
        body.add(pRacket);

        this.npcGroup = new THREE.Group();
        const npcBody = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x007aff }));
        npcBody.name = "bodyMesh"; 
        npcBody.position.y = 0.5; 
        this.npcGroup.add(npcBody);
        
        // NPCの影
        const npcShadow = playerShadow.clone();
        this.npcGroup.add(npcShadow);

        this.npcGroup.position.set(0, 0, -6);
        this.scene.add(this.npcGroup);

        const nRacket = pRacket.clone();
        nRacket.position.set(-0.6, 0.4, 0.2); 
        nRacket.rotation.set(0.2, 0, 0.3);
        npcBody.add(nRacket);
    },

    buildShuttle() {
        this.shuttleGroup = new THREE.Group();
        this.shuttleGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: 0xdddddd })));
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.16, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
        skirt.position.y = 0.08; this.shuttleGroup.add(skirt);
        this.scene.add(this.shuttleGroup);

        this.shuttleShadow = new THREE.Mesh(new THREE.RingGeometry(0, 0.18, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
        this.shuttleShadow.rotation.x = -Math.PI / 2; 
        this.shuttleShadow.position.y = 0.025; // 影がコート床に隠れないように調整
        this.scene.add(this.shuttleShadow);
    },

    initInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.code === 'Space') { keys.Space = true; this.startCharging(); }
            if (e.code === 'KeyW' || e.key === 'ArrowUp') keys.w = true; 
            if (e.code === 'KeyA' || e.key === 'ArrowLeft') keys.a = true;
            if (e.code === 'KeyS' || e.key === 'ArrowDown') keys.s = true; 
            if (e.code === 'KeyD' || e.key === 'ArrowRight') keys.d = true;
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.code === 'Space') { keys.Space = false; this.stopCharging(); }
            if (e.code === 'KeyW' || e.key === 'ArrowUp') keys.w = false; 
            if (e.code === 'KeyA' || e.key === 'ArrowLeft') keys.a = false;
            if (e.code === 'KeyS' || e.key === 'ArrowDown') keys.s = false; 
            if (e.code === 'KeyD' || e.key === 'ArrowRight') keys.d = false;
        });

        const dpadMapping = { 'dpad-up': 'w', 'dpad-down': 's', 'dpad-left': 'a', 'dpad-right': 'd' };
        Object.keys(dpadMapping).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[dpadMapping[id]] = true; }, { passive: false });
                btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[dpadMapping[id]] = false; }, { passive: false });
            }
        });
        
        const hBtn = document.getElementById('hit-button');
        if (hBtn) {
            hBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startCharging(); }, { passive: false });
            window.addEventListener('touchend', () => { if (isCharging) this.stopCharging(); });
        }
    },

    startCharging() { 
        if (gameState !== 'ended' && gameState !== 'waiting' && (typeof UIManager === 'undefined' || !UIManager.isPaused)) isCharging = true; 
    },

    stopCharging() {
        isCharging = false;
        if (gameState === 'serve-player') {
            this.serveShuttle('player');
        } else if (gameState === 'rally' && PlayerManager.playerHasHitRight && !PlayerManager.isAirborneWaiting) {
            if (PlayerManager.checkShuttleInRange(this.playerGroup.position, PlayerManager.jumpY, this.shuttlePhys.pos, this.hitRadius) && this.shuttlePhys.pos.z > -1.5) {
                this.hitShuttle('player', power);
                PlayerManager.playerHasHitRight = false;
            } else {
                this.playerSwingTime = 0;
            }
        }
        power = 0; if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0);
    },

    hitShuttle(hitter, hitPower) {
        const isSmash = (hitPower >= 50);
        BadmintonAudio.playHit(isSmash);
        
        if (hitter === 'player') {
            this.playerSwingTime = 0;
            let tx = (keys.a) ? -4.2 : (keys.d) ? 4.2 : (Math.random() - 0.5) * 1.5;
            let tz = -this.courtLength / 2 + 1.2 + Math.random() * 2.0;

            if (isSmash) {
                const jumpHitPoint = new THREE.Vector3(this.playerGroup.position.x, 2.3 + (PlayerManager.jumpY * 0.5), this.playerGroup.position.z);
                BadmintonPhysics.calculateSmash(jumpHitPoint, new THREE.Vector3(tx, 0.1, tz), hitPower, this.shuttlePhys);
            } else {
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.5, this.shuttlePhys);
            }
            PlayerManager.npcHasHitRight = true; PlayerManager.isAirborneWaiting = false;
        } else {
            this.npcSwingTime = 0;
            let tx = this.playerGroup.position.x > 0 ? -3.4 : 3.4;
            let tz = this.courtLength / 2 - 1.5 - Math.random() * 2.0;
            
            if (npcLevel === 2 && this.shuttlePhys.pos.y > 2.5 && this.shuttlePhys.pos.z < -2.0) {
                BadmintonPhysics.calculateSmash(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 85, this.shuttlePhys);
            } else {
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 4.8 + Math.random() * 2.0, this.shuttlePhys);
            }
            PlayerManager.playerHasHitRight = true;
        }
        gameState = 'rally';
    },

    serveShuttle(server) {
        BadmintonAudio.playHit(false);
        if (server === 'player') {
            this.playerSwingTime = 0;
            BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(0, 0, -4.5), 4.2, this.shuttlePhys);
            PlayerManager.playerHasHitRight = false; PlayerManager.npcHasHitRight = true;
        } else {
            this.npcSwingTime = 0;
            BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(0, 0, 4.5), 4.2, this.shuttlePhys);
            PlayerManager.playerHasHitRight = true; PlayerManager.npcHasHitRight = false;
        }
        gameState = 'rally';
    },

    scorePoint(winner) {
        gameState = 'ended';
        if (winner === 'player') { 
            playerScore++; document.getElementById('player-score').innerText = playerScore; this.showBanner("POINT FOR YOU!", "#34c759"); 
        } else { 
            npcScore++; document.getElementById('npc-score').innerText = npcScore; this.showBanner("POINT FOR NPC!", "#ff3b30"); 
        }
        if (playerScore >= MATCH_POINT || npcScore >= MATCH_POINT) {
            if (typeof UIManager !== 'undefined') setTimeout(() => UIManager.showResult(playerScore, npcScore), 1500);
        } else {
            setTimeout(() => this.resetToServe(winner === 'player' ? 'player' : 'npc'), 2200);
        }
    },

    resetGame() {
        playerScore = 0; npcScore = 0;
        const pVal = document.getElementById('player-score');
        const nVal = document.getElementById('npc-score');
        if (pVal) pVal.innerText = "0";
        if (nVal) nVal.innerText = "0";
    },

    resetToServe(nextServer) {
        this.playerGroup.position.set(0, 0, 6.5); this.npcGroup.position.set(0, 0, -6.5);
        power = 0; if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0); 
        isCharging = false;
        PlayerManager.playerHasHitRight = true; PlayerManager.npcHasHitRight = true;
        PlayerManager.isJumping = false; PlayerManager.isAirborneWaiting = false;
        PlayerManager.jumpY = 0; PlayerManager.jumpVel = 0;
        if (nextServer === 'player') {
            gameState = 'serve-player'; this.shuttlePhys.pos.set(0.5, 1.2, 5.5); this.shuttlePhys.vel.set(0, 0, 0);
        } else {
            gameState = 'serve-npc'; this.shuttlePhys.pos.set(-0.5, 1.2, -5.5); this.shuttlePhys.vel.set(0, 0, 0);
            setTimeout(() => { if (gameState === 'serve-npc') this.serveShuttle('npc'); }, 1200);
        }
    },

    showBanner(text, color) {
        const b = document.getElementById('message-banner');
        if (b) {
            b.innerText = text; b.style.borderBottomColor = color; b.style.opacity = 1;
            setTimeout(() => { b.style.opacity = 0; }, 1600);
        }
    },

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    update(dt) {
        if (dt > 0.1) dt = 0.1;
        if (gameState === 'waiting' || (typeof UIManager !== 'undefined' && UIManager.isPaused)) return;

        // サーブ待機時のシャトル手元追従
        if (gameState === 'serve-player') {
            this.shuttlePhys.pos.set(
                this.playerGroup.position.x + 0.5,
                1.2,
                this.playerGroup.position.z - 0.5
            );
            this.shuttlePhys.vel.set(0, 0, 0);
            this.shuttleGroup.position.copy(this.shuttlePhys.pos);
            this.shuttleShadow.position.set(this.shuttlePhys.pos.x, 0.02, this.shuttlePhys.pos.z);
        } else if (gameState === 'serve-npc') {
            this.shuttlePhys.pos.set(
                this.npcGroup.position.x - 0.5,
                1.2,
                this.npcGroup.position.z + 0.5
            );
            this.shuttlePhys.vel.set(0, 0, 0);
            this.shuttleGroup.position.copy(this.shuttlePhys.pos);
            this.shuttleShadow.position.set(this.shuttlePhys.pos.x, 0.02, this.shuttlePhys.pos.z);
        }

        PlayerManager.movePlayer(this.playerGroup, keys, {x:0, y:0}, false, isCharging, dt);
        
        if (isCharging) {
            power = Math.min(MAX_POWER, power + POWER_CHARGE_SPEED);
            if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(power);
            if (gameState === 'rally' && PlayerManager.playerHasHitRight && this.shuttlePhys.vel.z > 0 && this.shuttlePhys.pos.z > -1.5) {
                // 水平距離（2D）で判定するよう修正
                const flatPlayer = new THREE.Vector2(this.playerGroup.position.x, this.playerGroup.position.z);
                const flatShuttle = new THREE.Vector2(this.shuttlePhys.pos.x, this.shuttlePhys.pos.z);
                const dist2D = flatPlayer.distanceTo(flatShuttle);
                
                // 水平距離が近く、シャトルが高い位置にある場合にジャンプ
                if (power >= 50 && !PlayerManager.isJumping && dist2D < (this.hitRadius + 1.2) && this.shuttlePhys.pos.y > 2.5) {
                    PlayerManager.isJumping = true; PlayerManager.isAirborneWaiting = true;
                    PlayerManager.jumpVel = (power >= 99) ? 17.5 : 14.5;
                }
                
                // ジャンプ中または地上でのヒット判定
                if (PlayerManager.checkShuttleInRange(this.playerGroup.position, PlayerManager.jumpY, this.shuttlePhys.pos, this.hitRadius)) {
                    this.hitShuttle('player', power);
                    PlayerManager.playerHasHitRight = false;
                    this.stopCharging();
                }
            }
        }

        PlayerManager.updateJump(this.playerGroup.getObjectByName("bodyMesh"), dt);
        PlayerManager.updateNPC(this.npcGroup, this.shuttlePhys, gameState, dt, npcLevel);

        if (gameState === 'rally') {
            if (PlayerManager.npcHasHitRight && this.npcGroup.position.distanceTo(this.shuttlePhys.pos) < this.hitRadius && this.shuttlePhys.vel.z < 0 && this.shuttlePhys.pos.z < 1.5) {
                this.hitShuttle('npc', 80);
                PlayerManager.npcHasHitRight = false;
            }
            this.shuttlePhys.vel.y += BadmintonPhysics.gravity * dt;
            const sp = this.shuttlePhys.vel.length();
            if (sp > 0.01) {
                this.shuttlePhys.vel.sub(this.shuttlePhys.vel.clone().normalize().multiplyScalar(Math.min(BadmintonPhysics.airDrag * sp * dt, sp)));
            }
            this.shuttlePhys.pos.addScaledVector(this.shuttlePhys.vel, dt);
            this.shuttleGroup.position.copy(this.shuttlePhys.pos);
            
            if (sp > 0.1) {
                const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), this.shuttlePhys.vel.clone().normalize());
                this.shuttleGroup.quaternion.slerp(rot, 12 * dt);
            }
            
            this.shuttleShadow.position.set(this.shuttlePhys.pos.x, 0.02, this.shuttlePhys.pos.z);
            
            if (Math.abs(this.shuttlePhys.pos.z) < 0.18 && this.shuttlePhys.pos.y < this.netHeight) {
                this.shuttlePhys.vel.set(0, -3.0, this.shuttlePhys.pos.z > 0 ? 0.5 : -0.5);
            }
            
            if (this.shuttlePhys.pos.y <= 0.12) {
                this.shuttlePhys.pos.y = 0.12; this.shuttlePhys.vel.set(0,0,0);
                const inCourt = Math.abs(this.shuttlePhys.pos.x) <= this.courtWidth/2 && Math.abs(this.shuttlePhys.pos.z) <= this.courtLength/2;
                this.scorePoint(inCourt ? (this.shuttlePhys.pos.z > 0 ? 'npc' : 'player') : (this.shuttlePhys.pos.z > 0 ? 'player' : 'npc'));
            }
        }

        const bodyM = this.playerGroup.getObjectByName("bodyMesh");
        const npcBodyM = this.npcGroup.getObjectByName("bodyMesh");
        const rackP = bodyM ? bodyM.getObjectByName("racket") : null;
        const rackN = npcBodyM ? npcBodyM.getObjectByName("racket") : null;
        
        if (this.playerSwingTime >= 0 && rackP) {
            this.playerSwingTime += dt;
            if (this.playerSwingTime < 0.25) rackP.rotation.x = 0.2 - Math.sin((this.playerSwingTime/0.25)*Math.PI)*1.6;
            else { rackP.rotation.set(0.2, 0, -0.3); this.playerSwingTime = -1; }
        }
        if (this.npcSwingTime >= 0 && rackN) {
            this.npcSwingTime += dt;
            if (this.npcSwingTime < 0.25) rackN.rotation.x = 0.2 - Math.sin((this.npcSwingTime/0.25)*Math.PI)*1.6;
            else { rackN.rotation.set(0.2, 0, 0.3); this.npcSwingTime = -1; }
        }

        this.camera.position.x += (this.playerGroup.position.x * 0.42 - this.camera.position.x) * 3.8 * dt;
        this.camera.position.z += (16.5 + (this.playerGroup.position.z - 6.5) * 0.32 - this.camera.position.z) * 3.8 * dt;
        this.camera.lookAt(this.playerGroup.position.x * 0.18, 1.0, 0);
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update(this.clock.getDelta());
        this.renderer.render(this.scene, this.camera);
    }
};

window.addEventListener('DOMContentLoaded', () => GameCore.init());