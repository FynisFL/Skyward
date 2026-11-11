/* ============================================================
   SKYWARD SALVAGE — particles.js
   Hệ thống hạt dùng THREE.Points (một draw call, rất nhẹ).
   ============================================================ */

let _glowTex = null;
function getGlowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

class ParticleSystem {
  constructor(scene, max, opts) {
    opts = opts || {};
    this.max = max || 900;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.maxLife = new Float32Array(this.max);
    this.grav = new Float32Array(this.max);
    this.baseCol = new Float32Array(this.max * 3);
    this.cursor = 0;
    this.activeCount = 0;

    for (let i = 0; i < this.max; i++) {
      this.pos[i * 3 + 1] = -9999;
      this.life[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.colAttr = new THREE.BufferAttribute(this.col, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);

    this.mat = new THREE.PointsMaterial({
      size: 0.55,
      map: getGlowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: opts.blending || THREE.AdditiveBlending,
      sizeAttenuation: true,
      opacity: opts.opacity !== undefined ? opts.opacity : 0.95
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, r, g, b, life, gravity) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    if (this.life[i] <= 0) this.activeCount++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.baseCol[i * 3] = r; this.baseCol[i * 3 + 1] = g; this.baseCol[i * 3 + 2] = b;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity === undefined ? 9 : gravity;
  }

  burst(p, opts) {
    const o = opts || {};
    const count = o.count || 20;
    const color = o.color || [1, 0.7, 0.3];
    const color2 = o.color2 || null;
    const speed = o.speed || 7;
    const life = o.life || 0.7;
    const gravity = o.gravity === undefined ? 9 : o.gravity;
    const up = o.up || 0;
    const spread = o.spread === undefined ? 1 : o.spread;

    for (let n = 0; n < count; n++) {
      const c = (color2 && Math.random() < 0.5) ? color2 : color;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.65);
      const vx = Math.sin(ph) * Math.cos(th) * s * spread;
      const vy = Math.cos(ph) * s + up;
      const vz = Math.sin(ph) * Math.sin(th) * s * spread;
      this.spawn(
        p.x, p.y, p.z,
        vx, vy, vz,
        c[0], c[1], c[2],
        life * (0.6 + Math.random() * 0.8),
        gravity
      );
    }
  }

  update(dt) {
    const pos = this.pos, vel = this.vel, col = this.col, base = this.baseCol;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        pos[i * 3 + 1] = -9999;
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
        this.activeCount--;
        if (this.activeCount < 0) this.activeCount = 0;
        continue;
      }
      vel[i * 3 + 1] -= this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.05 && vel[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 0.05;
        vel[i * 3 + 1] *= -0.32;
        vel[i * 3] *= 0.7;
        vel[i * 3 + 2] *= 0.7;
      }
      const f = this.life[i] / this.maxLife[i];
      col[i * 3] = base[i * 3] * f;
      col[i * 3 + 1] = base[i * 3 + 1] * f;
      col[i * 3 + 2] = base[i * 3 + 2] * f;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
