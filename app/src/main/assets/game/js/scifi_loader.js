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
  const EMBEDDED_EMISSIVE_MASKS = {
    MI_Enemies: 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAAD9UlEQVR42u3czYtbVRjH8eeec5Mx8yJTRqh23qjKWK1CBSu+trYiuJARF26KXVT8AxRc+LYVl+JCRBFlcOFKEV36Ai0GcTnV4oCiLR1HHToWdaKT5J7zuEiYJk0WDWPefL6f1U1Wub/znHOfk3sTEQAwzDccelFxLlGTQbjmJOxI6uccZM/9s7vGw9bat8sXxV4AcusTV313enUrzS3sv7n05akNW+Uv7vm37tl+mR588ZA4UwnseucpEfHu8sXASgGMv3dUXMOQu9TYhfC1RcmZ7QOcD8d++zhXNdwKjb097gyfvpPFrzZtB3DgM8ksBzAl501vhtzCekxNBzBVFdsVkJaNB1AuGA/gl7yo6QC+350PpgMolRbEciPkxR8u+mi6FXxz3ngJ3Pe64d2wePXnFg6fSqPpGnjlmaYbBAaXgZdevU7Eee98j+4JjA3Q8IuoO+mf3rP2p6qqqux1/3Q5cJ1ZzhX9YPRftfsCPuSO3V756dzf+dyN0/rGWdfVJcGHI198sugHo/+qbYWDry4t7bthZjLbXH5/XaTbS2I1bg3KFKh/FxDEh5WVeoV2/4pQcMmABSASRLwkohpj96fd9OBswBq/DTK5KbLcBPc1gMR6AFu2A1Cp2A4gUeNTYDwxHYDKsn49OMtgX9yWF9B+AAAAAAAAAAAAAAAAAAAAAACA/5RrObAlnTEewKWfDBsNQEusAgAAAAAAAAAAAAAAAAAAAAAAAAAA/F+4ie0jowFMUgQAAAAAAAAAAAAArpgnAuODeKS8aTuA07lP0zjkAezoAYmNO0SHvQLSHWQXf77FhwEYwySpH2noaQCJXBxL+xyAT2JsmoRp1ssAzjzU70eMgsjo3E17J7yf+rV8/ocfL2Q9rACR1ZE+dwKjdx+6a9/0pQ/x+8rJl3v5v/Hzz/W1Apx8qKqqWbUmi6p6wE575mSuHCpZiLotlqvHOyzqnQ2h728AR/Mx513SsCz59PHhvzJfefpLWtVmUf/Y3dmgDvGToiF3b8vHT8LVD1sJwMncrCSXv6v6YGdzYHgDSOT6fExa28KDnTVnwxzAgsQ2785f29FJDfPT4te0iyUW5lonRrc6wb5SmW/fHPeyD+hzI9xuqL0bMxNArn1hzHY0BYY5AG1/vVvv6Do41BWQhHYXhw0zU+DdmG/Z/qvLLljZDTh54ButxubNQIhro1Y2Q+Jl4iONWeNeKKto0dAv4bzICxXNqlmIMYasmqnq2gljN6zu/LyhAv764LHJjjvqIS+CII8+sn96JNHS2TPF4qqIi6YCqJ1vIRUpV0TSJAYxx9fnvBvxTz5r/I51YVYAAAAAAAAAAAAAAAAAAACAmn8BZpxDti0ScqAAAAAASUVORK5CYII=',
    MI_Enemies_Large: 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAAA+klEQVR42u3bMUqEMRAG0En+32KxU1BhLUTYRvFENp7OA22hlZ2sbKNYLCLqxksICc57F8jkS8ikmQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEjvMPXup7h9XkUdopYuVZQ4Xl5nDqDFen8xyG3sdAzv9TxzAD+xbatomW/A6+dJ7gC+NovYp+6El0t/odyqCAAAAAAAAAAAAAAA/qFpksEgJ9Fp3bubdercD3abQSrpNLkxl4fMk6M1zhZvUfIGUOIoHjMHEHH6/ZL5DShxNT8NMjnapw22j3q/a0FedZYBAAAAAAAAAAAAAAAAAAAAAMAf+AWMmB7UEymd/wAAAABJRU5ErkJggg==',
    MI_Guns_Batch1: 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAAEA0lEQVR42u3dT2hcVRTH8fPufclM0vwpcbQ1agdMadIUg/8qQgUFq7hw4abipog7N4IIKrgUWlAKLroRxKUuVNy5cKVQRK3aTW0qSrDBtlqahNSakJnk3eOi9c86eS/zDuf7gZCs7mR+c++59743c0cEAAAAAAAAAAAAgAfRzn+qL0+cjVp2s7mZADLZ15Ss9GaDod7a6VbQaPBeAywF0NdX/wBClYH+flG03i9RrHZeqaTlcstqo51dXJGQnNaT5rG5ovjtZMtrOR35RlVV9ee7XM4tQT7QTpFS6ugpjwEE2Zc2kqqqruthQyvsUFo7z2d6s6LqYxUsWeu/EPrfPqVlquuW5Yd/X/XsgstZYPfKRqGqmtZ1xmMVjPKGrq8XxUZX3/W5xQpy8sY64KM+t1vMpz78cfbTI2yt/Yrxxg8AAAAAAAAAAADKwI0X744MlNpcsNb/39rVcXwTNpdXXvJ8EzrK08cMfcSjfOG29/o9TwJRjh8sfQAYGlCheLj7XUyOB4C8M15Fq2YGQHr0ymXPFSDI223x3APSZHc+Og4gyhNfiOceUMT211L4DSDI1OJqFM8B3H9ePA8BlYlzVYwAMwEUef8F1z1AdnU3guMAgty+VM0nsYwEkMkt18T3EBhbch7AQHIeQLpWzeEBZgLI+pz3ABl0PQuI/NXvvAcsjbkOQOXqqOsAklze6XwWWGjsSJ4DiLI8Uck/a2ca/Gl/JfOgmesBcma6kiJgpgeE+WYrVTK2rASg43fMln+eoqHL4vL5wSrGgKF7g1dW70vBcQAqnzzj+kjNFM71Hyg8n1IRZPJE+UXb0A13jVfvHf4lquc+MPz+qOuTWoI8cqLst8mZes+Jxvn24VNB3QYgmn//+IPfZp7LgMizAwLX+MAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAjwQi8G3sbtdPP5c3T9fkdNReDcXhhqjrAIpUk87YqwCyzHkAtTkevFcB5GuSuQ5gd11OyM579LiXhp0vhIZ2shgEAAAAAPwnSJSjr23bPj2vXQBJMhnfs41511H3uvMANDkPYHDHtj1UXsOnn+SrhiTBttj8xfmoIllR1cBMwUgXCG57wNTUaFz98/yvTgPYe6g4+0en2Z6JHy8Gj/VqsnXzj+lX9zqtnjGISIgy8vqtrmeRKHteNF0Jt3qTVuPyZGchqNsAJNPuzKzhALbce5NcGhHDXwdfwvBdE8sL9xICiKbXASUEMFZY/kb4LQcQ5Z451zVA4/QZj5v3EP759cJDphdCm70ilERCpinJ0eXTpndDmyxfg082FpNq84Hn5j6zvRvc5HY43HloaC3p0NKXC8Z3w1u4JNZqrCyKWL8a8Dfgr/IlD/GnDwAAAABJRU5ErkJggg==',
    MI_Guns_Batch2: 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAAFV0lEQVR42u3bTUwcZRgH8Gfed3aWXWD5rKXQFim2VUEBQ2M9GEWtSQ+NxmhaE71YExNPHjwbD568mGg03vRkvHiojR+XHxhgTrcHENjVWY9uAklIo5aOwsOx8vI+HhWV2d9AtzC67+/5/p04ehtnneb+HLRHozSjHQ4RwiSR5ASFpEJEbfBORUjVRZLmeUmGSeT9ReJOogR4gvYOnRxrd0c/PFeSv5PFjje7PX02LwqbuenTXwm8XSajqb/9XF5mZmT+yRF77PzTKzMwzpwv6QOPHi8zMPxwJ6h1l+NBWJLz8TzE7nuc5Dn+Sk42gwUV2HMdxmN/My7P1V2bXcRSvntiBCkQOtIT40N0LnsvMzCrNz+ZkE7vMNjMze44a9kcEneG0YmZ2eL679PNAQaM9+MTIkf3hPNak19nJjAB21Ne+NE16fiPCn/kiko5mIzZ/QGa5C2BFREPPsBXSCPhCuWvJKJ5u8JfmU7WeplITMX/k3WzEU9eiJU02qLrxXjc9OxbWE+p9C40VTWb/zdRhZENGQyzli/RlI4bR0XqjlCtBUAGSl5yoDOmhBt1mzl6trvpjKxsBUjm7JP+FvUqlXAmDRrrrUHoltIeeyzazx+eXpa80PxnrFVDqym3hi1yg9QjzVLLsq4AIddptnVob0Mrmp3xTnaDuVdfLjPQ0v+bri4L62VHrk+A75Z8E2zqbwtwHnWB2M6v9ezmroKQ3WDmu8hybv4+InMiHbLtKKS/NE7vKvw2yYpFQB9lzfzEz8+JbeV1L0tvpTDt/e1fuWBR1X66tApNHS7wNKMNZQKj404812Re/+bsw0n/y8Z7582fPFt714itDCXv8zPvTO3AYaBm4pySnQRkYqd908ujtEndwHLS2tnsNmmBaj12/GmYBvMypXxW+D/CEcJfJ5IA3BZLn5ohMt8j2l/1spv7YRuvk1LJxfDLcPsVKKcWBASIKjjAJg4vu/oMzCzcTzXPhFGA5SfNcAQdpLv5DWK1XnzEudcyEMwSi+9IGVRdlkmNv6eBsBL8OSFXba5c+e97tmf2nIpfB8rjXklvJHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAq0/GTQrOM8/JdthV6gV5kzlXLSOJGcbftafacGhwCdZ0Hi7or9oiZHuyowR5AS1O3iiga911RPaMD017N9YDk5T+LuEdRfOHAA8ppr8iMonIbBUjsbi7qnpXExO8kr1dkAZ5s38YQEMotYmpjWhxKzg6MJSuzS990yzF1dO6NV+aYruu9s583cq7q9ycu2HrtA8ycK6vTklWekCVT4W2M9dsJGk2dIqVXAXLbXD388j4du8GGzkMmzkd6q/r+H9u7vYSr/n2ImdB84fPus/QugLKN7bwPqH5u87JmO5l8jREsZQAAAABQBKNKP3es10pdCeMvIFV6GrSGbo2vDGv89vLuLjpFhzs07gEp0UIrVgi/qUrfB3iHJpcW778WwiRQrZNgd8dSYmxa5+VLNmEJBwAAgFIy4zV/4PqPrbDZGJWRhYVa31FuGom31wlSMlnjBdi0i8fbhMdEpqVpAaJtzAYRGRFNC9Dyv12ktgsQMVmThW6zAgjNe8DG4mDqWYCNtFnTArDmBZCki+ACSMlF7JVr47gTfEJgw8ikXvMboc0a2BRCCoOEsar51w4BACr73AqaaNmjdfqSvluOlOg3V8d+jed//AXDQO9BgP/SCgAAAAAAAAAAAAAAAACVTKIEmjfQS96MqORvnJf8u1cvHK7571vDznaxbfoX6eDpEK9TRA4AAAAASUVORK5CYII=',
    MI_Props_Batch2: 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAADfklEQVR42u3dy2sVSRTA4dPVdZP4jApq1FwYH2RGMCJGd6LigyDqYhYDCj6YYTIbYdSVoitdiIL4B8R9VoKCILgQXakBIUYXPhFBYYxXE9RoyO3uOrO4waVg2sTbOb9vn9zUqXNOV1Wn+4oAAAAAAACgUGKX8xdExR27cyJp/ggWNwAaQpiz4/NHoxngwi9/VVp+X/l4y39Gi1+uqqomukJytQFf2AJws6TqxPc8d8FkBjhZcjPL9L7pa2BXEi4XuY3nXgJMG9K74sRwBPa8PVDcLvZDzDG+EHYCAAAAAMBP3FjGBT+XiPOFwMvJ7oIezdSGHWf/bgq5ThcXrBUtcgacG3jUleN81Uv37YIez9YywA19ef0m1xTOLOo9tlrhRmcH+3vjzGL3rwUg893ico1/pKgdYKz3p07y3WEbaSx0BkjO4as8G2YtBQAAAAAAAAAAAAAAAAAAAAAAAAAA8C22Xxg4u3kSPqR+n3pva5MQve43m/odnSWRps0brFbB/N2yWLzItrLJLuNk2QP5+0Rakr7lE/wn1muCJYNyeuWJRIaDBJMBaGgSt3/NYWmMjTaBpRvFi98k61ZZ7YLb2kVEVuya6OHX7TrAbZ72KpTDzarZhZA0L4wqg+wG2AoBAOytA+JIM/OTMykvaq3T92CWj//h3n0Odid/1s6rOtRzaLblAtg+pHrF7hdpOS/t70f1kOGvEmuQvZp9KBveEMRyR/Wi4RTw8o8m+pvdFHDSnmjffMt74rmDyWrDJSAyc+TehBeAq+cSaG56bDsA7fJoEj6ljh2Uh4YbgJeOavKr3YtgSeY9TF80Gs6ARb2qPWYvgq712Kg+O9Nqdg24/lL/hc4ZhvPfjfVBy3wsAAAAAAAAAAAAAIAfZHy3YL0TJWhmB+NCy75VlU+Gp7/zierHW0YfZ/HSel01SVSXGf0XvvUvtZppCKM2A1A+VdFUVYMOt5gbvJPFvZ9UM1VV1cpcg+XfpSGtDT/TGw1TZVq/Q8jSsctmkKdVby8AaRx9/bGtTam1AKgMfNC09kx3JAummyuBTPrelHw89kRzNkU2A99VyAPbt3S0dWpUywGrjmo1VQ1v51kcvPPey3nVtJpeK1l9mMXL8b5e1Z1TZFc8vlLu+DM94uy+32FKHYiMLwNcJLzjBQAAAAAAAAAAAAAAAAAAAAAAAAAAAPXlf6Gh90f1dpa5AAAAAElFTkSuQmCC'
  };
  const embeddedEmissiveCache = Object.create(null);
  function getEmbeddedEmissiveMask(materialName) {
    const encoded = EMBEDDED_EMISSIVE_MASKS[materialName];
    if (!encoded) return null;
    if (embeddedEmissiveCache[materialName]) return embeddedEmissiveCache[materialName];
    const tex = new THREE.TextureLoader().load('data:image/png;base64,' + encoded, function (loaded) {
      loaded.flipY = false;
      loaded.encoding = THREE.sRGBEncoding;
      loaded.anisotropy = 4;
      loaded.needsUpdate = true;
    });
    tex.flipY = false;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    embeddedEmissiveCache[materialName] = tex;
    return tex;
  }
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
    // Quaternius ORM atlases encode several armor/gun surfaces as almost fully
    // metallic. With a lightweight scene environment this removes diffuse
    // response and makes the assets read as black silhouettes. Use per-atlas
    // material limits while preserving the original maps and emissive masks.
    const materialProfile = {
      MI_Enemies:       { metalnessCap: 0.12, roughnessFloor: 0.64, albedoLift: 1.42, envIntensity: 1.35 },
      MI_Enemies_Large: { metalnessCap: 0.12, roughnessFloor: 0.64, albedoLift: 1.48, envIntensity: 1.35 },
      MI_Guns_Batch1:   { metalnessCap: 0.18, roughnessFloor: 0.60, albedoLift: 1.58, envIntensity: 1.25 },
      MI_Guns_Batch2:   { metalnessCap: 0.16, roughnessFloor: 0.62, albedoLift: 1.42, envIntensity: 1.25 },
      MI_Props_Batch2:  { metalnessCap: 0.28, roughnessFloor: 0.56, albedoLift: 1.20, envIntensity: 1.30 }
    }[def.name] || null;
    const metalnessCap = materialProfile ? materialProfile.metalnessCap : 0.68;
    const roughnessFloor = materialProfile ? materialProfile.roughnessFloor : 0.38;
    const albedoLift = materialProfile ? materialProfile.albedoLift : 1.12;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(base[0], base[1], base[2]),
      opacity: base[3],
      metalness: Math.min(metalnessCap, pbr.metallicFactor === undefined ? 1 : pbr.metallicFactor),
      roughness: Math.max(roughnessFloor, Math.min(0.86, pbr.roughnessFactor === undefined ? 1 : pbr.roughnessFactor)),
      side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    });
    if (window.SKYWARD_ENV) {
      mat.envMap = window.SKYWARD_ENV;
      mat.envMapIntensity = materialProfile ? materialProfile.envIntensity : 1.25;
    }
    mat.color.multiplyScalar(albedoLift);
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
    mat.emissiveMap = textureFor(gltf, def.emissiveTexture, true) || getEmbeddedEmissiveMask(def.name);
    if (mat.emissiveMap && !def.emissiveFactor) {
      if (def.name === 'MI_Props_Batch2') mat.emissive.setRGB(0.34, 1.0, 0.58);
      else if (def.name.indexOf('MI_Guns_') === 0) mat.emissive.setRGB(0.38, 0.78, 1.0);
      else mat.emissive.setRGB(1.0, 1.0, 1.0);
      mat.emissiveIntensity = 0.9;
    }
    if (mat.aoMap) mat.aoMapIntensity = Math.min(mat.aoMapIntensity, 0.72);
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
      { x: 35, z: -5, s: 1.05, r: 0.15, n: 'Prop_Crate' },
      { x: -35, z: -7, s: 0.95, r: -0.25, n: 'Prop_Crate' },
      { x: -8, z: 27, s: 0.92, r: 0.35, n: 'Prop_Crate' },
      { x: 8, z: 27, s: 0.92, r: -0.35, n: 'Prop_Crate' },
      { x: 0, z: 31, s: 0.82, r: 0.2, n: 'Prop_Ammo' }
    ];
    placements.forEach(p => {
      const model = createStatic(p.n);
      if (!model) return;
      model.position.set(p.x, 0.02, p.z);
      model.rotation.y = p.r;
      model.scale.setScalar(p.s);
      model.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.decorative = false;
        o.userData.playerSolid = true;
        o.userData.blocksBullets = true;
      });
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
