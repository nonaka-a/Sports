const TableTennisCharacter = {
    // 卓球専用シェークハンドラケット生成
    createRacket(rubberColor, accentColor) {
        const racket = new THREE.Group();

        const grip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.022, 0.029, 0.15, 10),
            new THREE.MeshStandardMaterial({ color: 0xc98f58, roughness: 0.7 })
        );
        grip.position.y = 0.075;
        racket.add(grip);

        const tape = new THREE.Mesh(
            new THREE.CylinderGeometry(0.024, 0.024, 0.022, 10),
            new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4 })
        );
        tape.position.y = 0.14;
        racket.add(tape);

        const blade = new THREE.Mesh(
            new THREE.CylinderGeometry(0.145, 0.145, 0.015, 24),
            new THREE.MeshStandardMaterial({ color: 0xe3b886, roughness: 0.6 })
        );
        blade.rotation.x = Math.PI / 2;
        blade.scale.set(0.92, 1.0, 1.06);
        blade.position.y = 0.285;
        racket.add(blade);

        const rubberGeo = new THREE.CircleGeometry(0.139, 24);
        const frontRubber = new THREE.Mesh(
            rubberGeo,
            new THREE.MeshStandardMaterial({ color: rubberColor, roughness: 0.42 })
        );
        frontRubber.scale.set(0.92, 1.06, 1);
        frontRubber.position.set(0, 0.285, 0.0085);
        racket.add(frontRubber);

        const backRubber = new THREE.Mesh(
            rubberGeo,
            new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.48 })
        );
        backRubber.rotation.y = Math.PI;
        backRubber.scale.set(0.92, 1.06, 1);
        backRubber.position.set(0, 0.285, -0.0085);
        racket.add(backRubber);

        const swingArc = new THREE.Mesh(
            new THREE.RingGeometry(0.28, 0.56, 20, 1, -Math.PI * 0.35, Math.PI * 0.7),
            new THREE.MeshBasicMaterial({
                color: accentColor,
                transparent: true,
                opacity: 0.0,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        swingArc.rotation.y = Math.PI / 2;
        swingArc.rotation.z = Math.PI * 0.25;
        swingArc.name = "swingArc";
        swingArc.visible = false;
        racket.add(swingArc);

        return racket;
    },

    // 関節リグ付き3頭身卓球キャラクター生成（足裏基準 y = 0）
    createCharacter(config) {
        const bodyMesh = new THREE.Group();
        bodyMesh.name = "bodyMesh";

        const facingRoot = new THREE.Group();
        facingRoot.name = "facingRoot";
        facingRoot.rotation.y = config.faceBack ? Math.PI : 0;
        bodyMesh.add(facingRoot);

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd2b3, roughness: 0.55 });
        const jerseyMat = new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.45 });
        const accentMat = new THREE.MeshStandardMaterial({ color: config.accentColor, roughness: 0.4 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const shortsMat = new THREE.MeshStandardMaterial({ color: config.shortsColor, roughness: 0.65 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.4 });
        const soleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
        const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.78 });

        // 1. 骨盤
        const pelvisGroup = new THREE.Group();
        pelvisGroup.position.set(0, 0.34, 0);
        facingRoot.add(pelvisGroup);

        const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.195, 0.11, 16), shortsMat);
        pelvisMesh.position.y = -0.01;
        pelvisGroup.add(pelvisMesh);

        // 2. 両脚（股関節 -> 膝 -> 足首）
        const buildLeg = (sideSign) => {
            const hipGroup = new THREE.Group();
            hipGroup.position.set(sideSign * 0.11, -0.03, 0);
            pelvisGroup.add(hipGroup);

            const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.088, 0.095, 12), shortsMat);
            shortLeg.position.y = -0.038;
            hipGroup.add(shortLeg);

            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.054, 0.095, 12), skinMat);
            thigh.position.y = -0.10;
            hipGroup.add(thigh);

            const kneeGroup = new THREE.Group();
            kneeGroup.position.set(0, -0.145, 0);
            hipGroup.add(kneeGroup);

            kneeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), skinMat));

            const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.040, 0.09, 10), skinMat);
            calf.position.y = -0.045;
            kneeGroup.add(calf);

            const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.042, 0.042, 10), trimMat);
            sock.position.y = -0.095;
            kneeGroup.add(sock);

            const ankleGroup = new THREE.Group();
            ankleGroup.position.set(0, -0.11, 0);
            kneeGroup.add(ankleGroup);

            const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.048, 0.175), shoeMat);
            shoeUpper.position.set(0, -0.015, 0.028);
            ankleGroup.add(shoeUpper);

            const shoeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.109, 0.014, 0.12), trimMat);
            shoeStripe.position.set(0, -0.015, 0.02);
            ankleGroup.add(shoeStripe);

            const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.020, 0.185), soleMat);
            shoeSole.position.set(0, -0.044, 0.028);
            ankleGroup.add(shoeSole);

            return { hipGroup, kneeGroup, ankleGroup };
        };

        const leftLeg = buildLeg(1);
        const rightLeg = buildLeg(-1);

        // 3. 体幹・上半身
        const torsoGroup = new THREE.Group();
        torsoGroup.position.set(0, 0.04, 0);
        pelvisGroup.add(torsoGroup);

        const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.172, 0.12, 16), jerseyMat);
        waist.position.y = 0.06;
        torsoGroup.add(waist);

        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.195, 0.18, 16), jerseyMat);
        chest.position.y = 0.20;
        torsoGroup.add(chest);

        const chestBand = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.045, 0.26), trimMat);
        chestBand.position.set(0, 0.21, 0.01);
        torsoGroup.add(chestBand);

        const sideAccentGeo = new THREE.BoxGeometry(0.036, 0.28, 0.18);
        [-0.19, 0.19].forEach(sx => {
            const stripe = new THREE.Mesh(sideAccentGeo, accentMat);
            stripe.position.set(sx, 0.15, 0);
            torsoGroup.add(stripe);
        });

        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.018, 8, 16), trimMat);
        collar.rotation.x = Math.PI / 2;
        collar.position.set(0, 0.29, 0.01);
        torsoGroup.add(collar);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.072, 0.08, 12), skinMat);
        neck.position.y = 0.32;
        torsoGroup.add(neck);

        // 4. 頭部
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.48, 0.01);
        torsoGroup.add(headGroup);

        headGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.215, 24, 24), skinMat));

        const earGeo = new THREE.SphereGeometry(0.042, 10, 10);
        [-0.205, 0.205].forEach(ex => {
            const ear = new THREE.Mesh(earGeo, skinMat);
            ear.scale.set(0.6, 1.0, 0.8);
            ear.position.set(ex, -0.01, 0);
            headGroup.add(ear);
        });

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const browMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.7 });
        const eyeGeo = new THREE.SphereGeometry(0.028, 10, 10);
        const hlGeo = new THREE.SphereGeometry(0.009, 6, 6);
        const browGeo = new THREE.BoxGeometry(0.052, 0.014, 0.016);

        [-0.076, 0.076].forEach(ex => {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.scale.set(0.9, 1.35, 0.55);
            eye.position.set(ex, 0.005, 0.198);
            headGroup.add(eye);

            const hl = new THREE.Mesh(hlGeo, hlMat);
            hl.position.set(ex + 0.008, 0.022, 0.211);
            headGroup.add(hl);

            const brow = new THREE.Mesh(browGeo, browMat);
            brow.position.set(ex, 0.056, 0.202);
            brow.rotation.z = ex < 0 ? 0.12 : -0.12;
            headGroup.add(brow);
        });

        const hairCrown = new THREE.Mesh(
            new THREE.SphereGeometry(0.224, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
            hairMat
        );
        hairCrown.rotation.x = -0.26;
        headGroup.add(hairCrown);

        const bangGeo = new THREE.ConeGeometry(0.045, 0.11, 6);
        [-0.08, 0, 0.08].forEach((bx, idx) => {
            const bang = new THREE.Mesh(bangGeo, hairMat);
            bang.position.set(bx, 0.115, 0.182);
            bang.rotation.x = Math.PI * 0.82;
            bang.rotation.z = (idx - 1) * 0.15;
            headGroup.add(bang);
        });

        if (config.hasCap) {
            const headband = new THREE.Mesh(
                new THREE.TorusGeometry(0.216, 0.026, 8, 24),
                new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.4 })
            );
            headband.rotation.x = Math.PI / 2 - 0.15;
            headband.position.y = 0.075;
            headGroup.add(headband);

            const knot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.032, 0.055), trimMat);
            knot.position.set(0, 0.045, -0.22);
            headGroup.add(knot);
        } else {
            const band = new THREE.Mesh(
                new THREE.TorusGeometry(0.218, 0.025, 8, 24),
                new THREE.MeshStandardMaterial({ color: config.primaryColor, roughness: 0.35 })
            );
            band.rotation.x = Math.PI / 2 - 0.12;
            band.position.y = 0.082;
            headGroup.add(band);

            const brim = new THREE.Mesh(
                new THREE.CylinderGeometry(0.235, 0.255, 0.022, 16, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
                trimMat
            );
            brim.position.set(0, 0.09, 0.075);
            brim.rotation.x = 0.18;
            headGroup.add(brim);
        }

        // 5. 両腕（肩 -> 肘 -> 手首）
        const buildArm = (isRight) => {
            const sideSign = isRight ? -1 : 1;
            const shoulderGroup = new THREE.Group();
            shoulderGroup.position.set(sideSign * 0.25, 0.255, 0);
            torsoGroup.add(shoulderGroup);

            shoulderGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 12), jerseyMat));

            const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.15, 10), skinMat);
            upperArm.position.y = -0.075;
            shoulderGroup.add(upperArm);

            const elbowGroup = new THREE.Group();
            elbowGroup.position.set(0, -0.15, 0);
            shoulderGroup.add(elbowGroup);

            elbowGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), skinMat));

            const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.035, 0.145, 10), skinMat);
            forearm.position.y = -0.075;
            elbowGroup.add(forearm);

            if (isRight) {
                const wristBand = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.042, 10), trimMat);
                wristBand.position.y = -0.125;
                elbowGroup.add(wristBand);
            }

            const wristGroup = new THREE.Group();
            wristGroup.position.set(0, -0.15, 0);
            elbowGroup.add(wristGroup);

            wristGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), skinMat));

            let swingArc = null;
            if (isRight) {
                const racket = this.createRacket(config.rubberColor || 0xd92626, config.accentColor);
                racket.position.set(0, -0.01, 0.02);
                racket.rotation.set(Math.PI * 0.55, 0, -0.15);
                wristGroup.add(racket);
                swingArc = racket.getObjectByName("swingArc");
            }

            return { shoulderGroup, elbowGroup, wristGroup, swingArc };
        };

        const rightArm = buildArm(true);
        const leftArm = buildArm(false);

        bodyMesh.userData.rig = {
            facingRoot,
            pelvisGroup,
            torsoGroup,
            headGroup,
            leftLeg,
            rightLeg,
            leftArm,
            rightArm,
            basePelvisY: 0.34
        };

        this.resetPose(bodyMesh);
        return bodyMesh;
    },

    lerpAngle(obj, x, y, z, factor) {
        obj.rotation.x += (x - obj.rotation.x) * factor;
        obj.rotation.y += (y - obj.rotation.y) * factor;
        obj.rotation.z += (z - obj.rotation.z) * factor;
    },

    resetPose(bodyMesh) {
        const rig = bodyMesh && bodyMesh.userData ? bodyMesh.userData.rig : null;
        if (!rig) return;
        bodyMesh.position.y = 0;
        bodyMesh.rotation.z = 0;
        rig.pelvisGroup.position.y = rig.basePelvisY - 0.025;
        rig.torsoGroup.rotation.set(0.24, 0, 0);
        rig.headGroup.rotation.set(-0.20, 0, 0);
        rig.leftLeg.hipGroup.rotation.set(-0.28, 0, 0.14);
        rig.leftLeg.kneeGroup.rotation.set(0.56, 0, 0);
        rig.leftLeg.ankleGroup.rotation.set(-0.28, 0, -0.14);
        rig.rightLeg.hipGroup.rotation.set(-0.28, 0, -0.14);
        rig.rightLeg.kneeGroup.rotation.set(0.56, 0, 0);
        rig.rightLeg.ankleGroup.rotation.set(-0.28, 0, 0.14);
        rig.rightArm.shoulderGroup.rotation.set(-0.35, 0, -0.25);
        rig.rightArm.elbowGroup.rotation.set(-1.15, 0, 0.25);
        rig.rightArm.wristGroup.rotation.set(0, 0, 0);
        rig.leftArm.shoulderGroup.rotation.set(-0.35, 0, 0.25);
        rig.leftArm.elbowGroup.rotation.set(-0.95, 0, -0.15);
        if (rig.rightArm.swingArc) {
            rig.rightArm.swingArc.visible = false;
            rig.rightArm.swingArc.material.opacity = 0;
        }
    },

    updateAnimation(bodyMesh, state, dt) {
        const rig = bodyMesh && bodyMesh.userData ? bodyMesh.userData.rig : null;
        if (!rig) return { swingTime: state.swingTime, stepPhase: state.stepPhase };

        const {
            isPlayer,
            vx,
            vz,
            isCharging,
            chargeRatio,
            hitType,
            armMode,
            diveTime,
            diveDuration,
            diveDir,
            recoveryTime,
            idleTime
        } = state;

        let swingTime = state.swingTime;
        let stepPhase = state.stepPhase;
        const speed = Math.hypot(vx, vz);
        const factor = Math.min(1, 14 * dt);

        // キャラローカル座標での移動方向（+Z正面、+X左、-X右）
        const localVx = isPlayer ? -vx : vx;
        const localVz = isPlayer ? -vz : vz;
        const localDiveDir = isPlayer ? -diveDir : diveDir;

        // 1. 飛びつきジャンプ全体の位置・傾き
        if (diveTime >= 0) {
            const t = Math.min(1, diveTime / diveDuration);
            const arc = Math.sin(t * Math.PI);
            bodyMesh.position.y = arc * 0.45;
            bodyMesh.rotation.z = -diveDir * arc * 0.48;
        } else {
            bodyMesh.position.y += (0 - bodyMesh.position.y) * factor;
            bodyMesh.rotation.z += (0 - bodyMesh.rotation.z) * factor;
        }

        // 2. 下半身（膝曲げレディスタンス＋サイドステップ）
        let pelvisDrop = isCharging ? 0.045 : (recoveryTime > 0 ? 0.05 : 0.025);
        let stepBounce = 0;

        if (diveTime >= 0) {
            this.lerpAngle(rig.leftLeg.hipGroup, -0.22, 0, localDiveDir > 0 ? 0.48 : 0.12, factor);
            this.lerpAngle(rig.leftLeg.kneeGroup, 0.42, 0, 0, factor);
            this.lerpAngle(rig.leftLeg.ankleGroup, -0.20, 0, 0, factor);

            this.lerpAngle(rig.rightLeg.hipGroup, -0.22, 0, localDiveDir < 0 ? -0.48 : -0.12, factor);
            this.lerpAngle(rig.rightLeg.kneeGroup, 0.42, 0, 0, factor);
            this.lerpAngle(rig.rightLeg.ankleGroup, -0.20, 0, 0, factor);
        } else if (speed > 0.25) {
            stepPhase += dt * Math.min(speed * 3.2, 18);
            const s = Math.sin(stepPhase);
            stepBounce = Math.abs(s) * 0.022;
            const sideEmphasis = Math.min(1, Math.abs(localVx) / (speed + 0.001));
            const fbEmphasis = Math.min(1, Math.abs(localVz) / (speed + 0.001));

            const lHipX = -0.30 + s * 0.32 * fbEmphasis;
            const rHipX = -0.30 - s * 0.32 * fbEmphasis;
            const lHipZ = 0.16 + Math.max(0, s) * 0.22 * sideEmphasis;
            const rHipZ = -0.16 - Math.max(0, -s) * 0.22 * sideEmphasis;
            const lKnee = 0.56 + Math.max(0, -s) * 0.28;
            const rKnee = 0.56 + Math.max(0, s) * 0.28;

            this.lerpAngle(rig.leftLeg.hipGroup, lHipX, 0, lHipZ, factor);
            this.lerpAngle(rig.leftLeg.kneeGroup, lKnee, 0, 0, factor);
            this.lerpAngle(rig.leftLeg.ankleGroup, -(lHipX + lKnee), 0, -lHipZ, factor);

            this.lerpAngle(rig.rightLeg.hipGroup, rHipX, 0, rHipZ, factor);
            this.lerpAngle(rig.rightLeg.kneeGroup, rKnee, 0, 0, factor);
            this.lerpAngle(rig.rightLeg.ankleGroup, -(rHipX + rKnee), 0, -rHipZ, factor);
        } else {
            const idleKnee = 0.54 + Math.sin(idleTime * 3.4) * 0.04;
            const idleHipX = -idleKnee * 0.5;
            this.lerpAngle(rig.leftLeg.hipGroup, idleHipX, 0, 0.14, factor);
            this.lerpAngle(rig.leftLeg.kneeGroup, idleKnee, 0, 0, factor);
            this.lerpAngle(rig.leftLeg.ankleGroup, -idleHipX - idleKnee, 0, -0.14, factor);

            this.lerpAngle(rig.rightLeg.hipGroup, idleHipX, 0, -0.14, factor);
            this.lerpAngle(rig.rightLeg.kneeGroup, idleKnee, 0, 0, factor);
            this.lerpAngle(rig.rightLeg.ankleGroup, -idleHipX - idleKnee, 0, 0.14, factor);
        }

        rig.pelvisGroup.position.y += (rig.basePelvisY - pelvisDrop + stepBounce - rig.pelvisGroup.position.y) * factor;

        // 3. 上半身（前傾・腰のひねり）と右腕スイング
        let targetTorsoX = 0.24 + (isCharging ? 0.08 : 0);
        let targetTorsoY = 0;
        let targetTorsoZ = Math.max(-0.14, Math.min(0.14, -localVx * 0.03));

        let rShX = -0.35, rShY = 0, rShZ = -0.25;
        let rElX = -1.15, rElY = 0, rElZ = 0.25;
        let rWrX = 0, rWrY = 0, rWrZ = 0;
        let arcOpacity = 0;

        if (diveTime >= 0) {
            const stretchRight = localDiveDir < 0;
            targetTorsoX = 0.34;
            targetTorsoY = stretchRight ? -0.32 : 0.32;
            rShX = -0.75;
            rShZ = stretchRight ? -0.95 : 0.35;
            rElX = -0.35;
            rElZ = 0;
        } else if (swingTime >= 0) {
            swingTime += dt;
            const duration = 0.26;
            if (swingTime < duration) {
                const t = swingTime / duration;
                const s = Math.sin(t * Math.PI * 0.72);
                arcOpacity = (1 - t) * 0.55;

                if (hitType === 'back') {
                    // バックハンド：肘を前に構え前腕を前方へ展開して振り抜く
                    targetTorsoX = 0.28;
                    targetTorsoY = 0.26 - s * 0.52;
                    rShX = -0.58 + s * 0.18;
                    rShY = 0.38 - s * 0.65;
                    rShZ = 0.35 - s * 0.95;
                    rElX = -1.45 + s * 1.15;
                    rElZ = -0.25 + s * 0.35;
                    rWrX = -0.2 + s * 0.35;
                    rWrZ = 0.25 - s * 0.45;
                } else if (hitType === 'stop') {
                    // ストップ（ツッツキ）：ラケット面を上に向けて短く差し出す
                    targetTorsoX = 0.36;
                    targetTorsoY = -0.08 + s * 0.16;
                    rShX = -0.55 - s * 0.35;
                    rShZ = -0.12;
                    rElX = -1.10 + s * 0.55;
                    rWrX = 0.48;
                } else {
                    // フォアハンドドライブ：腰の回旋＋肘を支点に斜め前上へ振り抜き
                    targetTorsoX = 0.26;
                    targetTorsoY = -0.52 + s * 1.05;
                    rShX = 0.25 - s * 1.45;
                    rShY = -0.25 + s * 0.55;
                    rShZ = -0.55 + s * 0.85;
                    rElX = -0.55 - s * 0.95;
                    rElZ = 0.15 + s * 0.35;
                    rWrX = -0.15;
                    rWrY = 0.15 - s * 0.45;
                }
            } else {
                swingTime = -1;
            }
        } else if (isCharging) {
            // バックスイング（ため）：腰と右肩を後ろへ引きラケットを下げる
            targetTorsoX = 0.28 + chargeRatio * 0.08;
            targetTorsoY = -0.28 - chargeRatio * 0.32;
            rShX = 0.15 + chargeRatio * 0.32;
            rShY = -0.25;
            rShZ = -0.45 - chargeRatio * 0.22;
            rElX = -0.65 + chargeRatio * 0.15;
            rElZ = 0.15;
            rWrX = -0.12;
        } else {
            // 待機レディポジション
            const sway = Math.sin(idleTime * 3.4) * 0.04;
            rShX = -0.35 + sway;
            rShZ = -0.25;
            rElX = -1.15 - sway * 0.5;
            rElZ = 0.25;
        }

        const swingFactor = swingTime >= 0 ? Math.min(1, 26 * dt) : factor;
        this.lerpAngle(rig.torsoGroup, targetTorsoX, targetTorsoY, targetTorsoZ, swingFactor);
        this.lerpAngle(rig.headGroup, -targetTorsoX * 0.82, -targetTorsoY * 0.45, -targetTorsoZ * 0.5, swingFactor);

        this.lerpAngle(rig.rightArm.shoulderGroup, rShX, rShY, rShZ, swingFactor);
        this.lerpAngle(rig.rightArm.elbowGroup, rElX, rElY, rElZ, swingFactor);
        this.lerpAngle(rig.rightArm.wristGroup, rWrX, rWrY, rWrZ, swingFactor);

        if (rig.rightArm.swingArc) {
            rig.rightArm.swingArc.visible = arcOpacity > 0.01;
            rig.rightArm.swingArc.material.opacity = arcOpacity;
        }

        // 4. 左腕（トス動作・飛びつきバランス・通常構え）
        let lShX = -0.35, lShZ = 0.25;
        let lElX = -0.95, lElZ = -0.15;

        if (diveTime >= 0) {
            const stretchLeft = localDiveDir > 0;
            lShX = -0.65;
            lShZ = stretchLeft ? 0.95 : -0.25;
            lElX = -0.35;
        } else if (armMode === 'hold') {
            lShX = -0.65;
            lShZ = 0.12;
            lElX = -0.85;
            lElZ = -0.25;
        } else if (armMode === 'toss') {
            lShX = -2.15;
            lShZ = 0.18;
            lElX = -0.25;
            lElZ = 0;
        } else if (swingTime >= 0 && hitType === 'fore') {
            lShX = -0.45;
            lShZ = 0.42;
            lElX = -1.15;
        } else {
            const sway = Math.sin(idleTime * 3.4) * 0.04;
            lShX = -0.35 + sway;
            lElX = -0.95;
        }

        this.lerpAngle(rig.leftArm.shoulderGroup, lShX, 0, lShZ, factor);
        this.lerpAngle(rig.leftArm.elbowGroup, lElX, 0, lElZ, factor);

        return { swingTime, stepPhase };
    }
};