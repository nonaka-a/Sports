const TTPhysics = {
    // ターゲット地点へ指定時間 T で着弾する初速ベクトルを計算（縦スピン・水平減衰・横回転カーブ対応）
    computeBallVelocity(game, start, target, duration, spinAccel = 0, horizDrag = 0, curveAccelX = 0) {
        const totalGravity = game.gravity + spinAccel;
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
        return game._tmpVelOut.set(vx, vy, vz);
    },

    getReachInfo(game, charPos, ballPos, isPlayer, maxReachXOverride = null) {
        if (ballPos.y < 0.4 || ballPos.y > 2.9) {
            return { inRange: false, isDive: false, dir: 0 };
        }
        const dx = ballPos.x - charPos.x;
        const absX = Math.abs(dx);
        const maxX = maxReachXOverride !== null ? maxReachXOverride : game.maxReachX;

        const forwardDist = isPlayer ? (charPos.z - ballPos.z) : (ballPos.z - charPos.z);
        if (forwardDist < -game.reachBackZ || forwardDist > game.reachFrontZ || absX > maxX) {
            return { inRange: false, isDive: false, dir: 0 };
        }

        const isDive = absX > game.normalReachX;
        return { inRange: true, isDive, dir: dx >= 0 ? 1 : -1 };
    },

    checkInRange(game, charPos, ballPos, isPlayer = true, maxReachXOverride = null) {
        return this.getReachInfo(game, charPos, ballPos, isPlayer, maxReachXOverride).inRange;
    },

    predictBallInfo(game, targetZ) {
        const p = game._predPos.copy(game.ballPos);
        const v = game._predVel.copy(game.ballVel);
        let spin = game.ballSpinAccel;
        let horizDrag = game.ballHorizDrag;
        let curveX = game.ballCurveAccelX;
        const step = 0.03;
        let hasBounce = false;
        let hasHit = false;

        for (let i = 0; i < 80; i++) {
            v.x += curveX * step;
            v.y += (game.gravity + spin) * step;
            if (horizDrag > 0) {
                const hf = Math.exp(-horizDrag * step);
                v.x *= hf;
                v.z *= hf;
            }
            p.addScaledVector(v, step);
            if (p.y <= game.tableHeight + game.ballRadius && v.y < 0 && Math.abs(p.x) <= game.tableWidth / 2 && Math.abs(p.z) <= game.tableLength / 2) {
                p.y = game.tableHeight + game.ballRadius;
                if (!hasBounce && p.z < 0) {
                    game._predBounce.copy(p);
                    hasBounce = true;
                }
                v.y = Math.abs(v.y) * game.ballBounceScaleY;
                v.z *= game.ballBounceScaleZ;
                spin = 0;
                horizDrag = 0;
                curveX *= 0.25;
            }
            if (!hasHit && p.z <= targetZ) {
                game._predHit.copy(p);
                hasHit = true;
            }
            if (hasBounce && hasHit) break;
        }
        game._predResult.bounce = hasBounce ? game._predBounce : null;
        game._predResult.hit = hasHit ? game._predHit : null;
        return game._predResult;
    },

    // 打点の高さに応じたドライブ失敗判定（ネット上端1.30m以上は0%、0.80m以下で上限50%）
    getLowHitDriveMissType(game, hitY) {
        const netTopY = game.tableHeight + game.netHeight;
        if (hitY >= netTopY) return null;
        const minHeight = 0.80;
        const ratio = Math.max(0, Math.min(1, (netTopY - hitY) / (netTopY - minHeight)));
        const missProb = ratio * 0.50;
        if (Math.random() >= missProb) return null;
        return Math.random() < 0.5 ? 'net' : 'over';
    },

    serveBall(game, server, servePower = 30, mode = 'up') {
        const isCutServe = (server === 'player' && mode === 'down');
        const isLongServe = (!isCutServe && servePower >= 50);
        const pRatio = isLongServe ? Math.max(0, Math.min(1, (servePower - 50) / 50)) : 0;

        if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(isLongServe);
        game.trailIsSmash = isLongServe;
        game.trailMode = isCutServe ? 'cut' : (isLongServe ? 'smash' : 'normal');
        game.ballSpinAccel = 0;
        game.ballHorizDrag = 0;
        game.ballCurveAccelX = 0;
        game.serveFlightHorizDrag = 0;
        game.serveFlightCurveX = 0;
        game.ballBounceScaleY = 0.82;
        game.ballBounceScaleZ = 0.97;
        game.netFault = false;
        game.incomingCutMissProb = isCutServe ? (0.15 + Math.max(0, Math.min(1, servePower / 100)) * 0.20) : 0;
        game.receiverBounces = 0;
        game.lastReceiverBounceZ = null;
        game.isServeFirstBounce = true;
        game.isShortServeActive = (server === 'player' && !isLongServe);
        game.servePhase = 'idle';
        game.lastHitter = server;
        game.npcReactionTimer = 0;
        const effectType = isCutServe ? 'cut' : (isLongServe ? 'smash' : 'lob');
        game.core.spawnHitEffect(game.ballPos, effectType);

        const targetY = game.tableHeight + game.ballRadius;

        if (server === 'player') {
            game.playerHitType = isCutServe ? 'cut' : 'fore';
            game.playerSwingTime = 0;

            const aimDir = keys.a ? -1 : (keys.d ? 1 : 0);
            const firstX = aimDir !== 0
                ? aimDir * (0.35 + (isLongServe ? 0.25 : 0.15))
                : game.playerGroup.position.x * 0.35 + (Math.random() - 0.5) * 0.25;

            if (isCutServe) {
                const cutRatio = Math.max(0, Math.min(1, servePower / 100));
                const curveDir = keys.a ? -1 : (keys.d ? 1 : -1);
                const firstZ = 1.18 + cutRatio * 0.28;
                game.serveDestX = (aimDir !== 0 ? aimDir : curveDir) * (0.35 + cutRatio * 0.65);
                game.serveDestZ = -(1.35 + cutRatio * 0.45);
                game.serveFlightDuration = 0.54 + cutRatio * 0.08;
                game.serveFlightSpin = 1.0 + cutRatio * 2.0;
                game.serveFlightHorizDrag = cutRatio * 0.55;
                game.serveFlightCurveX = curveDir * (cutRatio * 3.0);
                game.serveNextBounceY = 0.92 - cutRatio * 0.10;
                game.serveNextBounceZ = 0.90 - cutRatio * 0.16;
                game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.24, 0));
            } else if (isLongServe) {
                const firstZ = 2.10 + pRatio * 0.25;
                game.serveDestX = aimDir !== 0 ? aimDir * (1.15 + pRatio * 0.32) : (Math.random() - 0.5) * 0.45;
                game.serveDestZ = -(2.15 + pRatio * 0.42);
                game.serveFlightDuration = 0.50 - pRatio * 0.05;
                game.serveFlightSpin = -4.5 - pRatio * 3.0;
                game.serveNextBounceY = 0.75;
                game.serveNextBounceZ = 1.06 + pRatio * 0.06;
                game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.26, 0));
            } else {
                const firstZ = 1.15 + Math.random() * 0.15;
                game.serveDestX = aimDir !== 0 ? aimDir * 1.05 : (Math.random() - 0.5) * 0.35;
                game.serveDestZ = -(1.05 + Math.random() * 0.18);
                game.serveFlightDuration = 0.56;
                game.serveFlightSpin = 0;
                game.serveNextBounceY = 0.84;
                game.serveNextBounceZ = 0.88;
                game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.25, 0));
            }

            game.playerCanHit = false;
            game.npcCanHit = false;

            if (game.onlineMode && typeof TTNetwork !== 'undefined') {
                game.onlineSeq++;
                const payload = {
                    seq: game.onlineSeq,
                    isServe: true,
                    pos: { x: game.mirrorX(game.ballPos.x), y: game.ballPos.y, z: game.mirrorZ(game.ballPos.z) },
                    vel: { x: game.mirrorX(game.ballVel.x), y: game.ballVel.y, z: game.mirrorZ(game.ballVel.z) },
                    serveDestX: game.mirrorX(game.serveDestX),
                    serveDestZ: game.mirrorZ(game.serveDestZ),
                    serveFlightDuration: game.serveFlightDuration,
                    serveFlightSpin: game.serveFlightSpin,
                    serveFlightHorizDrag: game.serveFlightHorizDrag,
                    serveFlightCurveX: game.mirrorX(game.serveFlightCurveX),
                    serveNextBounceY: game.serveNextBounceY,
                    serveNextBounceZ: game.serveNextBounceZ,
                    cutMissProb: game.incomingCutMissProb,
                    hitType: game.playerHitType,
                    trailMode: game.trailMode,
                    effectType,
                    isSmashSound: isLongServe
                };
                TTNetwork.send(game.onlineRole === 'host' ? 'host_serve' : 'guest_serve', payload);
            }
        } else {
            game.npcHitType = 'fore';
            game.npcSwingTime = 0;

            const aimDir = npcLevel >= 3 ? (Math.random() > 0.5 ? 1 : -1) : 0;
            const firstX = aimDir !== 0 ? aimDir * 0.45 : (Math.random() - 0.5) * 0.4;

            if (isLongServe) {
                const firstZ = -(2.10 + pRatio * 0.25);
                game.serveDestX = aimDir !== 0 ? aimDir * (1.10 + pRatio * 0.25) : (Math.random() - 0.5) * 0.6;
                game.serveDestZ = 2.10 + pRatio * 0.35;
                game.serveFlightDuration = 0.51 - pRatio * 0.04;
                game.serveFlightSpin = -4.5 - pRatio * 2.5;
                game.serveNextBounceY = 0.76;
                game.serveNextBounceZ = 1.05;
                game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.26, 0));
            } else {
                const firstZ = -(1.15 + Math.random() * 0.15);
                game.serveDestX = aimDir !== 0 ? aimDir * 0.95 : (Math.random() - 0.5) * 0.5;
                game.serveDestZ = 1.05 + Math.random() * 0.18;
                game.serveFlightDuration = 0.56;
                game.serveFlightSpin = 0;
                game.serveNextBounceY = 0.84;
                game.serveNextBounceZ = 0.88;
                game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, new THREE.Vector3(firstX, targetY, firstZ), 0.25, 0));
            }

            game.playerCanHit = true;
            game.npcCanHit = false;
        }
        gameState = 'rally';
    },

    hitBall(game, hitter, hitPower, reachInfo = null, mode = 'up') {
        const isStop = (hitter === 'player' && keys.s);
        const isDownBtn = (hitter === 'player' && mode === 'down' && !isStop);
        const isCut = (isDownBtn && hitPower >= 50);
        const isPush = (isDownBtn && hitPower < 50);
        const isDrive = (!isStop && !isDownBtn && hitPower >= 50);
        const isUnchargedUp = (!isStop && !isDownBtn && hitPower < 50);
        const incomingCutMissProb = game.incomingCutMissProb || 0;

        const targetY = game.tableHeight + game.ballRadius;
        game.isServeFirstBounce = false;
        game.isShortServeActive = false;
        game.netFault = false;
        game.receiverBounces = 0;
        game.lastReceiverBounceZ = null;
        game.lastHitter = hitter;

        if (hitter === 'player') {
            const reach = reachInfo || this.getReachInfo(game, game.playerGroup.position, game.ballPos, true);
            const relX = game.ballPos.x - game.playerGroup.position.x;
            const isMiddle = !reach.isDive && Math.abs(relX) <= game.middleThresholdX;

            game.playerHitType = isStop ? 'stop' : (isDownBtn ? 'cut' : (relX < -game.middleThresholdX ? 'back' : 'fore'));
            game.playerSwingTime = 0;
            game.playerCanHit = false;
            game.npcCanHit = true;
            game.npcReactionTimer = 0;

            let tx = keys.a ? -1.10 : (keys.d ? 1.10 : (Math.random() - 0.5) * 0.65);
            let tz = -1.65 - Math.random() * 0.55;
            let destY = targetY;
            let duration = 0.78;
            let spinAccel = 0;
            let horizDrag = 0;
            let bounceY = 0.84;
            let bounceZ = 0.96;
            let isSmashSound = false;
            let effectType = 'lob';
            let nextCutMissProb = 0;

            if (reach.isDive) {
                game.playerDiveTime = 0;
                game.playerDiveDir = reach.dir;
                game.playerRecoveryTime = game.recoveryDuration;

                if (isDownBtn) {
                    if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                    const pRatio = Math.max(0, Math.min(1, hitPower / 100));
                    if (hitPower >= 50) {
                        const cutRatio = Math.max(0, Math.min(1, (hitPower - 50) / 50));
                        nextCutMissProb = 0.15 + cutRatio * 0.20;
                    }
                    tx = keys.a ? -0.85 : (keys.d ? 0.85 : (Math.random() - 0.5) * 0.6);
                    tz = -1.55 - pRatio * 0.35 - Math.random() * 0.25;
                    duration = 0.76;
                    spinAccel = 3.6 + pRatio * 1.2;
                    horizDrag = 0.65 + pRatio * 0.25;
                    bounceY = 0.62 - pRatio * 0.06;
                    bounceZ = 0.75 - pRatio * 0.06;
                    game.trailIsSmash = false;
                    game.trailMode = 'cut';
                    effectType = 'cut';
                    game.core.spawnHitEffect(game.ballPos, 'cut');
                    game.core.spawnRing(new THREE.Vector3(game.playerGroup.position.x, 0.05, game.playerGroup.position.z), 0x00d8ff, 0.4, 1.8, 0.28, true, 0.7);
                } else {
                    if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                    if (isUnchargedUp && incomingCutMissProb > 0 && Math.random() < incomingCutMissProb) {
                        tx = (Math.random() - 0.5) * 0.3;
                        tz = 0;
                        destY = game.tableHeight + game.netHeight * 0.55;
                        duration = Math.max(0.16, Math.min(0.32, Math.abs(game.ballPos.z) * 0.085));
                        spinAccel = -4.0;
                    } else {
                        tx = (Math.random() - 0.5) * 0.6;
                        tz = -1.35 - Math.random() * 0.45;
                        duration = 1.12;
                    }
                    bounceY = 0.96;
                    bounceZ = 0.84;
                    game.trailIsSmash = false;
                    game.trailMode = 'normal';
                    effectType = 'lob';
                    game.core.spawnHitEffect(game.ballPos, 'lob');
                    game.core.spawnRing(new THREE.Vector3(game.playerGroup.position.x, 0.05, game.playerGroup.position.z), 0xffffff, 0.4, 1.8, 0.28, true, 0.65);
                }
            } else if (isMiddle) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                if (isUnchargedUp && incomingCutMissProb > 0 && Math.random() < incomingCutMissProb) {
                    tx *= 0.25;
                    tz = 0;
                    destY = game.tableHeight + game.netHeight * 0.55;
                    duration = Math.max(0.16, Math.min(0.32, Math.abs(game.ballPos.z) * 0.085));
                    spinAccel = -4.0;
                } else {
                    tx *= 0.4;
                    tz = -1.25 - Math.random() * 0.45;
                    duration = 0.94;
                }
                bounceY = 0.92;
                bounceZ = 0.90;
                game.trailIsSmash = false;
                game.trailMode = 'normal';
                effectType = 'drop';
                game.core.spawnHitEffect(game.ballPos, 'drop');
            } else if (isStop) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tz = -0.82 - Math.random() * 0.25;
                duration = 0.64;
                game.trailIsSmash = false;
                game.trailMode = 'normal';
                effectType = 'drop';
                game.core.spawnHitEffect(game.ballPos, 'drop');
            } else if (isCut) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                const pRatio = Math.max(0, Math.min(1, (hitPower - 50) / 50));
                nextCutMissProb = 0.15 + pRatio * 0.20;
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
                game.trailIsSmash = false;
                game.trailMode = 'cut';
                effectType = 'cut';
                game.core.spawnHitEffect(game.ballPos, 'cut');
            } else if (isPush) {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                tz = -1.30 - Math.random() * 0.40;
                duration = 0.52;
                spinAccel = 2.0;
                horizDrag = 0.35;
                bounceY = 0.70;
                bounceZ = 0.84;
                game.trailIsSmash = false;
                game.trailMode = 'normal';
                effectType = 'drop';
                game.core.spawnHitEffect(game.ballPos, 'drop');
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

                const missType = this.getLowHitDriveMissType(game, game.ballPos.y);
                if (missType === 'net') {
                    tx *= 0.45;
                    tz = 0;
                    destY = game.tableHeight + game.netHeight * 0.55;
                    duration = Math.max(0.16, Math.min(0.32, Math.abs(game.ballPos.z) * 0.085));
                    spinAccel = -8.0;
                } else if (missType === 'over') {
                    tz = -3.65 - Math.random() * 0.65;
                    destY = game.tableHeight + 0.28;
                    duration = 0.44;
                    spinAccel = -2.2;
                } else {
                    duration = 0.46 - pRatio * 0.19;
                    tz = -1.75 - pRatio * 0.35 - Math.random() * 0.25;
                    spinAccel = -14.0 - pRatio * 12.0;
                }

                bounceY = 0.70 - pRatio * 0.08;
                bounceZ = 1.08 + pRatio * 0.14;
                game.trailIsSmash = true;
                game.trailMode = 'smash';
                effectType = 'smash';
                game.core.spawnHitEffect(game.ballPos, 'smash');
            } else {
                if (typeof BadmintonAudio !== 'undefined') BadmintonAudio.playHit(false);
                if (incomingCutMissProb > 0 && Math.random() < incomingCutMissProb) {
                    tx *= 0.45;
                    tz = 0;
                    destY = game.tableHeight + game.netHeight * 0.55;
                    duration = Math.max(0.16, Math.min(0.32, Math.abs(game.ballPos.z) * 0.085));
                    spinAccel = -4.0;
                } else {
                    const lowRatio = Math.max(0, Math.min(1, hitPower / 50));
                    duration = 0.86 - lowRatio * 0.18;
                    tz = -1.50 - Math.random() * 0.50;
                }
                bounceY = 0.86;
                game.trailIsSmash = false;
                game.trailMode = 'normal';
                effectType = 'lob';
                game.core.spawnHitEffect(game.ballPos, 'lob');
            }

            game.incomingCutMissProb = nextCutMissProb;
            game.ballSpinAccel = spinAccel;
            game.ballHorizDrag = horizDrag;
            game.ballCurveAccelX = 0;
            game.ballBounceScaleY = bounceY;
            game.ballBounceScaleZ = bounceZ;
            const target = new THREE.Vector3(tx, destY, tz);
            game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, target, duration, spinAccel, horizDrag, 0));

            if (game.onlineMode && typeof TTNetwork !== 'undefined') {
                game.onlineSeq++;
                const payload = {
                    seq: game.onlineSeq,
                    pos: { x: game.mirrorX(game.ballPos.x), y: game.ballPos.y, z: game.mirrorZ(game.ballPos.z) },
                    vel: { x: game.mirrorX(game.ballVel.x), y: game.ballVel.y, z: game.mirrorZ(game.ballVel.z) },
                    spin: game.ballSpinAccel,
                    horizDrag: game.ballHorizDrag,
                    curveX: game.mirrorX(game.ballCurveAccelX),
                    bounceY: game.ballBounceScaleY,
                    bounceZ: game.ballBounceScaleZ,
                    cutMissProb: game.incomingCutMissProb,
                    hitType: game.playerHitType,
                    trailMode: game.trailMode,
                    effectType,
                    isSmashSound,
                    isDive: reach.isDive,
                    diveDir: game.mirrorX(reach.dir)
                };
                TTNetwork.send(game.onlineRole === 'host' ? 'host_hit' : 'guest_hit', payload);
            }
        } else {
            const reach = reachInfo || this.getReachInfo(game, game.npcGroup.position, game.ballPos, false);
            const relX = game.ballPos.x - game.npcGroup.position.x;
            const isMiddle = !reach.isDive && Math.abs(relX) <= game.middleThresholdX;

            game.npcHitType = relX > game.middleThresholdX ? 'back' : 'fore';
            game.npcSwingTime = 0;
            game.npcCanHit = false;
            game.playerCanHit = true;
            game.npcReactionTimer = 0;
            game.incomingCutMissProb = 0;

            let tx = game.playerGroup.position.x > 0 ? -0.95 : 0.95;
            if (npcLevel >= 3) {
                tx = game.playerGroup.position.x > 0.35 ? -1.15 : (game.playerGroup.position.x < -0.35 ? 1.15 : (Math.random() > 0.5 ? 1.1 : -1.1));
            }

            let tz = 1.55 + Math.random() * 0.55;
            let destY = targetY;
            let duration = 0.78;
            let spinAccel = 0;
            let bounceY = 0.84;
            let bounceZ = 0.96;
            let shotType = 'lob';
            let canNetMissByCut = false;

            if (reach.isDive) {
                game.npcDiveTime = 0;
                game.npcDiveDir = reach.dir;
                game.npcRecoveryTime = game.recoveryDuration;

                tx = (Math.random() - 0.5) * 0.6;
                tz = 1.35 + Math.random() * 0.45;
                duration = 1.12;
                bounceY = 0.96;
                bounceZ = 0.84;
                shotType = 'lob';
                canNetMissByCut = true;
                game.core.spawnRing(new THREE.Vector3(game.npcGroup.position.x, 0.05, game.npcGroup.position.z), 0xffffff, 0.4, 1.8, 0.28, true, 0.65);
            } else if (isMiddle) {
                tx = (Math.random() - 0.5) * 0.65;
                tz = 1.25 + Math.random() * 0.45;
                duration = 0.96;
                bounceY = 0.93;
                bounceZ = 0.90;
                shotType = 'drop';
                canNetMissByCut = true;
            } else if (npcLevel === 4) {
                const isHighBall = game.ballPos.y >= game.tableHeight + 0.25;
                const isMidLowBall = !isHighBall && game.ballPos.y >= game.tableHeight;
                if (isHighBall || (isMidLowBall && Math.random() < 0.35)) {
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
                    canNetMissByCut = true;
                }
            } else if (npcLevel === 3) {
                const isHighBall = game.ballPos.y >= game.tableHeight + 0.25;
                const isMidLowBall = !isHighBall && game.ballPos.y >= game.tableHeight;
                if ((isHighBall && Math.random() < 0.5) || (isMidLowBall && Math.random() < 0.30)) {
                    duration = 0.44;
                    tz = 1.80 + Math.random() * 0.4;
                    spinAccel = -14.0;
                    bounceY = 0.72;
                    bounceZ = 1.08;
                    shotType = 'smash';
                } else {
                    duration = 0.70;
                    canNetMissByCut = true;
                }
            } else if (npcLevel === 2) {
                duration = 0.76;
                canNetMissByCut = true;
            } else {
                tx = (Math.random() - 0.5) * 1.25;
                duration = 0.86;
                canNetMissByCut = true;
            }

            if (canNetMissByCut && incomingCutMissProb > 0 && Math.random() < incomingCutMissProb) {
                tx *= 0.45;
                tz = 0;
                destY = game.tableHeight + game.netHeight * 0.55;
                duration = Math.max(0.16, Math.min(0.32, Math.abs(game.ballPos.z) * 0.085));
                spinAccel = -4.0;
            } else if (shotType === 'smash') {
                const missType = this.getLowHitDriveMissType(game, game.ballPos.y);
                if (missType === 'net') {
                    tx *= 0.45;
                    tz = 0;
                    destY = game.tableHeight + game.netHeight * 0.55;
                    duration = Math.max(0.16, Math.min(0.32, Math.abs(game.ballPos.z) * 0.085));
                    spinAccel = -8.0;
                } else if (missType === 'over') {
                    tz = 3.65 + Math.random() * 0.65;
                    destY = game.tableHeight + 0.28;
                    duration = 0.44;
                    spinAccel = -2.2;
                }
            }

            if (typeof BadmintonAudio !== 'undefined') {
                BadmintonAudio.playHit(shotType === 'smash');
            }
            game.ballSpinAccel = spinAccel;
            game.ballHorizDrag = 0;
            game.ballCurveAccelX = 0;
            game.ballBounceScaleY = bounceY;
            game.ballBounceScaleZ = bounceZ;
            game.trailIsSmash = (shotType === 'smash');
            game.trailMode = (shotType === 'smash') ? 'smash' : 'normal';
            game.core.spawnHitEffect(game.ballPos, shotType);
            const target = new THREE.Vector3(tx, destY, tz);
            game.ballVel.copy(this.computeBallVelocity(game, game.ballPos, target, duration, spinAccel));
        }
    },

    updateNPC(game, dt) {
        if (game.onlineMode) {
            game.updateRemoteOpponent(dt);
            return;
        }
        if (gameState !== 'rally') return;

        // 飛びつきジャンプ中は横方向へ飛び込み、終了後はリカバリー遅延に入る
        if (game.npcDiveTime >= 0) {
            game.npcGroup.position.x += game.npcDiveDir * 2.6 * dt;
            game.npcGroup.position.x = Math.max(-game.limitX, Math.min(game.limitX, game.npcGroup.position.x));
            return;
        }

        let speed = game.npcBaseSpeed;
        if (npcLevel === 2) speed = game.npcBaseSpeed * 1.18;
        if (npcLevel === 3) speed = game.npcBaseSpeed * 1.32;
        if (npcLevel === 4) speed = game.npcBaseSpeed * 1.50;
        if (game.npcRecoveryTime > 0) speed *= 0.30;

        let targetX = 0;
        let targetZ = -3.8;

        if (game.lastHitter === 'player') {
            game.npcReactionTimer += dt;
            const reactionDelay = (npcLevel === 1) ? 0.46 : (npcLevel === 2) ? 0.40 : (npcLevel === 3) ? 0.37 : 0.29;

            if (game.npcReactionTimer < reactionDelay) {
                targetX = game.npcGroup.position.x;
                targetZ = game.npcGroup.position.z;
            } else if (npcLevel >= 3) {
                if (game.isShortServeActive) {
                    const aimX = game.isServeFirstBounce ? game.serveDestX : game.ballPos.x;
                    targetX = Math.max(-game.limitX, Math.min(game.limitX, aimX + 0.42));
                    targetZ = game.npcZMax;
                } else if (game.isServeFirstBounce) {
                    targetX = Math.max(-game.limitX, Math.min(game.limitX, game.serveDestX + 0.48));
                    targetZ = Math.max(game.npcZMin, Math.min(game.npcZMax, game.serveDestZ - 1.75));
                } else {
                    const info = this.predictBallInfo(game, -2.3);
                    const bz = (game.receiverBounces >= 1 && game.lastReceiverBounceZ !== null)
                        ? game.lastReceiverBounceZ
                        : (info.bounce ? info.bounce.z : (info.hit ? info.hit.z : game.ballPos.z));
                    const px = info.hit ? info.hit.x : (info.bounce ? info.bounce.x : game.ballPos.x);
                    targetX = Math.max(-game.limitX, Math.min(game.limitX, px + 0.48));
                    targetZ = Math.max(game.npcZMin, Math.min(game.npcZMax, bz - 1.75));
                }
            } else {
                targetX = Math.max(-game.limitX, Math.min(game.limitX, game.ballPos.x + 0.42));
                targetZ = Math.max(game.npcZMin, Math.min(game.npcZMax, game.ballPos.z - 0.65));
            }
        } else {
            game.npcReactionTimer = 0;
            if (npcLevel === 1) {
                targetX = game.npcGroup.position.x;
                targetZ = game.npcGroup.position.z;
            } else if (npcLevel === 2) {
                targetX = 0;
                targetZ = -3.8;
                speed *= 0.4;
            } else {
                targetX = 0;
                targetZ = -3.8;
            }
        }

        const dx = targetX - game.npcGroup.position.x;
        const dz = targetZ - game.npcGroup.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.14) {
            game.npcGroup.position.x += (dx / dist) * speed * dt;
            game.npcGroup.position.z += (dz / dist) * speed * dt;
            game.npcGroup.position.x = Math.max(-game.limitX, Math.min(game.limitX, game.npcGroup.position.x));
            game.npcGroup.position.z = Math.max(game.npcZMin, Math.min(game.npcZMax, game.npcGroup.position.z));
        }

        if (game.npcCanHit && game.receiverBounces === 1 && game.ballPos.z < -0.2) {
            const npcMaxX = npcLevel >= 3 ? game.maxReachX * 0.96 : game.maxReachX * 0.88;
            const reach = this.getReachInfo(game, game.npcGroup.position, game.ballPos, false, npcMaxX);
            if (reach.inRange) {
                this.hitBall(game, 'npc', 70, reach);
            }
        }
    }
};