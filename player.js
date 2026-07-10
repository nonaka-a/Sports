const PlayerManager = {
    BASE_PLAYER_SPEED: 6.5,
    npcSpeed: 5.3,
    COURT_LIMIT_X: 12 / 2 - 0.3,
    COURT_LIMIT_Z_MIN: 0.5,
    COURT_LIMIT_Z_MAX: 20 / 2 - 0.5,
    playerHasHitRight: true,
    npcHasHitRight: true,
    
    // ジャンプ関連ステータス (PLAYER)
    isJumping: false,
    jumpY: 0,
    jumpVel: 0,
    isAirborneWaiting: false,

    // ジャンプ関連ステータス (NPC)
    npcIsJumping: false,
    npcJumpY: 0,
    npcJumpVel: 0,

    // 反応遅延（リアクション）用タイマー (NPC)
    npcReactionTimer: 0,

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
        if (isCharging || this.isJumping) speed *= 0.5; 

        let mx = 0, mz = 0;
        if (keys.w) mz -= 1;
        if (keys.s) mz += 1;
        if (keys.a) mx -= 1;
        if (keys.d) mx += 1;
        
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
            if (bodyMesh) bodyMesh.position.y = 0.5 + this.jumpY;
        } else {
            if (bodyMesh) bodyMesh.position.y = 0.5;
        }
    },

    updateNPC(npcGroup, shuttlePhys, state, dt, npcLevel) {
        if (state !== 'rally') {
            // ラリー以外の場合はNPCのジャンプ・リアクションタイマーをリセット
            this.npcIsJumping = false;
            this.npcJumpY = 0;
            this.npcJumpVel = 0;
            this.npcReactionTimer = 0;
            const bodyMesh = npcGroup.getObjectByName("bodyMesh");
            if (bodyMesh) bodyMesh.position.y = 0.5;
            return;
        }

        let currentNpcSpeed = this.npcSpeed;
        if (npcLevel === 2) currentNpcSpeed = this.npcSpeed * 1.3;
        if (npcLevel === 3) currentNpcSpeed = this.npcSpeed * 1.45; // 新レベル3: やや速いクリア予測ダッシュ速度
        if (npcLevel === 4) currentNpcSpeed = this.npcSpeed * 1.72; // レベルMAX: 高速予測移動速度

        let targetX = shuttlePhys.pos.x;
        let targetZ = shuttlePhys.pos.z;
        
        if (shuttlePhys.vel.z < 0) {
            if (npcLevel === 3 || npcLevel === 4) {
                // リアクション遅延時間を累積計算
                this.npcReactionTimer += dt;
                
                // 新レベル3は 0.38秒（動き出しをかなり遅らせる）、レベルMAXは 0.22秒 の反応遅延を設ける
                const reactionDelay = (npcLevel === 3) ? 0.38 : 0.22;

                if (this.npcReactionTimer < reactionDelay) {
                    // 反応が遅れている間は未来の予測地点ではなく「現在のシャトルの位置」を目標とし、
                    // 移動速度も少し制限して、ぼんやりと追うに留める
                    targetX = shuttlePhys.pos.x;
                    targetZ = shuttlePhys.pos.z;
                    currentNpcSpeed = this.npcSpeed * 0.8;
                } else {
                    // 遅延時間を経過したら、物理予測（落下地点）へ移動開始
                    const predictedPos = this.predictLandingPoint(
                        shuttlePhys.pos,
                        shuttlePhys.vel,
                        -12.0, // BadmintonPhysics.gravity
                        0.28,  // BadmintonPhysics.airDrag
                        1.65   // 予測打点高さ
                    );
                    if (predictedPos) {
                        targetX = predictedPos.x;
                        targetZ = predictedPos.z;
                    } else {
                        targetX = shuttlePhys.pos.x;
                        targetZ = shuttlePhys.pos.z;
                    }
                }
            } else {
                targetX = shuttlePhys.pos.x;
                targetZ = shuttlePhys.pos.z - 0.2;
            }
            targetZ = Math.max(-this.COURT_LIMIT_Z_MAX, Math.min(-this.COURT_LIMIT_Z_MIN, targetZ));
        } else {
            // シャトルが自分のコートに飛んできていない時は、遅延タイマーをリセット
            this.npcReactionTimer = 0;
            if (npcLevel === 1) {
                // レベル1は中央に戻らずその場に完全に立ち止まる
                targetX = npcGroup.position.x;
                targetZ = npcGroup.position.z;
            } else if (npcLevel === 2) {
                // レベル2は中央を目標にしつつ、戻る速度を大幅に下げることで「ちょっとだけ中央に戻る」挙動にする
                targetX = 0;
                targetZ = -6.5;
                currentNpcSpeed = this.npcSpeed * 0.35; // 戻り速度を通常の35%に制限
            } else {
                // レベル3以上は速やかに中央ポジション付近に戻る
                targetX = 0;
                targetZ = -6.5;
            }
        }
        
        const dx = targetX - npcGroup.position.x;
        const dz = targetZ - npcGroup.position.z;
        const dist = Math.hypot(dx, dz);
        
        // 距離が0.22以内の場合は移動目標を達成したとみなし、静止させてプルプル震える現象を防止
        if (dist > 0.22) {
            npcGroup.position.x += (dx / dist) * currentNpcSpeed * dt;
            npcGroup.position.z += (dz / dist) * currentNpcSpeed * dt;
            npcGroup.position.x = Math.max(-this.COURT_LIMIT_X, Math.min(this.COURT_LIMIT_X, npcGroup.position.x));
            npcGroup.position.z = Math.max(-this.COURT_LIMIT_Z_MAX, Math.min(-this.COURT_LIMIT_Z_MIN, npcGroup.position.z));
        }

        // レベル3およびレベルMAX：チャージ・ジャンプスマッシュ用事前トリガー
        if ((npcLevel === 3 || npcLevel === 4) && shuttlePhys.vel.z < 0 && !this.npcIsJumping) {
            const flatNpc = new THREE.Vector2(npcGroup.position.x, npcGroup.position.z);
            const flatShuttle = new THREE.Vector2(shuttlePhys.pos.x, shuttlePhys.pos.z);
            const dist2D = flatNpc.distanceTo(flatShuttle);

            // 各レベル固有の反応遅延時間を超過しているか確認
            const requiredDelay = (npcLevel === 3) ? 0.38 : 0.22;

            // ネットから離れた位置（Z < -3.0）で、高く打ち上げられた球（Y >= 3.0）のみジャンプを開始
            if (this.npcReactionTimer >= requiredDelay && dist2D < 2.0 && shuttlePhys.pos.y >= 3.0 && shuttlePhys.pos.z < -3.0) {
                this.npcIsJumping = true;
                this.npcJumpVel = 15.5; // ジャンプ上昇力
            }
        }

        // NPCジャンプ物理更新
        const bodyMesh = npcGroup.getObjectByName("bodyMesh");
        if (this.npcIsJumping) {
            this.npcJumpVel += -28.0 * dt;
            this.npcJumpY += this.npcJumpVel * dt;
            if (this.npcJumpY <= 0) {
                this.npcJumpY = 0;
                this.npcJumpVel = 0;
                this.npcIsJumping = false;
            }
            if (bodyMesh) bodyMesh.position.y = 0.5 + this.npcJumpY;
        } else {
            if (bodyMesh) bodyMesh.position.y = 0.5;
        }
    },

    predictLandingPoint(pos, vel, gravity, airDrag, targetY) {
        const p = pos.clone();
        const v = vel.clone();
        const simStep = 0.05;
        for (let i = 0; i < 80; i++) {
            v.y += gravity * simStep;
            const sp = v.length();
            if (sp > 0.01) {
                v.sub(v.clone().normalize().multiplyScalar(Math.min(airDrag * sp * simStep, sp)));
            }
            p.addScaledVector(v, simStep);
            if (p.y <= targetY) {
                return p;
            }
        }
        return null;
    }
};