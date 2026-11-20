// Global State Variables
const keys = { w: false, a: false, s: false, d: false, Space: false };
const keyboardKeys = { w: false, a: false, s: false, d: false };
let isCharging = false;
let chargeMode = 'up';
let power = 0;
const MAX_POWER = 100;
const POWER_CHARGE_SPEED = 2.5;

let playerScore = 0;
let npcScore = 0;
let gameState = 'waiting';
let courtType = 'gym'; // 初期コートタイプ
let npcLevel = 1;
let matchPoint = 21;

const GameCore = {
    selectedSport: 'tabletennis',
    activeSport: 'tabletennis',
    courtWidth: 12, courtLength: 20, netHeight: 2.2, hitRadius: 2.0,
    scene: null, camera: null, renderer: null, clock: null,
    playerGroup: null, npcGroup: null, shuttleGroup: null, shuttleShadow: null,

    shuttlePhys: {
        pos: new THREE.Vector3(0, 3, -6),
        vel: new THREE.Vector3(0, 0, 0)
    },

    playerSwingTime: -1, npcSwingTime: -1,
    prevPlayerPos: new THREE.Vector3(0, 0, 6),
    prevNpcPos: new THREE.Vector3(0, 0, -6),
    playerStepPhase: 0,
    npcStepPhase: 0,
    idleTime: 0,

    // カメラ・着地状態管理
    cameraBasePos: new THREE.Vector3(0, 8, 16),
    cameraShakeTime: 0,
    cameraShakeDuration: 0,
    cameraShakeIntensity: 0,
    prevPlayerJumping: false,
    prevNpcJumping: false,

    // VFX システム用
    trailMaxPoints: 16,
    trailPoints: [],
    trailPointPool: [],
    trailMesh: null,
    trailIsSmash: false,
    ringPool: [],
    sparkPool: [],
    chargeSparkTimer: 0,

    // GC抑制用再利用オブジェクト
    _tmpVec2A: new THREE.Vector2(),
    _tmpVec2B: new THREE.Vector2(),
    _tmpVec3A: new THREE.Vector3(),
    _tmpVec3B: new THREE.Vector3(),
    _tmpVec3C: new THREE.Vector3(),
    _tmpVec3D: new THREE.Vector3(),
    _tmpPrevShuttlePos: new THREE.Vector3(),
    _tmpQuat: new THREE.Quaternion(),
    _downVec: new THREE.Vector3(0, -1, 0),

    init() {
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.cameraBasePos.set(0, 8, 16);
        this.camera.position.copy(this.cameraBasePos);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = false;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        if (typeof EnvironmentManager !== 'undefined') {
            EnvironmentManager.buildCourt(this.scene, courtType, {
                courtWidth: this.courtWidth,
                courtLength: this.courtLength,
                netHeight: this.netHeight,
                isTableTennis: true
            });
        }

        this.buildCharacters();
        this.buildShuttle();
        this.initVFX();
        this.setBadmintonVisibility(false);

        if (typeof TableTennisGame !== 'undefined') {
            TableTennisGame.init(this);
            TableTennisGame.setVisible(true);
            TableTennisGame.resetTitlePreview();
            this.cameraBasePos.set(0, 4.4, 8.6);
            this.camera.position.copy(this.cameraBasePos);
            this.camera.lookAt(0, 1.05, 0);
        }

        if (typeof UIManager !== 'undefined') {
            UIManager.init({
                onSelectSport: (sport) => {
                    this.selectedSport = sport;
                },
                onBackToTitle: () => {
                    if (typeof TTNetwork !== 'undefined') {
                        TTNetwork.disconnect();
                    }
                    UIManager.toggleSettings(false);
                    UIManager.hideResult();
                    UIManager.setOpponentLabel('NPC');
                    UIManager.setTeamColors(false);
                    UIManager.showStartScreen(true);
                    isCharging = false;
                    power = 0;
                    chargeMode = 'up';
                    UIManager.updatePowerBar(0, 'up', 'tabletennis');
                    this.resetShuttleTrail();
                    if (typeof FloatingJoystick !== 'undefined') {
                        FloatingJoystick.reset();
                    }
                    this.setBadmintonVisibility(false);
                    if (typeof EnvironmentManager !== 'undefined') {
                        EnvironmentManager.buildCourt(this.scene, courtType, {
                            courtWidth: this.courtWidth,
                            courtLength: this.courtLength,
                            netHeight: this.netHeight,
                            isTableTennis: true
                        });
                    }
                    if (typeof TableTennisGame !== 'undefined') {
                        TableTennisGame.setVisible(true);
                        TableTennisGame.resetTitlePreview();
                    }
                    this.activeSport = 'tabletennis';
                    this.cameraBasePos.set(0, 4.4, 8.6);
                    this.camera.position.copy(this.cameraBasePos);
                    this.camera.lookAt(0, 1.05, 0);
                    if (typeof BadmintonAudio !== 'undefined' && typeof BadmintonAudio.setBGMByLevel === 'function') {
                        BadmintonAudio.setBGMByLevel(1);
                    }
                    gameState = 'waiting';
                },
                onPauseToggle: (isPaused, isMenuOpen) => {
                    if (isPaused || isMenuOpen) {
                        isCharging = false;
                        power = 0;
                        chargeMode = 'up';
                        UIManager.updatePowerBar(0, 'up', this.activeSport);
                        if (typeof FloatingJoystick !== 'undefined') {
                            FloatingJoystick.reset();
                        }
                    }
                }
            });
        }

        this.initInputs();
        this.initOnlineButtons();

        const finalStartBtn = document.getElementById('final-start-btn');
        if (finalStartBtn) {
            finalStartBtn.addEventListener('click', () => {
                const activeCourtBtn = document.querySelector('.court-opt.active');
                if (activeCourtBtn) {
                    courtType = activeCourtBtn.dataset.court;
                }
                const activeLevelBtn = document.querySelector('.level-opt.active');
                if (activeLevelBtn) {
                    npcLevel = parseInt(activeLevelBtn.dataset.level);
                }
                const activePointBtn = document.querySelector('.point-opt.active');
                if (activePointBtn) {
                    matchPoint = parseInt(activePointBtn.dataset.point);
                }

                if (typeof BadmintonAudio !== 'undefined' && typeof BadmintonAudio.setBGMByLevel === 'function') {
                    BadmintonAudio.setBGMByLevel(npcLevel);
                }

                this.activeSport = this.selectedSport || 'badminton';
                if (typeof UIManager !== 'undefined') {
                    UIManager.setSportUI(this.activeSport);
                    UIManager.updatePowerBar(0, 'up', this.activeSport);
                }

                if (this.activeSport === 'tabletennis' && typeof TableTennisGame !== 'undefined') {
                    this.setBadmintonVisibility(false);
                    this.resetShuttleTrail();
                    if (typeof UIManager !== 'undefined') UIManager.showStartScreen(false);
                    TableTennisGame.startMatch(courtType, npcLevel, matchPoint);
                    return;
                }

                if (typeof TableTennisGame !== 'undefined') {
                    TableTennisGame.setVisible(false);
                }
                this.setBadmintonVisibility(true);
                this.cameraBasePos.set(0, 8, 16);
                this.camera.position.copy(this.cameraBasePos);
                this.camera.lookAt(0, 0, 0);

                if (typeof EnvironmentManager !== 'undefined') {
                    EnvironmentManager.buildCourt(this.scene, courtType, {
                        courtWidth: this.courtWidth,
                        courtLength: this.courtLength,
                        netHeight: this.netHeight
                    });
                }

                if (typeof UIManager !== 'undefined') UIManager.showStartScreen(false);
                this.resetGame();
                this.resetToServe('player');
            });
        }

        window.addEventListener('resize', () => this.onResize());

        this.animate();
    },

    initOnlineButtons() {
        const createBtn = document.getElementById('online-create-btn');
        const joinBtn = document.getElementById('online-join-btn');
        const joinInput = document.getElementById('online-join-input');
        const roomBox = document.getElementById('online-room-box');
        const roomIdText = document.getElementById('online-room-id-text');

        const handleDisconnect = () => {
            if (typeof TableTennisGame !== 'undefined') {
                TableTennisGame.onlineMode = false;
            }
            const resultScreen = document.getElementById('result-screen');
            const isResultShown = resultScreen && resultScreen.style.display !== 'none';
            if (gameState !== 'waiting' && !isResultShown) {
                gameState = 'ended';
                isCharging = false;
                power = 0;
                if (typeof FloatingJoystick !== 'undefined') FloatingJoystick.reset();
                if (typeof UIManager !== 'undefined') {
                    UIManager.toggleSettings(false);
                    UIManager.showResult(playerScore, npcScore, '相手が切断しました');
                }
            } else if (gameState === 'waiting' && typeof UIManager !== 'undefined') {
                UIManager.resetOnlinePanelUI();
                UIManager.setOnlineStatus('接続が切断されました。', true);
            }
        };

        const handleIncomingData = (data) => {
            if (!data || !data.t) return;
            if (data.t === 'match_start') {
                courtType = data.courtType || 'gym';
                this.launchOnlineTableTennis('guest', courtType);
                return;
            }
            if (typeof TableTennisGame !== 'undefined') {
                TableTennisGame.handleNetworkData(data);
            }
        };

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (typeof TTNetwork === 'undefined') return;
                createBtn.disabled = true;
                UIManager.setOnlineStatus('ルームIDを発行しています...');
                TTNetwork.createRoom({
                    onRoomCreated: (roomId) => {
                        if (roomIdText) roomIdText.innerText = roomId;
                        if (roomBox) roomBox.style.display = 'block';
                        UIManager.setOnlineStatus('相手の参加を待っています...');
                    },
                    onConnected: () => {
                        const activeCourtBtn = document.querySelector('.court-opt.active');
                        const selectedCourt = activeCourtBtn ? activeCourtBtn.dataset.court : 'gym';
                        courtType = selectedCourt;
                        TTNetwork.send('match_start', { courtType: selectedCourt });
                        this.launchOnlineTableTennis('host', selectedCourt);
                    },
                    onData: handleIncomingData,
                    onDisconnected: handleDisconnect,
                    onError: (msg) => {
                        createBtn.disabled = false;
                        if (roomBox) roomBox.style.display = 'none';
                        UIManager.setOnlineStatus(msg, true);
                    }
                });
            });
        }

        if (joinBtn) {
            const doJoin = () => {
                if (typeof TTNetwork === 'undefined') return;
                const code = joinInput ? joinInput.value : '';
                joinBtn.disabled = true;
                UIManager.setOnlineStatus('接続中...');
                TTNetwork.joinRoom(code, {
                    onConnected: () => {
                        UIManager.setOnlineStatus('接続完了！試合を開始します...');
                    },
                    onData: handleIncomingData,
                    onDisconnected: handleDisconnect,
                    onError: (msg) => {
                        joinBtn.disabled = false;
                        UIManager.setOnlineStatus(msg, true);
                    }
                });
            };
            joinBtn.addEventListener('click', doJoin);
            if (joinInput) {
                joinInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') doJoin();
                });
            }
        }
    },

    launchOnlineTableTennis(role, selectedCourt) {
        if (typeof BadmintonAudio !== 'undefined' && typeof BadmintonAudio.setBGMByLevel === 'function') {
            BadmintonAudio.setBGMByLevel(1);
        }
        this.activeSport = 'tabletennis';
        this.selectedSport = 'tabletennis';
        if (typeof UIManager !== 'undefined') {
            UIManager.setSportUI('tabletennis');
            UIManager.updatePowerBar(0, 'up', 'tabletennis');
            UIManager.showStartScreen(false);
        }
        this.setBadmintonVisibility(false);
        this.resetShuttleTrail();
        if (typeof TableTennisGame !== 'undefined') {
            TableTennisGame.startOnlineMatch(role, selectedCourt);
        }
    },

    // -----------------------------------------------------
    // VFX（トレイル・リング・スパーク・シェイク）管理
    // -----------------------------------------------------
    initVFX() {
        this.trailPointPool = [];
        for (let i = 0; i < this.trailMaxPoints; i++) {
            this.trailPointPool.push(new THREE.Vector3());
        }

        // 1. シャトル飛行トレイル（固定頂点リボンメッシュ）
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
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.trailMesh = new THREE.Mesh(trailGeo, trailMat);
        this.trailMesh.frustumCulled = false;
        this.trailMesh.visible = false;
        this.scene.add(this.trailMesh);

        // 2. 衝撃波リングプール
        const ringGeo = new THREE.RingGeometry(0.18, 0.30, 28);
        for (let i = 0; i < 12; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(ringGeo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            this.ringPool.push({
                mesh,
                active: false,
                age: 0,
                duration: 0.3,
                startScale: 1,
                endScale: 3,
                initialOpacity: 0.8
            });
        }

        // 3. スパークパーティクルプール
        const sparkGeo = new THREE.OctahedronGeometry(0.055, 0);
        for (let i = 0; i < 48; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(sparkGeo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            this.sparkPool.push({
                mesh,
                active: false,
                age: 0,
                duration: 0.4,
                vel: new THREE.Vector3(),
                gravity: -9.8,
                startScale: 1
            });
        }
    },

    resetShuttleTrail() {
        while (this.trailPoints.length > 0) {
            this.trailPointPool.push(this.trailPoints.pop());
        }
        this.trailIsSmash = false;
        if (this.trailMesh) {
            this.trailMesh.visible = false;
        }
    },

    updateShuttleTrail(active) {
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
        ptObj.copy(this.shuttlePhys.pos);
        this.trailPoints.unshift(ptObj);

        if (this.trailPoints.length < 2) {
            this.trailMesh.visible = false;
            return;
        }

        this.trailMesh.visible = true;
        this.trailMesh.material.color.setHex(this.trailIsSmash ? 0xff7b00 : 0x99ebff);
        this.trailMesh.material.opacity = this.trailIsSmash ? 0.78 : 0.42;

        const maxHalfWidth = this.trailIsSmash ? 0.14 : 0.06;
        const posAttr = this.trailMesh.geometry.attributes.position;
        const arr = posAttr.array;

        const camPos = this.camera.position;
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

    spawnRing(pos, colorHex, startScale, endScale, duration, flatOnGround = false, initialOpacity = 0.85) {
        const item = this.ringPool.find(r => !r.active);
        if (!item) return;

        item.active = true;
        item.age = 0;
        item.duration = duration;
        item.startScale = startScale;
        item.endScale = endScale;
        item.initialOpacity = initialOpacity;

        item.mesh.position.copy(pos);
        if (flatOnGround) {
            item.mesh.rotation.set(-Math.PI / 2, 0, 0);
        } else {
            item.mesh.quaternion.copy(this.camera.quaternion);
        }
        item.mesh.scale.setScalar(startScale);
        item.mesh.material.color.setHex(colorHex);
        item.mesh.material.opacity = initialOpacity;
        item.mesh.visible = true;
    },

    spawnSparks(pos, colorHex, count, speed, gravity = -9.8, duration = 0.35, startScale = 1.0, upwardBias = 0.2) {
        let spawned = 0;
        for (let i = 0; i < this.sparkPool.length && spawned < count; i++) {
            const s = this.sparkPool[i];
            if (s.active) continue;

            s.active = true;
            s.age = 0;
            s.duration = duration * (0.75 + Math.random() * 0.5);
            s.gravity = gravity;
            s.startScale = startScale * (0.7 + Math.random() * 0.6);

            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI;
            const spd = speed * (0.5 + Math.random() * 0.8);

            s.vel.set(
                Math.cos(theta) * Math.cos(phi) * spd,
                (Math.sin(phi) + upwardBias) * spd,
                Math.sin(theta) * Math.cos(phi) * spd
            );

            s.mesh.position.copy(pos);
            s.mesh.scale.setScalar(s.startScale);
            s.mesh.material.color.setHex(colorHex);
            s.mesh.material.opacity = 1.0;
            s.mesh.visible = true;
            spawned++;
        }
    },

    triggerCameraShake(intensity, duration) {
        this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, intensity);
        this.cameraShakeDuration = Math.max(this.cameraShakeDuration, duration);
        this.cameraShakeTime = 0;
    },

    spawnHitEffect(pos, type) {
        if (type === 'smash') {
            this.spawnRing(pos, 0xffd700, 0.8, 4.8, 0.28, false, 0.95);
            this.spawnRing(pos, 0xff4500, 0.4, 3.2, 0.22, false, 0.9);
            this.spawnSparks(pos, 0xffae00, 16, 8.5, -6.0, 0.38, 1.35, 0.15);
            this.spawnSparks(pos, 0xffffff, 8, 10.5, -4.0, 0.28, 1.0, 0.1);
            this.triggerCameraShake(0.14, 0.16);
        } else if (type === 'cut') {
            this.spawnRing(pos, 0x00d8ff, 0.7, 3.8, 0.28, false, 0.92);
            this.spawnRing(pos, 0x80f3ff, 0.35, 2.4, 0.22, false, 0.85);
            this.spawnSparks(pos, 0x00d8ff, 14, 6.2, -5.0, 0.36, 1.2, 0.15);
            this.spawnSparks(pos, 0xffffff, 6, 7.5, -4.0, 0.26, 0.9, 0.1);
        } else if (type === 'drop') {
            this.spawnRing(pos, 0x64f5a6, 0.4, 2.0, 0.22, false, 0.7);
            this.spawnSparks(pos, 0xb8ffd6, 6, 3.8, -5.0, 0.28, 0.8, 0.2);
        } else {
            this.spawnRing(pos, 0x80e5ff, 0.5, 2.6, 0.24, false, 0.8);
            this.spawnSparks(pos, 0xffffff, 8, 5.2, -7.0, 0.3, 0.95, 0.2);
        }
    },

    updateVFX(dt) {
        // リングプール更新
        for (let i = 0; i < this.ringPool.length; i++) {
            const r = this.ringPool[i];
            if (!r.active) continue;

            r.age += dt;
            const t = r.age / r.duration;
            if (t >= 1) {
                r.active = false;
                r.mesh.visible = false;
            } else {
                const ease = 1 - Math.pow(1 - t, 3);
                const s = r.startScale + (r.endScale - r.startScale) * ease;
                r.mesh.scale.setScalar(s);
                r.mesh.material.opacity = r.initialOpacity * (1 - t);
            }
        }

        // スパークプール更新
        for (let i = 0; i < this.sparkPool.length; i++) {
            const s = this.sparkPool[i];
            if (!s.active) continue;

            s.age += dt;
            const t = s.age / s.duration;
            if (t >= 1) {
                s.active = false;
                s.mesh.visible = false;
            } else {
                s.vel.y += s.gravity * dt;
                s.mesh.position.addScaledVector(s.vel, dt);
                s.mesh.rotation.x += 8 * dt;
                s.mesh.rotation.y += 8 * dt;
                s.mesh.scale.setScalar(s.startScale * (1 - t));
                s.mesh.material.opacity = 1 - t;
            }
        }

        // プレイヤー足元ヒットリングのチャージ連動発光＆上昇粒子
        const rangeRing = this.playerGroup ? this.playerGroup.getObjectByName("rangeRing") : null;
        if (rangeRing) {
            if (isCharging && gameState === 'rally') {
                if (power >= 50) {
                    rangeRing.material.color.setHex(power >= 95 ? 0xff3b30 : 0xff9500);
                    rangeRing.material.opacity = 0.85;
                    this.chargeSparkTimer += dt;
                    if (this.chargeSparkTimer >= 0.045) {
                        this.chargeSparkTimer = 0;
                        const angle = Math.random() * Math.PI * 2;
                        const rad = 0.4 + Math.random() * 0.7;
                        const p = new THREE.Vector3(
                            this.playerGroup.position.x + Math.cos(angle) * rad,
                            0.08,
                            this.playerGroup.position.z + Math.sin(angle) * rad
                        );
                        this.spawnSparks(p, power >= 95 ? 0xff4500 : 0xffd700, 1, 2.2, 4.5, 0.35, 0.8, 1.0);
                    }
                } else {
                    rangeRing.material.color.setHex(0xffd700);
                    rangeRing.material.opacity = 0.65;
                }
            } else {
                rangeRing.material.color.setHex(0xffffff);
                rangeRing.material.opacity = 0.45;
                this.chargeSparkTimer = 0;
            }
        }
    },

    createStringBedTexture(stencilColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 256, 256);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        const step = 18;
        for (let i = step; i < 256; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 256);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(256, i);
            ctx.stroke();
        }

        ctx.strokeStyle = stencilColor;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(92, 100);
        ctx.lineTo(128, 156);
        ctx.lineTo(164, 100);
        ctx.stroke();

        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        return tex;
    },

    createBadmintonRacket(primaryColor, accentColor, stringTex) {
        const racket = new THREE.Group();

        const capGeo = new THREE.CylinderGeometry(0.032, 0.034, 0.03, 12);
        const capMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.4, metalness: 0.3 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 0.015;
        racket.add(cap);

        const gripGeo = new THREE.CylinderGeometry(0.024, 0.031, 0.23, 12);
        const gripMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.9 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.y = 0.145;
        racket.add(grip);

        const tapeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.024, 12);
        const tapeMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.y = 0.255;
        racket.add(tape);

        const coneGeo = new THREE.CylinderGeometry(0.011, 0.024, 0.06, 12);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.6, roughness: 0.3 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = 0.295;
        racket.add(cone);

        const shaftGeo = new THREE.CylinderGeometry(0.009, 0.01, 0.44, 10);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x22252a, metalness: 0.85, roughness: 0.2 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.y = 0.545;
        racket.add(shaft);

        const tJointGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10);
        const frameMat = new THREE.MeshStandardMaterial({ color: primaryColor, metalness: 0.75, roughness: 0.25 });
        const tJoint = new THREE.Mesh(tJointGeo, frameMat);
        tJoint.position.y = 0.775;
        racket.add(tJoint);

        const throatGeo = new THREE.CylinderGeometry(0.008, 0.009, 0.11, 8);
        [-1, 1].forEach(side => {
            const throat = new THREE.Mesh(throatGeo, frameMat);
            throat.position.set(side * 0.032, 0.825, 0);
            throat.rotation.z = -side * 0.48;
            racket.add(throat);
        });

        const frameGroup = new THREE.Group();
        frameGroup.position.y = 1.03;

        const frameGeo = new THREE.TorusGeometry(0.18, 0.013, 10, 36);
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.scale.set(0.78, 1.05, 1.0);
        frameGroup.add(frame);

        const accentArcGeo = new THREE.TorusGeometry(0.18, 0.0145, 8, 20, Math.PI * 0.65);
        const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.6, roughness: 0.25 });
        const accentArc = new THREE.Mesh(accentArcGeo, accentMat);
        accentArc.rotation.z = Math.PI * 0.175;
        accentArc.scale.set(0.78, 1.05, 1.0);
        frameGroup.add(accentArc);

        const bedGeo = new THREE.CircleGeometry(0.175, 28);
        const bedMat = new THREE.MeshBasicMaterial({
            map: stringTex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.scale.set(0.78, 1.05, 1.0);
        frameGroup.add(bed);

        racket.add(frameGroup);

        const arcGeo = new THREE.RingGeometry(0.75, 1.25, 24, 1, -Math.PI * 0.35, Math.PI * 0.7);
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

    createSportsCharacter(config) {
        const bodyMesh = new THREE.Group();
        bodyMesh.name = "bodyMesh";
        bodyMesh.position.y = 0.5;

        const visualRoot = new THREE.Group();
        visualRoot.name = "visualRoot";
        if (config.faceBack) {
            visualRoot.rotation.y = Math.PI;
        }
        bodyMesh.add(visualRoot);

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd2b3, roughness: 0.55 });
        const jerseyMat = new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.45 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const shortsMat = new THREE.MeshStandardMaterial({ color: config.shortsColor, roughness: 0.65 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.4 });
        const soleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
        const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.8 });

        const createLeg = (xOffset, name) => {
            const legGroup = new THREE.Group();
            legGroup.name = name;
            legGroup.position.set(xOffset, -0.18, 0);

            const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.095, 0.14, 12), shortsMat);
            shortLeg.position.y = -0.04;
            legGroup.add(shortLeg);

            const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.046, 0.16, 10), skinMat);
            calf.position.y = -0.16;
            legGroup.add(calf);

            const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.06, 10), trimMat);
            sock.position.y = -0.23;
            legGroup.add(sock);

            const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.19), shoeMat);
            shoeUpper.position.set(0, -0.27, 0.03);
            legGroup.add(shoeUpper);

            const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.024, 0.2), soleMat);
            shoeSole.position.set(0, -0.308, 0.03);
            legGroup.add(shoeSole);

            return legGroup;
        };

        visualRoot.add(createLeg(-0.12, "leftLeg"));
        visualRoot.add(createLeg(0.12, "rightLeg"));

        const torsoGroup = new THREE.Group();
        torsoGroup.name = "torsoGroup";

        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.14, 16), shortsMat);
        pelvis.position.y = -0.12;
        torsoGroup.add(pelvis);

        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.36, 16), jerseyMat);
        chest.position.y = 0.11;
        torsoGroup.add(chest);

        const stripeGeo = new THREE.BoxGeometry(0.04, 0.34, 0.28);
        [-0.205, 0.205].forEach(sx => {
            const stripe = new THREE.Mesh(stripeGeo, trimMat);
            stripe.position.set(sx, 0.11, 0);
            torsoGroup.add(stripe);
        });

        const chestBand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.36), trimMat);
        chestBand.position.set(0, 0.16, 0);
        torsoGroup.add(chestBand);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.09, 12), skinMat);
        neck.position.y = 0.32;
        torsoGroup.add(neck);

        visualRoot.add(torsoGroup);

        const headGroup = new THREE.Group();
        headGroup.position.y = 0.51;

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 24), skinMat);
        headGroup.add(head);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        const eyeGeo = new THREE.SphereGeometry(0.024, 8, 8);
        [-0.075, 0.075].forEach(ex => {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.scale.set(0.9, 1.3, 0.6);
            eye.position.set(ex, 0.01, 0.195);
            headGroup.add(eye);
        });

        const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.218, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
        hairCrown.rotation.x = -0.22;
        headGroup.add(hairCrown);

        if (config.hasCap) {
            const bandGeo = new THREE.TorusGeometry(0.212, 0.026, 8, 24);
            const bandMat = new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.4 });
            const headband = new THREE.Mesh(bandGeo, bandMat);
            headband.rotation.x = Math.PI / 2 - 0.15;
            headband.position.y = 0.06;
            headGroup.add(headband);

            const knotGeo = new THREE.BoxGeometry(0.08, 0.03, 0.05);
            const knot = new THREE.Mesh(knotGeo, trimMat);
            knot.position.set(0, 0.03, -0.215);
            headGroup.add(knot);
        } else {
            const bandGeo = new THREE.TorusGeometry(0.214, 0.025, 8, 24);
            const visorMat = new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.35 });
            const band = new THREE.Mesh(bandGeo, visorMat);
            band.rotation.x = Math.PI / 2 - 0.12;
            band.position.y = 0.07;
            headGroup.add(band);

            const brimGeo = new THREE.CylinderGeometry(0.23, 0.25, 0.02, 16, 1, false, -Math.PI * 0.35, Math.PI * 0.7);
            const brim = new THREE.Mesh(brimGeo, trimMat);
            brim.position.set(0, 0.08, 0.07);
            brim.rotation.x = 0.18;
            headGroup.add(brim);
        }

        visualRoot.add(headGroup);

        const leftShoulder = new THREE.Group();
        leftShoulder.name = "leftArm";
        leftShoulder.position.set(0.27, 0.22, 0);

        const lSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), jerseyMat);
        leftShoulder.add(lSleeve);

        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.26, 10), skinMat);
        lArm.position.set(0.04, -0.14, 0.06);
        lArm.rotation.set(-0.35, 0, 0.25);
        leftShoulder.add(lArm);

        const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), skinMat);
        lHand.position.set(0.08, -0.26, 0.11);
        leftShoulder.add(lHand);

        visualRoot.add(leftShoulder);

        const rightShoulder = new THREE.Group();
        rightShoulder.name = "racket";
        rightShoulder.position.set(-0.27, 0.22, 0);
        rightShoulder.rotation.set(-0.35, 0, -0.12);

        const rSleeve = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), jerseyMat);
        rightShoulder.add(rSleeve);

        const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.18, 10), skinMat);
        rUpperArm.position.set(-0.05, 0.06, 0.05);
        rUpperArm.rotation.set(0.45, 0, 0.35);
        rightShoulder.add(rUpperArm);

        const wristBand = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.05, 10), trimMat);
        wristBand.position.set(-0.1, 0.16, 0.11);
        wristBand.rotation.set(0.2, 0, 0.15);
        rightShoulder.add(wristBand);

        const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), skinMat);
        rHand.position.set(-0.11, 0.2, 0.12);
        rightShoulder.add(rHand);

        const racketMesh = this.createBadmintonRacket(config.primaryColor, config.accentColor, config.stringTex);
        racketMesh.name = "racketMesh";
        racketMesh.position.set(-0.11, 0.12, 0.13);
        racketMesh.rotation.set(0.22, 0, 0.08);
        rightShoulder.add(racketMesh);

        visualRoot.add(rightShoulder);

        return bodyMesh;
    },

    buildCharacters() {
        const playerStringTex = this.createStringBedTexture('#ff3b30');
        const npcStringTex = this.createStringBedTexture('#007aff');

        const shadowGeo = new THREE.RingGeometry(0, 0.45, 32);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });

        this.playerGroup = new THREE.Group();
        const playerBody = this.createSportsCharacter({
            primaryColor: 0xff3b30,
            accentColor: 0xffd700,
            shortsColor: 0x1c1c1e,
            hairColor: 0x2b1d14,
            faceBack: true,
            hasCap: true,
            stringTex: playerStringTex
        });
        this.playerGroup.add(playerBody);

        const playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
        playerShadow.rotation.x = -Math.PI / 2;
        playerShadow.position.y = 0.025;
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
        rangeMesh.name = "rangeRing";
        rangeMesh.rotation.x = -Math.PI / 2;
        rangeMesh.position.y = 0.028;
        this.playerGroup.add(rangeMesh);

        this.playerGroup.position.set(0, 0, 6);
        this.scene.add(this.playerGroup);

        this.npcGroup = new THREE.Group();
        const npcBody = this.createSportsCharacter({
            primaryColor: 0x007aff,
            accentColor: 0x00d4ff,
            shortsColor: 0x182235,
            hairColor: 0x1f242d,
            faceBack: false,
            hasCap: false,
            stringTex: npcStringTex
        });
        this.npcGroup.add(npcBody);

        const npcShadow = playerShadow.clone();
        this.npcGroup.add(npcShadow);

        this.npcGroup.position.set(0, 0, -6);
        this.scene.add(this.npcGroup);
    },

    buildShuttle() {
        this.shuttleGroup = new THREE.Group();

        const corkGeo = new THREE.SphereGeometry(0.06, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const corkMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.75 });
        const cork = new THREE.Mesh(corkGeo, corkMat);
        cork.rotation.x = Math.PI;
        this.shuttleGroup.add(cork);

        const tapeGeo = new THREE.CylinderGeometry(0.0605, 0.0605, 0.012, 16, 1);
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xcc1100 });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.y = -0.01;
        this.shuttleGroup.add(tape);

        const skirtGeo = new THREE.CylinderGeometry(0.12, 0.06, 0.16, 16, 1, true);
        const skirtMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
            roughness: 0.9
        });
        const skirt = new THREE.Mesh(skirtGeo, skirtMat);
        skirt.position.y = 0.08;
        this.shuttleGroup.add(skirt);

        const skeletonMat = new THREE.MeshBasicMaterial({
            color: 0xeeeeee,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        const skeleton = new THREE.Mesh(skirtGeo, skeletonMat);
        skeleton.position.y = 0.08;
        this.shuttleGroup.add(skeleton);

        const ringGeo = new THREE.TorusGeometry(0.09, 0.002, 4, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.09;
        this.shuttleGroup.add(ring);

        this.scene.add(this.shuttleGroup);

        this.shuttleShadow = new THREE.Mesh(
            new THREE.RingGeometry(0, 0.18, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
        );
        this.shuttleShadow.rotation.x = -Math.PI / 2;
        this.shuttleShadow.position.y = 0.025;
        this.scene.add(this.shuttleShadow);
    },

    syncDirectionalKeys() {
        const joyKeys = (typeof FloatingJoystick !== 'undefined')
            ? FloatingJoystick.joyKeys
            : { w: false, a: false, s: false, d: false };
        keys.w = keyboardKeys.w || joyKeys.w;
        keys.a = keyboardKeys.a || joyKeys.a;
        keys.s = keyboardKeys.s || joyKeys.s;
        keys.d = keyboardKeys.d || joyKeys.d;
    },

    initInputs() {
        if (typeof FloatingJoystick !== 'undefined') {
            FloatingJoystick.init({
                onChange: () => this.syncDirectionalKeys()
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.code === 'Space' || e.code === 'KeyV' || e.key === 'v' || e.key === 'V') {
                keys.Space = true;
                this.startCharging('up');
            }
            if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
                if (this.activeSport === 'tabletennis') this.startCharging('down');
            }
            if (e.code === 'KeyW' || e.key === 'ArrowUp') { keyboardKeys.w = true; this.syncDirectionalKeys(); }
            if (e.code === 'KeyA' || e.key === 'ArrowLeft') { keyboardKeys.a = true; this.syncDirectionalKeys(); }
            if (e.code === 'KeyS' || e.key === 'ArrowDown') { keyboardKeys.s = true; this.syncDirectionalKeys(); }
            if (e.code === 'KeyD' || e.key === 'ArrowRight') { keyboardKeys.d = true; this.syncDirectionalKeys(); }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.code === 'Space' || e.code === 'KeyV' || e.key === 'v' || e.key === 'V') {
                keys.Space = false;
                this.stopCharging('up');
            }
            if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
                if (this.activeSport === 'tabletennis') this.stopCharging('down');
            }
            if (e.code === 'KeyW' || e.key === 'ArrowUp') { keyboardKeys.w = false; this.syncDirectionalKeys(); }
            if (e.code === 'KeyA' || e.key === 'ArrowLeft') { keyboardKeys.a = false; this.syncDirectionalKeys(); }
            if (e.code === 'KeyS' || e.key === 'ArrowDown') { keyboardKeys.s = false; this.syncDirectionalKeys(); }
            if (e.code === 'KeyD' || e.key === 'ArrowRight') { keyboardKeys.d = false; this.syncDirectionalKeys(); }
        });

        const dpadMapping = { 'dpad-up': 'w', 'dpad-down': 's', 'dpad-left': 'a', 'dpad-right': 'd' };
        Object.keys(dpadMapping).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    keyboardKeys[dpadMapping[id]] = true;
                    this.syncDirectionalKeys();
                }, { passive: false });

                const stopKey = (e) => {
                    e.preventDefault();
                    keyboardKeys[dpadMapping[id]] = false;
                    this.syncDirectionalKeys();
                };
                btn.addEventListener('touchend', stopKey, { passive: false });
                btn.addEventListener('touchcancel', stopKey, { passive: false });
            }
        });

        const bindActionBtn = (btn, mode) => {
            if (!btn) return;
            let activeTouchId = null;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (activeTouchId !== null) return;
                activeTouchId = e.changedTouches[0].identifier;
                this.startCharging(mode);
            }, { passive: false });

            const endTouchCharge = (e) => {
                if (activeTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        e.preventDefault();
                        activeTouchId = null;
                        this.stopCharging(mode);
                        break;
                    }
                }
            };

            btn.addEventListener('touchend', endTouchCharge, { passive: false });
            btn.addEventListener('touchcancel', endTouchCharge, { passive: false });

            btn.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || activeTouchId !== null) return;
                this.startCharging(mode);
            });
            btn.addEventListener('mouseup', () => {
                if (activeTouchId === null) this.stopCharging(mode);
            });
        };

        bindActionBtn(document.getElementById('hit-button'), 'up');
        bindActionBtn(document.getElementById('cut-button'), 'down');
    },

    setBadmintonVisibility(visible) {
        if (this.playerGroup) this.playerGroup.visible = visible;
        if (this.npcGroup) this.npcGroup.visible = visible;
        if (this.shuttleGroup) this.shuttleGroup.visible = visible;
        if (this.shuttleShadow) this.shuttleShadow.visible = visible;
    },

    startCharging(mode = 'up') {
        if (gameState === 'ended' || gameState === 'waiting') return;
        if (typeof UIManager !== 'undefined' && (UIManager.isPaused || UIManager.isMenuOpen)) return;
        if (isCharging) return;
        chargeMode = (this.activeSport === 'tabletennis' && mode === 'down') ? 'down' : 'up';
        isCharging = true;
        if (typeof UIManager !== 'undefined') {
            UIManager.updatePowerBar(power, chargeMode, this.activeSport);
        }
    },

    stopCharging(mode = null) {
        if (this.activeSport === 'tabletennis' && mode !== null) {
            if (!isCharging || mode !== chargeMode) return;
        }
        const activeMode = chargeMode;
        isCharging = false;
        if (this.activeSport === 'tabletennis' && typeof TableTennisGame !== 'undefined') {
            TableTennisGame.stopCharging(activeMode);
            power = 0;
            chargeMode = 'up';
            if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', 'tabletennis');
            return;
        }
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
        power = 0;
        chargeMode = 'up';
        if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', this.activeSport);
    },

    hitShuttle(hitter, hitPower) {
        const isDrop = (hitter === 'player' && keys.s);
        const isSmash = (!isDrop && hitPower >= 50);

        BadmintonAudio.playHit(isSmash);

        if (hitter === 'player') {
            this.playerSwingTime = 0;
            let tx = (keys.a) ? -4.2 : (keys.d) ? 4.2 : (Math.random() - 0.5) * 1.5;

            if (isDrop) {
                let tz = -2.0 - Math.random() * 1.2;
                BadmintonPhysics.calculateDrop(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 2.4, this.shuttlePhys);
                this.trailIsSmash = false;
                this.spawnHitEffect(this.shuttlePhys.pos, 'drop');
            } else if (isSmash) {
                let tz = -this.courtLength / 2 + 1.2 + Math.random() * 2.0;
                const jumpHitPoint = new THREE.Vector3(this.playerGroup.position.x, 2.3 + (PlayerManager.jumpY * 0.5), this.playerGroup.position.z);
                BadmintonPhysics.calculateSmash(jumpHitPoint, new THREE.Vector3(tx, 0.1, tz), hitPower, this.shuttlePhys);
                this.trailIsSmash = true;
                this.spawnHitEffect(jumpHitPoint, 'smash');
            } else {
                let tz = -this.courtLength / 2 + 1.2 + Math.random() * 2.0;
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.5, this.shuttlePhys);
                this.trailIsSmash = false;
                this.spawnHitEffect(this.shuttlePhys.pos, 'lob');
            }
            PlayerManager.npcHasHitRight = true; PlayerManager.isAirborneWaiting = false;
        } else {
            this.npcSwingTime = 0;
            let tx = this.playerGroup.position.x > 0 ? -3.4 : 3.4;
            if (npcLevel === 3 || npcLevel === 4) {
                tx = this.playerGroup.position.x > 1.2 ? -4.0 : (this.playerGroup.position.x < -1.2 ? 4.0 : (Math.random() > 0.5 ? 4.0 : -4.0));
            }

            let tz = this.courtLength / 2 - 1.5 - Math.random() * 2.0;
            let npcShotType = 'lob';

            if (npcLevel === 4) {
                const isChanceBall = this.shuttlePhys.pos.y >= 3.0 && this.shuttlePhys.pos.z < -3.0;

                if (PlayerManager.npcIsJumping && isChanceBall) {
                    const jumpHitPointNPC = new THREE.Vector3(this.npcGroup.position.x, 2.3 + (PlayerManager.npcJumpY * 0.5), this.npcGroup.position.z);
                    BadmintonPhysics.calculateSmash(jumpHitPointNPC, new THREE.Vector3(tx, 0.1, tz), 100, this.shuttlePhys);
                    npcShotType = 'smash';
                } else if (isChanceBall) {
                    BadmintonPhysics.calculateSmash(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 85, this.shuttlePhys);
                    npcShotType = 'smash';
                } else {
                    if (Math.random() < 0.30) {
                        const dropTx = this.playerGroup.position.x > 0 ? -3.8 : 3.8;
                        const dropTz = 2.0 + Math.random() * 1.0;
                        BadmintonPhysics.calculateDrop(this.shuttlePhys.pos, new THREE.Vector3(dropTx, 0.1, dropTz), 2.4, this.shuttlePhys);
                        npcShotType = 'drop';
                    } else {
                        BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.4 + Math.random() * 1.5, this.shuttlePhys);
                    }
                }
            } else if (npcLevel === 3) {
                const isChanceBall = this.shuttlePhys.pos.y >= 3.0 && this.shuttlePhys.pos.z < -3.0;

                if (isChanceBall && Math.random() < 0.50) {
                    if (PlayerManager.npcIsJumping) {
                        const jumpHitPointNPC = new THREE.Vector3(this.npcGroup.position.x, 2.3 + (PlayerManager.npcJumpY * 0.5), this.npcGroup.position.z);
                        BadmintonPhysics.calculateSmash(jumpHitPointNPC, new THREE.Vector3(tx, 0.1, tz), 70, this.shuttlePhys);
                    } else {
                        BadmintonPhysics.calculateSmash(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 68, this.shuttlePhys);
                    }
                    npcShotType = 'smash';
                } else {
                    if (Math.random() < 0.12) {
                        const dropTx = this.playerGroup.position.x > 0 ? -3.8 : 3.8;
                        const dropTz = 2.0 + Math.random() * 1.0;
                        BadmintonPhysics.calculateDrop(this.shuttlePhys.pos, new THREE.Vector3(dropTx, 0.1, dropTz), 2.4, this.shuttlePhys);
                        npcShotType = 'drop';
                    } else {
                        BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.2 + Math.random() * 1.5, this.shuttlePhys);
                    }
                }
            } else if (npcLevel === 2) {
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 4.8 + Math.random() * 2.0, this.shuttlePhys);
            } else {
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 4.8 + Math.random() * 2.0, this.shuttlePhys);
            }

            this.trailIsSmash = (npcShotType === 'smash');
            this.spawnHitEffect(this.shuttlePhys.pos, npcShotType);
            PlayerManager.playerHasHitRight = true;
        }
        gameState = 'rally';
    },

    serveShuttle(server) {
        BadmintonAudio.playHit(false);
        this.trailIsSmash = false;
        this.spawnHitEffect(this.shuttlePhys.pos, 'lob');
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
        this.trailIsSmash = false;

        if (typeof BadmintonAudio !== 'undefined') {
            BadmintonAudio.playCheer();
        }

        if (winner === 'player') {
            playerScore++; document.getElementById('player-score').innerText = playerScore; this.showBanner("POINT FOR YOU!", "#34c759");
        } else {
            npcScore++; document.getElementById('npc-score').innerText = npcScore; this.showBanner("POINT FOR NPC!", "#ff3b30");
        }

        if (playerScore >= matchPoint || npcScore >= matchPoint) {
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
        this.prevPlayerPos.copy(this.playerGroup.position);
        this.prevNpcPos.copy(this.npcGroup.position);
        this.playerSwingTime = -1;
        this.npcSwingTime = -1;
        this.prevPlayerJumping = false;
        this.prevNpcJumping = false;
        this.resetShuttleTrail();
        power = 0;
        chargeMode = 'up';
        if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0, 'up', 'badminton');
        isCharging = false;
        PlayerManager.playerHasHitRight = true; PlayerManager.npcHasHitRight = true;
        PlayerManager.isJumping = false; PlayerManager.isAirborneWaiting = false;
        PlayerManager.jumpY = 0; PlayerManager.jumpVel = 0;

        PlayerManager.npcIsJumping = false; PlayerManager.npcJumpY = 0; PlayerManager.npcJumpVel = 0;
        const npcBodyM = this.npcGroup.getObjectByName("bodyMesh");
        if (npcBodyM) npcBodyM.position.y = 0.5;

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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    },

    updateCharacterAnimation(group, prevPos, stepPhaseKey, isAirborne, isCharCharging, swingTime, dt) {
        const bodyM = group.getObjectByName("bodyMesh");
        if (!bodyM) return swingTime;

        const visualRoot = bodyM.getObjectByName("visualRoot");
        if (!visualRoot) return swingTime;

        const dx = group.position.x - prevPos.x;
        const dz = group.position.z - prevPos.z;
        const moveDist = Math.hypot(dx, dz);
        const speed = dt > 0.0001 ? moveDist / dt : 0;
        prevPos.copy(group.position);

        const faceSign = visualRoot.rotation.y !== 0 ? -1 : 1;
        const targetLeanX = Math.max(-0.14, Math.min(0.14, (dz / (dt * 8 + 0.001)) * 0.08 * faceSign));
        const targetLeanZ = Math.max(-0.14, Math.min(0.14, -(dx / (dt * 8 + 0.001)) * 0.08 * faceSign));
        visualRoot.rotation.x += (targetLeanX - visualRoot.rotation.x) * 10 * dt;
        visualRoot.rotation.z += (targetLeanZ - visualRoot.rotation.z) * 10 * dt;

        const leftLeg = visualRoot.getObjectByName("leftLeg");
        const rightLeg = visualRoot.getObjectByName("rightLeg");

        if (!isAirborne && speed > 0.3) {
            this[stepPhaseKey] += dt * Math.min(speed * 2.4, 18);
            const swing = Math.sin(this[stepPhaseKey]) * 0.55;
            if (leftLeg) leftLeg.rotation.x = swing;
            if (rightLeg) rightLeg.rotation.x = -swing;
            visualRoot.position.y = Math.abs(Math.sin(this[stepPhaseKey])) * 0.045 - (isCharCharging ? 0.06 : 0);
        } else {
            if (leftLeg) leftLeg.rotation.x += (0 - leftLeg.rotation.x) * 12 * dt;
            if (rightLeg) rightLeg.rotation.x += (0 - rightLeg.rotation.x) * 12 * dt;
            const crouch = isCharCharging ? -0.07 : Math.sin(this.idleTime * 3.2) * 0.012;
            visualRoot.position.y += (crouch - visualRoot.position.y) * 12 * dt;
        }

        const racketArm = visualRoot.getObjectByName("racket");
        const swingArc = racketArm ? racketArm.getObjectByName("swingArc") : null;

        if (racketArm) {
            if (swingTime >= 0) {
                swingTime += dt;
                const duration = 0.25;
                if (swingTime < duration) {
                    const t = swingTime / duration;
                    racketArm.rotation.x = -1.1 + Math.sin(t * Math.PI * 0.65) * 2.45;
                    racketArm.rotation.z = -0.15 + Math.sin(t * Math.PI) * 0.35;
                    if (swingArc) {
                        swingArc.visible = true;
                        swingArc.material.opacity = (1 - t) * 0.55;
                    }
                } else {
                    racketArm.rotation.set(-0.35, 0, -0.12);
                    if (swingArc) {
                        swingArc.visible = false;
                        swingArc.material.opacity = 0;
                    }
                    swingTime = -1;
                }
            } else if (isCharCharging) {
                const chargeRatio = Math.min(1, power / MAX_POWER);
                const targetRotX = -0.65 - chargeRatio * 0.65;
                racketArm.rotation.x += (targetRotX - racketArm.rotation.x) * 12 * dt;
                racketArm.rotation.z += (-0.28 - racketArm.rotation.z) * 12 * dt;
                if (swingArc) swingArc.visible = false;
            } else {
                const idleSway = Math.sin(this.idleTime * 3.2) * 0.04;
                racketArm.rotation.x += (-0.35 + idleSway - racketArm.rotation.x) * 10 * dt;
                racketArm.rotation.z += (-0.12 - racketArm.rotation.z) * 10 * dt;
                if (swingArc) swingArc.visible = false;
            }
        }

        return swingTime;
    },

    update(dt) {
        if (dt > 0.1) dt = 0.1;
        this.idleTime += dt;
        const isOnlineMatch = (this.activeSport === 'tabletennis' && typeof TableTennisGame !== 'undefined' && TableTennisGame.onlineMode);
        if (gameState === 'waiting' || (!isOnlineMatch && typeof UIManager !== 'undefined' && UIManager.isPaused)) return;
        if (this.activeSport === 'tabletennis' && typeof TableTennisGame !== 'undefined') {
            TableTennisGame.update(dt);
            return;
        }

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

        const joyDir = (typeof FloatingJoystick !== 'undefined') ? FloatingJoystick.dir : { x: 0, y: 0 };
        const joyActive = (typeof FloatingJoystick !== 'undefined') ? FloatingJoystick.active : false;
        PlayerManager.movePlayer(this.playerGroup, keys, joyDir, joyActive, isCharging, dt);

        if (isCharging) {
            power = Math.min(MAX_POWER, power + POWER_CHARGE_SPEED);
            if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(power, chargeMode, this.activeSport);
            if (gameState === 'rally' && PlayerManager.playerHasHitRight && this.shuttlePhys.vel.z > 0 && this.shuttlePhys.pos.z > -1.5) {
                this._tmpVec2A.set(this.playerGroup.position.x, this.playerGroup.position.z);
                this._tmpVec2B.set(this.shuttlePhys.pos.x, this.shuttlePhys.pos.z);
                const dist2D = this._tmpVec2A.distanceTo(this._tmpVec2B);

                if (power >= 50 && !PlayerManager.isJumping && dist2D < (this.hitRadius + 1.2) && this.shuttlePhys.pos.y > 2.5) {
                    PlayerManager.isJumping = true; PlayerManager.isAirborneWaiting = true;
                    PlayerManager.jumpVel = (power >= 99) ? 17.5 : 14.5;
                }

                if (PlayerManager.checkShuttleInRange(this.playerGroup.position, PlayerManager.jumpY, this.shuttlePhys.pos, this.hitRadius)) {
                    this.hitShuttle('player', power);
                    PlayerManager.playerHasHitRight = false;
                    this.stopCharging();
                }
            }
        }

        PlayerManager.updateJump(this.playerGroup.getObjectByName("bodyMesh"), dt);
        PlayerManager.updateNPC(this.npcGroup, this.shuttlePhys, gameState, dt, npcLevel);

        // ジャンプ着地時の足元ダストリング生成
        if (this.prevPlayerJumping && !PlayerManager.isJumping) {
            this._tmpVec3D.set(this.playerGroup.position.x, 0.04, this.playerGroup.position.z);
            this.spawnRing(this._tmpVec3D, 0xffffff, 0.8, 2.4, 0.28, true, 0.55);
        }
        if (this.prevNpcJumping && !PlayerManager.npcIsJumping) {
            this._tmpVec3D.set(this.npcGroup.position.x, 0.04, this.npcGroup.position.z);
            this.spawnRing(this._tmpVec3D, 0xffffff, 0.8, 2.4, 0.28, true, 0.55);
        }
        this.prevPlayerJumping = PlayerManager.isJumping;
        this.prevNpcJumping = PlayerManager.npcIsJumping;

        if (gameState === 'rally') {
            const npcRangeRadius = (npcLevel === 3 || npcLevel === 4) ? this.hitRadius : this.hitRadius * 0.85;
            const isNpcInRange = PlayerManager.checkShuttleInRange(
                this.npcGroup.position,
                PlayerManager.npcJumpY,
                this.shuttlePhys.pos,
                npcRangeRadius
            );

            if (PlayerManager.npcHasHitRight && isNpcInRange && this.shuttlePhys.vel.z < 0 && this.shuttlePhys.pos.z < 1.5) {
                let npcPower = 70;
                if (npcLevel === 3 || npcLevel === 4) {
                    npcPower = PlayerManager.npcIsJumping ? 100 : 80;
                }
                this.hitShuttle('npc', npcPower);
                PlayerManager.npcHasHitRight = false;
            }
            this.shuttlePhys.vel.y += BadmintonPhysics.gravity * dt;
            const sp = this.shuttlePhys.vel.length();
            if (sp > 0.01) {
                const drag = Math.min(BadmintonPhysics.airDrag * sp * dt, sp);
                this.shuttlePhys.vel.addScaledVector(this._tmpVec3D.copy(this.shuttlePhys.vel).normalize(), -drag);
            }
            const prevPos = this._tmpPrevShuttlePos.copy(this.shuttlePhys.pos);
            this.shuttlePhys.pos.addScaledVector(this.shuttlePhys.vel, dt);
            this.shuttleGroup.position.copy(this.shuttlePhys.pos);

            if (sp > 0.1) {
                this._tmpVec3D.copy(this.shuttlePhys.vel).normalize();
                this._tmpQuat.setFromUnitVectors(this._downVec, this._tmpVec3D);
                this.shuttleGroup.quaternion.slerp(this._tmpQuat, 12 * dt);
            }

            this.shuttleShadow.position.set(this.shuttlePhys.pos.x, 0.02, this.shuttlePhys.pos.z);

            const crossedNet = (prevPos.z > 0 && this.shuttlePhys.pos.z <= 0) || (prevPos.z < 0 && this.shuttlePhys.pos.z >= 0);
            if (crossedNet) {
                const dz = this.shuttlePhys.pos.z - prevPos.z;
                if (Math.abs(dz) > 0.0001) {
                    const t = -prevPos.z / dz;
                    const yAtNet = prevPos.y + t * (this.shuttlePhys.pos.y - prevPos.y);

                    if (yAtNet < this.netHeight) {
                        this.shuttlePhys.pos.z = prevPos.z > 0 ? 0.08 : -0.08;
                        this.shuttlePhys.pos.y = yAtNet;
                        this.shuttlePhys.vel.set(0, -3.0, prevPos.z > 0 ? 0.6 : -0.6);
                        this.trailIsSmash = false;
                        this.spawnRing(new THREE.Vector3(this.shuttlePhys.pos.x, yAtNet, 0), 0xff453a, 0.4, 2.0, 0.25, false, 0.8);
                    }
                }
            }

            if (this.shuttlePhys.pos.y <= 0.12) {
                this.shuttlePhys.pos.y = 0.12; this.shuttlePhys.vel.set(0, 0, 0);
                const inCourt = Math.abs(this.shuttlePhys.pos.x) <= this.courtWidth / 2 && Math.abs(this.shuttlePhys.pos.z) <= this.courtLength / 2;
                const landPos = new THREE.Vector3(this.shuttlePhys.pos.x, 0.04, this.shuttlePhys.pos.z);
                const landColor = inCourt ? 0x34c759 : 0xff3b30;
                this.spawnRing(landPos, landColor, 0.4, 3.6, 0.45, true, 0.95);
                this.spawnRing(landPos, 0xffffff, 0.2, 2.2, 0.32, true, 0.8);
                this.spawnSparks(landPos, landColor, 10, 4.2, -8.0, 0.35, 0.9, 0.5);
                if (this.trailIsSmash) {
                    this.triggerCameraShake(0.12, 0.15);
                }
                this.scorePoint(inCourt ? (this.shuttlePhys.pos.z > 0 ? 'npc' : 'player') : (this.shuttlePhys.pos.z > 0 ? 'player' : 'npc'));
            }
        }

        // トレイル・VFX更新
        this.updateShuttleTrail(gameState === 'rally');
        this.updateVFX(dt);

        // キャラクター・ラケットアニメーション更新
        this.playerSwingTime = this.updateCharacterAnimation(
            this.playerGroup,
            this.prevPlayerPos,
            'playerStepPhase',
            PlayerManager.isJumping,
            isCharging,
            this.playerSwingTime,
            dt
        );
        this.npcSwingTime = this.updateCharacterAnimation(
            this.npcGroup,
            this.prevNpcPos,
            'npcStepPhase',
            PlayerManager.npcIsJumping,
            false,
            this.npcSwingTime,
            dt
        );

        // カメラ追従＆シェイク
        this.cameraBasePos.x += (this.playerGroup.position.x * 0.42 - this.cameraBasePos.x) * 3.8 * dt;
        this.cameraBasePos.z += (16.5 + (this.playerGroup.position.z - 6.5) * 0.32 - this.cameraBasePos.z) * 3.8 * dt;

        this.camera.position.copy(this.cameraBasePos);
        if (this.cameraShakeDuration > 0) {
            this.cameraShakeTime += dt;
            if (this.cameraShakeTime < this.cameraShakeDuration) {
                const decay = 1 - (this.cameraShakeTime / this.cameraShakeDuration);
                const mag = this.cameraShakeIntensity * decay;
                this.camera.position.x += (Math.random() - 0.5) * 2 * mag;
                this.camera.position.y += (Math.random() - 0.5) * 2 * mag;
            } else {
                this.cameraShakeDuration = 0;
                this.cameraShakeIntensity = 0;
            }
        }

        this.camera.lookAt(this.playerGroup.position.x * 0.18, 1.0, 0);
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update(this.clock.getDelta());
        this.renderer.render(this.scene, this.camera);
    }
};

window.addEventListener('DOMContentLoaded', () => GameCore.init());