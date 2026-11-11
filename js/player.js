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

  reset() {
    this.pos.set(0, this.eyeHeight, 34);
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

  update(dt, bounds) {
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

    this.pos.x += move.x * dt;
    this.pos.z += move.z * dt;

    // giới hạn sân chơi
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > bounds) {
      this.pos.x *= bounds / d;
      this.pos.z *= bounds / d;
    }

    // trọng lực + nhảy
    this.vel.y -= 30 * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= this.eyeHeight) {
      if (!this.onGround && this.vel.y < -9) this.landDip = 0.12;
      this.pos.y = this.eyeHeight;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // hồi chiêu
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.grenadeCd = Math.max(0, this.grenadeCd - dt);
    this.superCd = Math.max(0, this.superCd - dt);
    this.landDip = Math.max(0, this.landDip - dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);

    // camera bob + landing dip + shake
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
