const BadmintonPhysics = {
    gravity: -12.0,
    airDrag: 0.28,
    terminalVelocity: 26,

    calculateLob(start, target, peakHeight, shuttlePhys) {
        const displacement = new THREE.Vector3().subVectors(target, start);
        const g = -this.gravity;
        const h = Math.max(peakHeight, start.y + 0.5);
        const t1 = Math.sqrt((2 * (h - start.y)) / g);
        const t2 = Math.sqrt((2 * h) / g);
        const totalTime = t1 + t2;
        
        const vx = displacement.x / totalTime;
        const vz = displacement.z / totalTime;
        const vy = g * t1;
        
        shuttlePhys.vel.set(vx, vy, vz);
        shuttlePhys.vel.multiplyScalar(1.22);
    },

    calculateSmash(start, target, power, shuttlePhys) {
        // パワー(50-100)をスピード因子に変換
        const speedFactor = 22 + (power / 100) * 12; 
        const direction = new THREE.Vector3().subVectors(target, start);
        direction.normalize();
        
        // 打撃の高さに基づいて下向きの角度を決定
        // ネット引っかかりを回避するため最低下向き角度を0.05まで下げ、高い位置(ジャンプ)から打った時のみ深く突き刺さる(最大0.43)ように再調整
        const heightFactor = Math.max(0, Math.min(1, (start.y - 2.1) / 1.2)); 
        const downwardAngle = 0.06 + heightFactor * 0.36; 
        
        direction.y = -downwardAngle; 
        direction.normalize();
        
        shuttlePhys.vel.copy(direction).multiplyScalar(speedFactor);
    },

    // 新規追加：ネット際にふんわりと沈めるドロップショット用の物理計算
    calculateDrop(start, target, peakHeight, shuttlePhys) {
        const displacement = new THREE.Vector3().subVectors(target, start);
        const g = -this.gravity;
        // ピーク高さを最低3.2mに引き上げ、手前で落ちるまでの滞空時間を稼ぎ、追いつきやすく修正
        const h = Math.max(peakHeight, start.y + 0.2, 3.2);
        const t1 = Math.sqrt((2 * (h - start.y)) / g);
        const t2 = Math.sqrt((2 * h) / g);
        const totalTime = t1 + t2;
        
        const vx = displacement.x / totalTime;
        const vz = displacement.z / totalTime;
        const vy = g * t1;
        
        shuttlePhys.vel.set(vx, vy, vz);
        // 初速倍率を1.06から0.92へ大きく引き下げ、シャトルの落下速度をさらに遅くマイルドにします
        shuttlePhys.vel.multiplyScalar(0.92);
    }
};