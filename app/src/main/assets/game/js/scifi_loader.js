/* ============================================================
   SKYWARD SALVAGE — Offline glTF asset runtime
   Quaternius Sci-Fi Essentials Kit (CC0 1.0)
   Embedded binary buffers + local textures: works without fetch/CDN.
   ============================================================ */
(function () {
  'use strict';
  const pack = window.SKYWARD_GLTF_PACK || {};
  const textureCache = Object.create(null);
  const definitionCache = Object.create(null);
  let textureQuality = 'med';
  const component = {
    5120: { Ctor: Int8Array, bytes: 1, get: 'getInt8' },
    5121: { Ctor: Uint8Array, bytes: 1, get: 'getUint8' },
    5122: { Ctor: Int16Array, bytes: 2, get: 'getInt16' },
    5123: { Ctor: Uint16Array, bytes: 2, get: 'getUint16' },
    5125: { Ctor: Uint32Array, bytes: 4, get: 'getUint32' },
    5126: { Ctor: Float32Array, bytes: 4, get: 'getFloat32' }
  };
  const itemSizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const attrNames = {
    POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv',
    TEXCOORD_1: 'uv2', TANGENT: 'tangent', COLOR_0: 'color',
    JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight'
  };
  function decodeBase64(s) {
    const raw = atob(s), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out.buffer;
  }
  function readAccessor(gltf, buffer, index) {
    const a = gltf.accessors[index];
    if (!a) throw new Error('Missing glTF accessor ' + index);
    const bv = gltf.bufferViews[a.bufferView];
    const info = component[a.componentType], size = itemSizes[a.type];
    if (!bv || !info || !size) throw new Error('Unsupported glTF accessor ' + index);
    const stride = bv.byteStride || size * info.bytes;
    const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const view = new DataView(buffer);
    const out = new info.Ctor(a.count * size);
    for (let i = 0; i < a.count; i++) {
      for (let j = 0; j < size; j++) {
        const off = start + i * stride + j * info.bytes;
        out[i * size + j] = info.bytes === 1 ? view[info.get](off) : view[info.get](off, true);
      }
    }
    if (a.normalized && a.componentType !== 5126) {
      const max = a.componentType === 5121 ? 255 : a.componentType === 5123 ? 65535 : a.componentType === 5120 ? 127 : 32767;
      const f = new Float32Array(out.length);
      for (let i = 0; i < out.length; i++) f[i] = Math.max(-1, out[i] / max);
      return { array: f, itemSize: size, normalized: false };
    }
    return { array: out, itemSize: size, normalized: !!a.normalized };
  }
  function getTexture(uri, colorSpace, sampler) {
    if (!uri) return null;
    const selectedUri = textureQuality === 'high' ? uri : uri.replace(/\.png$/i, '_512.png');
    const key = selectedUri;
    if (textureCache[key]) return textureCache[key];
    const loader = new THREE.TextureLoader();
    const tex = loader.load(selectedUri, function (loaded) {
      loaded.flipY = false;
      loaded.encoding = colorSpace ? THREE.sRGBEncoding : THREE.LinearEncoding;
      loaded.anisotropy = 4;
      loaded.needsUpdate = true;
    }, undefined, function (err) {
      console.warn('[Skyward] Texture unavailable:', selectedUri, err || '');
    });
    tex.flipY = false;
    tex.encoding = colorSpace ? THREE.sRGBEncoding : THREE.LinearEncoding;
    tex.anisotropy = 4;
    if (sampler) {
      const filters = {
        9728: THREE.NearestFilter, 9729: THREE.LinearFilter,
        9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter,
        9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter
      };
      tex.magFilter = filters[sampler.magFilter] || THREE.LinearFilter;
      tex.minFilter = filters[sampler.minFilter] || THREE.LinearMipmapLinearFilter;
      tex.wrapS = sampler.wrapS === 33648 ? THREE.MirroredRepeatWrapping : sampler.wrapS === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      tex.wrapT = sampler.wrapT === 33648 ? THREE.MirroredRepeatWrapping : sampler.wrapT === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    }
    textureCache[key] = tex;
    return tex;
  }
  function textureFor(gltf, textureInfo, colorSpace) {
    if (!textureInfo || !gltf.textures || !gltf.images) return null;
    const texDef = gltf.textures[textureInfo.index];
    const img = texDef && gltf.images[texDef.source];
    if (!img || !img.uri) return null;
    return getTexture(img.uri, colorSpace, gltf.samplers && gltf.samplers[texDef.sampler || 0]);
  }
  function makeMaterial(gltf, index) {
    const def = (gltf.materials || [])[index] || {};
    const pbr = def.pbrMetallicRoughness || {};
    const base = pbr.baseColorFactor || [1, 1, 1, 1];
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(base[0], base[1], base[2]),
      opacity: base[3],
      metalness: pbr.metallicFactor === undefined ? 1 : pbr.metallicFactor,
      roughness: pbr.roughnessFactor === undefined ? 1 : pbr.roughnessFactor,
      side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    });
    if (window.SKYWARD_ENV) { mat.envMap = window.SKYWARD_ENV; mat.envMapIntensity = 0.9; }
    mat.map = textureFor(gltf, pbr.baseColorTexture, true);
    const orm = textureFor(gltf, pbr.metallicRoughnessTexture, false);
    if (orm) { mat.metalnessMap = orm; mat.roughnessMap = orm; }
    mat.normalMap = textureFor(gltf, def.normalTexture, false);
    if (def.normalTexture && def.normalTexture.scale !== undefined) mat.normalScale.setScalar(def.normalTexture.scale);
    mat.aoMap = textureFor(gltf, def.occlusionTexture, false);
    if (mat.aoMap) mat.aoMapIntensity = def.occlusionTexture.strength === undefined ? 1 : def.occlusionTexture.strength;
    mat.emissive = new THREE.Color().setRGB(
      (def.emissiveFactor || [0, 0, 0])[0],
      (def.emissiveFactor || [0, 0, 0])[1],
      (def.emissiveFactor || [0, 0, 0])[2]
    );
    mat.emissiveMap = textureFor(gltf, def.emissiveTexture, true);
    if (def.alphaMode === 'BLEND') { mat.transparent = true; mat.depthWrite = false; }
    if (def.alphaMode === 'MASK') { mat.alphaTest = def.alphaCutoff === undefined ? 0.5 : def.alphaCutoff; }
    mat.userData.gltfMaterial = def.name || '';
    return mat;
  }
  function getDefinition(name) {
    if (definitionCache[name]) return definitionCache[name];
    const entry = pack[name];
    if (!entry) return null;
    const gltf = entry.gltf;
    const buffer = decodeBase64(entry.bin);
    const geometries = [];
    (gltf.meshes || []).forEach((meshDef, mi) => {
      geometries[mi] = [];
      (meshDef.primitives || []).forEach((prim) => {
        const geo = new THREE.BufferGeometry();
        Object.keys(prim.attributes || {}).forEach((semantic) => {
          const attr = readAccessor(gltf, buffer, prim.attributes[semantic]);
          const nameOut = attrNames[semantic];
          if (nameOut) {
            geo.setAttribute(nameOut, new THREE.BufferAttribute(attr.array, attr.itemSize, attr.normalized));
            if (nameOut === 'uv' && !geo.attributes.uv2) geo.setAttribute('uv2', new THREE.BufferAttribute(attr.array, attr.itemSize, attr.normalized));
          }
        });
        if (prim.indices !== undefined) {
          const idx = readAccessor(gltf, buffer, prim.indices);
          geo.setIndex(new THREE.BufferAttribute(idx.array, 1));
        }
        if (!geo.attributes.normal) geo.computeVertexNormals();
        geo.computeBoundingSphere();
        geometries[mi].push({ geometry: geo, materialIndex: prim.material || 0, mode: prim.mode === undefined ? 4 : prim.mode });
      });
    });
    const materials = (gltf.materials || [{}]).map((_, i) => makeMaterial(gltf, i));
    const clips = [];
    (gltf.animations || []).forEach(anim => {
      const tracks = [];
      (anim.channels || []).forEach(channel => {
        const sampler = anim.samplers[channel.sampler], target = channel.target || {};
        if (!sampler || target.node === undefined || target.path === 'weights' || sampler.interpolation === 'CUBICSPLINE') return;
        const node = gltf.nodes[target.node], nodeName = node && node.name;
        if (!nodeName) return;
        const times = readAccessor(gltf, buffer, sampler.input).array;
        const values = readAccessor(gltf, buffer, sampler.output).array;
        let Track = target.path === 'rotation' ? THREE.QuaternionKeyframeTrack : target.path === 'scale' || target.path === 'translation' ? THREE.VectorKeyframeTrack : null;
        if (!Track) return;
        const path = target.path === 'translation' ? 'position' : target.path === 'rotation' ? 'quaternion' : target.path;
        const interpolation = sampler.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear;
        tracks.push(new Track(nodeName + '.' + path, times, values, interpolation));
      });
      if (tracks.length) clips.push(new THREE.AnimationClip(anim.name || 'Animation', -1, tracks));
    });
    const def = { gltf, buffer, geometries, materials, clips };
    definitionCache[name] = def;
    return def;
  }
  function makeInstance(name, cloneMaterials) {
    const def = getDefinition(name);
    if (!def) return null;
    const gltf = def.gltf;
    const jointSet = new Set();
    (gltf.skins || []).forEach(s => s.joints.forEach(j => jointSet.add(j)));
    const nodes = gltf.nodes.map((n, i) => {
      const obj = jointSet.has(i) ? new THREE.Bone() : new THREE.Group();
      obj.name = n.name || ('Node_' + i);
      if (n.matrix) {
        const m = new THREE.Matrix4().fromArray(n.matrix);
        m.decompose(obj.position, obj.quaternion, obj.scale);
      } else {
        if (n.translation) obj.position.fromArray(n.translation);
        if (n.rotation) obj.quaternion.fromArray(n.rotation);
        if (n.scale) obj.scale.fromArray(n.scale);
      }
      return obj;
    });
    nodes.forEach((obj, i) => (gltf.nodes[i].children || []).forEach(c => obj.add(nodes[c])));
    const roots = new THREE.Group();
    roots.name = name + '_Root';
    (gltf.scenes[gltf.scene || 0].nodes || []).forEach(i => roots.add(nodes[i]));
    const materialInstances = cloneMaterials ? def.materials.map(m => m.clone()) : def.materials;
    const meshNodes = [];
    gltf.nodes.forEach((nodeDef, ni) => {
      if (nodeDef.mesh === undefined) return;
      const parent = nodes[ni], primitives = def.geometries[nodeDef.mesh] || [];
      let skeleton = null;
      if (nodeDef.skin !== undefined && gltf.skins && gltf.skins[nodeDef.skin]) {
        const skin = gltf.skins[nodeDef.skin];
        const bones = skin.joints.map(j => nodes[j]);
        const inverses = skin.inverseBindMatrices !== undefined
          ? readAccessor(gltf, def.buffer, skin.inverseBindMatrices).array.reduce((arr, _, idx, all) => {
              if (idx % 16 === 0) arr.push(new THREE.Matrix4().fromArray(Array.from(all.slice(idx, idx + 16))));
              return arr;
            }, [])
          : bones.map(() => new THREE.Matrix4());
        skeleton = new THREE.Skeleton(bones, inverses);
      }
      primitives.forEach(prim => {
        const mat = materialInstances[prim.materialIndex] || materialInstances[0];
        let mesh;
        if (skeleton && prim.geometry.attributes.skinIndex && prim.geometry.attributes.skinWeight) {
          mesh = new THREE.SkinnedMesh(prim.geometry, mat);
        } else mesh = new THREE.Mesh(prim.geometry, mat);
        mesh.name = nodeDef.name || (name + '_Mesh');
        mesh.userData.sharedAssetGeometry = true;
        mesh.userData.sharedAssetMaterial = !cloneMaterials;
        parent.add(mesh);
        if (skeleton && mesh.isSkinnedMesh) meshNodes.push({ mesh, skeleton });
      });
    });
    roots.updateMatrixWorld(true);
    meshNodes.forEach(item => item.mesh.bind(item.skeleton, item.mesh.matrixWorld.clone()));
    roots.updateMatrixWorld(true);
    return { root: roots, mixer: def.clips.length ? new THREE.AnimationMixer(roots) : null, clips: def.clips, materials: materialInstances, geometries: def.geometries };
  }
  function markEnemyMeshes(root, enemy) {
    root.traverse(o => {
      if (!o.isMesh) return;
      o.userData.enemy = enemy;
      o.userData.hitTarget = true;
      o.castShadow = true;
      o.receiveShadow = true;
    });
  }
  function createEnemy(name, enemy, targetHeight) {
    try {
      const instance = makeInstance(name, true);
      if (!instance) return null;
      markEnemyMeshes(instance.root, enemy);
      const box = new THREE.Box3().setFromObject(instance.root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const h = Math.max(0.001, size.y);
      const desired = targetHeight || 2;
      const scale = desired / h;
      instance.root.scale.setScalar(scale);
      instance.root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      instance.root.updateMatrixWorld(true);
      return instance;
    } catch (err) {
      console.error('[Skyward] glTF enemy fallback:', name, err);
      return null;
    }
  }
  function createStatic(name) {
    try {
      const instance = makeInstance(name, false);
      return instance ? instance.root : null;
    } catch (err) {
      console.error('[Skyward] glTF static fallback:', name, err);
      return null;
    }
  }
  function addWorldProps(scene) {
    const group = new THREE.Group();
    group.name = 'Quaternius_SciFi_Environment_Props';
    const placements = [
      { x: -19, z: -19, s: 1.35, r: 0.3, n: 'Prop_Crate' },
      { x: 20, z: -16, s: 1.15, r: -0.4, n: 'Prop_Crate' },
      { x: -22, z: 17, s: 1.1, r: 0.75, n: 'Prop_Crate' },
      { x: 23, z: 18, s: 1.3, r: -0.2, n: 'Prop_Crate' },
      { x: 0, z: -27, s: 0.85, r: 0.2, n: 'Prop_Ammo' }
    ];
    placements.forEach(p => {
      const model = createStatic(p.n);
      if (!model) return;
      model.position.set(p.x, 0.02, p.z);
      model.rotation.y = p.r;
      model.scale.setScalar(p.s);
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.decorative = true; } });
      group.add(model);
    });
    scene.add(group);
    return group;
  }
  window.SkywardAssetFactory = {
    setQuality: quality => { textureQuality = quality === 'high' ? 'high' : 'med'; },
    has: name => !!pack[name],
    createEnemy,
    createStatic,
    addWorldProps,
    getClipNames: name => { const d = getDefinition(name); return d ? d.clips.map(c => c.name) : []; }
  };
})();
