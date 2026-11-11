/* ============================================================
   SKYWARD SALVAGE — weapons.js
   3 vũ khí, hitscan, lựu đạn, không kích, viewmodel.
   ============================================================ */

const WEAPONS = {
  auto: {
    key: 'auto', name: 'SÚNG TRƯỜNG TỰ ĐỘNG', short: 'AUTO',
    damage: 15, rate: 0.105, mag: 32, reserve: 320, reload: 1.5,
    spread: 0.02, recoil: 0.011, auto: true, range: 140,
    tracer: 0xffe2b8, tracerLife: 0.075, flashSize: 0.85, flashColor: 0xffd9a0, shellRate: 1,
    sound: 'auto'
  },
  handcannon: {
    key: 'handcannon', name: 'SÚNG NGẮN NẶNG', short: 'CANNON',
    damage: 66, rate: 0.62, mag: 6, reserve: 60, reload: 2.0,
    spread: 0.004, recoil: 0.05, auto: false, range: 200,
    tracer: 0xffb066, tracerLife: 0.11, flashSize: 1.6, flashColor: 0xffc070, shellRate: 1.4,
    sound: 'handcannon'
  },
  scout: {
    key: 'scout', name: 'SÚNG TRƯỜNG CHÍNH XÁC', short: 'SCOUT',
    damage: 34, rate: 0.3, mag: 12, reserve: 120, reload: 1.7,
    spread: 0.0015, recoil: 0.026, auto: false, range: 300,
    tracer: 0xa8dcff, tracerLife: 0.10, flashSize: 1.15, flashColor: 0xd6eaff, shellRate: 1.2,
    sound: 'scout'
  }
};
const WEAPON_ORDER = ['auto', 'handcannon', 'scout'];

class WeaponSystem {
  constructor(opts) {
    this.camera = opts.camera;
    this.scene = opts.scene;
    this.particles = opts.particles;
    this.player = opts.player;
    this.sound = opts.sound;
    this.getEnemies = opts.getEnemies;
    this.getHitMeshes = opts.getHitMeshes;
    this.getWorldMeshes = opts.getWorldMeshes;
    this.onShot = opts.onShot || function () {};
    this.onHit = opts.onHit || function () {};
    this.onKill = opts.onKill || function () {};

    this.raycaster = new THREE.Raycaster();
    this.current = 'auto';
    this.state = {};
    WEAPON_ORDER.forEach(k => {
      const d = WEAPONS[k];
      this.state[k] = { mag: d.mag, reserve: d.reserve };
    });

    this.cooldown = 0;
    this.reloading = 0;
    this.aiming = false;
    this.baseFov = 75;
    this.recoilPitch = 0;
    this._wasTriggerDown = false;
    this.vfx = opts.vfx || null;
    this.onImpact = opts.onImpact || function () {};

    this.grenades = [];
    this.strikes = [];

    this._buildViewmodels();
  }

