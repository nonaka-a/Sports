const EnvironmentManager = {
    environmentGroup: null,
    createdTextures: [],

    // 古いコート環境を削除し、ジオメトリ・マテリアル・生成テクスチャのメモリを解放する
    clearEnvironment(scene) {
        if (this.environmentGroup) {
            scene.remove(this.environmentGroup);
            const disposedGeometries = new Set();
            const disposedMaterials = new Set();

            this.environmentGroup.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry && !disposedGeometries.has(child.geometry)) {
                        child.geometry.dispose();
                        disposedGeometries.add(child.geometry);
                    }
                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(m => {
                            if (!disposedMaterials.has(m)) {
                                if (m.map) m.map.dispose();
                                m.dispose();
                                disposedMaterials.add(m);
                            }
                        });
                    }
                }
            });
            this.environmentGroup = null;
        }

        if (this.createdTextures.length > 0) {
            this.createdTextures.forEach(tex => tex.dispose());
            this.createdTextures = [];
        }
    },

    // 外部から呼ばれるコート構築のメイン関数
    buildCourt(scene, type, options) {
        this.clearEnvironment(scene);
        this.environmentGroup = new THREE.Group();

        if (type === 'cute') {
            this.buildCuteEnvironment(this.environmentGroup, scene, options);
        } else {
            this.buildGymEnvironment(this.environmentGroup, scene, options);
        }

        scene.add(this.environmentGroup);
    },

    // -----------------------------------------------------
    // プロシージャルテクスチャ生成ユーティリティ
    // -----------------------------------------------------
    registerTexture(canvas, repeatX = 1, repeatY = 1) {
        const texture = new THREE.CanvasTexture(canvas);
        if (repeatX !== 1 || repeatY !== 1) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeatX, repeatY);
        }
        texture.anisotropy = 4;
        this.createdTextures.push(texture);
        return texture;
    },

    createWoodFloorTexture(baseHex, plankHex, lineHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, 512, 512);

        const rows = 8;
        const rowH = 512 / rows;
        for (let r = 0; r < rows; r++) {
            const y = r * rowH;
            // 板ごとの微妙な色ムラ
            ctx.fillStyle = (r % 2 === 0) ? baseHex : plankHex;
            ctx.globalAlpha = 0.35;
            ctx.fillRect(0, y, 512, rowH);

            // 木目ライン
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = lineHex;
            for (let g = 0; g < 4; g++) {
                ctx.fillRect(0, y + (g * rowH / 4) + 2, 512, 1.5);
            }

            // 縦の継ぎ目
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = lineHex;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            const offset = (r % 2) * 128 + 64;
            ctx.moveTo(offset, y);
            ctx.lineTo(offset, y + rowH);
            ctx.moveTo((offset + 256) % 512, y);
            ctx.lineTo((offset + 256) % 512, y + rowH);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        return this.registerTexture(canvas, 14, 14);
    },

    createCourtMatTexture(baseHex, grainHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, 256, 256);

        ctx.fillStyle = grainHex;
        for (let i = 0; i < 1600; i++) {
            ctx.globalAlpha = Math.random() * 0.08;
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            ctx.fillRect(x, y, 2, 2);
        }
        ctx.globalAlpha = 1.0;
        return this.registerTexture(canvas, 6, 10);
    },

    createNetTexture(meshColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 64, 64);
        ctx.strokeStyle = meshColor;
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(64, 0);
        ctx.moveTo(0, 32); ctx.lineTo(64, 32);
        ctx.moveTo(0, 0); ctx.lineTo(0, 64);
        ctx.moveTo(32, 0); ctx.lineTo(32, 64);
        ctx.stroke();

        return this.registerTexture(canvas, 36, 4);
    },

    createBannerTexture(text, bgHex, accentHex, textHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bgHex;
        ctx.fillRect(0, 0, 512, 128);

        // スポーティな斜めアクセントライン
        ctx.fillStyle = accentHex;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(90, 0);
        ctx.lineTo(50, 128);
        ctx.lineTo(0, 128);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(462, 0);
        ctx.lineTo(512, 0);
        ctx.lineTo(512, 128);
        ctx.lineTo(422, 128);
        ctx.closePath();
        ctx.fill();

        // 上下の細ライン
        ctx.fillRect(0, 0, 512, 8);
        ctx.fillRect(0, 120, 512, 8);

        ctx.fillStyle = textHex;
        ctx.font = 'italic bold 44px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 66);

        return this.registerTexture(canvas, 1, 1);
    },

    createArenaDisplayTexture(title, subTitle, bgHex, accentHex, textHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bgHex;
        ctx.fillRect(0, 0, 1024, 256);

        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, 1004, 236);

        ctx.fillStyle = accentHex;
        ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(subTitle, 512, 75);

        ctx.fillStyle = textHex;
        ctx.font = 'italic 900 84px "Segoe UI", Arial, sans-serif';
        ctx.fillText(title, 512, 175);

        return this.registerTexture(canvas, 1, 1);
    },

    // ハート形状のメッシュを生成するヘルパー関数
    createHeartMesh(color, scale = 0.04) {
        const x = 0, y = 0;
        const heartShape = new THREE.Shape();
        heartShape.moveTo(x + 5, y + 5);
        heartShape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
        heartShape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
        heartShape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
        heartShape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
        heartShape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
        heartShape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);

        const geometry = new THREE.ShapeGeometry(heartShape);
        geometry.center();
        const material = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.PI;
        mesh.scale.set(scale, scale, scale);
        return mesh;
    },

    // 共通：コート白線の構築
    buildCourtLines(group, courtWidth, courtLength) {
        const halfW = courtWidth / 2;
        const halfL = courtLength / 2;
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

        const createLineMesh = (w, h, x, z) => {
            const geo = new THREE.PlaneGeometry(w, h);
            const m = new THREE.Mesh(geo, lineMat);
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, 0.015, z);
            group.add(m);
        };

        const lw = 0.08;
        createLineMesh(courtWidth, lw, 0, -halfL);
        createLineMesh(courtWidth, lw, 0, halfL);
        createLineMesh(lw, courtLength, -halfW, 0);
        createLineMesh(lw, courtLength, halfW, 0);

        const singleLineOffset = halfW * 0.15;
        createLineMesh(lw, courtLength, -halfW + singleLineOffset, 0);
        createLineMesh(lw, courtLength, halfW - singleLineOffset, 0);

        const shortServiceZ = halfL * 0.295;
        createLineMesh(courtWidth, lw, 0, -shortServiceZ);
        createLineMesh(courtWidth, lw, 0, shortServiceZ);

        const doubleLongServiceOffset = halfL * 0.113;
        createLineMesh(courtWidth, lw, 0, -halfL + doubleLongServiceOffset);
        createLineMesh(courtWidth, lw, 0, halfL - doubleLongServiceOffset);

        const centerLineLength = halfL - shortServiceZ;
        const centerLineZNorth = -shortServiceZ - (centerLineLength / 2);
        const centerLineZSouth = shortServiceZ + (centerLineLength / 2);
        createLineMesh(lw, centerLineLength, 0, centerLineZNorth);
        createLineMesh(lw, centerLineLength, 0, centerLineZSouth);
        createLineMesh(courtWidth, lw, 0, 0);
    },

    // 共通：ネットとポストの構築
    buildNet(group, courtWidth, netHeight, postColor, padColor, netMeshColor) {
        const halfW = courtWidth / 2;
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, netHeight, 12);
        const postMat = new THREE.MeshStandardMaterial({ color: postColor, metalness: 0.7, roughness: 0.3 });
        const postBaseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.22, 16);
        const postBaseMat = new THREE.MeshStandardMaterial({ color: padColor, roughness: 0.6 });

        [-halfW - 0.12, halfW + 0.12].forEach(px => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(px, netHeight / 2, 0);
            group.add(post);

            const base = new THREE.Mesh(postBaseGeo, postBaseMat);
            base.position.set(px, 0.11, 0);
            group.add(base);
        });

        const netH = 0.76;
        const netTex = this.createNetTexture(netMeshColor);
        const netGeo = new THREE.PlaneGeometry(courtWidth, netH);
        const netMat = new THREE.MeshBasicMaterial({
            map: netTex,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const net = new THREE.Mesh(netGeo, netMat);
        net.position.set(0, netHeight - netH / 2, 0);
        group.add(net);

        // トップの白帯（立体感のあるボックスに変更）
        const tapeGeo = new THREE.BoxGeometry(courtWidth + 0.04, 0.075, 0.02);
        const tapeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.set(0, netHeight - 0.0375, 0);
        group.add(tape);

        // サイドテープ
        const sideTapeGeo = new THREE.BoxGeometry(0.04, netH, 0.015);
        [-halfW, halfW].forEach(sx => {
            const st = new THREE.Mesh(sideTapeGeo, tapeMat);
            st.position.set(sx, netHeight - netH / 2, 0);
            group.add(st);
        });
    },

    // 共通：審判台＆選手用ベンチの構築
    buildCourtSideProps(group, courtWidth, theme) {
        const halfW = courtWidth / 2;

        // 1. 審判台（左側ネット横：プレイヤーの視界や移動と干渉しない位置）
        const chairGroup = new THREE.Group();
        const frameMat = new THREE.MeshStandardMaterial({ color: theme.chairFrame, metalness: 0.5, roughness: 0.4 });
        const seatMat = new THREE.MeshStandardMaterial({ color: theme.chairSeat, roughness: 0.5 });

        // 4本の脚
        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8);
        [[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(legGeo, frameMat);
            leg.position.set(lx, 0.95, lz);
            chairGroup.add(leg);
        });
        // 座面と背もたれ
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.56), seatMat);
        seat.position.set(0, 1.9, 0);
        chairGroup.add(seat);

        const backRest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.56), seatMat);
        backRest.position.set(-0.27, 2.2, 0);
        chairGroup.add(backRest);

        // 踏み板
        const stepGeo = new THREE.BoxGeometry(0.56, 0.04, 0.14);
        [0.45, 0.9, 1.35].forEach(sy => {
            const step = new THREE.Mesh(stepGeo, frameMat);
            step.position.set(0, sy, 0.28);
            chairGroup.add(step);
        });

        chairGroup.position.set(-halfW - 1.65, 0, 0);
        group.add(chairGroup);

        // 2. 選手用ベンチ（右側ネット横のプレイヤー側・NPC側）
        const buildBench = (zPos) => {
            const bench = new THREE.Group();
            const top = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 2.2), seatMat);
            top.position.set(0, 0.45, 0);
            bench.add(top);

            const bLegGeo = new THREE.BoxGeometry(0.45, 0.44, 0.08);
            [-0.9, 0.9].forEach(bz => {
                const bl = new THREE.Mesh(bLegGeo, frameMat);
                bl.position.set(0, 0.22, bz);
                bench.add(bl);
            });

            // タオル・ボトル風小物
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.42), new THREE.MeshStandardMaterial({ color: theme.accentColor, roughness: 0.4 }));
            box.position.set(0, 0.57, 0.55);
            bench.add(box);

            bench.position.set(halfW + 1.85, 0, zPos);
            group.add(bench);
        };
        buildBench(2.6);
        buildBench(-2.6);
    },

    // 共通：バナー付きクッションパネル
    buildPerimeterBanners(group, courtWidth, courtLength, bannerList, frameColor) {
        const halfW = courtWidth / 2;
        const halfL = courtLength / 2;
        const panelHeight = 0.85;
        const panelThickness = 0.16;

        const boundaryX = halfW + 3.0;
        const boundaryZ = halfL + 4.0;
        const panelWidthZ = 3.5;
        const panelWidthX = 4.45;

        const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.5 });
        const panelGeoZ = new THREE.BoxGeometry(panelWidthZ, panelHeight, panelThickness);
        const panelGeoX = new THREE.BoxGeometry(panelWidthX, panelHeight, panelThickness);
        const faceGeoZ = new THREE.PlaneGeometry(panelWidthZ - 0.12, panelHeight - 0.12);
        const faceGeoX = new THREE.PlaneGeometry(panelWidthX - 0.12, panelHeight - 0.12);

        const faceMaterials = bannerList.map(tex => new THREE.MeshBasicMaterial({ map: tex }));

        let idx = 0;
        const createPanel = (x, z, rotY, isXPanel) => {
            const mesh = new THREE.Mesh(isXPanel ? panelGeoX : panelGeoZ, frameMat);
            mesh.position.set(x, panelHeight / 2, z);
            mesh.rotation.y = rotY;

            const face = new THREE.Mesh(isXPanel ? faceGeoX : faceGeoZ, faceMaterials[idx % faceMaterials.length]);
            face.position.set(0, 0, panelThickness / 2 + 0.01);
            mesh.add(face);

            group.add(mesh);
            idx++;
        };

        for (let z = -boundaryZ + (panelWidthZ / 2); z <= boundaryZ - (panelWidthZ / 2); z += panelWidthZ) {
            createPanel(-boundaryX, z, Math.PI / 2, false);
            createPanel(boundaryX, z, -Math.PI / 2, false);
        }

        const startX = -boundaryX + panelThickness / 2 + (panelWidthX / 2);
        const endX = boundaryX - panelThickness / 2 - (panelWidthX / 2);
        for (let x = startX; x <= endX + 0.01; x += panelWidthX) {
            createPanel(x, -boundaryZ, 0, true);
            createPanel(x, boundaryZ, Math.PI, true);
        }
    },

    // 共通：最適化された観客席の構築
    buildSpectatorStands(group, halfL, stepColor, railColor, spectatorColors) {
        const standRows = 4;
        const standStepHeight = 0.65;
        const standStepDepth = 1.25;
        const standWidth = 44;

        const stepMat = new THREE.MeshStandardMaterial({ color: stepColor, roughness: 0.8 });
        const railMat = new THREE.MeshStandardMaterial({ color: railColor, metalness: 0.6, roughness: 0.3 });
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
        const spectatorMats = spectatorColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 }));

        // 共有ジオメトリ
        const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.52, 8);
        const headGeo = new THREE.SphereGeometry(0.17, 8, 8);
        const railGeo = new THREE.BoxGeometry(standWidth, 0.06, 0.06);
        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6);

        const buildStand = (posX, posZ, rotY) => {
            const standGroup = new THREE.Group();

            // 最前列手すり
            const frontRail = new THREE.Mesh(railGeo, railMat);
            frontRail.position.set(0, 0.85, -0.55);
            standGroup.add(frontRail);
            for (let rx = -standWidth / 2 + 2; rx <= standWidth / 2 - 2; rx += 4) {
                const p = new THREE.Mesh(postGeo, railMat);
                p.position.set(rx, 0.425, -0.55);
                standGroup.add(p);
            }

            for (let i = 0; i < standRows; i++) {
                const stepH = standStepHeight * (i + 1);
                const stepGeo = new THREE.BoxGeometry(standWidth, stepH, standStepDepth);
                const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                stepMesh.position.set(0, stepH / 2, i * standStepDepth);
                standGroup.add(stepMesh);

                const spectatorCount = 22;
                for (let j = 0; j < spectatorCount; j++) {
                    const specX = ((j + 0.5) / spectatorCount - 0.5) * (standWidth - 3) + (Math.random() - 0.5) * 0.8;
                    const specY = stepH + 0.26;
                    const specZ = (i * standStepDepth) + (Math.random() - 0.5) * 0.3;

                    const specMat = spectatorMats[Math.floor(Math.random() * spectatorMats.length)];
                    const specBody = new THREE.Mesh(bodyGeo, specMat);
                    specBody.position.set(specX, specY, specZ);

                    const specHead = new THREE.Mesh(headGeo, headMat);
                    specHead.position.set(0, 0.36, 0);
                    specBody.add(specHead);

                    standGroup.add(specBody);
                }
            }
            standGroup.position.set(posX, 0, posZ);
            standGroup.rotation.y = rotY;
            group.add(standGroup);
        };

        buildStand(0, -halfL - 10.5, 0);
        buildStand(0, halfL + 10.5, Math.PI);
    },

    // 共通：アリーナ壁・柱・電光掲示板・天井トラス＆照明
    buildArenaStructure(group, halfW, halfL, theme) {
        const wallMat = new THREE.MeshStandardMaterial({ color: theme.wallColor, roughness: 0.9 });
        const pillarMat = new THREE.MeshStandardMaterial({ color: theme.pillarColor, roughness: 0.7 });
        const windowMat = new THREE.MeshBasicMaterial({ color: theme.windowColor });

        // 奥壁・手前壁・左右壁
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(52, 18), wallMat);
        backWall.position.set(0, 9, -25);
        group.add(backWall);

        const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(52, 18), wallMat);
        frontWall.position.set(0, 9, 27);
        frontWall.rotation.y = Math.PI;
        group.add(frontWall);

        const sideWallGeo = new THREE.PlaneGeometry(54, 18);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.position.set(-23, 9, 1);
        leftWall.rotation.y = Math.PI / 2;
        group.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.position.set(23, 9, 1);
        rightWall.rotation.y = -Math.PI / 2;
        group.add(rightWall);

        // 奥の壁の柱＆高窓
        const pillarGeo = new THREE.BoxGeometry(0.8, 18, 0.8);
        const winGeo = new THREE.PlaneGeometry(3.4, 2.2);
        for (let px = -20; px <= 20; px += 8) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(px, 9, -24.7);
            group.add(pillar);

            if (px < 20) {
                const win = new THREE.Mesh(winGeo, windowMat);
                win.position.set(px + 4, 14.5, -24.85);
                group.add(win);
            }
        }

        // アリーナ中央 大型ビジョン（奥壁）
        const boardFrame = new THREE.Mesh(
            new THREE.BoxGeometry(11.4, 3.1, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 })
        );
        boardFrame.position.set(0, 8.2, -24.6);
        group.add(boardFrame);

        const boardScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(10.8, 2.6),
            new THREE.MeshBasicMaterial({ map: theme.arenaDisplayTex })
        );
        boardScreen.position.set(0, 8.2, -24.38);
        group.add(boardScreen);

        // 天井トラス構造
        const trussMat = new THREE.MeshStandardMaterial({ color: theme.trussColor, metalness: 0.7, roughness: 0.4 });
        const beamGeo = new THREE.BoxGeometry(46, 0.35, 0.35);
        [-12, -4, 4, 12].forEach(tz => {
            const beam = new THREE.Mesh(beamGeo, trussMat);
            beam.position.set(0, 15.2, tz);
            group.add(beam);
        });

        // 競技用天井LEDスポットライト
        const fixtureGeo = new THREE.BoxGeometry(1.2, 0.25, 0.8);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
        const emitterGeo = new THREE.PlaneGeometry(1.0, 0.6);
        const emitterMat = new THREE.MeshBasicMaterial({ color: theme.lightEmitterColor });
        const lightConeGeo = new THREE.CylinderGeometry(0.45, 4.5, 15, 24, 1, true);
        const lightConeMat = new THREE.MeshBasicMaterial({
            color: theme.lightConeColor,
            transparent: true,
            opacity: 0.045,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const setupCeilingLight = (x, z) => {
            const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixture.position.set(x, 14.95, z);
            group.add(fixture);

            const emitter = new THREE.Mesh(emitterGeo, emitterMat);
            emitter.rotation.x = Math.PI / 2;
            emitter.position.set(x, 14.81, z);
            group.add(emitter);

            const cone = new THREE.Mesh(lightConeGeo, lightConeMat);
            cone.position.set(x, 7.4, z);
            group.add(cone);

            const spotLight = new THREE.SpotLight(theme.spotLightColor, 0.35);
            spotLight.position.set(x, 14.7, z);
            spotLight.target.position.set(x, 0, z);
            spotLight.angle = Math.PI / 4;
            spotLight.penumbra = 0.8;
            spotLight.distance = 26;
            group.add(spotLight);
            group.add(spotLight.target);
        };

        setupCeilingLight(-halfW + 1.2, -halfL + 2.5);
        setupCeilingLight(halfW - 1.2, -halfL + 2.5);
        setupCeilingLight(-halfW + 1.2, halfL - 2.5);
        setupCeilingLight(halfW - 1.2, halfL - 2.5);
    },

    // -----------------------------------------------------
    // 1. NORMAL (体育館アリーナ) 環境の構築
    // -----------------------------------------------------
    buildGymEnvironment(group, scene, options) {
        const { courtWidth, courtLength, netHeight } = options;
        const halfW = courtWidth / 2;
        const halfL = courtLength / 2;

        scene.background = new THREE.Color(0x1f2d24);
        scene.fog = new THREE.FogExp2(0x1f2d24, 0.009);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        group.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfffdf5, 0.45);
        dirLight.position.set(10, 25, 12);
        group.add(dirLight);

        // 体育館木目フローリング
        const woodTex = this.createWoodFloorTexture('#c48f5a', '#b37e49', '#6e4720');
        const groundGeo = new THREE.PlaneGeometry(70, 70);
        const groundMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.42, metalness: 0.05 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        group.add(ground);

        // 大会用外枠サラウンドマット（濃緑）
        const surroundMat = new THREE.MeshStandardMaterial({ color: 0x134229, roughness: 0.7 });
        const surround = new THREE.Mesh(new THREE.PlaneGeometry(courtWidth + 3.2, courtLength + 4.4), surroundMat);
        surround.rotation.x = -Math.PI / 2;
        surround.position.y = 0.005;
        group.add(surround);

        // メインコートマット
        const courtTex = this.createCourtMatTexture('#1b6b42', '#145232');
        const courtGeo = new THREE.PlaneGeometry(courtWidth, courtLength);
        const courtMat = new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.65, metalness: 0.05 });
        const court = new THREE.Mesh(courtGeo, courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.01;
        group.add(court);

        if (!options.isTableTennis) {
            this.buildCourtLines(group, courtWidth, courtLength);
            this.buildNet(group, courtWidth, netHeight, 0x333333, 0x1b6b42, '#2a1810');
        }

        this.buildCourtSideProps(group, courtWidth, {
            chairFrame: 0xcccccc,
            chairSeat: 0x1b5e3a,
            accentColor: 0xff9500
        });

        const banners = [
            this.createBannerTexture('BADMINTON PRO', '#14243b', '#ff9500', '#ffffff'),
            this.createBannerTexture('SMASH SERIES', '#1b472d', '#ffd700', '#ffffff'),
            this.createBannerTexture('ARENA CHAMPION', '#222222', '#34c759', '#ffffff')
        ];
        this.buildPerimeterBanners(group, courtWidth, courtLength, banners, 0x1e1e1e);

        this.buildSpectatorStands(
            group,
            halfL,
            0x2b3036,
            0x888e96,
            [0xd9383a, 0x2c6fdb, 0x2fa84f, 0xedb826, 0x8e44ad, 0x16a085, 0xecf0f1]
        );

        const displayTex = this.createArenaDisplayTexture(
            'GRAND PRIX',
            'WORLD BADMINTON SERIES',
            '#0e1726',
            '#ffd700',
            '#ffffff'
        );
        this.buildArenaStructure(group, halfW, halfL, {
            wallColor: 0x2a3630,
            pillarColor: 0x1d2622,
            windowColor: 0x8ecae6,
            trussColor: 0x3b444b,
            lightEmitterColor: 0xffffff,
            lightConeColor: 0xfffbe0,
            spotLightColor: 0xffffff,
            arenaDisplayTex: displayTex
        });
    },

    // -----------------------------------------------------
    // 2. CUTE (ピンク・ハートアリーナ) 環境の構築
    // -----------------------------------------------------
    buildCuteEnvironment(group, scene, options) {
        const { courtWidth, courtLength, netHeight } = options;
        const halfW = courtWidth / 2;
        const halfL = courtLength / 2;

        scene.background = new THREE.Color(0xd98fa0);
        scene.fog = new THREE.FogExp2(0xd98fa0, 0.008);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
        group.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff5f8, 0.42);
        dirLight.position.set(10, 25, 12);
        group.add(dirLight);

        // パステルピンクの明るいフローリング
        const cuteWoodTex = this.createWoodFloorTexture('#f2c2ce', '#e8b3c0', '#c77f93');
        const groundGeo = new THREE.PlaneGeometry(70, 70);
        const groundMat = new THREE.MeshStandardMaterial({ map: cuteWoodTex, roughness: 0.4, metalness: 0.05 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        group.add(ground);

        // 外枠サラウンドマット（濃ローズピンク）
        const surroundMat = new THREE.MeshStandardMaterial({ color: 0xb83b68, roughness: 0.65 });
        const surround = new THREE.Mesh(new THREE.PlaneGeometry(courtWidth + 3.2, courtLength + 4.4), surroundMat);
        surround.rotation.x = -Math.PI / 2;
        surround.position.y = 0.005;
        group.add(surround);

        // メインコートマット（スイートチェリーピンク）
        const courtTex = this.createCourtMatTexture('#e65582', '#d1436f');
        const courtGeo = new THREE.PlaneGeometry(courtWidth, courtLength);
        const courtMat = new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.55, metalness: 0.05 });
        const court = new THREE.Mesh(courtGeo, courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.01;
        group.add(court);

        // コート中央および四隅のハート装飾
        const bigHeart = this.createHeartMesh(0xffb6c1, 0.24);
        bigHeart.position.set(0, 0.012, 0);
        group.add(bigHeart);

        const hOffsetW = halfW - 1.2;
        const hOffsetL = halfL - 1.2;
        [
            { x: -hOffsetW, z: -hOffsetL },
            { x: hOffsetW, z: -hOffsetL },
            { x: -hOffsetW, z: hOffsetL },
            { x: hOffsetW, z: hOffsetL }
        ].forEach(pos => {
            const heart = this.createHeartMesh(0xffffff, 0.055);
            heart.position.set(pos.x, 0.012, pos.z);
            heart.rotation.z = pos.z > 0 ? 0 : Math.PI;
            group.add(heart);
        });

       if (!options.isTableTennis) {
            this.buildCourtLines(group, courtWidth, courtLength);
            this.buildNet(group, courtWidth, netHeight, 0xffffff, 0xff69b4, '#ff1493');
        }

        this.buildCourtSideProps(group, courtWidth, {
            chairFrame: 0xffffff,
            chairSeat: 0xff69b4,
            accentColor: 0xff1493
        });

        const banners = [
            this.createBannerTexture('CUTE CUP ♥', '#ff85b3', '#ffffff', '#ffffff'),
            this.createBannerTexture('LOVELY SMASH', '#d94c82', '#ffb6c1', '#ffffff'),
            this.createBannerTexture('SWEET ARENA', '#ff69b4', '#ffe4ec', '#ffffff')
        ];
        this.buildPerimeterBanners(group, courtWidth, courtLength, banners, 0xffffff);

        // 白い羽の視認性を維持するため、観客席階段を濃チェリーマゼンタにし、観客服から白を除外
        this.buildSpectatorStands(
            group,
            halfL,
            0xa32457,
            0xffc0cb,
            [0xffb6c1, 0x87cefa, 0x98fb98, 0xffe4b5, 0xdda0dd, 0xff1493]
        );

        const displayTex = this.createArenaDisplayTexture(
            '♥ CUTE CUP ♥',
            'DREAM BADMINTON STAGE',
            '#7a1c44',
            '#ffb6c1',
            '#ffffff'
        );
        this.buildArenaStructure(group, halfW, halfL, {
            wallColor: 0xd98fa0,
            pillarColor: 0xc27084,
            windowColor: 0xffe6ee,
            trussColor: 0xf5d0db,
            lightEmitterColor: 0xfff0f5,
            lightConeColor: 0xffb6c1,
            spotLightColor: 0xfff0f5,
            arenaDisplayTex: displayTex
        });
    }
};