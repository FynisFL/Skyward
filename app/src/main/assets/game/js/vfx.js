/* ============================================================
   SKYWARD SALVAGE — vfx.js  (V2)
   Hiệu ứng chiến đấu: tracer, vỏ đạn, khói, muzzle flash,
   shockwave, impact theo bề mặt, vụ nổ nhiều lớp.
   Tất cả đều dùng object pooling — không new trong vòng lặp.
   ============================================================ */

const VFX_SURFACES = {
  concrete: { color: [0.78, 0.76, 0.70], color2: [0.52, 0.50, 0.46], speed: 5, dust: true, dustColor: [0.62, 0.60, 0.56], decalScale: 0.30 },
  asphalt: { color: [0.45, 0.46, 0.48], color2: [0.30, 0.31, 0.33], speed: 5, dust: true, dustColor: [0.38, 0.39, 0.41], decalScale: 0.30 },
  metal: { spark: true, color: [1.0, 0.80, 0.35], color2: [1.0, 0.96, 0.72], speed: 9, dust: false, decalScale: 0.20 },
  gunmetal: { spark: true, color: [1.0, 0.82, 0.40], color2: [1.0, 0.95, 0.70], speed: 9, dust: false, decalScale: 0.20 },
  stone: { color: [0.62, 0.58, 0.52], color2: [0.42, 0.39, 0.35], speed: 6, dust: true, dustColor: [0.52, 0.49, 0.44], decalScale: 0.34 },
  ground: { color: [0.48, 0.39, 0.28], color2: [0.32, 0.26, 0.19], speed: 4, dust: true, dustColor: [0.44, 0.36, 0.27], decalScale: 0.36 },
  grass: { color: [0.38, 0.45, 0.24], color2: [0.46, 0.37, 0.26], speed: 4, dust: true, dustColor: [0.42, 0.38, 0.28], decalScale: 0.36 },
  wood: { color: [0.55, 0.42, 0.26], color2: [0.38, 0.29, 0.18], speed: 5, dust: true, dustColor: [0.50, 0.40, 0.28], decalScale: 0.30 },
  rust: { spark: true, color: [1.0, 0.72, 0.30], color2: [0.9, 0.55, 0.25], speed: 7, dust: true, dustColor: [0.45, 0.34, 0.26], decalScale: 0.24 },
  enemy: { color: [1.0, 0.35, 0.25], color2: [0.9, 0.2, 0.15], speed: 6, dust: false, decalScale: 0 }
};

class Vfx {
  constructor(scene, particles, dustParticles, opts) {
    opts = opts || {};
    this.scene = scene;
    this.particles = particles;
    this.dust = dustParticles;
    this.quality = opts.quality || 'med';
    this.reducedMotion = false;
    this.shake = 0;

    const q = this.quality;
    this.decals = new DecalPool(scene, q === 'low' ? 24 : q === 'high' ? 64 : 48);

    this.counts = {
      tracer: q === 'low' ? 12 : q === 'high' ? 32 : 20,
      shell: q === 'low' ? 16 : q === 'high' ? 40 : 28,
      smoke: q === 'low' ? 20 : q === 'high' ? 60 : 40,
      ring: 8,
      flash: 10,
      light: 2
    };

    this._tracers = [];
    this._shells = [];
    this._smokes = [];
    this._rings = [];
    this._flashes = [];
    this._lights = [];
    this._tc = 0; this._sc = 0; this._smc = 0; this._rc = 0; this._fc = 0; this._lc = 0;

    this._build();
  }

  _build() {
    const c = this.counts;
    let i;

    // ---- tracer ----
    const tGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 5, 1, true);
    for (i = 0; i < c.tracer; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const m = new THREE.Mesh(tGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this._tracers.push({ mesh: m, life: 0, max: 1 });
    }

    // ---- vỏ đạn ----
    const sGeo = new THREE.BoxGeometry(0.022, 0.022, 0.055);
    const sMat = new THREE.MeshStandardMaterial({ color: 0xb08d4f, roughness: 0.35, metalness: 0.9 });
    for (i = 0; i < c.shell; i++) {
      const m = new THREE.Mesh(sGeo, sMat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this._shells.push({
        mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, max: 1
      });
    }

    // ---- khói ----
    const smokeTex = Tex.special('smoke');
    for (i = 0; i < c.smoke; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex, color: 0x8a8a86, transparent: true, opacity: 0, depthWrite: false
      });
      const m = new THREE.Sprite(mat);
      m.visible = false;
      this.scene.add(m);
      this._smokes.push({ mesh: m, life: 0, max: 1, base: 1, baseOp: 0.4, grow: 1.6, rise: 1.2 });
    }

