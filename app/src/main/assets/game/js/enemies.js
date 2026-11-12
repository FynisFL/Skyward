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
    this.fireTimer = 1.2 + SkywardRNG.random('ai') * cfg.fireRate;
    this.combatProfile = window.SkywardCombatAI ? window.SkywardCombatAI.getProfile(type) : null;
    this.attackState = 'idle';
    this.attackKind = '';
    this.attackTimer = 0;
    this.attackCooldown = (type === 'speeder' || type === 'brute')
      ? 1.2 + SkywardRNG.random('ai') * 0.8 : 0;
    this.attackTarget = new THREE.Vector3();
    this.attackDirection = new THREE.Vector3();
    this.attackHit = false;
    this.attackMovement = new THREE.Vector3();
    this.staggerMeter = 0;
    this.bossPhase = this.isBoss ? 1 : 0;
    this.weakpointOpenT = 0;
    this.telegraphLine = null;
    this.telegraphMarker = null;
    this.spawnT = 0;
    this.strafePhase = SkywardRNG.random('ai') * Math.PI * 2;
    this.strafeDir = SkywardRNG.random('ai') < 0.5 ? 1 : -1;
    this.bobPhase = SkywardRNG.random('ai') * Math.PI * 2;
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
    this._createTelegraphVisuals();
  }

  _emitCombatEvent(type, payload) {
    const bus = window.SkywardEvents;
    if (bus && typeof bus.emit === 'function') {
      bus.emit(type, Object.assign({ enemyType: this.type, boss: !!this.isBoss }, payload || {}));
    }
  }

  _createTelegraphVisuals() {
    if (this.type === 'brute') {
      const material = new THREE.MeshBasicMaterial({
        color: 0xff493d, transparent: true, opacity: 0.48,
        side: THREE.DoubleSide, depthWrite: false
      });
      this.telegraphMarker = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), material);
      this.telegraphMarker.rotation.x = -Math.PI / 2;
      this.telegraphMarker.position.y = 0.1;
      this.telegraphMarker.renderOrder = 5;
      this.telegraphMarker.visible = false;
      this.scene.add(this.telegraphMarker);
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({
      color: this.isBoss ? 0xff3159 : (this.type === 'speeder' ? 0xffa34d : 0xff5948),
      transparent: true, opacity: 0.82, depthWrite: false
    });
    this.telegraphLine = new THREE.Line(geometry, material);
    this.telegraphLine.frustumCulled = false;
    this.telegraphLine.visible = false;
    this.telegraphLine.renderOrder = 5;
    this.scene.add(this.telegraphLine);
  }

  _beginTelegraph(kind, target, duration) {
    this.attackState = 'telegraph';
    this.attackKind = kind;
    this.attackTimer = duration;
    this.attackHit = false;
    this.attackTarget.copy(target);
    this._updateTelegraphVisual();
    this._emitCombatEvent('enemy:telegraph', {
      attack: kind,
      duration: Number(duration.toFixed(3)),
      target: { x: Number(target.x.toFixed(3)), y: Number(target.y.toFixed(3)), z: Number(target.z.toFixed(3)) },
      phase: this.bossPhase || null
    });
  }

  _updateTelegraphVisual() {
    if (this.telegraphLine) {
      const attribute = this.telegraphLine.geometry.getAttribute('position');
      const array = attribute.array;
      const from = this.group.position;
      array[0] = from.x;
      array[1] = from.y + 0.18;
      array[2] = from.z;
      array[3] = this.attackTarget.x;
      array[4] = this.attackTarget.y;
      array[5] = this.attackTarget.z;
      attribute.needsUpdate = true;
      this.telegraphLine.visible = this.attackState === 'telegraph';
    }
    if (this.telegraphMarker) {
      this.telegraphMarker.position.set(this.attackTarget.x, this.attackTarget.y + 0.1, this.attackTarget.z);
      const pulse = 0.94 + Math.sin(this.attackTimer * 13) * 0.045;
      this.telegraphMarker.scale.setScalar(pulse);
      this.telegraphMarker.material.opacity = 0.38 + Math.sin(this.attackTimer * 16) * 0.08;
      this.telegraphMarker.visible = this.attackState === 'telegraph';
    }
  }

  _hideTelegraph() {
    if (this.telegraphLine) this.telegraphLine.visible = false;
    if (this.telegraphMarker) this.telegraphMarker.visible = false;
  }

  _enterRecover(duration, cooldown) {
    this._hideTelegraph();
    this.attackState = 'recover';
    this.attackKind = '';
    this.attackTimer = Math.max(0, duration || 0);
    if (Number.isFinite(cooldown)) this.attackCooldown = Math.max(this.attackCooldown, cooldown);
  }

  isWeakpointExposed() {
    return !!(this.isBoss && this.weakpointOpenT > 0);
  }

  _updateCommanderPhase() {
    if (!this.isBoss || !window.SkywardCombatAI) return;
    const nextPhase = window.SkywardCombatAI.getCommanderPhase(this.hp, this.maxHp);
    if (nextPhase === this.bossPhase) return;
    this.bossPhase = nextPhase;
    this.moveSpeed = nextPhase >= 3 ? 2.8 : (nextPhase === 2 ? 2.3 : 1.9);
    this.fireRate = nextPhase >= 3 ? 0.76 : (nextPhase === 2 ? 0.94 : 1.2);
    this._emitCombatEvent('enemy:phase', { phase: nextPhase, hpRatio: Number((this.hp / this.maxHp).toFixed(3)) });
  }

  _updateAttackState(dt, player, distance, onPlayerHit) {
    const profile = this.combatProfile || (window.SkywardCombatAI && window.SkywardCombatAI.getProfile(this.type));
    if (!profile) return;

    if (this.weakpointOpenT > 0) this.weakpointOpenT = Math.max(0, this.weakpointOpenT - dt);
    if (this.staggerMeter > 0) this.staggerMeter = Math.max(0, this.staggerMeter - dt * profile.staggerThreshold * 0.22);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    this._updateCommanderPhase();

    if (this.attackState === 'telegraph') {
      this.attackTimer -= dt;
      this._updateTelegraphVisual();
      if (this.attackTimer <= 0) {
        this._hideTelegraph();
        if (this.attackKind === 'charge') {
          this.attackDirection.subVectors(this.attackTarget, this.group.position);
          this.attackDirection.y = 0;
          if (this.attackDirection.lengthSq() < 0.001) this.attackDirection.set(0, 0, -1);
          this.attackDirection.normalize();
          this.attackState = 'lunge';
          this.attackTimer = profile.chargeDuration;
          this._emitCombatEvent('enemy:attack', { attack: 'charge', phase: null });
        } else if (this.attackKind === 'slam') {
          const hit = window.SkywardCombatAI.isInsideRadialAttack(
            this.attackTarget.x, this.attackTarget.z,
            player.pos.x, player.pos.z,
            profile.slamRadius,
            this.attackTarget.y,
            player.pos.y - player.eyeHeight,
            profile.slamHeightTolerance
          );
          this._emitCombatEvent('enemy:attack', { attack: 'ground-slam', hit: hit });
          if (hit && typeof onPlayerHit === 'function') {
            onPlayerHit(profile.damage, this.attackTarget.clone(), { source: 'brute-slam', enemyType: this.type });
          }
          const cooldown = profile.cooldown * (0.88 + SkywardRNG.random('ai') * 0.24);
          this._enterRecover(profile.recover, cooldown);
        } else if (this.attackKind === 'volley') {
          this.shootAt(this.attackTarget, this.bossPhase);
          this.weakpointOpenT = profile.weakpointWindow;
          this._emitCombatEvent('enemy:weakpoint-open', { phase: this.bossPhase, duration: profile.weakpointWindow });
          this.fireTimer = this.fireRate * (0.8 + SkywardRNG.random('ai') * 0.5);
          this._enterRecover(profile.recover, 0);
        } else {
          this.shootAt(this.attackTarget, 1);
          this.fireTimer = this.fireRate * (0.8 + SkywardRNG.random('ai') * 0.5);
          this._enterRecover(0.18, 0);
        }
      }
      return;
    }

    if (this.attackState === 'lunge') {
      this.attackTimer -= dt;
      return;
    }

    if (this.attackState === 'recover') {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackState = 'idle';
        this.attackKind = '';
      }
      return;
    }

    if (this.type === 'speeder' && this.attackCooldown <= 0 &&
        window.SkywardCombatAI.isInChargeWindow(distance, profile) && !player.dead) {
      const target = player.pos.clone();
      target.y -= 1.25;
      this._beginTelegraph('charge', target, profile.windup);
      return;
    }

    if (this.type === 'brute' && this.attackCooldown <= 0 &&
        distance <= profile.slamRange && !player.dead) {
      const target = player.pos.clone();
      target.y = Math.max(0.08, player.pos.y - player.eyeHeight);
      this._beginTelegraph('slam', target, profile.windup);
      return;
    }

    if (this.type === 'drone' || this.isBoss) {
      const squadPressure = !this.isBoss && Array.isArray(this._allies) &&
        this._allies.some(other => other !== this && other.alive && other.type === 'brute' &&
          Math.hypot(other.group.position.x - player.pos.x, other.group.position.z - player.pos.z) < 10);
      this.fireTimer -= dt * (squadPressure ? 1.16 : 1);
      if (this.fireTimer <= 0 && distance < this.cfg.range * 1.8 && !player.dead) {
        const target = player.pos.clone();
        target.y -= 0.85;
        this._beginTelegraph(this.isBoss ? 'volley' : 'shot', target, profile.windup);
      }
    }
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
    const profile = this.combatProfile || (window.SkywardCombatAI && window.SkywardCombatAI.getProfile(this.type));
    if (profile && this.attackState === 'telegraph' && window.SkywardCombatAI) {
      const stagger = window.SkywardCombatAI.addStagger(this.staggerMeter, amount, profile.staggerThreshold);
      this.staggerMeter = stagger.value;
      if (stagger.interrupted) {
        const interruptedAttack = this.attackKind;
        this._enterRecover(0.46, Math.max(this.attackCooldown, this.isBoss ? 0.85 : 0.55));
        if (this.type === 'drone' || this.isBoss) this.fireTimer = Math.max(this.fireTimer, this.fireRate * 0.85);
        this._emitCombatEvent('enemy:staggered', { interruptedAttack: interruptedAttack, damage: Number(amount.toFixed(3)) });
      }
    }
    this._updateCommanderPhase();
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
    this._hideTelegraph();
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

  update(dt, player, bounds, others, world, onPlayerHit) {
    if (!this.alive) return;
    this.t += dt;
    if (this.assetMixer) this.assetMixer.update(dt);
    if (this.assetAttackT > 0) this.assetAttackT = Math.max(0, this.assetAttackT - dt);
    if (this.assetHitT > 0) this.assetHitT = Math.max(0, this.assetHitT - dt);

    // Spawn animation remains non-interactive until the enemy is fully deployed.
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
    const profile = this.combatProfile || window.SkywardCombatAI.getProfile(this.type);

    this._allies = others || [];
    this._updateAttackState(dt, player, dist, onPlayerHit);

    // Role-specific movement: supports hold a firing lane, speeders sweep the flank,
    // and brutes occupy the frontline rather than retreating into another firing lane.
    const move = new THREE.Vector3();
    if (this.attackState === 'lunge') {
      move.copy(this.attackDirection);
    } else if (this.attackState !== 'telegraph' && this.attackState !== 'recover') {
      const intent = window.SkywardCombatAI.getMovementIntent(this.type, dist);
      if (intent === 'advance') move.add(dir);
      else if (intent === 'retreat') move.sub(dir);
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const orbit = Math.sin(this.t * (this.type === 'speeder' ? 1.65 : 1.1) + this.strafePhase) * this.strafeDir;
      const sideWeight = intent === 'flank' ? profile.strafe * (0.85 + Math.abs(orbit) * 0.3) : profile.strafe * orbit;
      move.add(side.multiplyScalar(sideWeight));
    }

    // Squad spacing preserves readable lanes while leaving room for distinct roles.
    if (others && this.attackState !== 'lunge') {
      for (let i = 0; i < others.length; i++) {
        const other = others[i];
        if (other === this || !other.alive) continue;
        const separation = new THREE.Vector3().subVectors(pos, other.group.position);
        separation.y = 0;
        const length = separation.length();
        const minimum = this.radius + other.radius + 1.2;
        if (length > 0.001 && length < minimum) {
          move.add(separation.divideScalar(length).multiplyScalar((minimum - length) * 0.9));
        }
      }
    }

    if (move.lengthSq() > 0.001) {
      const desired = move.clone().normalize();
      const lunge = this.attackState === 'lunge';
      const travel = (lunge ? profile.chargeSpeed : this.moveSpeed) * dt;
      const blockedAt = (x, z) => world && typeof world.isEnemyBlocked === 'function'
        ? world.isEnemyBlocked(x, z, pos.y, this.radius)
        : false;
      const nextX = pos.x + desired.x * travel;
      const nextZ = pos.z + desired.z * travel;
      if (!blockedAt(nextX, nextZ)) {
        pos.x = nextX;
        pos.z = nextZ;
      } else {
        const angles = lunge ? [0.32, -0.32, 0.62, -0.62] : [0.55, -0.55, 1.05, -1.05, 1.57, -1.57, 2.1, -2.1];
        let best = null, bestScore = Infinity;
        for (let i = 0; i < angles.length; i++) {
          const angle = angles[i], cosine = Math.cos(angle), sine = Math.sin(angle);
          const sx = desired.x * cosine - desired.z * sine;
          const sz = desired.x * sine + desired.z * cosine;
          const tx = pos.x + sx * travel, tz = pos.z + sz * travel;
          if (blockedAt(tx, tz)) continue;
          const score = Math.hypot(player.pos.x - tx, player.pos.z - tz) + Math.abs(angle) * (lunge ? 0.8 : 0.12);
          if (score < bestScore) { bestScore = score; best = { x: tx, z: tz }; }
        }
        if (best) { pos.x = best.x; pos.z = best.z; }
      }
    }

    const arenaRadius = Math.hypot(pos.x, pos.z);
    if (arenaRadius > bounds) { pos.x *= bounds / arenaRadius; pos.z *= bounds / arenaRadius; }

    // Resolve the speeder's charge only after movement; a player can dodge the locked lane.
    if (this.attackState === 'lunge') {
      const contactDistance = Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z);
      if (!this.attackHit && contactDistance <= profile.hitRadius && !player.dead) {
        this.attackHit = true;
        this._emitCombatEvent('enemy:attack', { attack: 'charge-hit', damage: profile.damage });
        if (typeof onPlayerHit === 'function') {
          onPlayerHit(profile.damage, pos.clone(), { source: 'speeder-charge', enemyType: this.type });
        }
        this._enterRecover(profile.recover, profile.cooldown * (0.88 + SkywardRNG.random('ai') * 0.24));
      } else if (this.attackTimer <= 0) {
        this._emitCombatEvent('enemy:attack', { attack: 'charge-missed' });
        this._enterRecover(profile.recover * 0.7, profile.cooldown * (0.88 + SkywardRNG.random('ai') * 0.24));
      }
    }

    pos.y = this.baseY + Math.sin(this.t * 2 + this.bobPhase) * 0.35;
    if (this.attackState === 'lunge') {
      this.group.lookAt(pos.x + this.attackDirection.x, pos.y, pos.z + this.attackDirection.z);
    } else {
      this.group.lookAt(player.pos.x, pos.y, player.pos.z);
    }
    this.ring.rotation.z += dt * (this.type === 'speeder' ? 3.8 : 2.4);
    if (this.rotorGroup) this.rotorGroup.rotation.y += dt * 4.8;
    if (this.speederRings) this.speederRings.forEach((ring, index) => { ring.rotation.x += dt * (index ? -7.2 : 7.2); });
    if (this.bossPods) this.bossPods.forEach((pod, index) => { pod.rotation.y += dt * (index - 1) * 0.7; });
    if (this.core) {
      const pulse = 1 + Math.sin(this.t * 5.5) * 0.09;
      const phaseScale = this.bossPhase >= 3 ? 1.5 : this.bossPhase === 2 ? 1.25 : 1;
      this.core.scale.setScalar(phaseScale * pulse);
      if (this.core.material && this.core.material.emissiveIntensity !== undefined) {
        this.core.material.emissiveIntensity = this.isWeakpointExposed() ? 3.2 : (this.bossPhase >= 3 ? 0.9 : 0.48);
      }
    }

    // Hit reactions can interrupt a telegraph; otherwise this block remains visual-only.
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

    if (this.assetMixer) {
      const animation = this.assetHitT > 0 ? 'Hit' :
        (this.attackState === 'telegraph' || this.attackState === 'lunge' ? 'Attack' :
        (this.attackState === 'recover' ? 'Idle' : (dist > profile.idealRange ? 'Run' : 'Idle')));
      this._playAssetAnimation(animation);
    }

    this._updateTelegraphVisual();

    // Drone/Commander ranged pressure is deliberate and telegraphed. Speeder and Brute
    // use their own charge/slam patterns instead of sharing a generic ranged projectile.
  }

  shoot(player) {
    const target = new THREE.Vector3(player.pos.x, player.pos.y - 0.85, player.pos.z);
    this.shootAt(target, this.isBoss ? this.bossPhase : 1);
  }

  shootAt(target, phase) {
    this.assetAttackT = 0.42;
    this._playAssetAnimation('Attack');
    const from = this.group.position.clone();
    const baseDirection = target.clone().sub(from).normalize();
    const offsets = this.isBoss && window.SkywardCombatAI
      ? window.SkywardCombatAI.getCommanderVolleyOffsets(phase || 1)
      : [0];
    offsets.forEach(offset => {
      const direction = baseDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset);
      this.spawnProjectile(from, direction);
    });
    this.sound.enemyShot();
    this._emitCombatEvent('enemy:attack', {
      attack: this.isBoss ? 'commander-volley' : 'aimed-shot',
      phase: this.isBoss ? this.bossPhase : null,
      projectiles: offsets.length
    });
  }

  spawnProjectile(from, dir) {
    let projectile = this.projectilePool.pop();
    if (!projectile) {
      const resources = this.projectileResources;
      const mesh = new THREE.Mesh(resources.geometry, resources.material);
      const glow = new THREE.Sprite(resources.spriteMaterial);
      glow.scale.set(1.4, 1.4, 1.4); mesh.add(glow);
      projectile = { mesh, vel: new THREE.Vector3(), life: 0, damage: this.cfg.damage };
    }
    projectile.mesh.visible = true;
    projectile.mesh.position.copy(from);
    projectile.vel.copy(dir).multiplyScalar(this.isBoss ? 20 : 17);
    projectile.life = this.isBoss ? 5.5 : 5;
    projectile.damage = this.cfg.damage;
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
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
        onPlayerHit(p.damage, pp.clone(), { source: 'projectile', enemyType: this.type });
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
    this._hideTelegraph();
    if (this.telegraphLine) {
      this.scene.remove(this.telegraphLine);
      this.telegraphLine.geometry.dispose();
      this.telegraphLine.material.dispose();
      this.telegraphLine = null;
    }
    if (this.telegraphMarker) {
      this.scene.remove(this.telegraphMarker);
      this.telegraphMarker.geometry.dispose();
      this.telegraphMarker.material.dispose();
      this.telegraphMarker = null;
    }
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
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(SkywardRNG.random('ai') * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    this._currentHpMul = this.mods.hpMul * mult;
    return list;
  }

  _spawnPos() {
    const a = SkywardRNG.random('ai') * Math.PI * 2, r = 28 + SkywardRNG.random('ai') * 19;
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
      e.update(dt, player, bounds, this.enemies, world, this.onPlayerHit);
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
