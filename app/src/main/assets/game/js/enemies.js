/* ============================================================
   SKYWARD SALVAGE — enemies.js
   Drone / speeder / brute + quản lý đợt (wave).
   ============================================================ */

function hexToRgb(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const ENEMY_TYPES = {
  drone: {
    hp: 32, speed: 4.6, damage: 9, score: 100, radius: 1.15, range: 17,
    fireRate: 2.7, color: 0xd8483a, glow: 0xff5a3d, scale: 1, hover: 2.1
  },
  speeder: {
    hp: 20, speed: 8.4, damage: 7, score: 150, radius: 0.95, range: 14,
    fireRate: 1.9, color: 0xff9a3d, glow: 0xffc06a, scale: 0.85, hover: 1.7
  },
  brute: {
    hp: 115, speed: 2.8, damage: 20, score: 300, radius: 1.75, range: 19,
    fireRate: 3.5, color: 0x9a5fd0, glow: 0xc07aff, scale: 1.65, hover: 2.5
  },
  boss: {
    hp: 980, speed: 1.9, damage: 23, score: 1500, radius: 2.8, range: 26,
    fireRate: 1.2, color: 0x7c2637, glow: 0xff4d68, scale: 2.05, hover: 3.2
  }
};


const ENEMY_PROJECTILE_RESOURCES = Object.create(null);
function acquireEnemyProjectileResources(type, glow) {
  let resources = ENEMY_PROJECTILE_RESOURCES[type];
  if (!resources) {
    resources = {
      geometry: new THREE.SphereGeometry(0.22, 8, 6),
      material: new THREE.MeshBasicMaterial({ color: glow }),
      spriteMaterial: new THREE.SpriteMaterial({ map: getGlowTexture(), color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }),
      refs: 0
    };
    ENEMY_PROJECTILE_RESOURCES[type] = resources;
  }
  resources.refs++;
  return resources;
}
function releaseEnemyProjectileResources(type, resources) {
  if (!resources) return;
  resources.refs = Math.max(0, resources.refs - 1);
  if (resources.refs === 0) {
    resources.geometry.dispose();
    resources.material.dispose();
    resources.spriteMaterial.dispose();
    delete ENEMY_PROJECTILE_RESOURCES[type];
  }
}

class Enemy {
  constructor(scene, particles, sound, type, pos, hpMul) {
    const cfg = ENEMY_TYPES[type];
    this.type = type;
    this.cfg = cfg;
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.isBoss = type === 'boss';
    this.hp = Math.round(cfg.hp * (hpMul || 1));
    this.maxHp = this.hp;
    this.alive = true; this.disposed = false;
    this.radius = cfg.radius;
    this.score = cfg.score;
    this.moveSpeed = cfg.speed; this.fireRate = cfg.fireRate;
    this.fireTimer = 1.2 + Math.random() * cfg.fireRate;
    this.spawnT = 0.7;
    this.strafePhase = Math.random() * Math.PI * 2;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.t = 0;
    this.flinchT = 0;
    this.flinchDir = new THREE.Vector3();

    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: cfg.color, roughness: 0.45, metalness: 0.6,
      emissive: cfg.glow, emissiveIntensity: 0.12
    });
    const bodyGeo = this.isBoss ? new THREE.DodecahedronGeometry(cfg.radius * 0.72, 1) :
      (type === 'speeder' ? new THREE.OctahedronGeometry(cfg.radius * 0.78, 0) :
      (type === 'brute' ? new THREE.DodecahedronGeometry(cfg.radius * 0.75, 0) : new THREE.IcosahedronGeometry(cfg.radius * 0.72, 0)));
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.userData.enemy = this;
    body.userData.hitTarget = true;
    g.add(body);
    this.body = body;
    this.bodyMat = bodyMat;

    const eyeMat = new THREE.MeshStandardMaterial({ color: cfg.glow, emissive: cfg.glow, emissiveIntensity: 2.2 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 0.22, 12, 10), eyeMat);
    eye.position.set(0, cfg.radius * 0.12, cfg.radius * 0.62);
    g.add(eye);
    this.eye = eye;

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.5, metalness: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.radius * 0.95, cfg.radius * 0.07, 6, 20), ringMat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    this.ring = ring;

    const jetMat = new THREE.MeshBasicMaterial({ color: cfg.glow, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const jet = new THREE.Mesh(new THREE.ConeGeometry(cfg.radius * 0.3, cfg.radius * 0.9, 8), jetMat);
    jet.position.y = -cfg.radius * 0.85;
    jet.rotation.x = Math.PI;
    g.add(jet);
    this.jet = jet;

    // Silhouette riêng cho từng lớp địch; các mesh phụ không nhận raycast hit.
    const armorMat = new THREE.MeshStandardMaterial({ color: this.isBoss ? 0x321d29 : 0x27343d, roughness: 0.42, metalness: 0.82 });
    const accentMat = new THREE.MeshStandardMaterial({ color: cfg.glow, emissive: cfg.glow, emissiveIntensity: this.isBoss ? 1.5 : 0.65, metalness: 0.4, roughness: 0.3 });
    const addPart = (geo, mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.userData.enemy = this; m.userData.hitTarget = true;
      g.add(m); return m;
    };
    if (this.isBoss) {
      // Heavy command unit: shoulder armor, horns, reactor and side pods.
      addPart(new THREE.BoxGeometry(cfg.radius * 1.9, cfg.radius * 0.46, cfg.radius * 0.72), armorMat, 0, cfg.radius * 0.55, 0);
      addPart(new THREE.BoxGeometry(cfg.radius * 0.42, cfg.radius * 1.25, cfg.radius * 0.72), armorMat, -cfg.radius * 0.88, 0.1, 0);
      addPart(new THREE.BoxGeometry(cfg.radius * 0.42, cfg.radius * 1.25, cfg.radius * 0.72), armorMat, cfg.radius * 0.88, 0.1, 0);
      addPart(new THREE.ConeGeometry(cfg.radius * 0.2, cfg.radius * 0.8, 6), accentMat, -cfg.radius * 0.72, cfg.radius * 1.05, 0, 0, 0, 0.35);
      addPart(new THREE.ConeGeometry(cfg.radius * 0.2, cfg.radius * 0.8, 6), accentMat, cfg.radius * 0.72, cfg.radius * 1.05, 0, 0, 0, -0.35);
      const reactor = addPart(new THREE.SphereGeometry(cfg.radius * 0.32, 16, 12), accentMat, 0, 0, cfg.radius * 0.68);
      reactor.userData.bossCore = true; reactor.userData.enemy = this; reactor.userData.weakpoint = true; this.core = reactor;
      this.bossPods = [];
      for (let i = 0; i < 3; i++) {
        const pod = addPart(new THREE.CylinderGeometry(cfg.radius * 0.18, cfg.radius * 0.24, cfg.radius * 0.7, 8), armorMat, (i - 1) * cfg.radius * 0.7, -cfg.radius * 0.65, cfg.radius * 0.2, 0, 0, (i - 1) * 0.16);
        pod.userData.bossArmor = true; this.bossPods.push(pod);
      }
    } else if (type === 'speeder') {
      addPart(new THREE.BoxGeometry(cfg.radius * 2.9, cfg.radius * 0.14, cfg.radius * 0.46), armorMat, 0, 0, 0.05, 0, 0, 0.06);
      addPart(new THREE.ConeGeometry(cfg.radius * 0.48, cfg.radius * 1.0, 5), accentMat, 0, 0, cfg.radius * 0.78, Math.PI / 2);
      this.speederRings = [];
      [-1, 1].forEach(side => {
        addPart(new THREE.CylinderGeometry(cfg.radius * 0.12, cfg.radius * 0.12, cfg.radius * 0.7, 8), armorMat, side * cfg.radius * 1.1, -cfg.radius * 0.22, 0, 0, 0, Math.PI / 2);
        this.speederRings.push(addPart(new THREE.TorusGeometry(cfg.radius * 0.25, cfg.radius * 0.035, 5, 12), accentMat, side * cfg.radius * 1.35, -cfg.radius * 0.22, 0, Math.PI / 2));
      });
    } else if (type === 'brute') {
      addPart(new THREE.BoxGeometry(cfg.radius * 1.55, cfg.radius * 0.62, cfg.radius * 1.08), armorMat, 0, -cfg.radius * 0.25, 0.08);
      [-1, 1].forEach(side => {
        addPart(new THREE.BoxGeometry(cfg.radius * 0.5, cfg.radius * 1.15, cfg.radius * 0.62), armorMat, side * cfg.radius * 0.78, 0.1, 0.08, 0, 0, side * -0.18);
        addPart(new THREE.ConeGeometry(cfg.radius * 0.18, cfg.radius * 0.55, 6), accentMat, side * cfg.radius * 0.8, cfg.radius * 0.7, 0.15, 0, 0, side * -0.25);
      });
    } else {
      // Four-armed drone rotor assembly: the whole cross rotates as one joint.
      this.rotorGroup = new THREE.Group(); g.add(this.rotorGroup);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const x = Math.cos(a) * cfg.radius * 0.72, z = Math.sin(a) * cfg.radius * 0.72;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(cfg.radius * 0.9, cfg.radius * 0.1, cfg.radius * 0.13), armorMat);
        arm.position.set(x, 0, z); arm.rotation.y = -a; arm.userData.enemy = this; arm.userData.hitTarget = true; this.rotorGroup.add(arm);
        const hub = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 0.13, 8, 6), accentMat);
        hub.position.set(x * 1.45, -cfg.radius * 0.08, z * 1.45); hub.userData.enemy = this; hub.userData.hitTarget = true; this.rotorGroup.add(hub);
      }
    }

    // External Quaternius glTF models are the primary render layer; procedural geometry
    // remains as a no-network fallback and retains the boss reactor/armor accents.
    this.assetMixer = null; this.assetActions = Object.create(null); this.assetActionName = '';
    this.assetMaterials = [];
    if (window.SkywardAssetFactory) {
      const assetByType = {
        drone: 'Enemy_EyeDrone', speeder: 'Enemy_QuadShell',
        brute: 'Enemy_Trilobite', boss: 'Enemy_QuadShell'
      };
      const targetHeight = { drone: 2.15, speeder: 2.0, brute: 1.95, boss: 2.42 }[type] || 2;
      const asset = window.SkywardAssetFactory.createEnemy(assetByType[type], this, targetHeight);
      if (asset) {
        this.assetModel = asset.root;
        this.assetMixer = asset.mixer;
        this.assetMaterials = asset.materials || [];
        asset.clips.forEach(clip => { this.assetActions[clip.name.toLowerCase()] = clip; });
        this.assetMaterials.forEach(mat => {
          if (mat.emissive) mat.emissive.setHex(cfg.glow);
          // The supplied emissive atlas isolates only lamps/reactors; keep armor diffuse.
          mat.emissiveIntensity = mat.emissiveMap ? 0.82 : 0.06;
        });
        // Keep the visible reactor and boss pods from the procedural fallback.
        g.children.forEach(child => {
          if (child === this.core) return;
          child.visible = false;
          child.traverse(o => { if (o.isMesh) o.userData.hitTarget = false; });
        });
        g.add(this.assetModel);
        if (this.isBoss && this.core) {
          this.core.geometry.dispose();
          this.core.geometry = new THREE.SphereGeometry(0.42, 20, 16);
          this.core.position.set(0, -0.65, 1.38);
        }
        this.bodyMat = this.assetMaterials[0] || this.bodyMat;
        this._playAssetAnimation('Idle');
      }
    }

    // Projectile geometry/material được dùng chung cho pool của enemy này.
    this.projectiles = []; this.projectilePool = [];
    this.projectileResources = acquireEnemyProjectileResources(type, cfg.glow);

    g.position.copy(pos);
    g.scale.set(0.01, 0.01, 0.01);
    scene.add(g);
    this.group = g;

    this.baseY = cfg.hover;
    g.position.y = this.baseY;
  }

  _playAssetAnimation(preferred) {
    if (!this.assetMixer || !this.assetActions) return;
    const key = String(preferred || 'Idle').toLowerCase();
    let clip = this.assetActions[key];
    if (!clip) {
      const keys = Object.keys(this.assetActions);
      const fallback = key === 'run' || key === 'walk' ? ['walk', 'run', 'idle'] :
        key === 'attack' || key === 'charge' ? ['attack', 'charge', 'idle'] :
        ['idle', 'look', 'walk'];
      for (let i = 0; i < fallback.length && !clip; i++) clip = this.assetActions[fallback[i]];
      if (!clip && keys.length) clip = this.assetActions[keys[0]];
    }
    if (!clip || this.assetActionName === clip.name) return;
    const next = this.assetMixer.clipAction(clip);
    next.reset();
    const oneShot = key === 'turnoff' || key === 'hit' || key === 'attack' || key === 'charge';
    next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    next.clampWhenFinished = oneShot;
    next.fadeIn(0.16).play();
    if (this._activeAssetAction) this._activeAssetAction.fadeOut(0.14);
    this._activeAssetAction = next;
    this.assetActionName = clip.name;
  }

  takeDamage(amount, point) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.assetHitT = 0.18;
    this._playAssetAnimation('Hit');
    this.bodyMat.emissiveIntensity = this.isBoss ? 1.25 : 0.7;
    if (this.assetMaterials) this.assetMaterials.forEach(mat => { if (mat.emissive) mat.emissiveIntensity = this.isBoss ? 1.25 : 0.7; });
    if (this.isBoss && this.core) {
      const ratio = this.hp / this.maxHp;
      this.core.scale.setScalar(ratio < 0.3 ? 1.5 : ratio < 0.65 ? 1.25 : 1);
      this.moveSpeed = ratio < 0.3 ? 2.7 : ratio < 0.65 ? 2.25 : 1.9;
      this.fireRate = ratio < 0.3 ? 0.78 : ratio < 0.65 ? 0.96 : 1.2;
    }
    if (point) {
      this.particles.burst(point, { count: 8, color: [1, 0.75, 0.35], color2: [1, 0.3, 0.2], speed: 6, life: 0.4, gravity: 8 });
    }
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  // phản ứng khi trúng đạn — chỉ hiệu ứng, không đổi AI/HP
  flinch(normal) {
    if (!this.alive) return;
    this.flinchT = 0.14;
    if (normal) {
      this.flinchDir = normal.clone();
      this.flinchDir.y = 0;
      if (this.flinchDir.lengthSq() > 0.001) this.flinchDir.normalize();
    }
  }

  _recycleProjectile(p) {
    if (!p || !p.mesh) return;
    this.scene.remove(p.mesh);
    p.mesh.visible = false;
    p.vel.set(0, 0, 0); p.life = 0;
    this.projectilePool.push(p);
  }

  _clearProjectiles() {
    if (!this.projectiles) this.projectiles = [];
    while (this.projectiles.length) this._recycleProjectile(this.projectiles.pop());
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this._clearProjectiles();
    this.deathT = 0.45;
    this._playAssetAnimation('TurnOff');
    const p = this.group.position.clone();
    const gc = hexToRgb(this.cfg.glow);
    this.particles.burst(p, { count: 46, color: [1, 0.6, 0.2], color2: gc, speed: 12, life: 0.9, gravity: 10, up: 5 });
    this.particles.burst(p, { count: 14, color: [0.3, 0.3, 0.34], speed: 5, life: 1.5, gravity: 2, up: 3 });
    this.sound.explosion(false);
    if (this.onDeath) this.onDeath(p);
  }

  // animate chết: rơi + xoay + co lại. Trả về true khi xong (xoá khỏi scene)
  updateDeath(dt) {
    if (this.deathT === undefined || this.deathT <= 0) return true;
    this.deathT -= dt;
    if (this.assetMixer) this.assetMixer.update(dt);
    const f = Math.max(0, this.deathT / 0.45);
    this.group.scale.setScalar(Math.max(0.01, this.cfg.scale * f));
    this.group.position.y = this.baseY * f + 0.25 * f;
    this.group.rotation.x += dt * 4.5;
    this.group.rotation.z += dt * 3.2;
    this.bodyMat.emissiveIntensity = 0.12 + f * 1.2;
    if (this.deathT <= 0) {
      this.scene.remove(this.group);
      return true;
    }
    return false;
  }

  update(dt, player, bounds, others, world) {
    if (!this.alive) return;
    this.t += dt;
    if (this.assetMixer) this.assetMixer.update(dt);
    if (this.assetAttackT > 0) this.assetAttackT = Math.max(0, this.assetAttackT - dt);
    if (this.assetHitT > 0) this.assetHitT = Math.max(0, this.assetHitT - dt);

    // spawn animation
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      const f = 1 - Math.max(0, this.spawnT / 0.7);
      const s = this.cfg.scale * (0.2 + f * 0.8);
      this.group.scale.set(s, s, s);
      this.group.position.y = this.baseY - (1 - f) * 2;
      return;
    }

    const pos = this.group.position;
    const toPlayer = new THREE.Vector3().subVectors(player.pos, pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = dist > 0.001 ? toPlayer.clone().divideScalar(dist) : new THREE.Vector3(1, 0, 0);

    // giữ khoảng cách + trào ngang
    const move = new THREE.Vector3();
    if (dist > this.cfg.range) move.add(dir);
    else if (dist < this.cfg.range * 0.55) move.sub(dir);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(this.t * 1.1 + this.strafePhase) * this.strafeDir);
    move.add(side.multiplyScalar(0.7));

    // tách đàn
    if (others) {
      for (let i = 0; i < others.length; i++) {
        const o = others[i];
        if (o === this || !o.alive) continue;
        const d = new THREE.Vector3().subVectors(pos, o.group.position);
        d.y = 0;
        const l = d.length();
        const min = this.radius + o.radius + 1.2;
        if (l > 0.001 && l < min) move.add(d.divideScalar(l).multiplyScalar((min - l) * 0.9));
      }
    }

    if (move.lengthSq() > 0.001) {
      const desired = move.clone().normalize();
      const travel = this.moveSpeed * dt;
      const blockedAt = (x, z) => world && typeof world.isEnemyBlocked === 'function'
        ? world.isEnemyBlocked(x, z, pos.y, this.radius)
        : false;
      const nextX = pos.x + desired.x * travel;
      const nextZ = pos.z + desired.z * travel;
      if (!blockedAt(nextX, nextZ)) {
        pos.x = nextX;
        pos.z = nextZ;
      } else {
        // Probe shallow steering offsets around the direct route; choose the
        // clear candidate that makes the most progress toward the player.
        const angles = [0.55, -0.55, 1.05, -1.05, 1.57, -1.57, 2.1, -2.1];
        let best = null, bestScore = Infinity;
        for (let i = 0; i < angles.length; i++) {
          const a = angles[i], c = Math.cos(a), s = Math.sin(a);
          const sx = desired.x * c - desired.z * s;
          const sz = desired.x * s + desired.z * c;
          const tx = pos.x + sx * travel, tz = pos.z + sz * travel;
          if (blockedAt(tx, tz)) continue;
          const score = Math.hypot(player.pos.x - tx, player.pos.z - tz) +
            Math.abs(a) * 0.12;
          if (score < bestScore) { bestScore = score; best = { x: tx, z: tz }; }
        }
        if (best) { pos.x = best.x; pos.z = best.z; }
      }
    }

    // giới hạn sân
    const rr = Math.hypot(pos.x, pos.z);
    if (rr > bounds) { pos.x *= bounds / rr; pos.z *= bounds / rr; }

    // bay + nhìn
    pos.y = this.baseY + Math.sin(this.t * 2 + this.bobPhase) * 0.35;
    this.group.lookAt(player.pos.x, pos.y, player.pos.z);
    this.ring.rotation.z += dt * 2.4;
    if (this.rotorGroup) this.rotorGroup.rotation.y += dt * 4.8;
    if (this.speederRings) this.speederRings.forEach((r, i) => { r.rotation.x += dt * (i ? -5.5 : 5.5); });
    if (this.bossPods) this.bossPods.forEach((pod, i) => { pod.rotation.y += dt * (i - 1) * 0.7; });
    if (this.core) {
      const pulse = 1 + Math.sin(this.t * 5.5) * 0.09;
      const phaseScale = this.hp / this.maxHp < 0.3 ? 1.5 : this.hp / this.maxHp < 0.65 ? 1.25 : 1;
      this.core.scale.setScalar(phaseScale * pulse);
    }

    // flinch khi trúng đạn
    if (this.flinchT > 0) {
      this.flinchT -= dt;
      const f = Math.max(0, this.flinchT / 0.14);
      const k = (1 - f) * 0.30;
      this.body.position.set(this.flinchDir.x * k, 0, this.flinchDir.z * k);
      this.body.scale.setScalar(1 + (1 - f) * 0.20);
      this.bodyMat.emissiveIntensity = 0.12 + (1 - f) * 1.6;
      if (this.assetMaterials) this.assetMaterials.forEach(mat => { if (mat.emissive) mat.emissiveIntensity = 0.12 + (1 - f) * 1.6; });
    } else {
      this.body.position.set(0, 0, 0);
      this.body.scale.setScalar(1);
      const baseEmissive = this.assetMaterials && this.assetMaterials.length ? 0.06 : 0.12;
      this.bodyMat.emissiveIntensity += (baseEmissive - this.bodyMat.emissiveIntensity) * Math.min(1, dt * 6);
      if (this.assetMaterials) this.assetMaterials.forEach(mat => { if (mat.emissive) mat.emissiveIntensity += (baseEmissive - mat.emissiveIntensity) * Math.min(1, dt * 6); });
    }

    // Chọn clip phù hợp với trạng thái di chuyển/tấn công của model glTF.
    if (this.assetMixer) this._playAssetAnimation(this.assetHitT > 0 ? 'Hit' : (this.assetAttackT > 0 ? 'Attack' : (dist > this.cfg.range ? 'Run' : 'Idle')));

    // bắn
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && dist < this.cfg.range * 1.8 && !player.dead) {
      this.fireTimer = this.fireRate * (0.8 + Math.random() * 0.5);
      this.shoot(player);
    }
  }

  shoot(player) {
    this.assetAttackT = 0.42;
    this._playAssetAnimation('Attack');
    const from = this.group.position.clone();
    const target = new THREE.Vector3(player.pos.x, player.pos.y - 0.85, player.pos.z);
    const dir = target.sub(from).normalize();
    this.spawnProjectile(from, dir);
    this.sound.enemyShot();
  }

  spawnProjectile(from, dir) {
    let p = this.projectilePool.pop();
    if (!p) {
      const resources = this.projectileResources;
      const mesh = new THREE.Mesh(resources.geometry, resources.material);
      const glow = new THREE.Sprite(resources.spriteMaterial);
      glow.scale.set(1.4, 1.4, 1.4); mesh.add(glow);
      p = { mesh, vel: new THREE.Vector3(), life: 0, damage: this.cfg.damage };
    }
    p.mesh.visible = true;
    p.mesh.position.copy(from);
    p.vel.copy(dir).multiplyScalar(this.isBoss ? 20 : 17);
    p.life = this.isBoss ? 5.5 : 5;
    p.damage = this.cfg.damage;
    this.scene.add(p.mesh);
    this.projectiles.push(p);
  }

  updateProjectiles(dt, player, onPlayerHit, world) {
    if (!this.projectiles) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const previous = p.mesh.position.clone();
      p.mesh.position.addScaledVector(p.vel, dt);
      const pp = p.mesh.position;
      const target = new THREE.Vector3(player.pos.x, player.pos.y - 0.85, player.pos.z);
      const hit = pp.distanceTo(target) < 1.35;
      let blocked = false;
      if (world && typeof world.isEnemyProjectileBlocked === 'function') {
        const travel = previous.distanceTo(pp);
        const samples = Math.max(1, Math.ceil(travel / 0.18));
        for (let step = 1; step <= samples; step++) {
          const t = step / samples;
          const x = previous.x + (pp.x - previous.x) * t;
          const y = previous.y + (pp.y - previous.y) * t;
          const z = previous.z + (pp.z - previous.z) * t;
          if (world.isEnemyProjectileBlocked(x, y, z, 0.22)) { blocked = true; break; }
        }
      }
      let dead = p.life <= 0 || pp.y < 0.1 || blocked;
      if (hit && !blocked && !player.dead) {
        onPlayerHit(p.damage, pp.clone());
        dead = true;
      }
      if (dead) {
        this.particles.burst(pp, { count: 8, color: [1, 0.6, 0.3], speed: 4, life: 0.3, gravity: 6 });
        this.projectiles.splice(i, 1);
        this._recycleProjectile(p);
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.alive = false;
    this._clearProjectiles();
    this.scene.remove(this.group);
    if (this.assetMixer) this.assetMixer.stopAllAction();
    this.group.traverse(o => {
      if (!o.isMesh) return;
      if (o.geometry && !o.userData.sharedAssetGeometry) o.geometry.dispose();
      if (o.material && !o.userData.sharedAssetMaterial) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose();
      }
    });
    this.projectilePool.length = 0;
    releaseEnemyProjectileResources(this.type, this.projectileResources);
    this.projectileResources = null;
  }
}

