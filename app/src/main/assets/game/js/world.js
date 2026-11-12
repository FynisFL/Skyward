/* ============================================================
   SKYWARD SALVAGE — world.js  (V2)
   Aegis-09: industrial sci-fi salvage facility, layered service decks,
   command hangar, containment reactor and floating relay platforms.
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
    const world = { bounds: 54, groundY: 0, updatables: [], mood: 'clear', blinkers: [], lamps: [], sway: [], platforms: [], ramps: [], playerColliders: [], relayMotion: [], navigationRoutes: [] };
    
    // Phase 1: surface queries used by player vertical physics.
    function containsPlatform(p, x, z, inset = 0.18) {
      if (Number.isFinite(p.radius)) {
        return Math.hypot(x - p.x, z - p.z) <= Math.max(0, p.radius - inset);
      }
      const halfW = Math.max(0, p.w * 0.5 - inset);
      const halfD = Math.max(0, p.d * 0.5 - inset);
      return Math.abs(x - p.x) <= halfW && Math.abs(z - p.z) <= halfD;
    }

    world.getSpawnSurface = function (x, z) {
      let surface = { height: Number.isFinite(this.groundY) ? this.groundY : 0, collider: null };
      for (let i = 0; i < this.platforms.length; i++) {
        const p = this.platforms[i];
        if (containsPlatform(p, x, z) && p.topY > surface.height) {
          surface = { height: p.topY, collider: p.collider || null };
        }
      }
      return surface;
    };

    world.getSpawnHeight = function (x, z) {
      return this.getSpawnSurface(x, z).height;
    };

    function rampContains(ramp, x, z, inset = 0) {
      const dx = x - ramp.x, dz = z - ramp.z;
      const c = Math.cos(ramp.yaw), s = Math.sin(ramp.yaw);
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      return ramp.axis === 'x'
        ? Math.abs(lx) <= ramp.length * 0.5 - inset && Math.abs(lz) <= ramp.width * 0.5 - inset
        : Math.abs(lx) <= ramp.width * 0.5 - inset && Math.abs(lz) <= ramp.length * 0.5 - inset;
    }

    function rampHeightAt(ramp, x, z) {
      const value = ramp.axis === 'x' ? x : z;
      const t = (value - ramp.from) / (ramp.to - ramp.from);
      return ramp.fromY + Math.max(0, Math.min(1, t)) * (ramp.toY - ramp.fromY);
    }

    world.getWalkableSurface = function (x, z, feetY, maxStepUp = 0.45, maxStepDown = 0.55) {
      const minY = feetY - Math.max(0, maxStepDown) - 1e-4;
      const maxY = feetY + Math.max(0, maxStepUp) + 1e-4;
      let surface = null;
      const ground = Number.isFinite(this.groundY) ? this.groundY : 0;
      if (ground >= minY && ground <= maxY) surface = { height: ground, collider: null };
      for (let i = 0; i < this.platforms.length; i++) {
        const p = this.platforms[i];
        // The player's capsule can still be supported while its centre slightly
        // overhangs the platform edge.
        if (!containsPlatform(p, x, z, -0.12) || p.topY < minY || p.topY > maxY) continue;
        if (!surface || p.topY > surface.height) {
          surface = { height: p.topY, collider: p.collider || null };
        }
      }
      for (let i = 0; i < this.ramps.length; i++) {
        const ramp = this.ramps[i];
        if (!rampContains(ramp, x, z, -0.12)) continue;
        const height = rampHeightAt(ramp, x, z);
        if (height < minY || height > maxY) continue;
        if (!surface || height > surface.height) surface = { height, collider: null };
      }
      return surface;
    };

    world.getWalkableHeight = function (x, z, feetY, maxStepUp = 0.45, maxStepDown = 0.55) {
      const surface = this.getWalkableSurface(x, z, feetY, maxStepUp, maxStepDown);
      return surface ? surface.height : null;
    };

    world.getLandingSurface = function (x, z, fromFeetY, toFeetY) {
      if (toFeetY > fromFeetY) return null;
      let surface = null;
      const ground = Number.isFinite(this.groundY) ? this.groundY : 0;
      if (fromFeetY >= ground - 1e-4 && toFeetY <= ground + 1e-4) {
        surface = { height: ground, collider: null };
      }
      for (let i = 0; i < this.platforms.length; i++) {
        const p = this.platforms[i];
        // Allow a small capsule overhang when catching the edge of a lower step.
        if (!containsPlatform(p, x, z, -0.12)) continue;
        if (fromFeetY < p.topY - 1e-4 || toFeetY > p.topY + 1e-4) continue;
        if (!surface || p.topY > surface.height) {
          surface = { height: p.topY, collider: p.collider || null };
        }
      }
      for (let i = 0; i < this.ramps.length; i++) {
        const ramp = this.ramps[i];
        if (!rampContains(ramp, x, z, -0.12)) continue;
        const height = rampHeightAt(ramp, x, z);
        if (fromFeetY < height - 1e-4 || toFeetY > height + 1e-4) continue;
        if (!surface || height > surface.height) surface = { height, collider: null };
      }
      return surface;
    };

    world.getLandingHeight = function (x, z, fromFeetY, toFeetY) {
      const surface = this.getLandingSurface(x, z, fromFeetY, toFeetY);
      return surface ? surface.height : null;
    };

    world.sampleGroundHeight = function (x, z) {
      return this.getSpawnHeight(x, z);
    };

    // Phase 2: player-solid colliders are independent from walkable surfaces.
    function isObjectVisible(object) {
      for (let node = object; node; node = node.parent) {
        if (node.visible === false) return false;
      }
      return true;
    }

    world.isPlayerBlocked = function (x, z, feetY, bodyHeight = 1.62, radius = 0.36, stepUp = 0, ignoredPlatform = null) {
      const bodyMinY = feetY + 0.04;
      const bodyMaxY = feetY + bodyHeight;
      for (let i = 0; i < this.playerColliders.length; i++) {
        const c = this.playerColliders[i];
        if (ignoredPlatform && c.object === ignoredPlatform) continue;
        if (c.object && !isObjectVisible(c.object)) continue;
        if (bodyMaxY <= c.minY + 0.02 || bodyMinY >= c.maxY - 0.02) continue;

        if (c.isPlatform) {
          const rise = c.maxY - feetY;
          if (rise >= -0.05 && rise <= stepUp + 1e-4) continue;
          if (feetY >= c.maxY - 0.06) continue;
        }

        const dx = x - c.x;
        const dz = z - c.z;
        if (c.shape === 'circle') {
          const combinedRadius = radius + c.radius;
          if (dx * dx + dz * dz < combinedRadius * combinedRadius) return true;
          continue;
        }
        const cos = Math.cos(c.yaw);
        const sin = Math.sin(c.yaw);
        const localX = cos * dx - sin * dz;
        const localZ = sin * dx + cos * dz;
        const closestX = Math.max(-c.halfX, Math.min(c.halfX, localX));
        const closestZ = Math.max(-c.halfZ, Math.min(c.halfZ, localZ));
        const distanceX = localX - closestX;
        const distanceZ = localZ - closestZ;
        if (distanceX * distanceX + distanceZ * distanceZ < radius * radius) return true;
      }
      return false;
    };



    scene.add(makeSkyDome());
    scene.add(makeHaze());
    scene.fog = new THREE.Fog(0x829db0, 66, 390);

    // ---------- ánh sáng ----------
    const hemi = new THREE.HemisphereLight(0xc8eaff, 0x344858, 1.02);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xe5f3ff, 1.48);
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

    const rim = new THREE.DirectionalLight(0x4bcfff, 0.82);
    rim.position.set(-60, 35, -70);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffc18a, 0.36);
    fill.position.set(-30, 20, 60);
    scene.add(fill);

    // ---------- AEGIS-09: orbital salvage facility ----------
    // The playable island is now an abandoned industrial installation, not a
    // flat arena. Raised decks are walkable surfaces and every step is physical.
    const deckMat = Tex.mat('floorplate', { rx: 22, ry: 22, roughness: 0.78, metalness: 0.62, bumpScale: 0.018 });
    const hullMat = Tex.mat('gunmetal', { rx: 5, ry: 3, roughness: 0.58, metalness: 0.82, bumpScale: 0.012 });
    const armorMat = Tex.mat('metal', { rx: 4, ry: 3, roughness: 0.66, metalness: 0.72, bumpScale: 0.014 });
    const containerMat = Tex.mat('container', { rx: 4, ry: 2, roughness: 0.68, metalness: 0.58, bumpScale: 0.018 });
    const rustMat = Tex.mat('rust', { rx: 3, ry: 2, roughness: 0.78, metalness: 0.48 });
    const hazardMat = Tex.mat('hazard', { rx: 2, ry: 1, roughness: 0.72, metalness: 0.35 });
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x43c9e7, emissive: 0x087f9e, emissiveIntensity: 1.25,
      roughness: 0.28, metalness: 0.35
    });
    const cyanSoftMat = new THREE.MeshStandardMaterial({
      color: 0x174b60, emissive: 0x087c9b, emissiveIntensity: 0.75,
      roughness: 0.42, metalness: 0.55
    });
    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xffa54b, emissive: 0xb94b12, emissiveIntensity: 0.85,
      roughness: 0.38, metalness: 0.28
    });
    hullMat.color.multiplyScalar(1.28);
    armorMat.color.multiplyScalar(1.18);
    containerMat.color.multiplyScalar(1.12);
    const darkGlassMat = new THREE.MeshStandardMaterial({
      color: 0x102533, emissive: 0x06374a, emissiveIntensity: 0.42,
      roughness: 0.2, metalness: 0.68
    });

    const groundMat = Tex.mat('floorplate', { rx: 30, ry: 30, roughness: 0.9, metalness: 0.48, bumpScale: 0.02 });
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(62, 46, 7, 72), groundMat);
    ground.position.y = -3.5;
    ground.receiveShadow = shadowOn;
    ground.userData.surface = 'metal';
    scene.add(ground);

    // A continuous service deck covers the old bare concrete arena floor.
    const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(61, 96), deckMat);
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.position.y = 0.014;
    floorDisc.receiveShadow = true;
    floorDisc.userData.surface = 'metal';
    scene.add(floorDisc);

    const floorTrimMat = new THREE.MeshStandardMaterial({
      color: 0x213744, emissive: 0x063e55, emissiveIntensity: 0.55,
      roughness: 0.5, metalness: 0.7
    });
    [14, 34, 49].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, i === 2 ? 0.12 : 0.075, 6, 96), floorTrimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.045 + i * 0.002;
      scene.add(ring);
    });
    for (let i = -5; i <= 5; i++) {
      const x = i * 8;
      const seamX = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 94), floorTrimMat);
      seamX.position.set(x, 0.035, 0);
      scene.add(seamX);
      const seamZ = new THREE.Mesh(new THREE.BoxGeometry(94, 0.025, 0.045), floorTrimMat);
      seamZ.position.set(0, 0.035, x);
      scene.add(seamZ);
    }

    const structures = new THREE.Group();
    structures.name = 'Aegis09_Industrial_Structures';
    scene.add(structures);

    function addMapBox(parent, w, h, d, material, x, y, z, ry = 0, solid = true, blocksBullets = true) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.castShadow = shadowOn;
      mesh.receiveShadow = true;
      if (solid) mesh.userData.playerSolid = true;
      if (blocksBullets) mesh.userData.blocksBullets = true;
      parent.add(mesh);
      return mesh;
    }

    function addMapCylinder(parent, radiusTop, radiusBottom, height, material, x, y, z, solid = true) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadowOn;
      mesh.receiveShadow = true;
      if (solid) {
        mesh.userData.playerSolid = true;
        mesh.userData.blocksBullets = true;
      }
      parent.add(mesh);
      return mesh;
    }

    function addDeck(def) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.w, def.h, def.d),
        def.material || deckMat
      );
      mesh.position.set(def.x, def.baseY + def.h * 0.5, def.z);
      mesh.castShadow = shadowOn;
      mesh.receiveShadow = true;
      mesh.userData.platform = true;
      mesh.userData.playerSolid = true;
      mesh.userData.blocksBullets = true;
      scene.add(mesh);
      world.platforms.push({
        x: def.x, z: def.z, w: def.w, d: def.d,
        topY: def.baseY + def.h, baseY: def.baseY, height: def.h, collider: mesh
      });
      return mesh;
    }

    function addStepRun(def) {
      // Each riser is <= maxStepUp, so the player can climb the service stairs
      // without jumping. Step surfaces also participate in landing queries.
      for (let i = 1; i <= def.count; i++) {
        const rise = def.rise;
        const along = (i - 0.5) * def.depth;
        const x = def.x + (def.axis === 'x' ? def.direction * along : 0);
        const z = def.z + (def.axis === 'z' ? def.direction * along : 0);
        const w = def.axis === 'x' ? def.depth : def.width;
        const d = def.axis === 'z' ? def.depth : def.width;
        const baseY = (i - 1) * rise;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, rise, d),
          def.material || hullMat
        );
        mesh.position.set(x, baseY + rise * 0.5, z);
        mesh.castShadow = shadowOn;
        mesh.receiveShadow = true;
        mesh.userData.platform = true;
        mesh.userData.playerSolid = true;
        mesh.userData.blocksBullets = true;
        scene.add(mesh);
        world.platforms.push({
          x, z, w, d, topY: baseY + rise, baseY, height: rise, collider: mesh
        });
      }
    }

    function addRamp(def) {
      const length = Math.hypot(def.toX - def.fromX, def.toZ - def.fromZ);
      const rise = def.toY - def.fromY;
      const axis = Math.abs(def.toX - def.fromX) >= Math.abs(def.toZ - def.fromZ) ? 'x' : 'z';
      const from = axis === 'x' ? def.fromX : def.fromZ;
      const to = axis === 'x' ? def.toX : def.toZ;
      const yaw = axis === 'x' ? 0 : 0;
      const angle = Math.atan2(Math.abs(rise), length) * Math.sign(
        axis === 'z' ? rise : rise * Math.sign(def.toX - def.fromX)
      );
      const rampGeometry = axis === 'x'
        ? new THREE.BoxGeometry(length, 0.22, def.width)
        : new THREE.BoxGeometry(def.width, 0.22, length);
      const mesh = new THREE.Mesh(rampGeometry, def.material || armorMat);
      mesh.position.set((def.fromX + def.toX) * 0.5, (def.fromY + def.toY) * 0.5, (def.fromZ + def.toZ) * 0.5);
      if (axis === 'z') mesh.rotation.x = angle;
      else mesh.rotation.z = angle;
      mesh.castShadow = shadowOn;
      mesh.receiveShadow = true;
      mesh.userData.navigationRamp = true;
      mesh.userData.decorativeOnly = false;
      scene.add(mesh);
      const ramp = {
        x: mesh.position.x, z: mesh.position.z, yaw, axis, from, to,
        fromY: def.fromY, toY: def.toY, width: def.width, length,
        mesh
      };
      world.ramps.push(ramp);
      return ramp;
    }

    // Main sectors: landing dock, command deck, maintenance deck and cargo deck.
    addDeck({ x: 0, z: 30, w: 24, d: 14, h: 0.36, baseY: 0 });
    addDeck({ x: 0, z: -27, w: 20, d: 12, h: 1.2, baseY: 0 });
    addDeck({ x: -27, z: -4, w: 14, d: 18, h: 0.9, baseY: 0 });
    addDeck({ x: 27, z: -4, w: 14, d: 18, h: 0.9, baseY: 0 });
    addDeck({ x: -40, z: 25, w: 9, d: 12, h: 0.6, baseY: 0 });
    addDeck({ x: 40, z: 25, w: 9, d: 12, h: 0.6, baseY: 0 });
    addDeck({ x: 0, z: -7, w: 12, d: 8, h: 0.3, baseY: 0 });

    // Purpose-built, traversable approaches to the raised sectors.
    addStepRun({ x: 0, z: -13.7, axis: 'z', direction: -1, count: 4, rise: 0.3, depth: 1.8, width: 5.5 });
    addStepRun({ x: -14.6, z: -4, axis: 'x', direction: -1, count: 3, rise: 0.3, depth: 1.8, width: 7 });
    addStepRun({ x: 14.6, z: -4, axis: 'x', direction: 1, count: 3, rise: 0.3, depth: 1.8, width: 7 });
    addStepRun({ x: -31.9, z: 25, axis: 'x', direction: -1, count: 2, rise: 0.3, depth: 1.8, width: 7 });
    addStepRun({ x: 31.9, z: 25, axis: 'x', direction: 1, count: 2, rise: 0.3, depth: 1.8, width: 7 });

    // Independent ramps run beside the stairs; both use the same surface queries.
    addRamp({ fromX: 4.4, toX: 4.4, fromZ: -14.7, toZ: -21.0, fromY: 0, toY: 1.2, width: 3.2 });
    addRamp({ fromX: -14.5, toX: -20.0, fromZ: 2.0, toZ: 2.0, fromY: 0, toY: 0.9, width: 3.2 });
    addRamp({ fromX: 14.5, toX: 20.0, fromZ: 2.0, toZ: 2.0, fromY: 0, toY: 0.9, width: 3.2 });

    // Explicit region graph: all four mission sectors connect to the central deck.
    world.navigationRoutes = [
      { from: 'landing-dock', to: 'central-service-deck', via: 'ground-level approach' },
      { from: 'central-service-deck', to: 'command-hangar', via: 'north stairs + ramp' },
      { from: 'central-service-deck', to: 'maintenance-bay', via: 'west stairs + ramp' },
      { from: 'central-service-deck', to: 'cargo-depot', via: 'east stairs + ramp' }
    ];
    world.validateNavigationRoutes = function () {
      const required = ['landing-dock', 'command-hangar', 'maintenance-bay', 'cargo-depot'];
      const connected = new Set(['central-service-deck', 'landing-dock']);
      this.navigationRoutes.forEach(route => {
        if (connected.has(route.from)) connected.add(route.to);
        if (connected.has(route.to)) connected.add(route.from);
      });
      return required.every(region => connected.has(region)) &&
        this.ramps.length === 3 && this.platforms.length >= 15;
    };

    // Metallic edge bands make each deck read as installed infrastructure.
    const deckEdgeMat = new THREE.MeshStandardMaterial({ color: 0x182733, roughness: 0.52, metalness: 0.82 });
    const deckGlowMat = new THREE.MeshStandardMaterial({ color: 0x1c6d83, emissive: 0x087d9b, emissiveIntensity: 0.9, metalness: 0.55 });
    [
      { x: 0, z: 30, w: 24, d: 14, y: 0.38 },
      { x: 0, z: -27, w: 20, d: 12, y: 1.22 },
      { x: -27, z: -4, w: 14, d: 18, y: 0.92 },
      { x: 27, z: -4, w: 14, d: 18, y: 0.92 }
    ].forEach(d => {
      addMapBox(structures, d.w, 0.08, 0.14, deckEdgeMat, d.x, d.y, d.z - d.d * 0.5 + 0.12, 0, false, false);
      addMapBox(structures, d.w, 0.08, 0.14, deckEdgeMat, d.x, d.y, d.z + d.d * 0.5 - 0.12, 0, false, false);
      addMapBox(structures, 0.14, 0.08, d.d, deckGlowMat, d.x - d.w * 0.5 + 0.12, d.y, d.z, 0, false, false);
      addMapBox(structures, 0.14, 0.08, d.d, deckGlowMat, d.x + d.w * 0.5 - 0.12, d.y, d.z, 0, false, false);
    });

    const underMat = Tex.mat('stone', { rx: 8, ry: 3, roughness: 0.96, metalness: 0.12, bumpScale: 0.04 });
    const underside = new THREE.Mesh(new THREE.CylinderGeometry(46, 9, 30, 56), underMat);
    underside.position.y = -21;
    scene.add(underside);
    const rimMat = Tex.mat('gunmetal', { rx: 40, ry: 1, roughness: 0.45, metalness: 0.85, bumpScale: 0.008 });
    const edgeRing = new THREE.Mesh(new THREE.TorusGeometry(61.2, 1.0, 10, 96), rimMat);
    edgeRing.rotation.x = Math.PI / 2;
    edgeRing.position.y = 0.08;
    scene.add(edgeRing);

    // ---------- central containment reactor ----------
    const turbine = new THREE.Group();
    turbine.name = 'Aegis09_Containment_Reactor';
    const reactorBase = addMapCylinder(turbine, 5.8, 6.6, 1.6, hullMat, 0, 0.8, 0, true);
    const reactorRing = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.18, 8, 48), cyanSoftMat);
    reactorRing.rotation.x = Math.PI / 2;
    reactorRing.position.y = 1.58;
    turbine.add(reactorRing);
    const reactorShaft = addMapCylinder(turbine, 1.8, 2.1, 5.8, armorMat, 0, 4.5, 0, true);
    const reactorCap = addMapCylinder(turbine, 2.7, 2.5, 0.7, hullMat, 0, 7.75, 0, true);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x69e8ff, emissive: 0x03bce7, emissiveIntensity: 1.6,
      roughness: 0.22, metalness: 0.25
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 16), coreMat);
    core.position.y = 8.8;
    turbine.add(core);
    const coreRingRig = new THREE.Group();
    coreRingRig.position.y = 8.8;
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.16, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0x67dff7, emissive: 0x00a9d6, emissiveIntensity: 1.25, roughness: 0.28, metalness: 0.35 })
    );
    coreRing.rotation.x = Math.PI / 2;
    coreRingRig.add(coreRing);
    turbine.add(coreRingRig);

    const reactorOrbit = new THREE.Group();
    reactorOrbit.position.y = 8.8;
    const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.075, 8, 52), cyanMat);
    orbitRing.rotation.x = Math.PI / 2;
    reactorOrbit.add(orbitRing);
    const orbitNode = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), amberMat);
    orbitNode.position.set(3.15, 0, 0);
    reactorOrbit.add(orbitNode);
    turbine.add(reactorOrbit);

    const reactorBeamMat = new THREE.MeshStandardMaterial({
      color: 0x3cdcff, emissive: 0x08bce7, emissiveIntensity: 1.15,
      transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide
    });
    const reactorBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 6.4, 16, 1, true), reactorBeamMat);
    reactorBeam.position.y = 4.9;
    turbine.add(reactorBeam);
    const reactorLight = new THREE.PointLight(0x36dfff, q === 'low' ? 0.5 : 1.35, 28, 2);
    reactorLight.position.y = 8.7;
    turbine.add(reactorLight);
    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.18, 0.34), i % 2 ? cyanSoftMat : hullMat);
      arm.position.set(0, 2.25, 0);
      arm.rotation.y = i * Math.PI / 2;
      blades.add(arm);
    }
    turbine.add(blades);
    const beacon = makeBlinkingLight(0x35dfff);
    beacon.position.y = 10.2;
    turbine.add(beacon);
    world.blinkers.push(beacon);
    turbine.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = shadowOn; } });
    scene.add(turbine);
    world.turbine = turbine;
    world.blades = blades;
    world.core = core;
    world.coreRing = coreRing;
    world.coreRingRig = coreRingRig;
    world.reactorOrbit = reactorOrbit;
    world.reactorBeam = reactorBeam;
    world.reactorLight = reactorLight;

    // ---------- north command hangar ----------
    const arch = new THREE.Group();
    arch.name = 'Aegis09_Command_Hangar';
    const hangarFrameMat = Tex.mat('gunmetal', { rx: 4, ry: 2, roughness: 0.5, metalness: 0.84 });
    const hangarWallMat = Tex.mat('container', { rx: 5, ry: 2, roughness: 0.62, metalness: 0.7 });
    const sideA = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.2, 1.6), hangarFrameMat);
    sideA.position.set(-8.4, 4.8, 0);
    sideA.userData.playerSolid = true; sideA.userData.blocksBullets = true;
    const sideB = sideA.clone(); sideB.position.x = 8.4;
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(16.8, 5.8, 0.8), hangarWallMat);
    rearWall.position.set(0, 4.1, -5.2);
    rearWall.userData.playerSolid = true; rearWall.userData.blocksBullets = true;
    const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.8, 0.8), hangarWallMat);
    frontLeft.position.set(-5.8, 4.1, 5.2);
    frontLeft.userData.playerSolid = true; frontLeft.userData.blocksBullets = true;
    const frontRight = frontLeft.clone(); frontRight.position.x = 5.8;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(18.2, 1.2, 1.6), hangarFrameMat);
    lintel.position.set(0, 8.1, 5.1);
    lintel.userData.playerSolid = true; lintel.userData.blocksBullets = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.55, 11.6), hangarFrameMat);
    roof.position.set(0, 7.2, 0);
    roof.userData.playerSolid = true; roof.userData.blocksBullets = true;
    arch.add(sideA, sideB, rearWall, frontLeft, frontRight, lintel, roof);

    const windowA = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.18, 0.06), cyanMat);
    windowA.position.set(-5.1, 5.4, 5.64);
    const windowB = windowA.clone(); windowB.position.x = 5.1;
    const hangarStripe = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.12, 0.08), amberMat);
    hangarStripe.position.set(0, 1.45, 5.65);
    arch.add(windowA, windowB, hangarStripe);

    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x65e4ff, emissive: 0x06b9e8, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.72, side: THREE.DoubleSide
    });
    const portal = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.22, 10, 48), portalMat);
    portal.position.set(0, 4.0, 5.55);
    arch.add(portal);
    const portalLight = new THREE.PointLight(0x25cfff, q === 'low' ? 0.35 : 0.9, 17, 2);
    portalLight.position.set(0, 4.2, 7.0);
    arch.add(portalLight);
    const hangarScanner = new THREE.Group();
    hangarScanner.position.set(0, 7.2, 0.2);
    const scannerArm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.14), cyanMat);
    hangarScanner.add(scannerArm);
    const scannerBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), amberMat);
    scannerBeacon.position.x = 1.75;
    hangarScanner.add(scannerBeacon);
    arch.add(hangarScanner);
    arch.position.set(0, 0, -27);
    arch.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = shadowOn; } });
    scene.add(arch);
    world.portal = portal;
    world.portalLight = portalLight;
    world.hangarScanner = hangarScanner;

    // ---------- maintenance bay: west ----------
    const props = new THREE.Group();
    props.name = 'Aegis09_Maintenance_And_Cargo';
    scene.add(props);
    world.gantryTrolley = null;
    const addBox = (w, h, d, mat, x, y, z, ry = 0, solid = true, blocksBullets = true) =>
      addMapBox(props, w, h, d, mat, x, y, z, ry, solid, blocksBullets);
    const addCylinder = (rt, rb, h, mat, x, y, z) =>
      addMapCylinder(props, rt, rb, h, mat, x, y, z, true);

    // Pressure tanks, service couplings and exposed conduit runs.
    addCylinder(1.35, 1.5, 4.6, hullMat, -31.2, 3.2, -4.2);
    addCylinder(1.15, 1.3, 4.0, armorMat, -23.4, 2.9, -5.8);
    addBox(6.4, 1.1, 2.4, hullMat, -27.1, 1.55, 1.0, 0.08);
    addBox(0.32, 0.32, 9.5, cyanSoftMat, -33.4, 1.55, -4.5, 0, false, false);
    addBox(0.32, 0.32, 8.4, cyanSoftMat, -21.0, 1.55, -4.3, 0, false, false);
    [-1, 1].forEach(side => {
      addCylinder(0.16, 0.16, 4.8, amberMat, -27.2 + side * 4.2, 3.0, -10.5);
    });

    // ---------- cargo depot: east ----------
    // Container stacks are placed on the elevated cargo deck, with open lanes
    // left between them for ground movement and firing lines.
    addBox(6.8, 3.0, 2.8, containerMat, 23.9, 2.4, -8.4, -0.08);
    addBox(6.8, 3.0, 2.8, containerMat, 31.0, 2.4, -8.1, 0.06);
    addBox(6.8, 3.0, 2.8, rustMat, 27.5, 5.4, -8.25, -0.02);
    addBox(1.0, 1.0, 1.0, amberMat, 23.9, 4.45, -8.4, 0, false, false);
    addBox(1.0, 1.0, 1.0, amberMat, 31.0, 4.45, -8.1, 0, false, false);

    // Overhead loading gantry on the cargo deck.
    [-1, 1].forEach(side => {
      addBox(0.55, 6.4, 0.55, hullMat, 21.7 + (side > 0 ? 11 : 0), 4.1, -1.6);
    });
    addBox(12.0, 0.48, 0.6, hullMat, 27.2, 7.15, -1.6);
    addBox(0.5, 0.5, 0.5, cyanMat, 27.2, 6.82, -1.6, 0, false, false);
    const gantryTrolley = new THREE.Group();
    addMapBox(gantryTrolley, 1.7, 0.48, 0.88, armorMat, 0, 0, 0, 0, false, false);
    addMapBox(gantryTrolley, 1.22, 0.12, 0.94, cyanMat, 0, -0.08, 0, 0, false, false);
    addMapBox(gantryTrolley, 0.06, 1.05, 0.06, hullMat, 0, -0.72, 0, 0, false, false);
    addMapBox(gantryTrolley, 0.52, 0.42, 0.52, amberMat, 0, -1.42, 0, 0, false, false);
    gantryTrolley.position.set(27.2, 6.9, -1.6);
    props.add(gantryTrolley);
    world.gantryTrolley = gantryTrolley;

    // Scattered cover is deliberate and leaves broad lanes through the centre.
    addBox(5.8, 1.25, 0.7, hullMat, -12.5, 0.625, 12.5, 0.28);
    addBox(5.8, 1.25, 0.7, hullMat, 12.5, 0.625, 12.5, -0.28);
    addBox(5.8, 1.25, 0.7, hullMat, -12.5, 0.625, -12.5, -0.28);
    addBox(5.8, 1.25, 0.7, hullMat, 12.5, 0.625, -12.5, 0.28);

    // Low barricades at the service approaches: cover, not arena walls.
    [
      [-8, 23, 0.14], [8, 23, -0.14],
      [-37, 4, 0.22], [37, 4, -0.22],
      [-18, -24, 0.12], [18, -24, -0.12]
    ].forEach((p, i) => {
      addBox(4.8, 1.1, 0.62, i % 2 ? armorMat : hazardMat, p[0], 0.55, p[1], p[2]);
      addBox(4.5, 0.12, 0.68, amberMat, p[0], 1.08, p[1], p[2], false, false);
    });

    // Landing dock with a raised circular deployment pad.
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 8.0, 0.18, 48), hullMat);
    pad.position.set(0, 0.45, 31);
    pad.castShadow = shadowOn;
    pad.receiveShadow = true;
    pad.userData.playerSolid = true;
    pad.userData.platform = true;
    pad.userData.blocksBullets = true;
    props.add(pad);
    world.platforms.push({ x: 0, z: 31, radius: 8, topY: 0.54, baseY: 0.36, height: 0.18, collider: pad });
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(7.45, 0.22, 8, 48), cyanMat);
    padRing.rotation.x = Math.PI / 2;
    padRing.position.set(0, 0.56, 31);
    props.add(padRing);
    const padInnerRing = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.07, 6, 48), amberMat);
    padInnerRing.rotation.x = Math.PI / 2;
    padInnerRing.position.set(0, 0.565, 31);
    props.add(padInnerRing);
    [-1, 1].forEach(side => {
      addMapBox(props, 0.18, 0.06, 4.0, cyanMat, side * 9.3, 0.42, 31, 0, false, false);
    });

    // Supply cases and fuel drums are kept near the sector edges.
    [
      [-8.5, 0.75, 25.5, 0.18], [8.5, 0.75, 25.5, -0.18],
      [-35.0, 0.75, -6.5, 0.2], [-36.8, 0.75, -5.1, -0.12],
      [35.0, 0.75, 7.0, -0.35], [36.5, 0.75, 8.0, 0.18]
    ].forEach(c => addBox(1.5, 1.5, 1.5, Tex.mat('crate', { rx: 1, ry: 1, roughness: 0.88, metalness: 0.1 }), c[0], c[1], c[2], c[3]));
    [
      [-6.5, 0.95, 27.5], [6.5, 0.95, 27.5],
      [-35.5, 0.95, -9.5], [35.5, 0.95, 10.5]
    ].forEach((p, i) => addCylinder(0.58, 0.58, 1.9, i % 2 ? armorMat : rustMat, p[0], p[1], p[2]));

    // Perimeter signal pylons and navigation lights.
    const pylons = [[-44, -22], [44, -22], [-44, 22], [44, 22]];
    pylons.forEach((p, i) => {
      const pylon = new THREE.Group();
      addMapCylinder(pylon, 0.34, 0.52, 6.2, hullMat, 0, 3.1, 0, true);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.11, 6, 16), i % 2 ? amberMat : cyanMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 5.4;
      pylon.add(collar);
      const lamp = makeBlinkingLight(i % 2 ? 0xff9b42 : 0x35dfff);
      lamp.position.y = 6.4;
      pylon.add(lamp);
      pylon.position.set(p[0], 0, p[1]);
      pylon.traverse(o => { if (o.isMesh) { o.castShadow = shadowOn; o.receiveShadow = true; } });
      structures.add(pylon);
      world.blinkers.push(lamp);
    });

    // ---------- floating relay platforms ----------
    // Distant islands are now abandoned industrial relays instead of green huts.
    const islandGroup = new THREE.Group();
    islandGroup.name = 'Aegis09_Floating_Relay_Structures';
    const islandDefs = [
      { x: -34, y: 8, z: -22, s: 1.25 },
      { x: 38, y: 12, z: -30, s: 1.55 },
      { x: -46, y: 16, z: 12, s: 1.05 },
      { x: 44, y: 7, z: 20, s: 1.3 },
      { x: 6, y: 20, z: -52, s: 1.7 },
      { x: -18, y: 24, z: 40, s: 1.1 }
    ];
    const islandRockMat = new THREE.MeshStandardMaterial({ color: 0x263541, roughness: 0.92, metalness: 0.16 });
    islandDefs.forEach((d, i) => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(5.8 * d.s, 6.2 * d.s, 0.85, 18), hullMat);
      top.position.y = 0;
      // Relay islands are visual landmarks only: never register them as walkable or solid. 
      top.userData.decorativeOnly = true;
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(5.5 * d.s, 8.5 * d.s, 14), islandRockMat);
      bottom.rotation.x = Math.PI;
      bottom.position.y = -4.4 * d.s;
      bottom.userData.decorativeOnly = true;
      g.add(top, bottom);
      const relayMast = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * d.s, 0.28 * d.s, 3.2 * d.s, 8), armorMat);
      relayMast.position.y = 2.0 * d.s;
      g.add(relayMast);
      const relayCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.65 * d.s, 0), cyanMat);
      relayCore.position.y = 4.0 * d.s;
      g.add(relayCore);
      const relayRingRig = new THREE.Group();
      relayRingRig.position.y = -1.2 * d.s;
      const relayRing = new THREE.Mesh(new THREE.TorusGeometry(4.5 * d.s, 0.085 * d.s, 6, 36), cyanSoftMat);
      relayRing.rotation.x = Math.PI / 2;
      relayRingRig.add(relayRing);
      g.add(relayRingRig);
      const relayThrusters = [];
      for (let j = 0; j < 3; j++) {
        const tx = Math.cos(j * Math.PI * 2 / 3) * 2.3 * d.s;
        const tz = Math.sin(j * Math.PI * 2 / 3) * 2.3 * d.s;
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * d.s, 0.62 * d.s, 1.1 * d.s, 8), darkGlassMat);
        thruster.position.set(tx, -0.9 * d.s, tz);
        g.add(thruster);
        const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.43 * d.s, 0.055 * d.s, 5, 16), cyanMat);
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.set(tx, -1.45 * d.s, tz);
        g.add(glowRing);
        relayThrusters.push(glowRing);
      }
      world.relayMotion.push({ core: relayCore, ringRig: relayRingRig, thrusters: relayThrusters, phase: i * 0.9 });
      g.position.set(d.x, d.y, d.z);
      g.userData.baseY = d.y;
      g.userData.phase = i * 1.3;
      g.userData.speed = 0.28 + (i % 3) * 0.1;
      islandGroup.add(g);
      world.updatables.push(g);
    });
    islandGroup.traverse(o => { if (o.isMesh) o.castShadow = shadowOn; });
    scene.add(islandGroup);

    // ---------- lighting language / map variants ----------
    const outpost = new THREE.Group();
    outpost.name = 'Stormglass_Blacksite_Overlay';
    const outpostWallMat = new THREE.MeshStandardMaterial({ color: 0x1a2632, roughness: 0.58, metalness: 0.82 });
    const outpostAccent = new THREE.MeshStandardMaterial({ color: 0x8f2e37, emissive: 0x52131c, emissiveIntensity: 0.9, metalness: 0.42 });
    [
      [-33, -17, 0.12], [33, -17, -0.12], [-33, 17, -0.12], [33, 17, 0.12]
    ].forEach(p => {
      addMapBox(outpost, 7.2, 1.5, 0.9, outpostWallMat, p[0], 0.75, p[1], p[2], true, true);
      addMapBox(outpost, 6.5, 0.14, 0.96, outpostAccent, p[0], 1.5, p[1], p[2], true, true);
    });
    [[-40, -32], [40, -32], [-40, 32], [40, 32]].forEach(p => {
      addMapCylinder(outpost, 0.3, 0.42, 5.6, outpostWallMat, p[0], 2.8, p[1], true);
    });
    outpost.visible = false;
    scene.add(outpost);
    world.outpost = outpost;
    world.setMap = function (name) {
      const isOutpost = name === 'blackout';
      outpost.visible = isOutpost;
      world.mapName = isOutpost ? 'STORMGLASS BLACKSITE' : 'AEGIS-09 SALVAGE COMPLEX';
    };

    // ---------- clouds ----------
    const cloudLayers = [
      makeCloudLayer({ count: 9, seed: 11, size: 16, radius: 260, y: 95, jitter: 26, opacity: 0.48, speed: 0.9 }),
      makeCloudLayer({ count: 10, seed: 47, size: 11, radius: 190, y: 62, jitter: 20, opacity: 0.62, speed: 1.5 }),
      makeCloudLayer({ count: 8, seed: 83, size: 7, radius: 130, y: 38, jitter: 14, opacity: 0.72, speed: 2.4 }),
      makeCloudLayer({ count: 16, seed: 129, size: 20, radius: 180, y: -26, jitter: 18, opacity: 0.78, speed: 0.5 })
    ];
    cloudLayers.forEach(c => scene.add(c));
    world.clouds = cloudLayers;

    // ---------- mood theo mission ----------
    const moods = {
      clear: { sky: [0x102538, 0x426a82, 0x91adbc], fog: [0x829db0, 66, 390], sun: 1.48, hemi: 1.02 },
      squall: { sky: [0x101c2a, 0x2c465b, 0x637e91], fog: [0x627b8c, 38, 250], sun: 1.08, hemi: 0.78 },
      gale: { sky: [0x1b3e58, 0x5d8eaa, 0xa9c2cf], fog: [0x93afbd, 88, 480], sun: 1.58, hemi: 1.08 },
      blackout: { sky: [0x080f19, 0x142838, 0x283d4e], fog: [0x344b5c, 32, 205], sun: 0.82, hemi: 0.62 }
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
      rim.intensity = m.sun < 0.9 ? 0.62 : 0.82;
      fill.intensity = m.sun < 0.9 ? 0.28 : 0.36;
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


    // Register explicitly solid meshes. Can be called again for late-loaded static assets.
    const registeredColliderMeshes = new WeakSet();
    function registerPlayerColliderMesh(o) {
      if (!o.isMesh || o.userData.decorativeOnly === true || !(o.userData.playerSolid === true || o.userData.blocksBullets === true)) return;
      if (registeredColliderMeshes.has(o)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const localBox = o.geometry.boundingBox;
      if (!localBox) return;
      const localSize = localBox.getSize(new THREE.Vector3());
      const worldScale = o.getWorldScale(new THREE.Vector3());
      const worldRotation = o.getWorldQuaternion(new THREE.Quaternion());
      const worldBounds = new THREE.Box3().setFromObject(o);
      const worldCenter = new THREE.Vector3();
      worldBounds.getCenter(worldCenter);
      const yaw = Math.atan2(
        2 * (worldRotation.w * worldRotation.y + worldRotation.x * worldRotation.z),
        1 - 2 * (worldRotation.y * worldRotation.y + worldRotation.x * worldRotation.x)
      );
      const isRound = o.geometry.type === 'CylinderGeometry' || o.geometry.type === 'ConeGeometry';
      world.playerColliders.push({
        object: o,
        x: worldCenter.x,
        z: worldCenter.z,
        yaw: yaw,
        shape: isRound ? 'circle' : 'box',
        radius: Math.max(localSize.x * Math.abs(worldScale.x), localSize.z * Math.abs(worldScale.z)) * 0.5,
        halfX: Math.max(0.01, localSize.x * Math.abs(worldScale.x) * 0.5),
        halfZ: Math.max(0.01, localSize.z * Math.abs(worldScale.z) * 0.5),
        minY: worldBounds.min.y,
        maxY: worldBounds.max.y,
        isPlatform: o.userData.platform === true
      });
      registeredColliderMeshes.add(o);
    }
    world.registerPlayerColliders = function (root) {
      scene.updateMatrixWorld(true);
      const target = root || scene;
      if (target && typeof target.traverse === 'function') target.traverse(registerPlayerColliderMesh);
      return this.playerColliders.length;
    };
    world.registerPlayerColliders(scene);

    // ---------- animation ----------
    let t = 0;
    world.update = function (dt, reducedMotion) {
      t += dt;
      const k = reducedMotion ? 0.2 : 1;
      const reactorPulse = 0.5 + 0.5 * Math.sin(t * 2.35);
      blades.rotation.y += dt * 0.42 * k;
      core.scale.setScalar(1 + (reactorPulse - 0.5) * 0.1 * k);
      core.material.emissiveIntensity = 1.65 + (reactorPulse - 0.5) * 2.1 * k;
      coreRingRig.rotation.y += dt * 0.68 * k;
      coreRing.material.emissiveIntensity = 1.32 + (reactorPulse - 0.5) * 1.9 * k;
      reactorOrbit.rotation.y -= dt * 0.46 * k;
      orbitRing.material.emissiveIntensity = 0.95 + (reactorPulse - 0.5) * 1.0 * k;
      orbitNode.rotation.x += dt * 1.2 * k;
      reactorBeam.scale.y = 1 + (reactorPulse - 0.5) * 0.24 * k;
      reactorBeam.material.opacity = 0.18 + (reactorPulse - 0.5) * 0.18 * k;
      reactorLight.intensity = (q === 'low' ? 0.5 : 1.25) * (0.9 + (reactorPulse - 0.5) * 0.6 * k);

      portal.material.emissiveIntensity = 1.2 + Math.sin(t * 1.7) * 0.35 * k;
      portal.rotation.z += dt * 0.28 * k;
      portalLight.intensity = (q === 'low' ? 0.35 : 0.9) * (0.9 + Math.sin(t * 1.7 + 0.8) * 0.1 * k);
      hangarScanner.rotation.y = Math.sin(t * 0.34) * 0.82 * k;

      if (gantryTrolley) {
        gantryTrolley.position.x = 27.2 + Math.sin(t * 0.42) * 3.4 * k;
      }

      islandGroup.children.forEach((g, i) => {
        g.position.y = g.userData.baseY + Math.sin(t * g.userData.speed + g.userData.phase) * 1.2 * k;
        g.rotation.y += dt * 0.03 * k;
      });
      for (let i = 0; i < world.relayMotion.length; i++) {
        const relay = world.relayMotion[i];
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.1 + relay.phase);
        relay.core.scale.setScalar(1 + (pulse - 0.5) * 0.16 * k);
        relay.ringRig.rotation.y += dt * (i % 2 ? -0.32 : 0.32) * k;
        relay.thrusters.forEach((ring, j) => {
          ring.material.emissiveIntensity = 0.9 + Math.sin(t * 2.7 + relay.phase + j) * 0.55 * k;
        });
      }

      // ambient sway hooks for optional environment props
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
        const pulse = Math.pow(Math.max(0, Math.sin(t * 2.2 + i * 1.05)), 8) * k;
        b.userData.light.intensity = 0.15 + pulse * (q === 'low' ? 1.5 : 3.0);
        b.userData.bulb.material.emissiveIntensity = 0.28 + pulse * 2.7;
      }

      for (let i = 0; i < world.lamps.length; i++) {
        world.lamps[i].emissiveIntensity = 1.55 + Math.sin(t * 2.4 + i * 1.4) * 0.35 * k;
      }
    };

    return world;
  }

  return { create: createWorld, mergeGeoms: mergeGeoms };
})();
