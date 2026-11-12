/* ============================================================
   SKYWARD SALVAGE — player.js
   Nhân vật: di chuyển, nhìn, nhảy, máu, kỹ năng.
   ============================================================ */

class Player {
  constructor(camera, mods) {
    this.camera = camera;
    this.mods = mods || { damage: 1, speed: 1, maxHp: 100, cooldown: 1 };

    this.yaw = new THREE.Object3D();
    this.pitch = new THREE.Object3D();
    this.yaw.add(this.pitch);
    this.pitch.add(camera);
    camera.position.set(0, 0, 0);

    this.pos = this.yaw.position;
    this.vel = new THREE.Vector3();
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.touchLook = null;
    this.onGround = true;
    this.eyeHeight = 1.7;
    this.groundY = 0;
    this.gravity = 30;
    this.jumpVelocity = 10.5;
    this.maxStepUp = 0.45;
    this.maxStepDown = 0.55;
    this.collisionRadius = 0.36;
    this.collisionHeight = 1.62;

    this.maxHealth = Math.round(100 * this.mods.maxHp);
    this.health = this.maxHealth;
    this.dead = false;

    this.sensitivity = 1;
    this.invertY = false;

    this.dashCd = 0;
    this.dashCdMax = 5;
    this.dashTime = 0;
    this.grenadeCd = 0;
    this.grenadeCdMax = 9;
    this.superCd = 0;
    this.superCdMax = 26;

    this.landDip = 0;
    this.bob = 0;
    this.shake = 0;

    this.reset();
  }

  reset(world) {
    const spawnX = 0;
    const spawnZ = 34;
    const spawnGround = world && typeof world.getSpawnHeight === 'function'
      ? world.getSpawnHeight(spawnX, spawnZ)
      : (world && Number.isFinite(world.groundY) ? world.groundY : 0);
    this.groundY = Number.isFinite(spawnGround) ? spawnGround : 0;
    this.onGround = true;
    this.pos.set(spawnX, this.groundY + this.eyeHeight, spawnZ);
    this.yaw.rotation.set(0, 0, 0);
    this.pitch.rotation.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.dead = false;
    this.keys.clear();
    this.touchMove.x = 0; this.touchMove.y = 0;
    this.dashCd = this.grenadeCd = this.superCd = 0;
    this.dashTime = 0;
    this.shake = 0;
  }
  look(dx, dy) {
    const s = 0.0022 * this.sensitivity;
    this.yaw.rotation.y -= dx * s;
    const dir = this.invertY ? -1 : 1;
    this.pitch.rotation.x -= dy * s * dir;
    const lim = 1.45;
    if (this.pitch.rotation.x > lim) this.pitch.rotation.x = lim;
    if (this.pitch.rotation.x < -lim) this.pitch.rotation.x = -lim;
  }