/* ============================================================
   WaveManager
   ============================================================ */

const BASE_WAVES = [
  { drone: 4, speeder: 0, brute: 0 },
  { drone: 4, speeder: 3, brute: 0 },
  { drone: 4, speeder: 3, brute: 2 },
  { drone: 6, speeder: 4, brute: 2 },
  { drone: 5, speeder: 5, brute: 3 }
];

class WaveManager {
  constructor(scene, particles, sound, opts) {
    this.scene = scene; this.particles = particles; this.sound = sound;
    this.onWaveStart = opts.onWaveStart || function () {};
    this.onWaveClear = opts.onWaveClear || function () {};
    this.onAllClear = opts.onAllClear || function () {};
    this.onEnemyKilled = opts.onEnemyKilled || function () {};
    this.onPlayerHit = opts.onPlayerHit || function () {};
    this.enemies = []; this.waveIndex = 0; this.state = 'idle'; this.timer = 0;
    this.mods = { countMul: 1, hpMul: 1 }; this.spawnQueue = []; this.spawnTimer = 0;
    this.endless = false; this.waveTotal = 3;
  }

  start(mods) {
    this.clearAll();
    this.mods = Object.assign({ countMul: 1, hpMul: 1 }, mods || {});
    this.endless = !!this.mods.endless;
    this.waveTotal = this.endless ? Infinity : (this.mods.waveCount || 3);
    this.waveIndex = 0; this.state = 'intermission'; this.timer = 1.6;
  }

