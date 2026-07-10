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
        
        // 打点の高さ(start.y)に基づいて角度を決定
        // ネットの高さは約2.2。打点が低い(2.3付近)ときは水平に近い
        // 高い(3.0以上)ときは鋭角(0.35)に突き刺す
        const heightFactor = Math.max(0, Math.min(1, (start.y - 2.2) / 1.2)); 
        const downwardAngle = heightFactor * 0.35; 
        
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
        // 初速倍率を1.06に抑え、ふんわりとしたやさしい山なりのドロップショットにします
        shuttlePhys.vel.multiplyScalar(1.06);
    }
};