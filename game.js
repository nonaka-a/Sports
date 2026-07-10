// Global State Variables
const keys = { w: false, a: false, s: false, d: false, Space: false };
let isCharging = false;
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
        
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 8, 16);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = false;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // 背景色は EnvironmentManager に一任するため削除し、初期コート構築を呼び出す
        if (typeof EnvironmentManager !== 'undefined') {
            EnvironmentManager.buildCourt(this.scene, courtType, {
                courtWidth: this.courtWidth,
                courtLength: this.courtLength,
                netHeight: this.netHeight
            });
        }

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

        // 最終的なスタートボタン押下時のフロー構築
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

                // 選択されたコート環境を再構築
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

    buildCharacters() {
        this.playerGroup = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.name = "bodyMesh"; 
        body.position.y = 0.5;
        this.playerGroup.add(body);

        const shadowGeo = new THREE.RingGeometry(0, 0.45, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.4, 
            side: THREE.DoubleSide 
        });
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
        rangeMesh.rotation.x = -Math.PI / 2; 
        rangeMesh.position.y = 0.028;
        this.playerGroup.add(rangeMesh);
        
        this.playerGroup.position.set(0, 0, 6);
        this.scene.add(this.playerGroup);

        const createRealisticRacket = (frameColor) => {
            const racket = new THREE.Group();

            const gripGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.28, 8);
            const gripMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.95 });
            const grip = new THREE.Mesh(gripGeo, gripMat);
            grip.position.y = 0.14;
            racket.add(grip);

            const capGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.04, 8);
            const capMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.y = 0.02;
            racket.add(cap);

            const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.65, 8);
            const shaftMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.85, roughness: 0.15 });
            const shaft = new THREE.Mesh(shaftGeo, shaftMat);
            shaft.position.y = 0.28 + 0.325;
            racket.add(shaft);

            const jointGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.06, 8);
            const jointMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.9, roughness: 0.2 });
            const joint = new THREE.Mesh(jointGeo, jointMat);
            joint.position.y = 0.91;
            racket.add(joint);

            const frameGeo = new THREE.TorusGeometry(0.18, 0.014, 8, 32);
            const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.8, roughness: 0.3 });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.y = 1.09;
            frame.scale.set(0.72, 1.0, 1.0);
            racket.add(frame);

            const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
            const stringThickness = 0.003;

            const vertPositions = [-0.07, 0, 0.07];
            vertPositions.forEach(xPos => {
                const stringH = Math.sqrt(1 - Math.pow(xPos / (0.18 * 0.72), 2)) * 0.34;
                if (stringH > 0) {
                    const strGeo = new THREE.CylinderGeometry(stringThickness, stringThickness, stringH, 4);
                    const str = new THREE.Mesh(strGeo, stringMat);
                    str.position.set(xPos, 1.09, 0);
                    racket.add(str);
                }
            });

            const horizPositions = [-0.12, -0.06, 0, 0.06, 0.12];
            horizPositions.forEach(yOffset => {
                const stringW = Math.sqrt(1 - Math.pow(yOffset / 0.18, 2)) * 0.18 * 2 * 0.72;
                if (stringW > 0) {
                    const strGeo = new THREE.CylinderGeometry(stringThickness, stringThickness, stringW, 4);
                    const str = new THREE.Mesh(strGeo, stringMat);
                    str.rotation.z = Math.PI / 2;
                    str.position.set(0, 1.09 + yOffset, 0);
                    racket.add(str);
                }
            });

            return racket;
        };

        const pRacket = createRealisticRacket(0xff3b30);
        pRacket.position.set(0.6, 0.4, 0.2); 
        pRacket.rotation.set(0.2, 0, -0.3); 
        pRacket.name = "racket";
        body.add(pRacket);

        this.npcGroup = new THREE.Group();
        const npcBody = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x007aff }));
        npcBody.name = "bodyMesh"; 
        npcBody.position.y = 0.5; 
        this.npcGroup.add(npcBody);
        
        const npcShadow = playerShadow.clone();
        this.npcGroup.add(npcShadow);

        this.npcGroup.position.set(0, 0, -6);
        this.scene.add(this.npcGroup);

        const nRacket = createRealisticRacket(0x007aff);
        nRacket.position.set(-0.6, 0.4, 0.2); 
        nRacket.rotation.set(0.2, 0, 0.3);
        nRacket.name = "racket";
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
        this.shuttleShadow.position.y = 0.025; 
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
                btn.addEventListener('touchstart', (e) => { 
                    e.preventDefault(); 
                    keys[dpadMapping[id]] = true; 
                }, { passive: false });
                
                const stopKey = (e) => {
                    e.preventDefault();
                    keys[dpadMapping[id]] = false;
                };
                btn.addEventListener('touchend', stopKey, { passive: false });
                btn.addEventListener('touchcancel', stopKey, { passive: false });
            }
        });
        
        const hBtn = document.getElementById('hit-button');
        if (hBtn) {
            let activeHitTouchId = null; 
            
            hBtn.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                if (activeHitTouchId !== null) return; 
                
                const touch = e.changedTouches[0];
                activeHitTouchId = touch.identifier; 
                this.startCharging(); 
            }, { passive: false });
            
            const endHitCharge = (e) => {
                if (activeHitTouchId === null) return;
                
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeHitTouchId) {
                        e.preventDefault();
                        activeHitTouchId = null; 
                        this.stopCharging();
                        break;
                    }
                }
            };
            
            hBtn.addEventListener('touchend', endHitCharge, { passive: false });
            hBtn.addEventListener('touchcancel', endHitCharge, { passive: false });
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
        const isDrop = (hitter === 'player' && keys.s);
        const isSmash = (!isDrop && hitPower >= 50);
        
        BadmintonAudio.playHit(isSmash);
        
        if (hitter === 'player') {
            this.playerSwingTime = 0;
            let tx = (keys.a) ? -4.2 : (keys.d) ? 4.2 : (Math.random() - 0.5) * 1.5;

            if (isDrop) {
                let tz = -2.0 - Math.random() * 1.2;
                BadmintonPhysics.calculateDrop(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 2.4, this.shuttlePhys);
            } else if (isSmash) {
                let tz = -this.courtLength / 2 + 1.2 + Math.random() * 2.0;
                const jumpHitPoint = new THREE.Vector3(this.playerGroup.position.x, 2.3 + (PlayerManager.jumpY * 0.5), this.playerGroup.position.z);
                BadmintonPhysics.calculateSmash(jumpHitPoint, new THREE.Vector3(tx, 0.1, tz), hitPower, this.shuttlePhys);
            } else {
                let tz = -this.courtLength / 2 + 1.2 + Math.random() * 2.0;
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.5, this.shuttlePhys);
            }
            PlayerManager.npcHasHitRight = true; PlayerManager.isAirborneWaiting = false;
        } else {
            this.npcSwingTime = 0;
            let tx = this.playerGroup.position.x > 0 ? -3.4 : 3.4;
            if (npcLevel === 3 || npcLevel === 4) {
                tx = this.playerGroup.position.x > 1.2 ? -4.0 : (this.playerGroup.position.x < -1.2 ? 4.0 : (Math.random() > 0.5 ? 4.0 : -4.0));
            }

            let tz = this.courtLength / 2 - 1.5 - Math.random() * 2.0;
            
            if (npcLevel === 4) {
                const isChanceBall = this.shuttlePhys.pos.y >= 3.0 && this.shuttlePhys.pos.z < -3.0;

                if (PlayerManager.npcIsJumping && isChanceBall) {
                    const jumpHitPointNPC = new THREE.Vector3(this.npcGroup.position.x, 2.3 + (PlayerManager.npcJumpY * 0.5), this.npcGroup.position.z);
                    BadmintonPhysics.calculateSmash(jumpHitPointNPC, new THREE.Vector3(tx, 0.1, tz), 100, this.shuttlePhys);
                } else if (isChanceBall) {
                    BadmintonPhysics.calculateSmash(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 85, this.shuttlePhys);
                } else {
                    if (Math.random() < 0.30) {
                        const dropTx = this.playerGroup.position.x > 0 ? -3.8 : 3.8;
                        const dropTz = 2.0 + Math.random() * 1.0;
                        BadmintonPhysics.calculateDrop(this.shuttlePhys.pos, new THREE.Vector3(dropTx, 0.1, dropTz), 2.4, this.shuttlePhys);
                    } else {
                        BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.4 + Math.random() * 1.5, this.shuttlePhys);
                    }
                }
            } else if (npcLevel === 3) {
                // 新レベル3：チャンスボールであっても50%の確率でのみスマッシュを打つ（レベル3は球速を落として調整）
                const isChanceBall = this.shuttlePhys.pos.y >= 3.0 && this.shuttlePhys.pos.z < -3.0;

                if (isChanceBall && Math.random() < 0.50) {
                    if (PlayerManager.npcIsJumping) {
                        const jumpHitPointNPC = new THREE.Vector3(this.npcGroup.position.x, 2.3 + (PlayerManager.npcJumpY * 0.5), this.npcGroup.position.z);
                        BadmintonPhysics.calculateSmash(jumpHitPointNPC, new THREE.Vector3(tx, 0.1, tz), 70, this.shuttlePhys); // 100 -> 76に落として調整
                    } else {
                        BadmintonPhysics.calculateSmash(this.shuttlePhys.pos, new THREE.Vector3(tx, 0.1, tz), 68, this.shuttlePhys); // 85 -> 68に落として調整
                    }
                } else {
                    // 通常打ち：ドロップショットは確率を下げて12%のみ、残りは安定したクリア（ロブ）
                    if (Math.random() < 0.12) {
                        const dropTx = this.playerGroup.position.x > 0 ? -3.8 : 3.8;
                        const dropTz = 2.0 + Math.random() * 1.0;
                        BadmintonPhysics.calculateDrop(this.shuttlePhys.pos, new THREE.Vector3(dropTx, 0.1, dropTz), 2.4, this.shuttlePhys);
                    } else {
                        BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 5.2 + Math.random() * 1.5, this.shuttlePhys);
                    }
                }
            } else if (npcLevel === 2) {
                // レベル2：スマッシュを打たず、クリア（ロブ）のみで安定して返す
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(tx, 0, tz), 4.8 + Math.random() * 2.0, this.shuttlePhys);
            } else {
                // レベル1など
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
        power = 0; if (typeof UIManager !== 'undefined') UIManager.updatePowerBar(0); 
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
    },

    update(dt) {
        if (dt > 0.1) dt = 0.1;
        if (gameState === 'waiting' || (typeof UIManager !== 'undefined' && UIManager.isPaused)) return;

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
                const flatPlayer = new THREE.Vector2(this.playerGroup.position.x, this.playerGroup.position.z);
                const flatShuttle = new THREE.Vector2(this.shuttlePhys.pos.x, this.shuttlePhys.pos.z);
                const dist2D = flatPlayer.distanceTo(flatShuttle);
                
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

        if (gameState === 'rally') {
            const isNpcInRange = PlayerManager.checkShuttleInRange(
                this.npcGroup.position, 
                PlayerManager.npcJumpY, 
                this.shuttlePhys.pos, 
                this.hitRadius * 0.85 // NPCのみ射程を15%縮小（2.0 -> 1.7）
            );

            if (PlayerManager.npcHasHitRight && isNpcInRange && this.shuttlePhys.vel.z < 0 && this.shuttlePhys.pos.z < 1.5) {
                let power = 70;
                if (npcLevel === 3 || npcLevel === 4) {
                    power = PlayerManager.npcIsJumping ? 100 : 80;
                }
                this.hitShuttle('npc', power);
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