  forwardDir() {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    return v;
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.shake = Math.min(0.5, this.shake + 0.16);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  tryDash() {
    if (this.dashCd > 0 || this.dead) return false;
    this.dashCd = this.dashCdMax * this.mods.cooldown;
    this.dashTime = 0.22;
    return true;
  }

  tryGrenade() {
    if (this.grenadeCd > 0 || this.dead) return false;
    this.grenadeCd = this.grenadeCdMax * this.mods.cooldown;
    return true;
  }

  trySuper() {
    if (this.superCd > 0 || this.dead) return false;
    this.superCd = this.superCdMax * this.mods.cooldown;
    return true;
  }

  update(dt, bounds, world) {
    if (this.dead) return;

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let speed = sprint ? 11.5 : 6.8;
    speed *= this.mods.speed;

    const yaw = this.yaw.rotation.y;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = new THREE.Vector3();

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(fwd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(fwd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (this.touchMove.y < -0.12) move.add(fwd.clone().multiplyScalar(Math.min(1, -this.touchMove.y)));
    if (this.touchMove.y > 0.12) move.sub(fwd.clone().multiplyScalar(Math.min(1, this.touchMove.y)));
    if (this.touchMove.x > 0.12) move.add(right.clone().multiplyScalar(Math.min(1, this.touchMove.x)));
    if (this.touchMove.x < -0.12) move.sub(right.clone().multiplyScalar(Math.min(1, -this.touchMove.x)));

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      this.bob += dt * (sprint ? 15 : 11);
    } else {
      this.bob *= 1 - Math.min(1, dt * 8);
    }

    if (this.dashTime > 0) {
      move.multiplyScalar(3.4);
      this.dashTime -= dt;
    }

    // Keep feet height independent from horizontal movement. Resolve X then Z
    // independently so blocked movement can slide along the wall.
    const previousFeetY = this.pos.y - this.eyeHeight;
    const canOccupy = (x, z) => {
      const distance = Math.hypot(x, z);
      if (distance > bounds) {
        const scale = bounds / distance;
        x *= scale;
        z *= scale;
      }
      if (world && typeof world.isPlayerBlocked === 'function' &&
          world.isPlayerBlocked(x, z, previousFeetY, this.collisionHeight, this.collisionRadius,
            this.onGround ? this.maxStepUp : 0)) return null;
      return { x, z };
    };
    const sweepAxis = (axis, delta) => {
      if (!delta) return;
      // Small substeps prevent fast dash movement tunnelling through thin barriers.
      const maxSubstep = Math.max(0.1, this.collisionRadius * 0.45);
      const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxSubstep));
      const step = delta / steps;
      for (let i = 0; i < steps; i++) {
        const candidate = canOccupy(
          this.pos.x + (axis === 'x' ? step : 0),
          this.pos.z + (axis === 'z' ? step : 0)
        );
        if (!candidate) break;
        this.pos.x = candidate.x;
        this.pos.z = candidate.z;
      }
    };
    sweepAxis('x', move.x * dt);
    sweepAxis('z', move.z * dt);

    const getWalkableHeight = world && typeof world.getWalkableHeight === 'function'
      ? world.getWalkableHeight.bind(world)
      : null;
    const getLandingHeight = world && typeof world.getLandingHeight === 'function'
      ? world.getLandingHeight.bind(world)
      : null;
    const fallbackGround = world && Number.isFinite(world.groundY) ? world.groundY : 0;

    if (this.onGround) {
      const supportY = getWalkableHeight
        ? getWalkableHeight(this.pos.x, this.pos.z, previousFeetY, this.maxStepUp, this.maxStepDown)
        : (Math.abs(previousFeetY - fallbackGround) <= this.maxStepUp ? fallbackGround : null);

      if (Number.isFinite(supportY)) {
        // A small rise/drop is treated as a step. Larger drops start a fall.
        this.groundY = supportY;
        this.pos.y = supportY + this.eyeHeight;
        this.vel.y = 0;
      } else {
        this.onGround = false;
      }
    }

    if (!this.onGround) {
      const fromFeetY = this.pos.y - this.eyeHeight;
      const nextFeetY = fromFeetY + this.vel.y * dt - 0.5 * this.gravity * dt * dt;
      this.vel.y -= this.gravity * dt;

      // Only land when descending through a surface from above.
      const landingY = this.vel.y <= 0 && getLandingHeight
        ? getLandingHeight(this.pos.x, this.pos.z, fromFeetY, nextFeetY)
        : (this.vel.y <= 0 && fromFeetY >= fallbackGround && nextFeetY <= fallbackGround ? fallbackGround : null);

      if (Number.isFinite(landingY)) {
        if (this.vel.y < -9) this.landDip = 0.12;
        this.groundY = landingY;
        this.pos.y = landingY + this.eyeHeight;
        this.vel.y = 0;
        this.onGround = true;
      } else {
        this.pos.y = nextFeetY + this.eyeHeight;
      }
    }

    this.dashCd = Math.max(0, this.dashCd - dt);
    this.grenadeCd = Math.max(0, this.grenadeCd - dt);
    this.superCd = Math.max(0, this.superCd - dt);
    this.landDip = Math.max(0, this.landDip - dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);

    const bobY = Math.sin(this.bob) * 0.055 * Math.min(1, move.length() / 6);
    const bobX = Math.cos(this.bob * 0.5) * 0.03 * Math.min(1, move.length() / 6);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.5;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.5;

    this.camera.position.set(bobX + shakeX, bobY - this.landDip + shakeY, 0);
  }
  cooldownFraction(kind) {
    if (kind === 'q') return this.dashCdMax * this.mods.cooldown === 0 ? 0 : this.dashCd / (this.dashCdMax * this.mods.cooldown);
    if (kind === 'e') return this.grenadeCd / (this.grenadeCdMax * this.mods.cooldown);
    if (kind === 'f') return this.superCd / (this.superCdMax * this.mods.cooldown);
    return 0;
  }
}