  aliveCount() { let n = 0; for (const e of this.enemies) if (e.alive) n++; return n; }

  hitMeshes() {
    const out = [];
    for (const e of this.enemies) {
      if (!e.alive || e.spawnT > 0) continue;
      e.group.traverse(o => { if (o.isMesh && o.userData.hitTarget) out.push(o); });
    }
    return out;
  }

  _buildWave(idx) {
    const base = BASE_WAVES[Math.min(idx, BASE_WAVES.length - 1)];
    const mult = this.endless ? 1 + Math.max(0, idx - 2) * 0.18 : 1;
    const count = this.endless ? 5 + Math.floor(idx * 1.45) : 0;
    const list = [];
    if (this.endless) {
      // Giới hạn số enemy trong một wave để draw call không tăng vô hạn; HP/boss vẫn scale theo wave.
      const n = Math.max(5, Math.min(32, Math.round(count * this.mods.countMul)));
      const droneN = Math.max(2, Math.floor(n * 0.48));
      const speedN = Math.floor(n * 0.32);
      const bruteN = Math.max(0, n - droneN - speedN);
      for (let i = 0; i < droneN; i++) list.push('drone');
      for (let i = 0; i < speedN; i++) list.push('speeder');
      for (let i = 0; i < bruteN; i++) list.push('brute');
      if ((idx + 1) % 5 === 0) list.push('boss');
    } else {
      ['drone', 'speeder', 'brute'].forEach(type => {
        const n = Math.round((base[type] || 0) * this.mods.countMul);
        for (let i = 0; i < n; i++) list.push(type);
      });
      if (this.mods.waveCount >= 5 && idx === 4) list.push('boss');
    }
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    this._currentHpMul = this.mods.hpMul * mult;
    return list;
  }

