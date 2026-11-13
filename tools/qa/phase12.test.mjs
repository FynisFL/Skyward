import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import '../../js/combat_ai.js';

const require = createRequire(import.meta.url);
const THREE = require('../../vendor/three.min.js');
const ai = globalThis.SkywardCombatAI;
assert.ok(ai, 'Combat AI proxy helper must be available');

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const playerSource = read('../../js/player.js');
const playerContext = {
  THREE: {
    MathUtils: {
      clamp: (value, min, max) => Math.max(min, Math.min(max, value))
    }
  }
};
vm.runInNewContext(playerSource + '\nthis.Player = Player;', playerContext);
const PlayerClass = playerContext.Player;

function makePlayer() {
  const player = Object.create(PlayerClass.prototype);
  player.yaw = { rotation: { y: 0 } };
  player.pitch = { rotation: { x: 0 } };
  player.sensitivity = 1;
  player.invertY = false;
  return player;
}

// Camera input rejects malformed deltas without poisoning either axis.
{
  const player = makePlayer();
  player.look(NaN, Infinity);
  assert.equal(player.yaw.rotation.y, 0);
  assert.equal(player.pitch.rotation.x, 0);
  player.look(-Infinity, NaN);
  assert.equal(player.yaw.rotation.y, 0);
  assert.equal(player.pitch.rotation.x, 0);
}

// Sensitivity is clamped to the supported range, and invalid settings fall back to 1.
{
  const high = makePlayer();
  high.sensitivity = 50;
  high.look(10, 0);
  assert.ok(Math.abs(high.yaw.rotation.y + 0.11) < 1e-12);

  const low = makePlayer();
  low.sensitivity = 0.001;
  low.look(10, 0);
  assert.ok(Math.abs(low.yaw.rotation.y + 0.0022) < 1e-12);

  const invalid = makePlayer();
  invalid.sensitivity = Infinity;
  invalid.look(10, 0);
  assert.ok(Math.abs(invalid.yaw.rotation.y + 0.022) < 1e-12);
}

// Normal and inverted Y input keep their established direction.
{
  const normal = makePlayer();
  normal.look(0, 20);
  assert.ok(normal.pitch.rotation.x < 0);

  const inverted = makePlayer();
  inverted.invertY = true;
  inverted.look(0, 20);
  assert.ok(inverted.pitch.rotation.x > 0);
}

// The camera can look almost vertically up/down but never crosses the singularity.
{
  const player = makePlayer();
  const limit = Math.PI * 0.5 - 0.01;
  player.look(0, -10000);
  assert.ok(Math.abs(player.pitch.rotation.x - limit) < 1e-12);
  player.look(0, 10000);
  assert.ok(Math.abs(player.pitch.rotation.x + limit) < 1e-12);
}

// The hitscan proxy is evaluated per enemy; a farther real mesh hit does not
// suppress the proxy for a nearer enemy whose animated mesh was missed.
{
  const nearEnemy = { alive: true, spawnT: 0, radius: 1, group: { position: { x: 0, y: 0, z: -5 } } };
  const farEnemy = { alive: true, spawnT: 0, radius: 1, group: { position: { x: 0, y: 0, z: -10 } } };
  const farMeshHit = { object: { userData: { enemy: farEnemy } } };
  const ray = {
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: -1 }
  };
  const candidates = ai.getEnemyProxyCandidates([nearEnemy, farEnemy], [farMeshHit], ray, 140);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].enemy, nearEnemy);
  assert.ok(candidates[0].distance > 0 && candidates[0].distance < 5);

  // Real mesh hits remain authoritative for that enemy.
  const bothMeshHits = ai.getEnemyProxyCandidates(
    [nearEnemy, farEnemy],
    [
      { object: { userData: { enemy: nearEnemy } } },
      farMeshHit
    ],
    ray,
    140
  );
  assert.deepEqual(bothMeshHits, []);

  // Dead, spawning, and out-of-range enemies cannot create fallback hits.
  const dead = { alive: false, spawnT: 0, radius: 1, group: { position: { x: 0, y: 0, z: -4 } } };
  const spawning = { alive: true, spawnT: 0.5, radius: 1, group: { position: { x: 0, y: 0, z: -4 } } };
  assert.deepEqual(ai.getEnemyProxyCandidates([dead, spawning], [], ray, 140), []);
  assert.deepEqual(ai.getEnemyProxyCandidates([nearEnemy], [], ray, 3), []);
}

