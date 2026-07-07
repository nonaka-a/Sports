// Global State Variables
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, Space: false };
let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickDir = { x: 0, y: 0 };

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
        this.initInputs();

        window.addEventListener('resize', () => this.onResize());
        
        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                npcLevel = parseInt(e.target.dataset.level);
                document.getElementById('start-screen').style.display = 'none';
                document.getElementById('ui-layer').style.display = 'flex';
                document.getElementById('back-to-title').style.display = 'block';
                this.resetGame();
                this.resetToServe('player');
            });
        });

        document.getElementById('back-to-title').addEventListener('click', () => {
            document.getElementById('result-screen').style.display = 'none';
            document.getElementById('ui-layer').style.display = 'none';
            document.getElementById('start-screen').style.display = 'flex';
            document.getElementById('back-to-title').style.display = 'none';
            gameState = 'waiting';
        });
        
        this.animate();
    },

    buildField() {
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2e6135, roughness: 0.95 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        const courtGeo = new THREE.PlaneGeometry(this.courtWidth, this.courtLength);
        const courtMat = new THREE.MeshStandardMaterial({ color: 0x2c75b0, roughness: 0.5 });
        const court = new THREE.Mesh(courtGeo, courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.01;
        this.scene.add(court);

        const createL = (w, h, x, z) => {
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = -Math.PI / 2; 
            m.position.set(x, 0.015, z);
            this.scene.add(m);
        };
        const lw = 0.12;
        createL(this.courtWidth, lw, 0, -this.courtLength/2);
        createL(this.courtWidth, lw, 0, this.courtLength/2);
        createL(lw, this.courtLength, -this.courtWidth/2, 0);
        createL(lw, this.courtLength, this.courtWidth/2, 0);
        createL(lw, this.courtLength, 0, 0);
        createL(this.courtWidth, lw, 0, -3);
        createL(this.courtWidth, lw, 0, 3);
        createL(this.courtWidth, lw, 0, 0);

        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, this.netHeight);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(-this.courtWidth/2 - 0.1, this.netHeight/2, 0);
        const postR = postL.clone(); 
        postR.position.x = this.courtWidth/2 + 0.1;
        this.scene.add(postL); 
        this.scene.add(postR);

        const netHeight = 0.75;
        const netGeo = new THREE.PlaneGeometry(this.courtWidth, netHeight, 40, 5);
        const netMat = new THREE.MeshPhongMaterial({ color: 0x331100, wireframe: true, transparent: true, opacity: 0.7 });
        const net = new THREE.Mesh(netGeo, netMat);
        net.position.set(0, this.netHeight - netHeight / 2, 0);
        this.scene.add(net);

        const tapeGeo = new THREE.PlaneGeometry(this.courtWidth, 0.08);
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.set(0, this.netHeight - 0.04, 0.005);
        this.scene.add(tape);
        const tapeBack = tape.clone();
        tapeBack.position.z = -0.005;
        this.scene.add(tapeBack);
    },

    buildCharacters() {
        this.playerGroup = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.name = "bodyMesh"; 
        body.position.y = 0.5;
        this.playerGroup.add(body);

        const shadowGeo = new THREE.RingGeometry(0, 0.48, 32);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2; 
        shadowMesh.position.y = 0.005;
        this.playerGroup.add(shadowMesh);

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
        rangeMesh.position.y = 0.008;
        this.playerGroup.add(rangeMesh);
        
        this.playerGroup.position.set(0, 0, 6);
        this.scene.add(this.playerGroup);

        const pRacket = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        shaft.position.y = 0.45; 
        pRacket.add(shaft);
        
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25), new THREE.MeshStandardMaterial({ color: 0xff3b30 }));
        grip.position.y = 0.125; 
        pRacket.add(grip);
        
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffdd00 }));
        frame.position.y = 1.08; 
        frame.scale.set(0.7, 1.0, 1.0); 
        pRacket.add(frame);
        
        pRacket.position.set(0.6, 0.4, 0.2); 
        pRacket.rotation.set(0.2, 0, -0.3); 
        pRacket.name = "racket";
        this.playerGroup.getObjectByName("bodyMesh").add(pRacket);

        this.npcGroup = new THREE.Group();
        const npcBody = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x007aff }));
        npcBody.name = "bodyMesh"; 
        npcBody.position.y = 0.5; 
        this.npcGroup.add(npcBody);
        
        const npcShadow = new THREE.Mesh(shadowGeo, shadowMat);
        npcShadow.rotation.x = -Math.PI / 2; 
        npcShadow.position.y = 0.005; 
        this.npcGroup.add(npcShadow);
        
        this.npcGroup.position.set(0, 0, -6);
        this.scene.add(this.npcGroup);

        const nRacket = pRacket.clone();
        nRacket.position.set(-0.6, 0.4, 0.2); 
        nRacket.rotation.set(0.2, 0, 0.3);
        nRacket.children[1].material = new THREE.MeshStandardMaterial({ color: 0x007aff });
        this.npcGroup.getObjectByName("bodyMesh").add(nRacket);
    },

    buildShuttle() {
        this.shuttleGroup = new THREE.Group();
        const cork = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        cork.rotation.x = Math.PI; 
        this.shuttleGroup.add(cork);
        
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.16, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
        skirt.position.y = 0.08; 
        this.shuttleGroup.add(skirt);
        
        this.shuttleGroup.position.set(0, 1.5, 0);
        this.scene.add(this.shuttleGroup);

        this.shuttleShadow = new THREE.Mesh(new THREE.RingGeometry(0, 0.18, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
        this.shuttleShadow.rotation.x = -Math.PI / 2; 
        this.shuttleShadow.position.y = 0.02;
        this.scene.add(this.shuttleShadow);
    },

    initInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.code === 'Space') { keys.Space = true; this.startCharging(); }
            if (e.key in keys) keys[e.key] = true;
            if (e.code === 'KeyW') keys.w = true; 
            if (e.code === 'KeyA') keys.a = true;
            if (e.code === 'KeyS') keys.s = true; 
            if (e.code === 'KeyD') keys.d = true;
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.code === 'Space') { keys.Space = false; this.stopCharging(); }
            if (e.key in keys) keys[e.key] = false;
            if (e.code === 'KeyW') keys.w = false; 
            if (e.code === 'KeyA') keys.a = false;
            if (e.code === 'KeyS') keys.s = false; 
            if (e.code === 'KeyD') keys.d = false;
        });
        
        const jZone = document.getElementById('joystick-zone');
        const jHandle = document.getElementById('joystick-handle');
        
        jZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            joystickActive = true;
            const r = jZone.getBoundingClientRect();
            joystickStart = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            this.handleJoystick(e.touches[0].clientX, e.touches[0].clientY, jHandle);
        }, { passive: false });
        
        window.addEventListener('touchmove', (e) => {
            if (joystickActive) {
                e.preventDefault();
                this.handleJoystick(e.touches[0].clientX, e.touches[0].clientY, jHandle);
            }
        }, { passive: false });
        
        window.addEventListener('touchend', (e) => {
            joystickActive = false; 
            joystickDir = { x: 0, y: 0 }; 
            jHandle.style.transform = `translate(0px, 0px)`;
        }, { passive: false });
        
        const hBtn = document.getElementById('hit-button');
        hBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startCharging(); }, { passive: false });
        window.addEventListener('touchend', (e) => { if (isCharging) this.stopCharging(); });
    },

    handleJoystick(cx, cy, handle) {
        const dx = cx - joystickStart.x; 
        const dy = cy - joystickStart.y;
        const dist = Math.hypot(dx, dy); 
        const maxDist = 45;
        
        let angle = Math.atan2(dy, dx);
        let tx = dx, ty = dy;
        
        if (dist > maxDist) { 
            tx = Math.cos(angle) * maxDist; 
            ty = Math.sin(angle) * maxDist; 
        }
        
        handle.style.transform = `translate(${tx}px, ${ty}px)`;
        joystickDir.x = tx / maxDist; 
        joystickDir.y = ty / maxDist;
    },

    startCharging() { 
        if (gameState !== 'ended' && gameState !== 'waiting') isCharging = true; 
    },

    stopCharging() {
        isCharging = false;
        
        if (gameState === 'serve-player') {
            this.serveShuttle('player');
            power = 0; 
            document.getElementById('power-fill').style.width = '0%';
            return;
        }
        
        if (gameState === 'rally' && PlayerManager.playerHasHitRight && !PlayerManager.isAirborneWaiting) {
            const inRange = PlayerManager.checkShuttleInRange(this.playerGroup.position, PlayerManager.jumpY, this.shuttlePhys.pos, this.hitRadius);
            
            if (inRange && this.shuttlePhys.pos.z > -1.5) {
                this.hitShuttle('player', power);
                PlayerManager.playerHasHitRight = false;
            } else {
                this.playerSwingTime = 0;
            }
        }
        
        power = 0; 
        document.getElementById('power-fill').style.width = '0%';
    },

    triggerAutoJump() {
        PlayerManager.isJumping = true;
        PlayerManager.isAirborneWaiting = true;
        
        if (power >= 99) {
            PlayerManager.jumpVel = 17.5;
        } else {
            PlayerManager.jumpVel = 14.5;
        }
    },

    hitShuttle(hitter, hitPower) {
        const isSmash = (hitPower >= 50);
        BadmintonAudio.playHit(isSmash);
        
        if (hitter === 'player') {
            this.playerSwingTime = 0;
            let targetX = 0;
            
            if (keys.a || keys.ArrowLeft || joystickDir.x < -0.2) targetX = -4.2;
            else if (keys.d || keys.ArrowRight || joystickDir.x > 0.2) targetX = 4.2;
            else targetX = (Math.random() - 0.5) * 1.5;
            
            const targetZ = -this.courtLength / 2 + 1.2 + Math.random() * 2.0;

            if (isSmash) {
                const jumpHitPoint = new THREE.Vector3(this.playerGroup.position.x, 2.3 + (PlayerManager.jumpY * 0.5), this.playerGroup.position.z);
                BadmintonPhysics.calculateSmash(jumpHitPoint, new THREE.Vector3(targetX, 0.1, targetZ), hitPower, this.shuttlePhys);
            } else {
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(targetX, 0, targetZ), 5.5, this.shuttlePhys);
            }
            PlayerManager.npcHasHitRight = true;
            PlayerManager.isAirborneWaiting = false;
        } else {
            this.npcSwingTime = 0;
            let targetX = this.playerGroup.position.x > 0 ? -3.4 : 3.4;
            if (Math.random() < 0.2) targetX = 0; 
            targetX += (Math.random() - 0.5) * 1.5;
            
            const targetZ = this.courtLength / 2 - 1.5 - Math.random() * 2.0;
            
            if (npcLevel === 2 && this.shuttlePhys.pos.y > 2.5 && this.shuttlePhys.pos.z < -2.0) {
                BadmintonPhysics.calculateSmash(this.shuttlePhys.pos, new THREE.Vector3(targetX, 0.1, targetZ), 85, this.shuttlePhys);
            } else {
                BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(targetX, 0, targetZ), 4.8 + Math.random() * 2.0, this.shuttlePhys);
            }
            PlayerManager.playerHasHitRight = true;
        }
        gameState = 'rally';
    },

    serveShuttle(server) {
        this.shuttlePhys.pos.copy(server === 'player' ? this.playerGroup.position : this.npcGroup.position);
        this.shuttlePhys.pos.y = 1.2;
        
        if (server === 'player') {
            this.playerSwingTime = 0;
            BadmintonAudio.playHit(false);
            BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(0, 0, -4.5), 4.2, this.shuttlePhys);
            PlayerManager.playerHasHitRight = false; 
            PlayerManager.npcHasHitRight = true;
        } else {
            this.npcSwingTime = 0;
            BadmintonAudio.playHit(false);
            BadmintonPhysics.calculateLob(this.shuttlePhys.pos, new THREE.Vector3(0, 0, 4.5), 4.2, this.shuttlePhys);
            PlayerManager.playerHasHitRight = true; 
            PlayerManager.npcHasHitRight = false;
        }
        gameState = 'rally';
    },

    scorePoint(winner) {
        gameState = 'ended';
        if (winner === 'player') {
            playerScore++; 
            document.getElementById('player-score').innerText = playerScore;
            this.showBanner("POINT FOR YOU!", "#34c759");
        } else {
            npcScore++; 
            document.getElementById('npc-score').innerText = npcScore;
            this.showBanner("POINT FOR NPC!", "#ff3b30");
        }

        if (playerScore >= MATCH_POINT || npcScore >= MATCH_POINT) {
            setTimeout(() => { this.showResult(); }, 1500);
        } else {
            setTimeout(() => { this.resetToServe(winner === 'player' ? 'player' : 'npc'); }, 2200);
        }
    },

    showResult() {
        gameState = 'ended';
        const resultScreen = document.getElementById('result-screen');
        const resultTitle = document.getElementById('result-title');
        const resultScore = document.getElementById('result-score');
        
        if (playerScore > npcScore) {
            resultTitle.innerText = "YOU WIN!";
            resultTitle.style.color = "#34c759";
        } else {
            resultTitle.innerText = "YOU LOSE...";
            resultTitle.style.color = "#ff3b30";
        }
        
        resultScore.innerText = `${playerScore} - ${npcScore}`;
        resultScreen.style.display = 'flex';
    },

    resetGame() {
        playerScore = 0;
        npcScore = 0;
        document.getElementById('player-score').innerText = "0";
        document.getElementById('npc-score').innerText = "0";
    },

    resetToServe(nextServer) {
        this.playerGroup.position.set(0, 0, 6.5); 
        this.npcGroup.position.set(0, 0, -6.5);
        
        power = 0; 
        document.getElementById('power-fill').style.width = '0%'; 
        isCharging = false;
        
        PlayerManager.playerHasHitRight = true; 
        PlayerManager.npcHasHitRight = true;
        PlayerManager.isJumping = false;
        PlayerManager.isAirborneWaiting = false;
        PlayerManager.jumpY = 0;
        PlayerManager.jumpVel = 0;
        
        if (nextServer === 'player') {
            gameState = 'serve-player'; 
            this.shuttlePhys.pos.set(0.5, 1.2, 5.5); 
            this.shuttlePhys.vel.set(0, 0, 0);
        } else {
            gameState = 'serve-npc'; 
            this.shuttlePhys.pos.set(-0.5, 1.2, -5.5); 
            this.shuttlePhys.vel.set(0, 0, 0);
            setTimeout(() => { if (gameState === 'serve-npc') this.serveShuttle('npc'); }, 1200);
        }
    },

    showBanner(text, color) {
        const banner = document.getElementById('message-banner');
        banner.innerText = text; 
        banner.style.borderBottomColor = color; 
        banner.style.opacity = 1;
        banner.style.transform = "translate(-50%, -50%) scale(1.05)";
        
        setTimeout(() => { 
            if (banner.innerText === text) { 
                banner.style.opacity = 0; 
                banner.style.transform = "translate(-50%, -50%) scale(1)"; 
            } 
        }, 1600);
    },

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    update(dt) {
        if (dt > 0.1) dt = 0.1;
        if (gameState === 'waiting') return;
        
        PlayerManager.movePlayer(this.playerGroup, keys, joystickDir, joystickActive, isCharging, dt);

        if (isCharging && (gameState === 'rally' || gameState === 'serve-player')) {
            power = Math.min(MAX_POWER, power + POWER_CHARGE_SPEED);
            document.getElementById('power-fill').style.width = `${power}%`;
            
            if (gameState === 'rally' && PlayerManager.playerHasHitRight) {
                if (this.shuttlePhys.vel.z > 0 && this.shuttlePhys.pos.z > -1.5) {
                    const flatPlayer = new THREE.Vector2(this.playerGroup.position.x, this.playerGroup.position.z);
                    const flatShuttle = new THREE.Vector2(this.shuttlePhys.pos.x, this.shuttlePhys.pos.z);
                    const dist2D = flatPlayer.distanceTo(flatShuttle);
                    
                    if (power >= 50 && !PlayerManager.isJumping && dist2D < (this.hitRadius + 1.2) && this.shuttlePhys.pos.y > 2.5) {
                        this.triggerAutoJump();
                    }
                    
                    const inRange = PlayerManager.checkShuttleInRange(this.playerGroup.position, PlayerManager.jumpY, this.shuttlePhys.pos, this.hitRadius);
                    if (inRange) {
                        this.hitShuttle('player', power);
                        PlayerManager.playerHasHitRight = false;
                        this.stopCharging();
                    }
                }
            }
        }

        PlayerManager.updateJump(this.playerGroup.getObjectByName("bodyMesh"), dt);
        PlayerManager.updateNPC(this.npcGroup, this.shuttlePhys, gameState, dt, npcLevel);

        if (gameState === 'rally' && PlayerManager.npcHasHitRight) {
            const dist = this.npcGroup.position.distanceTo(this.shuttlePhys.pos);
            if (dist < this.hitRadius && this.shuttlePhys.vel.z < 0 && this.shuttlePhys.pos.z < 1.5) {
                this.hitShuttle('npc', 60 + Math.random() * 30);
                PlayerManager.npcHasHitRight = false;
            }
        }

        if (gameState === 'rally') {
            this.shuttlePhys.vel.y += BadmintonPhysics.gravity * dt;
            const sp = this.shuttlePhys.vel.length();
            if (sp > 0.01) {
                const dForce = BadmintonPhysics.airDrag * sp * dt;
                this.shuttlePhys.vel.sub(this.shuttlePhys.vel.clone().normalize().multiplyScalar(Math.min(dForce, sp)));
            }
            if (this.shuttlePhys.vel.length() > BadmintonPhysics.terminalVelocity) {
                this.shuttlePhys.vel.setLength(BadmintonPhysics.terminalVelocity);
            }
            this.shuttlePhys.pos.addScaledVector(this.shuttlePhys.vel, dt);
            this.shuttleGroup.position.copy(this.shuttlePhys.pos);

            if (this.shuttlePhys.vel.lengthSq() > 0.1) {
                const dir = this.shuttlePhys.vel.clone().normalize();
                const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
                this.shuttleGroup.quaternion.slerp(rot, 12 * dt);
            }

            this.shuttleShadow.position.set(this.shuttlePhys.pos.x, 0.02, this.shuttlePhys.pos.z);
            const scale = Math.max(0.18, 0.9 - (this.shuttlePhys.pos.y * 0.08));
            this.shuttleShadow.scale.set(scale, scale, scale);
            this.shuttleShadow.material.opacity = Math.max(0.1, 0.55 - (this.shuttlePhys.pos.y * 0.035));

            if (Math.abs(this.shuttlePhys.pos.z) < 0.18 && this.shuttlePhys.pos.y < this.netHeight) {
                this.shuttlePhys.vel.set(0, -3.0, this.shuttlePhys.pos.z > 0 ? 0.5 : -0.5);
            }

            if (this.shuttlePhys.pos.y <= 0.12) {
                this.shuttlePhys.pos.y = 0.12; 
                this.shuttlePhys.vel.set(0, 0, 0);
                const inX = Math.abs(this.shuttlePhys.pos.x) <= this.courtWidth / 2;
                const inZ = Math.abs(this.shuttlePhys.pos.z) <= this.courtLength / 2;
                if (inX && inZ) this.scorePoint(this.shuttlePhys.pos.z > 0 ? 'npc' : 'player');
                else this.scorePoint(this.shuttlePhys.pos.z > 0 ? 'player' : 'npc');
            }
        } else {
            this.shuttleGroup.position.copy(this.shuttlePhys.pos);
            this.shuttleShadow.position.set(this.shuttlePhys.pos.x, 0.02, this.shuttlePhys.pos.z);
            this.shuttleShadow.scale.set(1.0, 1.0, 1.0); 
            this.shuttleShadow.material.opacity = 0.5;
        }

        if (this.playerSwingTime >= 0) {
            this.playerSwingTime += dt;
            const rack = this.playerGroup.getObjectByName("racket");
            if (this.playerSwingTime < 0.25) rack.rotation.x = 0.2 - Math.sin((this.playerSwingTime / 0.25) * Math.PI) * 1.6;
            else { rack.rotation.set(0.2, 0, -0.3); this.playerSwingTime = -1; }
        }
        if (this.npcSwingTime >= 0) {
            this.npcSwingTime += dt;
            const rack = this.npcGroup.getObjectByName("racket");
            if (this.npcSwingTime < 0.25) rack.rotation.x = 0.2 - Math.sin((this.npcSwingTime / 0.25) * Math.PI) * 1.6;
            else { rack.rotation.set(0.2, 0, 0.3); this.npcSwingTime = -1; }
        }

        const targetCamX = this.playerGroup.position.x * 0.42;
        const targetCamZ = 16.5 + (this.playerGroup.position.z - 6.5) * 0.32;
        this.camera.position.x += (targetCamX - this.camera.position.x) * 3.8 * dt;
        this.camera.position.z += (targetCamZ - this.camera.position.z) * 3.8 * dt;
        this.camera.lookAt(this.playerGroup.position.x * 0.18, 1.0, 0);
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();
        this.update(dt);
        this.renderer.render(this.scene, this.camera);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    GameCore.init();
});