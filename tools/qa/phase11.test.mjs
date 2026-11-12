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
assert.equal(ai.isInChargeWindow(15.5, speeder), true);
assert.equal(ai.isInChargeWindow(15.6, speeder), false);

// Brute ground slam resolves against the position locked at telegraph start.
assert.equal(ai.isInsideRadialAttack(0, 0, 3, 0, 3.55), true);
assert.equal(ai.isInsideRadialAttack(0, 0, 3.56, 0, 3.55), false);
assert.equal(ai.isInsideRadialAttack(0, 0, 0, 0, 0), true);
assert.equal(ai.isInsideRadialAttack(0, 0, 0, 0, 3.55, 0, 2.2, 1.75), false);
assert.equal(ai.isInsideRadialAttack(0, 0, 3, 0, 3.55, 0, 1.6, 1.75), true);
assert.equal(ai.isInsideRadialAttack(0, 0, NaN, 0, 3), false);

// Focus fire during a tell can interrupt an attack, while damage below threshold accumulates.
assert.deepEqual(ai.addStagger(0, 15, 25), { value: 15, interrupted: false });
assert.deepEqual(ai.addStagger(15, 10, 25), { value: 0, interrupted: true });
assert.deepEqual(ai.addStagger(10, 60, 48), { value: 0, interrupted: true });

// Commander phase thresholds and fan patterns expand in readable steps.
assert.equal(ai.getCommanderPhase(800, 980), 1);
assert.equal(ai.getCommanderPhase(637, 980), 2);
assert.equal(ai.getCommanderPhase(294, 980), 3);
assert.equal(ai.getCommanderPhase(0, 980), 3);
assert.deepEqual(ai.getCommanderVolleyOffsets(1), [0]);
assert.deepEqual(ai.getCommanderVolleyOffsets(2), [-0.13, 0, 0.13]);
assert.deepEqual(ai.getCommanderVolleyOffsets(3), [-0.4, -0.2, 0, 0.2, 0.4]);

console.log('Phase 11 tests: PASS (enemy roles, movement intent, charge window, slam counterplay, stagger interrupts, Commander phases and volleys)');
