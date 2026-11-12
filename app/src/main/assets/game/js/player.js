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
    const spawnSurface = world && typeof world.getSpawnSurface === 'function'
      ? world.getSpawnSurface(spawnX, spawnZ)
      : null;
    const spawnGround = spawnSurface
      ? spawnSurface.height
      : (world && typeof world.getSpawnHeight === 'function'
        ? world.getSpawnHeight(spawnX, spawnZ)
        : (world && Number.isFinite(world.groundY) ? world.groundY : 0));
    this.groundY = Number.isFinite(spawnGround) ? spawnGround : 0;
    this.groundCollider = spawnSurface ? spawnSurface.collider : null;
    this.fallFromCollider = null;
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
    let speed = (sprint ? 11.5 : 6.8) * this.mods.speed;

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

    const hasMoveInput = move.lengthSq() > 1e-6;
    if (hasMoveInput) {
      move.normalize().multiplyScalar(speed);
      this.bob += dt * (sprint ? 15 : 11);
    } else {
      this.bob *= 1 - Math.min(1, dt * 8);
    }

    const dashActive = this.dashTime > 0;
    if (dashActive) {
      move.multiplyScalar(3.4);
      this.dashTime = Math.max(0, this.dashTime - dt);
    }

    const getWalkableSurface = world && typeof world.getWalkableSurface === 'function'
      ? world.getWalkableSurface.bind(world)
      : null;
    const getWalkableHeight = world && typeof world.getWalkableHeight === 'function'
      ? world.getWalkableHeight.bind(world)
      : null;
    const getLandingSurface = world && typeof world.getLandingSurface === 'function'
      ? world.getLandingSurface.bind(world)
      : null;
    const getLandingHeight = world && typeof world.getLandingHeight === 'function'
      ? world.getLandingHeight.bind(world)
      : null;
    const fallbackGround = world && Number.isFinite(world.groundY) ? world.groundY : 0;

    // Jump input changes onGround outside this class. Capture the surface it
    // launched from so its vertical side cannot trap the player during descent.
    if (!this.onGround && !this.fallFromCollider && this.groundCollider) {
      this.fallFromCollider = this.groundCollider;
    }

    // Fixed-size physics slices keep landing checks synchronized with horizontal
    // travel, including dash. This avoids skipping narrow platforms on low FPS.
    const safeDt = Math.max(0, Math.min(dt, 0.12));
    const physicsSteps = Math.max(1, Math.ceil(safeDt / (1 / 60)));
    const stepDt = safeDt / physicsSteps;
    const maxMoveStep = Math.max(0.08, this.collisionRadius * 0.35);

    for (let physicsIndex = 0; physicsIndex < physicsSteps && safeDt > 0; physicsIndex++) {
      const feetY = this.pos.y - this.eyeHeight;
      const dx = move.x * stepDt;
      const dz = move.z * stepDt;
      const distance = Math.hypot(dx, dz);
      const moveSteps = Math.max(1, Math.ceil(distance / maxMoveStep));
      const stepX = dx / moveSteps;
      const stepZ = dz / moveSteps;

      const canOccupy = (x, z) => {
        const radialDistance = Math.hypot(x, z);
        if (radialDistance > bounds) {
          const scale = bounds / radialDistance;
          x *= scale;
          z *= scale;
        }
        if (world && typeof world.isPlayerBlocked === 'function' &&
            world.isPlayerBlocked(
              x, z, feetY, this.collisionHeight, this.collisionRadius,
              this.onGround ? this.maxStepUp : 0,
              this.onGround ? null : this.fallFromCollider
            )) return null;
        return { x, z };
      };

      for (let moveIndex = 0; moveIndex < moveSteps; moveIndex++) {
        const full = canOccupy(this.pos.x + stepX, this.pos.z + stepZ);
        if (full) {
          this.pos.x = full.x;
          this.pos.z = full.z;
          continue;
        }

        // Resolve the blocked vector by testing each axis. Prefer the axis with
        // more remaining travel so diagonal motion does not stick on corners.
        const xOnly = Math.abs(stepX) > 1e-7
          ? canOccupy(this.pos.x + stepX, this.pos.z)
          : null;
        const zOnly = Math.abs(stepZ) > 1e-7
          ? canOccupy(this.pos.x, this.pos.z + stepZ)
          : null;

        if (xOnly && zOnly) {
          if (Math.abs(dx) >= Math.abs(dz)) {
            this.pos.x = xOnly.x;
            this.pos.z = xOnly.z;
          } else {
            this.pos.x = zOnly.x;
            this.pos.z = zOnly.z;
          }
        } else if (xOnly) {
          this.pos.x = xOnly.x;
          this.pos.z = xOnly.z;
        } else if (zOnly) {
          this.pos.x = zOnly.x;
          this.pos.z = zOnly.z;
        } else {
          break;
        }
      }

      if (this.onGround) {
        const support = getWalkableSurface
          ? getWalkableSurface(this.pos.x, this.pos.z, feetY, this.maxStepUp, this.maxStepDown)
          : null;
        const supportY = support
          ? support.height
          : (getWalkableHeight
            ? getWalkableHeight(this.pos.x, this.pos.z, feetY, this.maxStepUp, this.maxStepDown)
            : (Math.abs(feetY - fallbackGround) <= this.maxStepUp ? fallbackGround : null));

        if (Number.isFinite(supportY)) {
          this.groundY = supportY;
          this.pos.y = supportY + this.eyeHeight;
          this.vel.y = 0;
          if (support) this.groundCollider = support.collider || null;
          this.fallFromCollider = null;
        } else {
          this.onGround = false;
          this.fallFromCollider = this.groundCollider || null;
        }
      }

      if (!this.onGround) {
        const fromFeetY = this.pos.y - this.eyeHeight;
        const nextFeetY = fromFeetY + this.vel.y * stepDt - 0.5 * this.gravity * stepDt * stepDt;
        const nextVelocityY = this.vel.y - this.gravity * stepDt;

        const landing = nextVelocityY <= 0 && getLandingSurface
          ? getLandingSurface(this.pos.x, this.pos.z, fromFeetY, nextFeetY)
          : null;
        const landingY = landing
          ? landing.height
          : (nextVelocityY <= 0 && getLandingHeight
            ? getLandingHeight(this.pos.x, this.pos.z, fromFeetY, nextFeetY)
            : (nextVelocityY <= 0 && fromFeetY >= fallbackGround && nextFeetY <= fallbackGround
              ? fallbackGround : null));

        if (Number.isFinite(landingY)) {
          if (nextVelocityY < -9) this.landDip = 0.12;
          this.groundY = landingY;
          this.pos.y = landingY + this.eyeHeight;
          this.vel.y = 0;
          this.onGround = true;
          if (landing) this.groundCollider = landing.collider || null;
          this.fallFromCollider = null;
        } else {
          this.pos.y = nextFeetY + this.eyeHeight;
          this.vel.y = nextVelocityY;
        }
      }
    }

    this.dashCd = Math.max(0, this.dashCd - dt);
    this.grenadeCd = Math.max(0, this.grenadeCd - dt);
    this.superCd = Math.max(0, this.superCd - dt);
    this.landDip = Math.max(0, this.landDip - dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);

    const bobAmount = hasMoveInput ? Math.min(1, move.length() / 6) : 0;
    const bobY = Math.sin(this.bob) * 0.055 * bobAmount;
    const bobX = Math.cos(this.bob * 0.5) * 0.03 * bobAmount;
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