// Load the real glTF loader with a minimal browser shell and test its exported
// asset validator against actual Three.js geometry and world-space bounds.
{
  const windowStub = { SKYWARD_GLTF_PACK: {} };
  const loaderContext = {
    window: windowStub,
    THREE,
    atob,
    console: { warn() {}, error() {} }
  };
  vm.runInNewContext(read('../../js/scifi_loader.js'), loaderContext);
  const validate = windowStub.SkywardAssetFactory.validateEnemyInstance;
  assert.equal(typeof validate, 'function', 'Enemy asset validator must be exposed to QA');

  assert.deepEqual(
    { valid: validate(null, 2).valid, reason: validate(null, 2).reason },
    { valid: false, reason: 'missing-root' }
  );

  const emptyRoot = new THREE.Group();
  assert.equal(validate(emptyRoot, 2).reason, 'missing-mesh');

  const missingPositionRoot = new THREE.Group();
  missingPositionRoot.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
  assert.equal(validate(missingPositionRoot, 2).reason, 'invalid-geometry');

  const shortGeometry = new THREE.BufferGeometry();
  shortGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0]), 3));
  const shortRoot = new THREE.Group();
  shortRoot.add(new THREE.Mesh(shortGeometry, new THREE.MeshBasicMaterial()));
  assert.equal(validate(shortRoot, 2).reason, 'invalid-geometry');

  const flatGeometry = new THREE.BufferGeometry();
  flatGeometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3
  ));
  const flatRoot = new THREE.Group();
  flatRoot.add(new THREE.Mesh(flatGeometry, new THREE.MeshBasicMaterial()));
  assert.equal(validate(flatRoot, 2).reason, 'invalid-bounds');

  const nonFiniteGeometry = new THREE.BufferGeometry();
  nonFiniteGeometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([NaN, 0, 0, NaN, 1, 0, NaN, 0, 1]), 3
  ));
  const nonFiniteRoot = new THREE.Group();
  nonFiniteRoot.add(new THREE.Mesh(nonFiniteGeometry, new THREE.MeshBasicMaterial()));
  assert.equal(validate(nonFiniteRoot, 2).valid, false);

  const validRoot = new THREE.Group();
  const validMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshBasicMaterial());
  validMesh.position.set(4, 2, -3);
  validRoot.add(validMesh);
  const valid = validate(validRoot, 2);
  assert.equal(valid.valid, true);
  assert.ok(Math.abs(valid.scale - 0.5) < 1e-12);
  assert.ok(Math.abs(valid.center.x - 4) < 1e-12);
  assert.ok(Math.abs(valid.center.y - 2) < 1e-12);
  assert.ok(Math.abs(valid.center.z + 3) < 1e-12);

  const defaultHeight = validate(validRoot, Infinity);
  assert.equal(defaultHeight.valid, true);
  assert.ok(Math.abs(defaultHeight.scale - 0.5) < 1e-12);
}

// Runtime mirrors and world-geometry obstruction ordering must remain intact.
{
  const weapons = read('../../js/weapons.js');
  const androidWeapons = read('../../app/src/main/assets/game/js/weapons.js');
  const player = read('../../js/player.js');
  const androidPlayer = read('../../app/src/main/assets/game/js/player.js');
  const loader = read('../../js/scifi_loader.js');
  const androidLoader = read('../../app/src/main/assets/game/js/scifi_loader.js');
  assert.equal(weapons, androidWeapons, 'Web/Android weapons mirror mismatch');
  assert.equal(player, androidPlayer, 'Web/Android player mirror mismatch');
  assert.equal(loader, androidLoader, 'Web/Android loader mirror mismatch');
  assert.ok(weapons.includes('getEnemyProxyCandidates'));
  assert.ok(weapons.includes('eh.distance < wh.distance'), 'World geometry must block hitscan proxies');
  assert.ok(loader.includes('o.frustumCulled = false'));
}

console.log('Phase 12 tests: PASS (camera input/pitch, per-enemy hitscan proxies, glTF mesh/bounds validation, Web/Android parity)');