  _spawnPos() {
    const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 19;
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  _spawnNext() {
    const type = this.spawnQueue.shift();
    const e = new Enemy(this.scene, this.particles, this.sound, type, this._spawnPos(), this._currentHpMul || this.mods.hpMul);
    this.enemies.push(e);
    this.particles.burst(e.group.position.clone(), { count: e.isBoss ? 34 : 16, color: [0.5, 0.8, 1], color2: [1, 0.35, 0.4], speed: e.isBoss ? 8 : 5, life: 0.5, gravity: 1, up: 4 });
  }

  continueAfterUpgrade() {
    if (this.state !== 'upgrade') return;
    this.state = 'intermission'; this.timer = 0.8;
  }

  update(dt, player, bounds, world) {
    if (this.state === 'upgrade' || this.state === 'idle' || this.state === 'done') return;
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = this.endless ? 0.38 : 0.45; this._spawnNext(); }
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) {
        if (e.updateDeath(dt)) { e.dispose(); this.enemies.splice(i, 1); i--; }
        continue;
      }
      e.update(dt, player, bounds, this.enemies, world);
      e.updateProjectiles(dt, player, this.onPlayerHit, world);
    }

    if (this.state === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (!this.endless && this.waveIndex >= this.waveTotal) { this.state = 'done'; this.onAllClear(); }
        else {
          this.spawnQueue = this._buildWave(this.waveIndex);
          this.state = 'fighting'; this.spawnTimer = 0; this.sound.wave();
          this.waveIndex++;
          this.onWaveStart(this.waveIndex, this.endless ? '∞' : this.waveTotal);
        }
      }
    } else if (this.state === 'fighting') {
      if (this.spawnQueue.length === 0 && this.aliveCount() === 0) {
        const clearedWave = this.waveIndex;
        const finalWave = !this.endless && clearedWave >= this.waveTotal;
        const offerUpgrade = this.endless || (!finalWave && clearedWave % 2 === 0);
        this.state = offerUpgrade ? 'upgrade' : 'intermission';
        this.timer = offerUpgrade ? 0 : 3.4;
        this.onWaveClear(this.waveIndex, this.endless ? '∞' : this.waveTotal);
      }
    }
  }

  clearAll() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0; this.spawnQueue.length = 0; this.state = 'idle';
  }
}
