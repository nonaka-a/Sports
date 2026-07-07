const PlayerManager = {
    BASE_PLAYER_SPEED: 6.5,
    npcSpeed: 5.3,
    COURT_LIMIT_X: 12 / 2 - 0.3,
    COURT_LIMIT_Z_MIN: 0.5,
    COURT_LIMIT_Z_MAX: 20 / 2 - 0.5,
    playerHasHitRight: true,
    npcHasHitRight: true,
    
    // ジャンプ関連ステータス
    isJumping: false,
    jumpY: 0,
    jumpVel: 0,
    isAirborneWaiting: false,

    // 3D空間での射程判定
    checkShuttleInRange(playerPos, playerJumpY, shuttlePos, radius) {
        const flatPlayer = new THREE.Vector2(playerPos.x, playerPos.z);
        const flatShuttle = new THREE.Vector2(shuttlePos.x, shuttlePos.z);
        const dist2D = flatPlayer.distanceTo(flatShuttle);
        
        if (dist2D > radius) return false;
        
        const playerReachMin = 0.2 + playerJumpY;
        const playerReachMax = 3.6 + playerJumpY;
        
        return (shuttlePos.y >= playerReachMin && shuttlePos.y <= playerReachMax);
    },

    movePlayer(playerGroup, keys, joystickDir, joystickActive, isCharging, dt) {
        let speed = this.BASE_PLAYER_SPEED;
        
        if (isCharging || this.isJumping) {
            speed *= 0.5; 
        }

        let mx = 0, mz = 0;
        if (keys.w || keys.ArrowUp) mz -= 1;
        if (keys.s || keys.ArrowDown) mz += 1;
        if (keys.a || keys.ArrowLeft) mx -= 1;
        if (keys.d || keys.ArrowRight) mx += 1;
        
        if (joystickActive) {
            mx = joystickDir.x;
            mz = joystickDir.y;
        }

        if (mx !== 0 || mz !== 0) {
            const len = Math.hypot(mx, mz);
            playerGroup.position.x += (mx / len) * speed * dt;
            playerGroup.position.z += (mz / len) * speed * dt;
            
            playerGroup.position.x = Math.max(-this.COURT_LIMIT_X, Math.min(this.COURT_LIMIT_X, playerGroup.position.x));
            playerGroup.position.z = Math.max(this.COURT_LIMIT_Z_MIN, Math.min(this.COURT_LIMIT_Z_MAX, playerGroup.position.z));
        }
    },

    updateJump(bodyMesh, dt) {
        if (this.isJumping) {
            this.jumpVel += -28.0 * dt; 
            this.jumpY += this.jumpVel * dt;
            
            if (this.jumpY <= 0) {
                this.jumpY = 0;
                this.jumpVel = 0;
                this.isJumping = false;
                this.isAirborneWaiting = false;
            }
            bodyMesh.position.y = 0.5 + this.jumpY;
        } else {
            bodyMesh.position.y = 0.5;
        }
    },

    updateNPC(npcGroup, shuttlePhys, state, dt, npcLevel) {
        if (state !== 'rally') return;
        
        // レベル2は移動速度を30%アップ
        const currentNpcSpeed = npcLevel === 2 ? this.npcSpeed * 1.3 : this.npcSpeed;
        
        let targetX = shuttlePhys.pos.x;
        let targetZ = shuttlePhys.pos.z;
        
        if (shuttlePhys.vel.z < 0) {
            targetX = shuttlePhys.pos.x;
            targetZ = Math.max(-this.COURT_LIMIT_Z_MAX, Math.min(-this.COURT_LIMIT_Z_MIN, shuttlePhys.pos.z - 0.2));
        } else {
            targetX = 0;
            targetZ = -6.5;
        }
        
        const dx = targetX - npcGroup.position.x;
        const dz = targetZ - npcGroup.position.z;
        const dist = Math.hypot(dx, dz);
        
        if (dist > 0.1) {
            npcGroup.position.x += (dx / dist) * currentNpcSpeed * dt;
            npcGroup.position.z += (dz / dist) * currentNpcSpeed * dt;
            npcGroup.position.x = Math.max(-this.COURT_LIMIT_X, Math.min(this.COURT_LIMIT_X, npcGroup.position.x));
            npcGroup.position.z = Math.max(-this.COURT_LIMIT_Z_MAX, Math.min(-this.COURT_LIMIT_Z_MIN, npcGroup.position.z));
        }
    }
};