    // ---- shockwave ----
    const ringTex = Tex.special('ring');
    const rGeo = new THREE.PlaneGeometry(1, 1);
    for (i = 0; i < c.ring; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: ringTex, color: 0xffe8cc, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      const m = new THREE.Mesh(rGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this._rings.push({ mesh: m, life: 0, max: 1, size: 1 });
    }

    // ---- muzzle flash ----
    const flashTex = Tex.special('flash');
    for (i = 0; i < c.flash; i++) {
      const mat = new THREE.SpriteMaterial({
        map: flashTex, color: 0xffe0b0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const m = new THREE.Sprite(mat);
      m.visible = false;
      this.scene.add(m);
      this._flashes.push({ mesh: m, life: 0, max: 1, size: 1 });
    }

    // ---- đèn tạm ----
    for (i = 0; i < c.light; i++) {
      const l = new THREE.PointLight(0xffa050, 0, 30);
      this.scene.add(l);
      this._lights.push({ light: l, life: 0, max: 1, peak: 4 });
    }
  }

  // ---------------- spawners ----------------
  tracer(from, to, colorHex, life) {
    const t = this._tracers[this._tc];
    this._tc = (this._tc + 1) % this._tracers.length;
    const len = from.distanceTo(to);
    if (len < 1.2) return;
    t.mesh.visible = true;
    t.mesh.material.color.setHex(colorHex);
    t.mesh.material.opacity = 0.85;
    t.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    t.mesh.scale.set(1, len, 1);
    t.mesh.lookAt(to);
    t.mesh.rotateX(Math.PI / 2);
    t.max = life || 0.08;
    t.life = t.max;
  }

  shell(pos, right) {
    const s = this._shells[this._sc];
    this._sc = (this._sc + 1) % this._shells.length;
    s.mesh.visible = true;
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    s.mesh.scale.set(1, 1, 1);
    s.vel.set(
      right.x * (1.4 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.7,
      2.1 + Math.random() * 1.5,
      right.z * (1.4 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.7
    );
    s.spin.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    s.max = 1.4;
    s.life = s.max;
  }

  smoke(pos, opts) {
    const o = opts || {};
    const s = this._smokes[this._smc];
    this._smc = (this._smc + 1) % this._smokes.length;
    s.mesh.visible = true;
    s.mesh.position.copy(pos);
    s.mesh.material.color.setHex(o.color !== undefined ? o.color : 0x8a8a86);
    s.mesh.material.rotation = Math.random() * Math.PI * 2;
    const sc = o.size || 0.8;
    s.base = sc;
    s.baseOp = o.opacity !== undefined ? o.opacity : 0.4;
    s.grow = o.grow !== undefined ? o.grow : 1.6;
    s.rise = o.rise !== undefined ? o.rise : 1.2;
    s.mesh.scale.set(sc, sc, sc);
    s.mesh.material.opacity = s.baseOp;
    s.max = o.life || 0.9;
    s.life = s.max;
  }

  flash(pos, opts) {
    const o = opts || {};
    const f = this._flashes[this._fc];
    this._fc = (this._fc + 1) % this._flashes.length;
    f.mesh.visible = true;
    f.mesh.position.copy(pos);
    f.mesh.material.rotation = Math.random() * Math.PI * 2;
    if (o.color !== undefined) f.mesh.material.color.setHex(o.color);
    const sc = o.size || 1;
    f.size = sc;
    f.mesh.scale.set(sc, sc, sc);
    f.mesh.material.opacity = o.opacity !== undefined ? o.opacity : 0.95;
    f.max = o.life || 0.06;
    f.life = f.max;
  }

  shockwave(pos, size, opts) {
    const o = opts || {};
    const r = this._rings[this._rc];
    this._rc = (this._rc + 1) % this._rings.length;
    r.mesh.visible = true;
    r.mesh.position.copy(pos);
    r.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    r.mesh.material.opacity = o.opacity !== undefined ? o.opacity : 0.9;
    r.size = size;
    r.max = o.life || 0.4;
    r.life = r.max;
  }

  flashLight(pos, colorHex, intensity, life) {
    const l = this._lights[this._lc];
    this._lc = (this._lc + 1) % this._lights.length;
    l.light.position.set(pos.x, pos.y + 1.2, pos.z);
    l.light.color.setHex(colorHex === undefined ? 0xffa050 : colorHex);
    l.peak = intensity || 4;
    l.max = life || 0.16;
    l.life = l.max;
  }

  // ---------------- impact theo bề mặt ----------------
  impact(point, normal, surface) {
    const cfg = VFX_SURFACES[surface] || VFX_SURFACES.concrete;
    const n = normal || new THREE.Vector3(0, 1, 0);

    this.particles.burst(point, {
      count: cfg.spark ? 14 : 7,
      color: cfg.color, color2: cfg.color2,
      speed: cfg.speed, life: 0.32, gravity: 14, spread: 1
    });

    if (cfg.dust) {
      const dp = point.clone().addScaledVector(n, 0.08);
      this.dust.burst(dp, {
        count: 7, color: cfg.dustColor, speed: 2.6, life: 0.75, gravity: 2.5, up: 1.4, spread: 1
      });
    }

    if (cfg.decalScale > 0) {
      this.decals.spawn(point, n, { scale: cfg.decalScale, life: 13, opacity: 0.9 });
    }
  }

  // ---------------- vụ nổ nhiều lớp ----------------
  explosion(point, radius, big) {
    const p = point.clone();
    const R = this.reducedMotion ? 0.5 : 1;

    // 1) flash
    this.flash(p, { size: (big ? 7 : 4) * R, life: 0.12, color: 0xfff0d0, opacity: 0.95 });
    // 2) shockwave
    this.shockwave(p, radius * (big ? 2.4 : 1.6), { life: big ? 0.5 : 0.35, opacity: 0.85 });
    // 3) fireball
    this.particles.burst(p, {
      count: Math.round((big ? 60 : 34) * R),
      color: [1, 0.62, 0.20], color2: [1, 0.93, 0.55],
      speed: big ? 18 : 13, life: 0.7, gravity: 8, up: 3.5, spread: 1
    });
    // 4) khói
    const nSmoke = Math.round((big ? 8 : 4) * R);
    for (let i = 0; i < nSmoke; i++) {
      const sp = p.clone();
      sp.x += (Math.random() - 0.5) * radius * 0.7;
      sp.z += (Math.random() - 0.5) * radius * 0.7;
      sp.y += Math.random() * 0.9;
      this.smoke(sp, {
        size: (1.2 + Math.random() * 1.5) * (big ? 1.3 : 1),
        grow: 2.3, rise: 1.7,
        life: 1.1 + Math.random() * 0.5,
        color: 0x4a4744, opacity: 0.42
      });
    }
    // 5) mảnh vỡ
    this.dust.burst(p, {
      count: Math.round((big ? 30 : 16) * R),
      color: [0.25, 0.23, 0.21], color2: [0.46, 0.41, 0.36],
      speed: big ? 16 : 11, life: 1.25, gravity: 17, up: 6.5, spread: 1
    });
    // 6) bụi mặt đất
    const nDust = Math.round((big ? 16 : 8) * R);
    for (let i = 0; i < nDust; i++) {
      const a = (i / nDust) * Math.PI * 2;
      const dp = new THREE.Vector3(
        p.x + Math.cos(a) * radius * 0.55, 0.16, p.z + Math.sin(a) * radius * 0.55
      );
      this.dust.burst(dp, {
        count: 3, color: [0.52, 0.48, 0.42], speed: 5, life: 0.85, gravity: 3, up: 1.6, spread: 1
      });
    }
    // 7) đèn tạm
    this.flashLight(p, big ? 0xff9a48 : 0xffc080, big ? 7 : 4.5, big ? 0.2 : 0.15);
    // 8) rung
    this.shake = Math.min(0.85, this.shake + (big ? 0.5 : 0.3));
  }

  // ---------------- update ----------------
  update(dt) {
    let i, o;

    for (i = 0; i < this._tracers.length; i++) {
      o = this._tracers[i];
      if (o.life <= 0) continue;
      o.life -= dt;
      if (o.life <= 0) { o.mesh.visible = false; o.mesh.material.opacity = 0; continue; }
      o.mesh.material.opacity = 0.85 * (o.life / o.max);
    }

    for (i = 0; i < this._shells.length; i++) {
      o = this._shells[i];
      if (o.life <= 0) continue;
      o.life -= dt;
      if (o.life <= 0) { o.mesh.visible = false; continue; }
      o.vel.y -= 18 * dt;
      o.mesh.position.addScaledVector(o.vel, dt);
      if (o.mesh.position.y < 0.035 && o.vel.y < 0) {
        o.mesh.position.y = 0.035;
        o.vel.y *= -0.34;
        o.vel.x *= 0.6;
        o.vel.z *= 0.6;
        o.spin.multiplyScalar(0.5);
      }
      o.mesh.rotation.x += o.spin.x * dt;
      o.mesh.rotation.y += o.spin.y * dt;
      o.mesh.rotation.z += o.spin.z * dt;
      if (o.life < 0.25) {
        const s = o.life / 0.25;
        o.mesh.scale.set(s, s, s);
      }
    }

    for (i = 0; i < this._smokes.length; i++) {
      o = this._smokes[i];
      if (o.life <= 0) continue;
      o.life -= dt;
      if (o.life <= 0) { o.mesh.visible = false; o.mesh.material.opacity = 0; continue; }
      const f = 1 - o.life / o.max;
      const sc = o.base * (1 + f * o.grow);
      o.mesh.scale.set(sc, sc, sc);
      o.mesh.position.y += o.rise * dt;
      o.mesh.material.opacity = o.baseOp * (1 - f) * (1 - f);
    }

    for (i = 0; i < this._rings.length; i++) {
      o = this._rings[i];
      if (o.life <= 0) continue;
      o.life -= dt;
      if (o.life <= 0) { o.mesh.visible = false; o.mesh.material.opacity = 0; continue; }
      const f = 1 - o.life / o.max;
      const ease = 1 - Math.pow(1 - f, 3);
      const sc = 0.2 + ease * o.size;
      o.mesh.scale.set(sc, sc, sc);
      o.mesh.material.opacity = (1 - f) * 0.9;
    }

    for (i = 0; i < this._flashes.length; i++) {
      o = this._flashes[i];
      if (o.life <= 0) continue;
      o.life -= dt;
      if (o.life <= 0) { o.mesh.visible = false; o.mesh.material.opacity = 0; continue; }
      const f = o.life / o.max;
      o.mesh.material.opacity = 0.95 * f;
      const sc = o.size * (0.8 + (1 - f) * 0.5);
      o.mesh.scale.set(sc, sc, sc);
    }

    for (i = 0; i < this._lights.length; i++) {
      o = this._lights[i];
      if (o.life <= 0) continue;
      o.life -= dt;
      if (o.life <= 0) { o.light.intensity = 0; continue; }
      o.light.intensity = o.peak * (o.life / o.max);
    }

    this.decals.update(dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }

  reset() {
    let i;
    for (i = 0; i < this._tracers.length; i++) { this._tracers[i].life = 0; this._tracers[i].mesh.visible = false; }
    for (i = 0; i < this._shells.length; i++) { this._shells[i].life = 0; this._shells[i].mesh.visible = false; }
    for (i = 0; i < this._smokes.length; i++) { this._smokes[i].life = 0; this._smokes[i].mesh.visible = false; }
    for (i = 0; i < this._rings.length; i++) { this._rings[i].life = 0; this._rings[i].mesh.visible = false; }
    for (i = 0; i < this._flashes.length; i++) { this._flashes[i].life = 0; this._flashes[i].mesh.visible = false; }
    for (i = 0; i < this._lights.length; i++) { this._lights[i].life = 0; this._lights[i].light.intensity = 0; }
    this.decals.clear();
    this.shake = 0;
  }
}
