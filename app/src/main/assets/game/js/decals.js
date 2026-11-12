/* ============================================================
   SKYWARD SALVAGE — decals.js  (V2)
   Pool decal lỗ đạn: số lượng cố định, xoay vòng, tự dọn.
   Không dùng DecalGeometry (không có trong three.min.js r128).
   ============================================================ */

class DecalPool {
  constructor(scene, max) {
    this.scene = scene;
    this.max = max || 48;
    this.tex = Tex.special('bulletHole');
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.pool = [];
    this.cursor = 0;
    this.activeCount = 0;

    for (let i = 0; i < this.max; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
        opacity: 0
      });
      const m = new THREE.Mesh(this.geo, mat);
      m.visible = false;
      m.renderOrder = 3;
      m.frustumCulled = false;
      scene.add(m);
      this.pool.push({ mesh: m, life: 0, maxLife: 1, baseOpacity: 1, scale: 1 });
    }
  }

  spawn(point, normal, opts) {
    const o = opts || {};
    const d = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;

    const m = d.mesh;
    m.visible = true;
    m.position.copy(point).addScaledVector(normal, 0.015 + SkywardRNG.random('vfx') * 0.01);
    m.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    m.rotateZ(SkywardRNG.random('vfx') * Math.PI * 2);

    const s = (o.scale || 0.32) * (0.8 + SkywardRNG.random('vfx') * 0.5);
    d.scale = s;
    m.scale.set(s, s, s);

    d.maxLife = o.life || 14;
    d.life = d.maxLife;
    d.baseOpacity = o.opacity !== undefined ? o.opacity : 0.92;
    m.material.opacity = d.baseOpacity;
    return d;
  }

  update(dt) {
    let active = 0;
    for (let i = 0; i < this.max; i++) {
      const d = this.pool[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.life = 0;
        d.mesh.visible = false;
        d.mesh.material.opacity = 0;
        continue;
      }
      active++;
      // fade trong 25% cuối
      const f = d.life / d.maxLife;
      d.mesh.material.opacity = d.baseOpacity * Math.min(1, f * 4);
    }
    this.activeCount = active;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.pool[i].life = 0;
      this.pool[i].mesh.visible = false;
      this.pool[i].mesh.material.opacity = 0;
    }
    this.activeCount = 0;
  }
}
