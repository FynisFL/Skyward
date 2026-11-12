import assert from 'node:assert/strict';
import '../../js/combat_ai.js';

const ai = globalThis.SkywardCombatAI;
assert.ok(ai, 'Combat AI profile module should load');
assert.equal(ai.version, 1);

// Enemy roles must demand different movement and attack decisions.
assert.equal(ai.getProfile('drone').role, 'ranged-support');
assert.equal(ai.getProfile('speeder').role, 'flanker');
assert.equal(ai.getProfile('brute').role, 'frontline-disruptor');
assert.equal(ai.getProfile('boss').role, 'commander');
assert.equal(ai.getMovementIntent('drone', 24), 'advance');
assert.equal(ai.getMovementIntent('drone', 7), 'retreat');
assert.equal(ai.getMovementIntent('drone', 17), 'orbit');
assert.equal(ai.getMovementIntent('speeder', 10), 'flank');
assert.equal(ai.getMovementIntent('brute', 12), 'advance');
assert.equal(ai.getMovementIntent('brute', 4), 'hold-frontline');

// Speeder charge has a bounded, dodgeable engagement window.
const speeder = ai.getProfile('speeder');
assert.equal(ai.isInChargeWindow(5.4, speeder), false);
assert.equal(ai.isInChargeWindow(5.5, speeder), true);
assert.equal(ai.isInChargeWindow(13.4, speeder), true);
assert.equal(ai.isInChargeWindow(13.5, speeder), false);
assert.equal(ai.isWithinVerticalTolerance(0, 1.5, speeder.chargeHeightTolerance), true);
assert.equal(ai.isWithinVerticalTolerance(0, 1.76, speeder.chargeHeightTolerance), false);

// Brute ground slam resolves against the position locked at telegraph start.
assert.equal(ai.isInsideRadialAttack(0, 0, 3, 0, 3.55), true);
assert.equal(ai.isInsideRadialAttack(0, 0, 3.56, 0, 3.55), false);
assert.equal(ai.isInsideRadialAttack(0, 0, 0, 0, 0), true);
assert.equal(ai.isInsideRadialAttack(0, 0, 0, 0, 3.55, 0, 2.2, 1.75), false);
assert.equal(ai.isInsideRadialAttack(0, 0, 3, 0, 3.55, 0, 1.6, 1.75), true);
assert.equal(ai.isInsideRadialAttack(0, 0, NaN, 0, 3), false);

// Ray-sphere fallback keeps enemies targetable when animated mesh bounds miss.
assert.equal(ai.raySphereDistance(0, 0, 0, 0, 0, -1, 0, 0, -10, 1, 140), 9);
assert.equal(ai.raySphereDistance(0, 0, 0, 0, 0, -1, 3, 0, -10, 1, 140), null);
assert.equal(ai.raySphereDistance(0, 0, 0, 0, 0, -1, 0, 0, 10, 1, 140), null);
assert.equal(ai.raySphereDistance(0, 0, 0, 0, 0, -1, 0, 0, -10, 1, 8), null);
assert.equal(ai.raySphereDistance(0, 0, 0, 0, 0, -1, 0, 0, -10, 1, 10), 9);
assert.equal(ai.raySphereDistance(0, 0, 0, 0, 0, 0, 0, 0, -10, 1, 140), null);
assert.equal(ai.raySphereDistance(NaN, 0, 0, 0, 0, -1, 0, 0, -10, 1, 140), null);

// Per-enemy hit proxies must still test a near enemy when a farther enemy has a real mesh hit.
const nearEnemy = { alive: true, spawnT: 0, radius: 1, group: { position: { x: 0, y: 0, z: -5 } } };
const farEnemy = { alive: true, spawnT: 0, radius: 1, group: { position: { x: 0, y: 0, z: -10 } } };
const farMeshHit = { object: { userData: { enemy: farEnemy } } };
const proxies = ai.getEnemyProxyCandidates(
  [nearEnemy, farEnemy],
  [farMeshHit],
  { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
  140
);
assert.equal(proxies.length, 1);
assert.equal(proxies[0].enemy, nearEnemy);
assert.ok(proxies[0].distance < 5);
assert.deepEqual(ai.getEnemyProxyCandidates(
  [nearEnemy, farEnemy],
  [{ object: { userData: { enemy: nearEnemy } } }, farMeshHit],
  { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
  140
), []);
// Focus fire during a tell can interrupt an attack, while damage below threshold accumulates.
assert.deepEqual(ai.addStagger(0, 15, 25), { value: 15, interrupted: false });
assert.deepEqual(ai.addStagger(15, 10, 25), { value: 0, interrupted: true });
assert.deepEqual(ai.addStagger(10, 60, 48), { value: 0, interrupted: true });

// Commander phase thresholds and fan patterns expand in readable steps.
assert.equal(ai.getCommanderPhase(800, 980), 1);
assert.equal(ai.getCommanderPhase(637, 980), 2);
assert.equal(ai.getCommanderPhase(294, 980), 3);
assert.equal(ai.getCommanderPhase(0, 980), 3);
assert.deepEqual(ai.getCommanderTuning(1), { phase: 1, moveSpeed: 1.9, fireRate: 1.2, coreScale: 1, volleyCount: 1 });
assert.deepEqual(ai.getCommanderTuning(2), { phase: 2, moveSpeed: 2.3, fireRate: 0.94, coreScale: 1.25, volleyCount: 3 });
assert.deepEqual(ai.getCommanderTuning(3), { phase: 3, moveSpeed: 2.8, fireRate: 0.76, coreScale: 1.5, volleyCount: 5 });
assert.deepEqual(ai.getCommanderVolleyOffsets(1), [0]);
assert.deepEqual(ai.getCommanderVolleyOffsets(2), [-0.13, 0, 0.13]);
assert.deepEqual(ai.getCommanderVolleyOffsets(3), [-0.4, -0.2, 0, 0.2, 0.4]);

console.log('Phase 11 tests: PASS (enemy roles, movement intent, charge window, slam counterplay, stagger interrupts, Commander phases and volleys)');
