const EnvironmentManager = {
    environmentGroup: null,

    // 古いコート環境を削除し、メモリを解放する
    clearEnvironment(scene) {
        if (this.environmentGroup) {
            scene.remove(this.environmentGroup);
            this.environmentGroup.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.environmentGroup = null;
        }
    },

    // 外部から呼ばれるコート構築のメイン関数
    buildCourt(scene, type, options) {
        this.clearEnvironment(scene);
        this.environmentGroup = new THREE.Group();

        if (type === 'cute') {
            this.buildCuteEnvironment(this.environmentGroup, scene, options);
        } else {
            // デフォルト: gym (ノーマル)
            this.buildGymEnvironment(this.environmentGroup, scene, options);
        }

        scene.add(this.environmentGroup);
    },

    // ハート形状のメッシュを生成するヘルパー関数
    createHeartMesh(color, scale = 0.04) {
        const x = 0, y = 0;
        const heartShape = new THREE.Shape();
        heartShape.moveTo( x + 5, y + 5 );
        heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
        heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7, x - 6, y + 7 );
        heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
        heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
        heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
        heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );

        const geometry = new THREE.ShapeGeometry( heartShape );
        // 中心を合わせて回転しやすくする
        geometry.center();
        const material = new THREE.MeshBasicMaterial( { color: color, side: THREE.DoubleSide } );
        const mesh = new THREE.Mesh( geometry, material );
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.PI; // 上下を正しい向きに
        mesh.scale.set(scale, scale, scale);
        
        return mesh;
    },

    // -----------------------------------------------------
    // 1. NORMAL (体育館) 環境の構築
    // -----------------------------------------------------
    buildGymEnvironment(group, scene, options) {
        const { courtWidth, courtLength, netHeight } = options;

        // 背景色の設定
        scene.background = new THREE.Color(0x3a7d44);
        scene.fog = new THREE.FogExp2(0x3a7d44, 0.015);

        // 照明の設定
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
        group.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight.position.set(10, 25, 10);
        group.add(dirLight);

        // グラウンド（体育館の床）
        const groundGeo = new THREE.PlaneGeometry(120, 120);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x1d3a24, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        group.add(ground);

        // バドミントンコート床面
        const courtGeo = new THREE.PlaneGeometry(courtWidth, courtLength);
        const courtMat = new THREE.MeshStandardMaterial({ color: 0x1b5e3a, roughness: 0.6, metalness: 0.1 });
        const court = new THREE.Mesh(courtGeo, courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.01;
        group.add(court);

        // 白線の描画
        const createLineMesh = (w, h, x, z) => {
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = -Math.PI / 2; 
            m.position.set(x, 0.015, z);
            group.add(m);
        };

        const lw = 0.08;
        const halfW = courtWidth / 2;
        const halfL = courtLength / 2;

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

        // ネットとポスト
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, netHeight);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(-halfW - 0.1, netHeight/2, 0);
        const postR = postL.clone(); 
        postR.position.x = halfW + 0.1;
        group.add(postL); 
        group.add(postR);

        const netH = 0.75;
        const netGeo = new THREE.PlaneGeometry(courtWidth, netH, 40, 5);
        const netMat = new THREE.MeshPhongMaterial({ color: 0x4e2715, wireframe: true, transparent: true, opacity: 0.75 });
        const net = new THREE.Mesh(netGeo, netMat);
        net.position.set(0, netHeight - netH / 2, 0);
        group.add(net);

        const tapeGeo = new THREE.PlaneGeometry(courtWidth, 0.08);
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.set(0, netHeight - 0.04, 0.005);
        group.add(tape);

        // 衝突用クッションパネル
        const panelHeight = 0.8;
        const panelThickness = 0.2;
        const cushionColor = 0xc5b13c; 

        const boundaryX = halfW + 3.0; 
        const boundaryZ = halfL + 4.0; 
        const panelWidthZ = 3.5;
        const panelGeoZ = new THREE.BoxGeometry(panelWidthZ, panelHeight, panelThickness);
        const panelWidthX = 4.45;
        const panelGeoX = new THREE.BoxGeometry(panelWidthX, panelHeight, panelThickness);

        const createCushionPanel = (x, z, rotationY, isXPanel) => {
            const panelGeo = isXPanel ? panelGeoX : panelGeoZ;
            const currentWidth = isXPanel ? panelWidthX : panelWidthZ;

            const panelMat = new THREE.MeshStandardMaterial({ color: cushionColor, roughness: 0.5 });
            const panelMesh = new THREE.Mesh(panelGeo, panelMat);
            panelMesh.position.set(x, panelHeight / 2, z);
            panelMesh.rotation.y = rotationY;
            group.add(panelMesh);

            const faceGeo = new THREE.PlaneGeometry(currentWidth - 0.1, panelHeight - 0.1);
            const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
            const faceMesh = new THREE.Mesh(faceGeo, faceMat);
            faceMesh.position.set(0, 0, panelThickness / 2 + 0.01);
            panelMesh.add(faceMesh);
        };

        for (let z = -boundaryZ + (panelWidthZ / 2); z <= boundaryZ - (panelWidthZ / 2); z += panelWidthZ) {
            createCushionPanel(-boundaryX, z, Math.PI / 2, false);
            createCushionPanel(boundaryX, z, -Math.PI / 2, false);
        }

        const startX = -boundaryX + panelThickness / 2 + (panelWidthX / 2); 
        const endX = boundaryX - panelThickness / 2 - (panelWidthX / 2);   
        for (let x = startX; x <= endX + 0.01; x += panelWidthX) {
            createCushionPanel(x, -boundaryZ, 0, true);
            createCushionPanel(x, boundaryZ, Math.PI, true);
        }

        // 観客席
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
                stepMesh.position.set(0, stepH / 2, i * stepD);
                standGroup.add(stepMesh);

                const spectatorCount = 18;
                const spectatorColors = [0xdd3333, 0x3333dd, 0x33dd33, 0xdddd33, 0xdd33dd, 0x33dddd, 0xeeeeee];
                for (let j = 0; j < spectatorCount; j++) {
                    const specX = (Math.random() - 0.5) * (stepW - 2);
                    const specY = stepH + 0.3; 
                    const specZ = (i * stepD) + (Math.random() - 0.5) * 0.4;
                    const bodyGeo = new THREE.BoxGeometry(0.35, 0.5, 0.35);
                    const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
                    const specColor = spectatorColors[Math.floor(Math.random() * spectatorColors.length)];
                    const specMat = new THREE.MeshStandardMaterial({ color: specColor, roughness: 0.7 });
                    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 }); 

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
            group.add(standGroup);
        };

        buildStands(0, -halfL - 11.0, 0);
        buildStands(0, halfL + 11.0, Math.PI);

        // 天井ライトアップ効果
        const lightFixtureGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 16);
        const lightFixtureMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
        const lightConeGeo = new THREE.CylinderGeometry(0.4, 4.5, 15, 32, 1, true);
        const lightConeMat = new THREE.MeshBasicMaterial({ color: 0xfffbe0, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false });

        const setupCeilingLight = (x, z) => {
            const fixture = new THREE.Mesh(lightFixtureGeo, lightFixtureMat);
            fixture.position.set(x, 15, z);
            group.add(fixture);

            const cone = new THREE.Mesh(lightConeGeo, lightConeMat);
            cone.position.set(x, 7.5, z);
            group.add(cone);

            const spotLight = new THREE.SpotLight(0xffffff, 0.35);
            spotLight.position.set(x, 14.8, z);
            spotLight.target.position.set(x, 0, z);
            spotLight.angle = Math.PI / 4;
            spotLight.penumbra = 0.8;
            spotLight.distance = 25;
            group.add(spotLight);
            group.add(spotLight.target);
        };

        setupCeilingLight(-halfW + 1, -halfL + 2);
        setupCeilingLight(halfW - 1, -halfL + 2);
        setupCeilingLight(-halfW + 1, halfL - 2);
        setupCeilingLight(halfW - 1, halfL - 2);
    },

   // -----------------------------------------------------
    // 2. CUTE (ピンク・ハート) 環境の構築
    // -----------------------------------------------------
    buildCuteEnvironment(group, scene, options) {
        const { courtWidth, courtLength, netHeight } = options;
        const halfW = courtWidth / 2;
        const halfL = courtLength / 2;

        // 背景色とフォグ：くすみを減らし、明るく可愛らしいストロベリーピンク(0xe8a7b1)に調整
        scene.background = new THREE.Color(0xe8a7b1);
        scene.fog = new THREE.FogExp2(0xe8a7b1, 0.015);

        // 照明の設定
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
        group.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight.position.set(10, 25, 10);
        group.add(dirLight);

        // グラウンド（外側の床: 暗すぎずしっかり彩度を持たせたローズピンク(0xc27a8b)に調整）
        const groundGeo = new THREE.PlaneGeometry(120, 120);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xc27a8b, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        group.add(ground);

        // バドミントンコート床面：明るく華やかなスイートチェリーピンク(0xe65582)に変更
        const courtGeo = new THREE.PlaneGeometry(courtWidth, courtLength);
        const courtMat = new THREE.MeshStandardMaterial({ color: 0xe65582, roughness: 0.5, metalness: 0.1 });
        const court = new THREE.Mesh(courtGeo, courtMat);
        court.rotation.x = -Math.PI / 2;
        court.position.y = 0.01;
        group.add(court);

        // コートの真ん中（ネットの真下）にどでかいハートを描く
        const bigHeart = this.createHeartMesh(0xffffff, 0.25); // スケールを大きくして巨大化
        bigHeart.position.set(0, 0.012, 0); // 中央 (X=0, Z=0)
        group.add(bigHeart);

        // ハートマークの装飾（コートの四隅に配置）
        const heartColor = 0xffffff;
        const hOffsetW = halfW - 1.2;
        const hOffsetL = halfL - 1.2;
        const positions = [
            { x: -hOffsetW, z: -hOffsetL },
            { x: hOffsetW,  z: -hOffsetL },
            { x: -hOffsetW, z: hOffsetL },
            { x: hOffsetW,  z: hOffsetL }
        ];

        positions.forEach(pos => {
            const heart = this.createHeartMesh(heartColor, 0.06);
            heart.position.set(pos.x, 0.012, pos.z); 
            if (pos.z > 0) heart.rotation.z = 0; 
            else heart.rotation.z = Math.PI;     
            group.add(heart);
        });

        // 白線の描画
        const createLineMesh = (w, h, x, z) => {
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const m = new THREE.Mesh(geo, mat);
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

        // ネットとポスト
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, netHeight);
        const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.5 }); 
        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(-halfW - 0.1, netHeight/2, 0);
        const postR = postL.clone(); 
        postR.position.x = halfW + 0.1;
        group.add(postL); 
        group.add(postR);

        const netH = 0.75;
        const netGeo = new THREE.PlaneGeometry(courtWidth, netH, 40, 5);
        const netMat = new THREE.MeshPhongMaterial({ color: 0xff1493, wireframe: true, transparent: true, opacity: 0.85 }); 
        const net = new THREE.Mesh(netGeo, netMat);
        net.position.set(0, netHeight - netH / 2, 0);
        group.add(net);

        const tapeGeo = new THREE.PlaneGeometry(courtWidth, 0.08);
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const tape = new THREE.Mesh(tapeGeo, tapeMat);
        tape.position.set(0, netHeight - 0.04, 0.005);
        group.add(tape);

        // 衝突用クッションパネル (くすみライトピンク)
        const panelHeight = 0.8;
        const panelThickness = 0.2;
        const cushionColor = 0xdbbdc1; // 彩度を落としたグレイッシュピンクでコート全体のトーンと統一

        const boundaryX = halfW + 3.0; 
        const boundaryZ = halfL + 4.0; 
        const panelWidthZ = 3.5;
        const panelGeoZ = new THREE.BoxGeometry(panelWidthZ, panelHeight, panelThickness);
        const panelWidthX = 4.45;
        const panelGeoX = new THREE.BoxGeometry(panelWidthX, panelHeight, panelThickness);

        const createCushionPanel = (x, z, rotationY, isXPanel) => {
            const panelGeo = isXPanel ? panelGeoX : panelGeoZ;
            const currentWidth = isXPanel ? panelWidthX : panelWidthZ;

            const panelMat = new THREE.MeshStandardMaterial({ color: cushionColor, roughness: 0.4 });
            const panelMesh = new THREE.Mesh(panelGeo, panelMat);
            panelMesh.position.set(x, panelHeight / 2, z);
            panelMesh.rotation.y = rotationY;
            group.add(panelMesh);

            const heart = this.createHeartMesh(0xff69b4, 0.04);
            heart.position.set(0, 0, panelThickness / 2 + 0.01);
            heart.rotation.x = 0; 
            heart.rotation.z = Math.PI; 
            panelMesh.add(heart);
        };

        for (let z = -boundaryZ + (panelWidthZ / 2); z <= boundaryZ - (panelWidthZ / 2); z += panelWidthZ) {
            createCushionPanel(-boundaryX, z, Math.PI / 2, false);
            createCushionPanel(boundaryX, z, -Math.PI / 2, false);
        }

        const startX = -boundaryX + panelThickness / 2 + (panelWidthX / 2); 
        const endX = boundaryX - panelThickness / 2 - (panelWidthX / 2);   
        for (let x = startX; x <= endX + 0.01; x += panelWidthX) {
            createCushionPanel(x, -boundaryZ, 0, true);
            createCushionPanel(x, boundaryZ, Math.PI, true);
        }

        // 観客席 (シャトルとの視認性コントラストを確保するため濃いマゼンタピンクに変更)
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
                // 階段の色を、羽（白）の視認性をしっかりキープしつつ彩度を上げたチェリーマゼンタ(0xbd2e65)に変更
                const stepMat = new THREE.MeshStandardMaterial({ color: 0xbd2e65, roughness: 0.8 });
                const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                stepMesh.position.set(0, stepH / 2, i * stepD);
                standGroup.add(stepMesh);

                const spectatorCount = 18;
                // 白い羽の視認性を確保するため、観客の服から白色(0xffffff)を完全に排除
                const spectatorColors = [0xffb6c1, 0x87cefa, 0x98fb98, 0xffe4b5, 0xdda0dd, 0xff1493];
                for (let j = 0; j < spectatorCount; j++) {
                    const specX = (Math.random() - 0.5) * (stepW - 2);
                    const specY = stepH + 0.3; 
                    const specZ = (i * stepD) + (Math.random() - 0.5) * 0.4;
                    const bodyGeo = new THREE.BoxGeometry(0.35, 0.5, 0.35);
                    const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
                    const specColor = spectatorColors[Math.floor(Math.random() * spectatorColors.length)];
                    const specMat = new THREE.MeshStandardMaterial({ color: specColor, roughness: 0.7 });
                    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 }); 

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
            group.add(standGroup);
        };

        buildStands(0, -halfL - 11.0, 0);
        buildStands(0, halfL + 11.0, Math.PI);

        // 天井ライトアップ効果 (ピンク系の光 - シャトルの視認性を妨げない穏やかな光に調整)
        const lightFixtureGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 16);
        const lightFixtureMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.2 });
        const lightConeGeo = new THREE.CylinderGeometry(0.4, 4.5, 15, 32, 1, true);
        // コーン光線の透明度(opacity)を0.1から0.05へ下げて過度なまぶしさをカット
        const lightConeMat = new THREE.MeshBasicMaterial({ color: 0xffb6c1, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false });

        const setupCeilingLight = (x, z) => {
            const fixture = new THREE.Mesh(lightFixtureGeo, lightFixtureMat);
            fixture.position.set(x, 15, z);
            group.add(fixture);

            const cone = new THREE.Mesh(lightConeGeo, lightConeMat);
            cone.position.set(x, 7.5, z);
            group.add(cone);

            const spotLight = new THREE.SpotLight(0xfff0f5, 0.35); 
            spotLight.position.set(x, 14.8, z);
            spotLight.target.position.set(x, 0, z);
            spotLight.angle = Math.PI / 4;
            spotLight.penumbra = 0.8;
            spotLight.distance = 25;
            group.add(spotLight);
            group.add(spotLight.target);
        };

        setupCeilingLight(-halfW + 1, -halfL + 2);
        setupCeilingLight(halfW - 1, -halfL + 2);
        setupCeilingLight(-halfW + 1, halfL - 2);
        setupCeilingLight(halfW - 1, halfL - 2);
    }
};