/* ============================================================
   SKYWARD SALVAGE — world.js  (V2)
   Cirrus Reach: bầu trời, mây nhiều lớp, đảo trôi, turbine,
   props kể chuyện, ánh sáng điện ảnh. Vật liệu từ textures.js.
   ============================================================ */

const World = (() => {

  // ---------- helper: gộp nhiều geometry thành 1 (giảm draw call) ----------
  function mergeGeoms(geoms) {
    let vCount = 0, iCount = 0;
    for (let i = 0; i < geoms.length; i++) {
      const g = geoms[i];
      vCount += g.attributes.position.count;
      iCount += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(vCount * 3);
    const norm = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const idx = new Uint32Array(iCount);
    let vo = 0, io = 0;
    for (let i = 0; i < geoms.length; i++) {
      const g = geoms[i];
      pos.set(g.attributes.position.array, vo * 3);
      if (g.attributes.normal) norm.set(g.attributes.normal.array, vo * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      const n = g.attributes.position.count;
      if (g.index) {
        const gi = g.index.array;
        for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
        io += gi.length;
      } else {
        for (let k = 0; k < n; k++) idx[io + k] = vo + k;
        io += n;
      }
      vo += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  // ---------- bầu trời ----------
  function makeSkyDome() {
    const geo = new THREE.SphereGeometry(900, 32, 18);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x1e4f86) },
        mid: { value: new THREE.Color(0x6fa8cf) },
        bottom: { value: new THREE.Color(0xd8e8f2) },
        offset: { value: 60 },
        exponent: { value: 0.7 }
      },
      vertexShader: [
        'varying vec3 vP;',
        'void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;',
        'uniform float offset; uniform float exponent;',
        'varying vec3 vP;',
        'void main(){',
        '  float h = normalize(vP + vec3(0.0, offset, 0.0)).y;',
        '  vec3 c = h > 0.0 ? mix(mid, top, pow(h, exponent))',
        '                   : mix(mid, bottom, pow(clamp(-h*1.6, 0.0, 1.0), exponent));',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -100;
    return dome;
  }

  // ---------- dải sương ngang ----------
  function makeHaze() {
    const geo = new THREE.CylinderGeometry(700, 700, 280, 48, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0xcfe2ee) },
        bottom: { value: new THREE.Color(0xa9c6d8) }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 bottom; varying vec2 vUv;',
        'void main(){',
        '  float a = pow(1.0 - vUv.y, 2.2) * 0.5;',
        '  gl_FragColor = vec4(mix(bottom, top, vUv.y), a);',
        '}'
      ].join('\n')
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 80;
    m.renderOrder = -90;
    return m;
  }

  // ---------- mây ----------
  function makeCloudLayer(opts) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0,
      emissive: 0x8fa6b8, emissiveIntensity: 0.25,
      transparent: true, opacity: opts.opacity, depthWrite: false
    });
    let s = opts.seed;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    for (let i = 0; i < opts.count; i++) {
      const puffs = [];
      const n = 3 + Math.floor(rand() * 4);
      for (let j = 0; j < n; j++) {
        const r = opts.size * (0.5 + rand() * 0.8);
        const g = new THREE.SphereGeometry(r, 10, 8);
        const ox = (rand() - 0.5) * opts.size * 2.6;
        const oy = (rand() - 0.5) * opts.size * 0.5;
        const oz = (rand() - 0.5) * opts.size * 1.6;
        g.applyMatrix4(new THREE.Matrix4().makeScale(1.9, 0.62, 1));
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(ox, oy, oz));
        puffs.push(g);
      }
      const mesh = new THREE.Mesh(mergeGeoms(puffs), mat);
      const ang = rand() * Math.PI * 2;
      const rad = opts.radius * (0.5 + rand() * 0.7);
      mesh.position.set(Math.cos(ang) * rad, opts.y + (rand() - 0.5) * opts.jitter, Math.sin(ang) * rad);
      mesh.userData.speed = opts.speed * (0.6 + rand() * 0.8);
      group.add(mesh);
    }
    return group;
  }

  // ---------- đèn nhấp nháy ----------
  function makeBlinkingLight(color) {
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 8),
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2.4 })
    );
    const light = new THREE.PointLight(color, 0, 20);
    light.position.y = 0.1;
    g.add(bulb, light);
    g.userData.isBlinker = true;
    g.userData.light = light;
    g.userData.bulb = bulb;
    return g;
  }

  function createWorld(scene, quality) {
    const q = quality || 'med';
    const shadowOn = q === 'high';
    const world = { bounds: 54, groundY: 0, updatables: [], mood: 'clear', blinkers: [], lamps: [], sway: [] };

    scene.add(makeSkyDome());
    scene.add(makeHaze());
    scene.fog = new THREE.Fog(0xb9d2e2, 70, 420);

    // ---------- ánh sáng ----------
    const hemi = new THREE.HemisphereLight(0xd6e9ff, 0x3f4a3a, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d4, 1.35);
    sun.position.set(70, 110, 45);
    if (shadowOn) {
      sun.castShadow = true;
      const sh = q === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(sh, sh);
      const c = sun.shadow.camera;
      c.left = -75; c.right = 75; c.top = 75; c.bottom = -75;
      c.near = 1; c.far = 320;
      sun.shadow.bias = -0.0016;
      sun.shadow.normalBias = 0.03;
    }
    scene.add(sun);
    scene.add(sun.target);
    world.sun = sun;

    const rim = new THREE.DirectionalLight(0x8fc4ff, 0.45);
    rim.position.set(-60, 35, -70);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffe0b8, 0.18);
    fill.position.set(-30, 20, 60);
    scene.add(fill);

    // ---------- nền đảo ----------
    const groundMat = Tex.mat('concrete', { rx: 14, ry: 14, roughness: 0.95, metalness: 0.03, bumpScale: 0.02 });
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(62, 46, 7, 72), groundMat);
    ground.position.y = -3.5;
    ground.receiveShadow = shadowOn;
    scene.add(ground);

    const rockMat = Tex.mat('stone', { rx: 10, ry: 3, roughness: 1, metalness: 0, bumpScale: 0.05 });
    const underside = new THREE.Mesh(new THREE.CylinderGeometry(46, 9, 30, 56), rockMat);
    underside.position.y = -21;
    scene.add(underside);

    const rimMat = Tex.mat('gunmetal', { rx: 40, ry: 1, roughness: 0.45, metalness: 0.85, bumpScale: 0.008 });
    const edgeRing = new THREE.Mesh(new THREE.TorusGeometry(61.2, 1.0, 10, 96), rimMat);
    edgeRing.rotation.x = Math.PI / 2;
    edgeRing.position.y = 0.08;
    scene.add(edgeRing);

    // ---------- turbine trung tâm ----------
    const turbine = new THREE.Group();
    const mastMat = Tex.mat('gunmetal', { rx: 3, ry: 6, roughness: 0.42, metalness: 0.88, bumpScale: 0.01 });
    const bladeMat = Tex.mat('military', { rx: 2, ry: 4, roughness: 0.62, metalness: 0.35, bumpScale: 0.012 });
    const baseMat = Tex.mat('concrete', { rx: 4, ry: 2, roughness: 0.92, metalness: 0.05 });
    const darkMat = Tex.mat('gunmetal', { rx: 2, ry: 2, roughness: 0.5, metalness: 0.8 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 9.5, 3.2, 28), baseMat);
    base.position.y = 1.6;
    turbine.add(base);

    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * 0.32, 3.7 - i * 0.32, 0.34, 20), darkMat);
      st.position.y = 0.2 + i * 0.62;
      turbine.add(st);
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 20, 22), mastMat);
    mast.position.y = 13;
    turbine.add(mast);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 13, 0.5), darkMat);
      strut.position.set(Math.cos(a) * 6.2, 7, Math.sin(a) * 6.2);
      strut.rotation.z = Math.cos(a) * 0.34;
      strut.rotation.x = -Math.sin(a) * 0.34;
      turbine.add(strut);
    }

    const hub = new THREE.Mesh(new THREE.SphereGeometry(2.5, 22, 18), mastMat);
    hub.position.y = 23;
    turbine.add(hub);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff8a3d, emissive: 0xff6a1c, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.2
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 16), coreMat);
    core.position.y = 23;
    turbine.add(core);

    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.16, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xffa64d, emissive: 0xff7a2f, emissiveIntensity: 1.6 })
    );
    coreRing.position.y = 23;
    turbine.add(coreRing);

    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.72, 15.5, 0.22), bladeMat);
      blade.position.y = 8.6;
      pivot.add(blade);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.4, 0.3), coreMat);
      tip.position.y = 16.2;
      pivot.add(tip);
      pivot.rotation.z = (i / 4) * Math.PI * 2;
      blades.add(pivot);
    }
    blades.position.y = 23;
    turbine.add(blades);

    const beacon = makeBlinkingLight(0xff3b2f);
    beacon.position.y = 26.4;
    turbine.add(beacon);
    world.blinkers.push(beacon);

    turbine.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = shadowOn; } });
    scene.add(turbine);
    world.turbine = turbine;
    world.blades = blades;
    world.core = core;
    world.coreRing = coreRing;

    // ---------- cổng đá ----------
    const archMat = Tex.mat('stone', { rx: 3, ry: 3, roughness: 0.95, metalness: 0.04, bumpScale: 0.03 });
    const arch = new THREE.Group();
    const pillarGeo = new THREE.BoxGeometry(2.6, 18, 2.6);
    const p1 = new THREE.Mesh(pillarGeo, archMat); p1.position.set(-7.2, 9, 0);
    const p2 = new THREE.Mesh(pillarGeo, archMat); p2.position.set(7.2, 9, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 2.8, 3.2), archMat); beam.position.y = 19.4;
    arch.add(p1, p2, beam);
    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x8fd0ff, emissive: 0x3f9fdf, emissiveIntensity: 1.2, transparent: true, opacity: 0.72,
      side: THREE.DoubleSide
    });
    const portal = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.34, 10, 48), portalMat);
    portal.position.y = 10;
    arch.add(portal);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(19, 1.2, 5), baseMat);
    plinth.position.y = 0.6;
    arch.add(plinth);
    arch.position.set(0, 0, -34);
    arch.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = shadowOn; } });
    scene.add(arch);
    world.portal = portal;

    // Alternate map dressing for the Blackout mission: Stormglass Outpost.
    const outpost = new THREE.Group();
    const outpostMetal = new THREE.MeshStandardMaterial({ color: 0x26343e, roughness: 0.62, metalness: 0.78 });
    const outpostAccent = new THREE.MeshStandardMaterial({ color: 0xc24c42, emissive: 0x5c1518, emissiveIntensity: 0.8, metalness: 0.35 });
    const barricadeGeo = new THREE.BoxGeometry(6.2, 1.25, 0.72);
    [[-24,-14,0.18],[24,-14,-0.18],[-24,15,-0.18],[24,15,0.18],[0,27,Math.PI/2],[0,-27,Math.PI/2]].forEach((p, i) => {
      const base = new THREE.Mesh(barricadeGeo, outpostMetal); base.position.set(p[0], 0.72, p[1]); base.rotation.y = p[2]; base.userData.blocksBullets = true; outpost.add(base);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 0.78), outpostAccent); stripe.position.set(p[0], 1.28, p[1]); stripe.rotation.y = p[2]; stripe.userData.blocksBullets = true; outpost.add(stripe);
    });
    [[-33,-24],[33,-24],[-33,24],[33,24]].forEach((p, i) => {
      const tower = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.38,7.5,8), outpostMetal); mast.position.y = 3.75; mast.userData.blocksBullets = true; tower.add(mast);
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff5d67, emissive: 0xff263b, emissiveIntensity: 1.3 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8), beaconMat); beacon.position.y = 7.7; tower.add(beacon);
      const beaconLight = new THREE.PointLight(0xff5d67, 0, 18); beaconLight.position.y = 7.75; tower.add(beaconLight);
      tower.position.set(p[0],0,p[1]); outpost.add(tower); world.blinkers.push({ userData: { light: beaconLight, bulb: beacon } });
    });
    outpost.visible = false; scene.add(outpost); world.outpost = outpost;
    world.setMap = function (name) {
      const isOutpost = name === 'blackout';
      outpost.visible = isOutpost;
      world.mapName = isOutpost ? 'STORMGLASS OUTPOST' : 'CIRRUS REACH';
    };

    // ---------- đảo bay ----------
    const islandGroup = new THREE.Group();
    const islandDefs = [
      { x: -34, y: 8, z: -22, s: 1.3 },
      { x: 38, y: 12, z: -30, s: 1.7 },
      { x: -46, y: 16, z: 12, s: 1.1 },
      { x: 44, y: 7, z: 20, s: 1.4 },
      { x: 6, y: 20, z: -52, s: 1.9 },
      { x: -18, y: 24, z: 40, s: 1.2 }
    ];
    const grassMat = Tex.mat('grass', { rx: 3, ry: 1, roughness: 1, metalness: 0, bumpScale: 0.02 });
    const iRockMat = Tex.mat('stone', { rx: 3, ry: 2, roughness: 1, metalness: 0, bumpScale: 0.04 });
    const trunkMat = Tex.mat('wood', { rx: 1, ry: 2, roughness: 0.95, metalness: 0 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d6b3f, roughness: 1, metalness: 0 });
    const hutMat = Tex.mat('military', { rx: 2, ry: 2, roughness: 0.8, metalness: 0.1 });

    islandDefs.forEach((d, i) => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(6 * d.s, 5 * d.s, 1.8, 18), grassMat);
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(5 * d.s, 9 * d.s, 14), iRockMat);
      bottom.rotation.x = Math.PI;
      bottom.position.y = -5.4 * d.s;
      g.add(top, bottom);
      if (i % 2 === 0) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 3.2, 8), trunkMat);
        trunk.position.y = 2.4;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5.4, 10), leafMat);
        leaves.position.y = 6.2;
        g.add(trunk, leaves);
        world.sway.push({ obj: leaves, phase: i * 0.9, amp: 0.11, base: leaves.rotation.z });
        world.sway.push({ obj: trunk, phase: i * 0.9 + 0.4, amp: 0.035, base: 0 });
      } else {
        const hut = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.7, 3.2), hutMat);
        hut.position.y = 2.2;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), trunkMat);
        roof.position.y = 4.4;
        roof.rotation.y = Math.PI / 4;
        g.add(hut, roof);
      }
      g.position.set(d.x, d.y, d.z);
      g.userData.baseY = d.y;
      g.userData.phase = i * 1.3;
      g.userData.speed = 0.28 + (i % 3) * 0.1;
      islandGroup.add(g);
      world.updatables.push(g);
    });
    islandGroup.traverse(o => { if (o.isMesh) o.castShadow = shadowOn; });
    scene.add(islandGroup);

    // ---------- mây: 3 lớp + biển mây dưới ----------
    const cloudLayers = [
      makeCloudLayer({ count: 9, seed: 11, size: 16, radius: 260, y: 95, jitter: 26, opacity: 0.55, speed: 0.9 }),
      makeCloudLayer({ count: 10, seed: 47, size: 11, radius: 190, y: 62, jitter: 20, opacity: 0.7, speed: 1.5 }),
      makeCloudLayer({ count: 8, seed: 83, size: 7, radius: 130, y: 38, jitter: 14, opacity: 0.82, speed: 2.4 }),
      makeCloudLayer({ count: 16, seed: 129, size: 20, radius: 180, y: -26, jitter: 18, opacity: 0.9, speed: 0.5 })
    ];
    cloudLayers.forEach(c => scene.add(c));
    world.clouds = cloudLayers;

    // ---------- cỏ & đá ----------
    const tuftGeo = new THREE.ConeGeometry(0.3, 1.6, 5);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x6d8048, roughness: 1 });
    const tuftCount = q === 'low' ? 70 : 180;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    const dummy = new THREE.Object3D();
    let ts = 5;
    const trand = () => { ts = (ts * 1664525 + 1013904223) >>> 0; return ts / 4294967296; };
    for (let i = 0; i < tuftCount; i++) {
      const a = trand() * Math.PI * 2;
      const r = 10 + trand() * 48;
      dummy.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r);
      dummy.rotation.set((trand() - 0.5) * 0.5, trand() * Math.PI, (trand() - 0.5) * 0.5);
      const sc = 0.7 + trand() * 1.6;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      tufts.setMatrixAt(i, dummy.matrix);
    }
    tufts.instanceMatrix.needsUpdate = true;
    scene.add(tufts);

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockCount = q === 'low' ? 14 : 30;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const a = trand() * Math.PI * 2;
      const r = 13 + trand() * 44;
      dummy.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r);
      dummy.rotation.set(trand() * 3, trand() * 3, trand() * 3);
      const sc = 0.5 + trand() * 2.0;
      dummy.scale.set(sc, sc * 0.8, sc);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.castShadow = shadowOn;
    scene.add(rocks);

    // ============================================================
    //  PROPS
    // ============================================================
    const props = new THREE.Group();
    scene.add(props);
    const crateMat = Tex.mat('crate', { rx: 1, ry: 1, roughness: 0.85, metalness: 0.05 });
    const contMatA = Tex.mat('container', { rx: 3, ry: 1, roughness: 0.7, metalness: 0.4 });
    const contMatB = Tex.mat('container', { rx: 3, ry: 1, roughness: 0.7, metalness: 0.4, color: 0x9fb4c4 });
    const rustMat = Tex.mat('rust', { rx: 2, ry: 2, roughness: 0.75, metalness: 0.5 });
    const barrelMat = Tex.mat('military', { rx: 2, ry: 1, roughness: 0.55, metalness: 0.5 });
    const hazardMat = Tex.mat('hazard', { rx: 1, ry: 1, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide });
    const plateMat = Tex.mat('floorplate', { rx: 4, ry: 4, roughness: 0.78, metalness: 0.38, bumpScale: 0.02 });

    function addBox(w, h, d, mat, x, y, z, ry) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (ry) m.rotation.y = ry;
      m.castShadow = shadowOn;
      m.receiveShadow = true;
      props.add(m);
      return m;
    }

    // bệ đáp
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.24, 40), plateMat);
    pad.position.set(0, 0.12, 30);
    pad.receiveShadow = true;
    props.add(pad);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.3, 8, 48), hazardMat);
    padRing.rotation.x = Math.PI / 2;
    padRing.position.set(0, 0.28, 30);
    props.add(padRing);
    const padMark = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), hazardMat);
    padMark.rotation.x = -Math.PI / 2;
    padMark.position.set(0, 0.26, 30);
    props.add(padMark);

    // container
    addBox(6.2, 2.7, 2.5, contMatA, -20, 1.35, 22, 0.28);
    addBox(6.2, 2.7, 2.5, contMatB, -20.4, 1.35, 24.9, 0.32);
    addBox(6.2, 2.7, 2.5, contMatA, -20.2, 4.05, 23.4, 0.3);
    addBox(6.2, 2.7, 2.5, contMatB, 24, 1.35, -14, -0.5);
    addBox(6.2, 2.7, 2.5, rustMat, 26.4, 1.35, -12.2, -0.42);

    // thùng quân nhu
    const cratePos = [
      [14, 0.75, 26, 0.2], [15.3, 0.75, 26.6, -0.15], [14.6, 2.15, 26.3, 0.45],
      [-14, 0.75, -18, 0.7], [-15.2, 0.75, -17.4, 0.1], [-14.6, 2.15, -17.7, -0.3],
      [8, 0.75, -26, 1.1], [9.2, 0.75, -25.4, 0.4],
      [-28, 0.75, -6, 0.9], [-28.6, 0.75, -7.4, 0.2]
    ];
    cratePos.forEach(c => addBox(1.5, 1.5, 1.5, crateMat, c[0], c[1], c[2], c[3]));

    // thùng phuy
    const barrelPos = [
      [12.4, 0.95, 28.4], [13.1, 0.95, 28.9], [12.7, 2.45, 28.6],
      [-16.6, 0.95, -19.6], [-17.3, 0.95, -19.1],
      [22.2, 0.95, -11.2], [23, 0.95, -10.6], [22.6, 2.45, -10.9],
      [-26, 0.95, -8.8], [6.4, 0.95, -28.4]
    ];
    barrelPos.forEach((b, i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 14), i % 3 === 0 ? rustMat : barrelMat);
      m.position.set(b[0], b[1], b[2]);
      m.castShadow = shadowOn;
      m.receiveShadow = true;
      props.add(m);
    });

    // biển cảnh báo
    const signDefs = [
      [10, 20, 0.6], [-12, 24, -0.4], [18, -20, 1.2], [-22, -14, 0.3], [30, 6, -0.9]
    ];
    signDefs.forEach(s => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), darkMat);
      post.position.set(s[0], 1.2, s[1]);
      post.castShadow = shadowOn;
      props.add(post);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), hazardMat);
      board.position.set(s[0], 2.3, s[1]);
      board.rotation.y = s[2];
      props.add(board);
    });

    // rào chắn
    const fenceDefs = [
      [-8, 12, 0.3], [-16, 12, 0.3], [12, 8, -0.6], [20, 10, -0.6],
      [-30, 2, 0.9], [30, 0, 0.9]
    ];
    fenceDefs.forEach(f => {
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), rimMat);
        post.position.set(f[0] + i * 2.0 * Math.cos(f[3]), 0.75, f[1] + i * 2.0 * Math.sin(f[3]));
        post.castShadow = shadowOn;
        props.add(post);
      }
      for (let k = 0; k < 2; k++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.1, 0.12), rimMat);
        rail.position.set(f[0] + 3.0 * Math.cos(f[3]), 0.6 + k * 0.6, f[1] + 3.0 * Math.sin(f[3]));
        rail.rotation.y = -f[3];
        rail.castShadow = shadowOn;
        props.add(rail);
      }
    });

    // ăng-ten hỏng
    const antenna = new THREE.Group();
    const aMast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 16, 10), mastMat);
    aMast.position.y = 8;
    antenna.add(aMast);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2 - i * 0.5, 0.08, 0.08), mastMat);
      bar.position.y = 12 + i * 1.1;
      bar.rotation.y = i * 0.6;
      antenna.add(bar);
    }
    const aLight = makeBlinkingLight(0xff3b2f);
    aLight.position.y = 16.4;
    antenna.add(aLight);
    world.blinkers.push(aLight);
    antenna.position.set(-30, 0, 26);
    antenna.rotation.z = 0.16;
    antenna.traverse(o => { if (o.isMesh) o.castShadow = shadowOn; });
    props.add(antenna);

    // máy móc hỏng
    const wreck1 = new THREE.Group();
    const wBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.4), rustMat);
    wBody.position.y = 1.1;
    const wStack = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 3.4, 12), rustMat);
    wStack.position.set(-0.9, 1.7, -0.5);
    wreck1.add(wBody, wStack);
    wreck1.position.set(28, 0, 22);
    wreck1.rotation.set(0.06, 0.7, 0.1);
    wreck1.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = true; } });
    props.add(wreck1);

    const wreck2 = new THREE.Group();
    const w2Body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 3.0, 16), rustMat);
    w2Body.rotation.z = Math.PI / 2;
    w2Body.position.y = 1.5;
    wreck2.add(w2Body);
    const w2Fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 1.6), rustMat);
    w2Fin.position.set(0, 3.0, 0);
    wreck2.add(w2Fin);
    wreck2.position.set(-26, 0, 18);
    wreck2.rotation.y = -0.5;
    wreck2.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = true; } });
    props.add(wreck2);

    // mảnh vỡ
    const debrisGeoms = [];
    let ds = 77;
    const drand = () => { ds = (ds * 1664525 + 1013904223) >>> 0; return ds / 4294967296; };
    const debrisCount = q === 'low' ? 8 : 20;
    for (let i = 0; i < debrisCount; i++) {
      const g = new THREE.DodecahedronGeometry(0.3 + drand() * 0.9, 0);
      const a = drand() * Math.PI * 2;
      const r = 12 + drand() * 40;
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(drand() * 3, drand() * 3, drand() * 3)));
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.25, Math.sin(a) * r));
      debrisGeoms.push(g);
    }
    const debris = new THREE.Mesh(mergeGeoms(debrisGeoms), rockMat);
    debris.castShadow = shadowOn;
    debris.receiveShadow = true;
    props.add(debris);

    // cột đèn
    [[16, 14], [-18, 10], [4, -30]].forEach(p => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6.4, 10), darkMat);
      pole.position.set(p[0], 3.2, p[1]);
      pole.castShadow = shadowOn;
      props.add(pole);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffd9a0, emissiveIntensity: 1.8 });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), headMat);
      head.position.set(p[0], 6.4, p[1]);
      props.add(head);
      world.lamps.push(headMat);
    });

    // ---------- mood theo mission ----------
    const moods = {
      clear: { sky: [0x1e4f86, 0x6fa8cf, 0xd8e8f2], fog: [0xb9d2e2, 70, 420], sun: 1.35, hemi: 0.75 },
      squall: { sky: [0x1b2a3c, 0x4a6a86, 0x9db4c4], fog: [0x7e99ad, 40, 260], sun: 0.85, hemi: 0.55 },
      gale: { sky: [0x2a5580, 0x84b4d6, 0xe2f0f8], fog: [0xc2d9e8, 95, 520], sun: 1.6, hemi: 0.95 },
      blackout: { sky: [0x101827, 0x273b50, 0x53687a], fog: [0x53687a, 35, 210], sun: 0.55, hemi: 0.34 }
    };

    let domeMesh = null;
    let hazeMesh = null;
    scene.traverse(o => {
      if (!o.material || !o.material.uniforms) return;
      const u = o.material.uniforms;
      if (u.mid && u.top) domeMesh = o;
      else if (u.top && u.bottom) hazeMesh = o;
    });

    world.setMood = function (name) {
      const m = moods[name] || moods.clear;
      world.mood = name;
      if (domeMesh) {
        domeMesh.material.uniforms.top.value.setHex(m.sky[0]);
        domeMesh.material.uniforms.mid.value.setHex(m.sky[1]);
        domeMesh.material.uniforms.bottom.value.setHex(m.sky[2]);
      }
      if (hazeMesh) {
        hazeMesh.material.uniforms.top.value.setHex(m.sky[2]);
        hazeMesh.material.uniforms.bottom.value.setHex(m.fog[0]);
      }
      scene.fog.color.setHex(m.fog[0]);
      scene.fog.near = m.fog[1];
      scene.fog.far = m.fog[2];
      sun.intensity = m.sun;
      hemi.intensity = m.hemi;
    };

    // ---------- gắn nhãn bề mặt để hiệu ứng trúng đạn đúng chất liệu ----------
    const SURFACE_FROM_TEX = {
      concrete: 'concrete', asphalt: 'asphalt', stone: 'stone', gravel: 'stone',
      dirt: 'ground', metal: 'metal', gunmetal: 'gunmetal', rust: 'rust',
      military: 'metal', wood: 'wood', floorplate: 'metal', container: 'metal',
      grass: 'grass', hazard: 'metal', crate: 'wood'
    };
    scene.traverse(o => {
      if (!o.isMesh) return;
      const texName = o.material && o.material.userData ? o.material.userData.tex : null;
      if (texName) o.userData.surface = SURFACE_FROM_TEX[texName] || 'concrete';
    });

    // ---------- animation ----------
    let t = 0;
    world.update = function (dt, reducedMotion) {
      t += dt;
      const k = reducedMotion ? 0.2 : 1;
      blades.rotation.z += dt * 0.85 * k;
      core.material.emissiveIntensity = 1.35 + Math.sin(t * 2.6) * 0.4;
      coreRing.rotation.z += dt * 0.8 * k;
      coreRing.material.emissiveIntensity = 1.4 + Math.sin(t * 2.6) * 0.4;
      portal.material.emissiveIntensity = 1.0 + Math.sin(t * 1.7) * 0.35;
      portal.rotation.z += dt * 0.22 * k;

      islandGroup.children.forEach(g => {
        g.position.y = g.userData.baseY + Math.sin(t * g.userData.speed + g.userData.phase) * 1.2 * k;
        g.rotation.y += dt * 0.03 * k;
      });

      // cây đung đưa theo gió
      for (let i = 0; i < world.sway.length; i++) {
        const s = world.sway[i];
        s.obj.rotation.z = s.base + Math.sin(t * 1.35 + s.phase) * s.amp * k;
      }

      cloudLayers.forEach(layer => {
        layer.children.forEach(c => {
          c.position.x += c.userData.speed * dt * k;
          if (c.position.x > 320) c.position.x = -320;
        });
      });

      for (let i = 0; i < world.blinkers.length; i++) {
        const b = world.blinkers[i];
        const on = ((t * 1.4 + i * 0.7) % 1) < 0.18;
        b.userData.light.intensity = on ? 3.2 : 0;
        b.userData.bulb.material.emissiveIntensity = on ? 3.0 : 0.15;
      }

      for (let i = 0; i < world.lamps.length; i++) {
        world.lamps[i].emissiveIntensity = 1.6 + Math.sin(t * 3 + i * 2) * 0.2;
      }
    };

    return world;
  }

  return { create: createWorld, mergeGeoms: mergeGeoms };
})();