  // ---------------- viewmodel ----------------
  _buildViewmodels() {
    this.rig = new THREE.Group();
    // Raise and center the first-person weapon slightly to prevent lower-edge clipping.
    this.rig.position.set(0.22, -0.24, -0.62);
    this.camera.add(this.rig);
    // Camera-space fill lights improve metallic viewmodel readability without
    // changing world lighting or enemy shading.
    this.viewmodelFill = new THREE.PointLight(0xc8e4ff, 1.05, 3.8, 2);
    this.viewmodelFill.position.set(0.18, -0.12, -1.15);
    this.camera.add(this.viewmodelFill);
    this.viewmodelRim = new THREE.DirectionalLight(0xe3f2ff, 0.55);
    this.viewmodelRim.position.set(-0.35, 0.45, -0.4);
    this.camera.add(this.viewmodelRim);

    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x2f363d, roughness: 0.5, metalness: 0.7 });
    const gunAccent = new THREE.MeshStandardMaterial({ color: 0xff7a2f, roughness: 0.4, metalness: 0.3, emissive: 0x903a08, emissiveIntensity: 0.5 });
    const gunDark = new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.6, metalness: 0.6 });
    this.accentMaterial = gunAccent;
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x171f25, roughness: 0.78, metalness: 0.12 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x34434c, roughness: 0.8, metalness: 0.18 });

    const models = {};

    // auto rifle
    const auto = new THREE.Group();
    const aBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.5), gunMetal);
    const aBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), gunDark);
    aBarrel.rotation.x = Math.PI / 2; aBarrel.position.set(0, 0.02, -0.42);
    const aMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), gunDark);
    aMag.position.set(0, -0.13, 0.02); aMag.rotation.x = 0.2;
    this._autoMagazine = aMag; this._autoMagazineBase = aMag.position.clone();
    const aSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.1), gunAccent);
    aSight.position.set(0, 0.1, -0.1);
    const aGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), gunDark);
    aGrip.position.set(0, -0.11, 0.16); aGrip.rotation.x = 0.3;
    auto.add(aBody, aBarrel, aMag, aSight, aGrip);
    models.auto = auto;

    // hand cannon
    const cannon = new THREE.Group();
    const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.34), gunMetal);
    const cBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34, 12), gunDark);
    cBarrel.rotation.x = Math.PI / 2; cBarrel.position.set(0, 0.03, -0.3);
    const cDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), gunAccent);
    cDrum.rotation.z = Math.PI / 2; cDrum.position.set(0, -0.02, -0.02);
    this._cannonDrum = cDrum; this._cannonDrumBase = cDrum.rotation.clone();
    const cGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.07), gunDark);
    cGrip.position.set(0, -0.13, 0.13); cGrip.rotation.x = 0.35;
    cannon.add(cBody, cBarrel, cDrum, cGrip);
    models.handcannon = cannon;

    // scout
    const scout = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.66), gunMetal);
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 10), gunDark);
    sBarrel.rotation.x = Math.PI / 2; sBarrel.position.set(0, 0.02, -0.55);
    const sScope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), gunAccent);
    sScope.rotation.x = Math.PI / 2; sScope.position.set(0, 0.09, -0.12);
    const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.2), gunDark);
    sStock.position.set(0, -0.05, 0.36);
    const sBolt = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.12), gunAccent);
    sBolt.position.set(0.055, 0.055, 0.04);
    scout.add(sBody, sBarrel, sScope, sStock, sBolt);
    this._scoutBolt = sBolt; this._scoutBoltBase = sBolt.position.clone();
    models.scout = scout;

    // Replace blockout weapons with the Quaternius glTF models. Procedural parts
    // remain hidden as a safe fallback if an asset definition is unavailable.
    this.externalWeaponModels = Object.create(null);
    if (window.SkywardAssetFactory) {
      const weaponAssets = {
        auto: { name: 'Gun_Rifle', scale: 0.62 },
        handcannon: { name: 'Gun_Revolver', scale: 0.92 },
        scout: { name: 'Gun_Sniper', scale: 0.39 }
      };
      Object.keys(weaponAssets).forEach(key => {
        const spec = weaponAssets[key];
        const asset = window.SkywardAssetFactory.createStatic(spec.name);
        if (!asset) return;
        const bounds = new THREE.Box3().setFromObject(asset);
        const center = bounds.getCenter(new THREE.Vector3());
        asset.position.sub(center);
        const wrapper = new THREE.Group();
        wrapper.name = 'External_' + spec.name;
        wrapper.rotation.y = Math.PI / 2;
        wrapper.scale.setScalar(spec.scale);
        wrapper.position.set(0, 0.01, -0.06);
        wrapper.add(asset);
        wrapper.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        models[key].children.forEach(child => { child.visible = false; });
        models[key].add(wrapper);
        this.externalWeaponModels[key] = wrapper;
      });
    }

    Object.keys(models).forEach(k => {
      models[k].visible = false;
      this.rig.add(models[k]);
    });
    this.models = models;
    this.models[this.current].visible = true;

    // Forearms and gloves provide a consistent first-person silhouette.
    this.arms = new THREE.Group();
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.105, 0.42, 8), sleeveMat);
    armL.rotation.x = -0.42; armL.rotation.z = -0.42; armL.position.set(-0.25, -0.31, 0.08);
    const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), gloveMat);
    gloveL.position.set(-0.19, -0.22, -0.08);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.105, 0.36, 8), sleeveMat);
    armR.rotation.x = -0.3; armR.rotation.z = 0.35; armR.position.set(0.27, -0.29, 0.2);
    const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), gloveMat);
    gloveR.position.set(0.19, -0.2, 0.02);
    this.arms.add(armL, gloveL, armR, gloveR); this.rig.add(this.arms);
    this.motionT = 0; this.reloadAnim = 0; this.switchAnim = 0; this.inspectT = 0;
    this.reloadDuration = 0; this.weaponSwapT = 0;
  }

  _muzzlePos(origin, dir) {
    const p = origin.clone().add(dir.clone().multiplyScalar(1.1));
    p.y -= 0.05;
    return p;
  }

  // ---------------- state ----------------
  def() { return WEAPONS[this.current]; }
  ammo() { return this.state[this.current]; }

  switchWeapon(key) {
    if (!WEAPONS[key] || key === this.current) return;
    this.models[this.current].visible = false;
    this.current = key;
    this.models[key].visible = true;
    this.reloading = 0;
    this.cooldown = Math.max(this.cooldown, 0.25);
    this.rig.position.z = -0.62 + 0.16;
    this.switchAnim = 0.42;
    this.weaponSwapT = 0.42;
    this.sound.reload();
    if (this.onSwitch) this.onSwitch(key);
  }

  cycle(dir) {
    const i = WEAPON_ORDER.indexOf(this.current);
    const n = WEAPON_ORDER[(i + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    this.switchWeapon(n);
  }

  startReload() {
    const d = this.def(), s = this.ammo();
    if (this.reloading > 0 || s.mag >= d.mag || s.reserve <= 0) return;
    this.reloading = d.reload / Math.max(0.5, this.player.mods.reloadSpeed || 1);
    this.reloadDuration = this.reloading;
    this.reloadAnim = 1;
    this.sound.reload();
  }

  _finishReload() {
    const d = this.def(), s = this.ammo();
    const need = d.mag - s.mag;
    const take = Math.min(need, s.reserve);
    s.mag += take;
    s.reserve -= take;
  }

  setAiming(a) { this.aiming = a; }

  // ---------------- shooting ----------------
  _origin() {
    const p = new THREE.Vector3();
    this.camera.getWorldPosition(p);
    return p;
  }

  _dir(spread) {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    if (spread > 0) {
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.z += (Math.random() - 0.5) * spread * 2;
      d.normalize();
    }
    return d;
  }

  tryFire(triggerDown) {
    const d = this.def();
    // LƯU Ý: phải xử lý nhả chuột TRƯỚC, nếu không vũ khí bắn đơn sẽ kẹt
    // _wasTriggerDown = true và không bao giờ bắn được nữa.
    if (!triggerDown) { this._wasTriggerDown = false; return; }
    if (!d.auto && this._wasTriggerDown) return;
    this._wasTriggerDown = true;

    if (this.cooldown > 0 || this.reloading > 0 || this.player.dead) return;

    const s = this.ammo();
    if (s.mag <= 0) {
      this.sound.dry();
      this.startReload();
      this.cooldown = 0.28;
      return;
    }

    s.mag--;
    this.cooldown = d.rate / Math.max(0.5, this.player.mods.fireRate || 1);
    const spread = d.spread * (this.aiming ? 0.35 : 1);
    const dir = this._dir(spread);
    const origin = this._origin();

    this.raycaster.set(origin, dir);
    this.raycaster.far = d.range;

    const hitMeshes = this.getHitMeshes();
    const worldMeshes = this.getWorldMeshes();
    const hits = this.raycaster.intersectObjects(hitMeshes, false);
    const whits = this.raycaster.intersectObjects(worldMeshes, false);

    let end = origin.clone().add(dir.clone().multiplyScalar(d.range));
    let hitEnemy = null;
    let hitPoint = null;
    let hitNormal = null;
    let surface = null;

    const wh = whits.length ? whits[0] : null;
    const eh = hits.length ? hits[0] : null;

    if (eh && (!wh || eh.distance < wh.distance)) {
      hitEnemy = eh.object.userData.enemy || null;
      hitPoint = eh.point;
      end = eh.point.clone();
      hitNormal = eh.face ? eh.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      hitNormal.transformDirection(eh.object.matrixWorld);
    } else if (wh) {
      hitPoint = wh.point;
      end = wh.point.clone();
      hitNormal = wh.face ? wh.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      hitNormal.transformDirection(wh.object.matrixWorld);
      surface = wh.object.userData.surface || 'concrete';
    }

    // ---- hiệu ứng ----
    const mpos = this._muzzlePos(origin, dir);
    const vfx = this.vfx;
    if (vfx) {
      vfx.flash(mpos, {
        size: d.flashSize * (this.aiming ? 0.8 : 1),
        life: 0.055, color: d.flashColor, opacity: 0.95
      });
      vfx.flashLight(mpos, d.flashColor, this.current === 'handcannon' ? 3.4 : 2.0, 0.07);
      vfx.tracer(mpos, end, d.tracer, d.tracerLife);

      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
      right.y = 0;
      right.normalize();
      vfx.shell(mpos, right);

      if (Math.random() < 0.5) {
        vfx.smoke(mpos, { size: 0.32, grow: 1.5, rise: 0.5, life: 0.5, color: 0x9a9a96, opacity: 0.22 });
      }
    }
    this.sound.shoot(d.sound);

    // giật + FOV
    const recoil = d.recoil * (this.aiming ? 0.55 : 1);
    this.player.pitch.rotation.x += recoil;
    this.player.yaw.rotation.y += (Math.random() - 0.5) * recoil * 0.5;
    this.recoilPitch = Math.min(0.25, this.recoilPitch + recoil * 0.6);
    this.rig.position.z = -0.62 + 0.09;
    this.rig.rotation.x = -recoil * 2.4;
    if (vfx) vfx.shake = Math.min(0.5, vfx.shake + recoil * 1.2);

    this.onShot();

    if (hitEnemy && hitEnemy.alive) {
      if (hitNormal) hitPoint.addScaledVector(hitNormal, 0.02);
      const weakpointMultiplier = eh.object.userData.weakpoint ? 1.8 : 1;
      const appliedDamage = d.damage * this.player.mods.damage * weakpointMultiplier;
      const killed = hitEnemy.takeDamage(appliedDamage, hitPoint);
      if (hitNormal && hitEnemy.alive) hitEnemy.flinch(hitNormal);
      this.sound.hit();
      this.onHit(hitEnemy, appliedDamage, killed, 'firearm');
      if (killed) this.onKill(hitEnemy);
    } else if (hitPoint && hitNormal && surface) {
      if (vfx) vfx.impact(hitPoint, hitNormal, surface);
      this.onImpact(hitPoint, surface);
    }
  }

  inspect() {
    if (this.inspectT > 0 || this.reloading > 0) return false;
    this.inspectT = 1.15;
    this.sound.ui();
    return true;
  }

  // ---------------- grenade ----------------
  _disposeGrenadeObject(root) {
    if (!root || !root.traverse) return;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.ownedGeometry && o.geometry) o.geometry.dispose();
      if (o.userData.ownedMaterial && o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

  throwGrenade() {
    if (!this.player.tryGrenade()) return false;
    const dir = this._dir(0);
    const origin = this._origin().add(dir.clone().multiplyScalar(0.6));
    let mesh = window.SkywardAssetFactory ? window.SkywardAssetFactory.createStatic('Prop_Grenade') : null;
    if (mesh) {
      mesh.scale.setScalar(1.15);
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f363d, roughness: 0.4, metalness: 0.7, emissive: 0xff7a2f, emissiveIntensity: 0.6 })
      );
      mesh.userData.ownedGeometry = true;
      mesh.userData.ownedMaterial = true;
    }
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const vel = dir.multiplyScalar(24);
    vel.y += 5;
    this.grenades.push({ mesh, vel, life: 3.2, fuse: 1.6 });
    this.sound.ui();
    return true;
  }

  // ---------------- super: airstrike ----------------
  callSuper() {
    if (!this.player.trySuper()) return false;
    const dir = this._dir(0);
    const origin = this._origin();
    this.raycaster.set(origin, dir);
    this.raycaster.far = 80;
    const wh = this.raycaster.intersectObjects(this.getWorldMeshes(), false);
    let target;
    if (wh.length) target = wh[0].point.clone();
    else target = origin.clone().add(dir.multiplyScalar(30));
    target.y = 0;

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
      const r = i === 0 ? 0 : 3 + Math.random() * 8;
      this.strikes.push({
        x: target.x + Math.cos(a) * r,
        z: target.z + Math.sin(a) * r,
        t: 0.55 + i * 0.16
      });
    }
    this.sound.wave();
    return true;
  }

  explode(p, radius, damage, fromPlayer) {
    if (this.vfx) this.vfx.explosion(p, radius, radius > 8);
    this.sound.explosion(true);

    if (fromPlayer) {
      const enemies = this.getEnemies();
      enemies.forEach(e => {
        if (!e.alive) return;
        const d = e.group.position.distanceTo(p);
        if (d < radius) {
          const killed = e.takeDamage(damage * (1 - (d / radius) * 0.6) * this.player.mods.damage, e.group.position);
          this.onHit(e, damage * (1 - (d / radius) * 0.6) * this.player.mods.damage, killed, 'ability');
          if (killed) this.onKill(e);
        }
      });
      const pd = this.player.pos.distanceTo(p);
      if (pd < radius * 0.7) this.player.damage(Math.round(14 * (1 - pd / radius)));
    }
  }

  // ---------------- update ----------------
  update(dt, triggerDown) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this._finishReload(); }
    }
    this.tryFire(triggerDown);

    // FOV
    const targetFov = this.aiming ? 52 : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.4) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
      this.camera.updateProjectionMatrix();
    }
    // Weapon sway, reload and swap animation.
    this.motionT += dt;
    if (this.reloadAnim > 0) this.reloadAnim = this.reloading > 0 && this.reloadDuration > 0 ? 1 - this.reloading / this.reloadDuration : 0;
    if (this.switchAnim > 0) this.switchAnim = Math.max(0, this.switchAnim - dt);
    this.weaponSwapT = Math.max(0, this.weaponSwapT - dt);
    if (this.inspectT > 0) this.inspectT = Math.max(0, this.inspectT - dt);
    const moving = this.player.keys.size > 0 || Math.abs(this.player.touchMove.x) + Math.abs(this.player.touchMove.y) > 0.2;
    const sway = moving ? 1 : 0.28;
    const targetX = 0.22 + Math.sin(this.motionT * 7) * 0.012 * sway;
    const reloadProgress = this.reloading > 0 && this.reloadDuration > 0 ? 1 - this.reloading / this.reloadDuration : 0;
    const reloadDip = this.reloading > 0 ? Math.sin(reloadProgress * Math.PI) * 0.2 : 0;
    this.rig.position.x += (targetX - this.rig.position.x) * Math.min(1, dt * 8);
    this.rig.position.y += (-0.24 - reloadDip - this.rig.position.y) * Math.min(1, dt * 7);
    this.rig.position.z += (-0.62 - this.rig.position.z + (this.switchAnim > 0 ? 0.28 : 0)) * Math.min(1, dt * 10);
    const inspectPose = this.inspectT > 0 ? Math.sin((1.15 - this.inspectT) / 1.15 * Math.PI) : 0;
    this.rig.rotation.x += (inspectPose * -0.12 - this.rig.rotation.x) * Math.min(1, dt * 7);
    this.rig.rotation.z += (inspectPose * 0.08 - this.rig.rotation.z) * Math.min(1, dt * 7);
    // Weapon-specific reload motions: magazine release, revolver cylinder turn, or scout bolt cycle.
    const reloadPulse = this.reloading > 0 ? Math.sin(Math.min(1, reloadProgress) * Math.PI) : 0;
    if (this._autoMagazine) this._autoMagazine.position.y = this._autoMagazineBase.y - (this.current === 'auto' ? reloadPulse * 0.12 : 0);
    if (this._cannonDrum) this._cannonDrum.rotation.x = this._cannonDrumBase.x + (this.current === 'handcannon' ? reloadPulse * 0.9 : 0);
    if (this._scoutBolt) this._scoutBolt.position.z = this._scoutBoltBase.z + (this.current === 'scout' ? reloadPulse * 0.09 : 0);
    // Inspect rotates the selected weapon around its own grip instead of tilting the whole camera rig.
    Object.keys(this.models).forEach(k => {
      const m = this.models[k];
      const active = k === this.current;
      const inspect = active ? inspectPose : 0;
      const swap = active && this.weaponSwapT > 0 ? Math.sin((1 - this.weaponSwapT / 0.42) * Math.PI) : 0;
      m.rotation.y += ((inspect * 0.42 + swap * 0.08) - m.rotation.y) * Math.min(1, dt * 8);
      m.rotation.z += ((inspect * -0.16) - m.rotation.z) * Math.min(1, dt * 8);
    });
    this.arms.position.y += ((moving ? Math.sin(this.motionT * 14) * 0.018 : 0) - this.arms.position.y) * Math.min(1, dt * 9);
    this.recoilPitch *= 1 - Math.min(1, dt * 6);
    this.player.pitch.rotation.x -= this.recoilPitch * dt * 3;
    // viewmodel theo weapon
    const vmScale = this.aiming ? 0.82 : 1;
    this.rig.scale.lerp(new THREE.Vector3(vmScale, vmScale, vmScale), Math.min(1, dt * 10));

    // VFX (tracer, vỏ đạn, khói, decal, shockwave)
    if (this.vfx) this.vfx.update(dt);

    // grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vel.y -= 26 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 8;
      g.life -= dt; g.fuse -= dt;
      let boom = g.fuse <= 0 || g.life <= 0;
      if (g.mesh.position.y <= 0.15) boom = true;
      if (!boom) {
        const enemies = this.getEnemies();
        for (const e of enemies) {
          if (e.alive && e.group.position.distanceTo(g.mesh.position) < 1.4) { boom = true; break; }
        }
      }
      if (boom) {
        this.explode(g.mesh.position.clone(), 7.5, 62, true);
        this.scene.remove(g.mesh);
        this._disposeGrenadeObject(g.mesh);
        this.grenades.splice(i, 1);
      }
    }

    // airstrikes
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      if (s.t <= 0) {
        const p = new THREE.Vector3(s.x, 0.2, s.z);
        this.explode(p, 8.5, 95, true);
        this.strikes.splice(i, 1);
      }
    }
  }

  setCosmeticLevel(level) {
    if (!this.accentMaterial) return;
    this.accentMaterial.color.setHex(level >= 3 ? 0x42d4c8 : 0xff7a2f);
    this.accentMaterial.emissive.setHex(level >= 3 ? 0x126f6d : 0x903a08);
  }

  reset() {
    WEAPON_ORDER.forEach(k => {
      this.state[k].mag = WEAPONS[k].mag;
      this.state[k].reserve = WEAPONS[k].reserve;
    });
    this.current = 'auto';
    Object.keys(this.models).forEach(k => { this.models[k].visible = (k === 'auto'); });
    this.rig.position.set(0.3, -0.3, -0.62); this.rig.rotation.set(0, 0, 0); this.rig.scale.setScalar(1);
    this.reloadAnim = 0; this.switchAnim = 0; this.inspectT = 0;
    this.cooldown = 0; this.reloading = 0; this.aiming = false;
    this._wasTriggerDown = false; this.recoilPitch = 0;
    this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
    this.grenades.forEach(g => {
      this.scene.remove(g.mesh);
      this._disposeGrenadeObject(g.mesh);
    });
    this.strikes.length = 0;
    this.grenades.length = 0;
    if (this.vfx) this.vfx.reset();
  }
}
