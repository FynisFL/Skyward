import assert from 'node:assert/strict';
import '../../js/rng.js';
import '../../js/events.js';
import '../../js/replay.js';

const rng = globalThis.SkywardRNG;
const events = globalThis.SkywardEvents;
const replay = globalThis.SkywardReplay;
assert.ok(rng && events && replay, 'Phase 7 modules must initialize in Node');

function sequence(seed, stream, count) {
  rng.reset(seed);
  return Array.from({ length: count }, () => rng.random(stream));
}
assert.deepEqual(sequence('phase7-seed', 'gameplay', 32), sequence('phase7-seed', 'gameplay', 32));

// Independent streams: cosmetic draws do not move gameplay/AI streams.
rng.reset(987654321);
const gameplayA = Array.from({ length: 20 }, () => rng.random('gameplay'));
const aiA = Array.from({ length: 20 }, () => rng.random('ai'));
rng.reset(987654321);
for (let i = 0; i < 1000; i++) rng.random('vfx');
const gameplayB = Array.from({ length: 20 }, () => rng.random('gameplay'));
const aiB = Array.from({ length: 20 }, () => rng.random('ai'));
assert.deepEqual(gameplayA, gameplayB);
assert.deepEqual(aiA, aiB);

// Snapshot restore and helper determinism.
rng.reset('snapshot-test');
rng.random('weapon');
rng.random('gameplay');
const snapshot = rng.snapshot();
const expected = [rng.random('weapon'), rng.random('gameplay'), rng.random('vfx')];
rng.restore(snapshot);
assert.deepEqual([rng.random('weapon'), rng.random('gameplay'), rng.random('vfx')], expected);
const source = [1, 2, 3, 4, 5];
rng.reset('shuffle-test');
const shuffled = rng.shuffle('gameplay', source);
rng.reset('shuffle-test');
assert.deepEqual(rng.shuffle('gameplay', source), shuffled);
assert.deepEqual(source, [1, 2, 3, 4, 5]);
assert.equal(rng.int('gameplay', 2, 2), 2);

// Event bus on/once/off/wildcard lifecycle.
events.clear('phase7:test');
const seen = [];
const unsubscribe = events.on('phase7:test', (payload) => seen.push(payload.value));
events.once('phase7:test', () => seen.push('once'));
events.on('*', (event) => seen.push(event.type));
events.emit('phase7:test', { value: 1 });
events.emit('phase7:test', { value: 2 });
unsubscribe();
events.emit('phase7:test', { value: 3 });
assert.deepEqual(seen, [1, 'once', 'phase7:test', 2, 'phase7:test', 'phase7:test']);
assert.equal(events.listenerCount('phase7:test'), 0);
events.clear('phase7:test');

// Replay tape: frame deltas, inputs and ordered event trace.
replay.start(424242, { mission: 'test-mission', class: 'test-class' });
events.emit('run:started', { seed: 424242 });
replay.recordInput('key-down', { code: 'KeyW' });
replay.beginFrame(1 / 60);
events.emit('wave:started', { wave: 1 });
replay.endFrame();
replay.beginFrame(1 / 30);
replay.recordInput('look', { dx: 3, dy: -2 });
events.emit('wave:completed', { wave: 1 });
replay.endFrame();
replay.finish({ victory: true });
const tape = replay.getTape();
assert.equal(tape.frames.length, 2);
assert.equal(tape.inputs.length, 2);
assert.equal(tape.events.length, 3);
assert.equal(tape.outcome.victory, true);

replay.load(JSON.stringify(tape));
replay.startPlayback();
events.emit('run:started', { seed: 424242 });
let step = replay.nextFrame();
assert.equal(step.index, 0);
assert.equal(step.dt, 1 / 60);
assert.deepEqual(replay.drainInputsForFrame(0).map((input) => input.action), ['key-down']);
events.emit('wave:started', { wave: 1 });
step = replay.nextFrame();
assert.equal(step.index, 1);
assert.equal(step.dt, 1 / 30);
assert.deepEqual(replay.drainInputsForFrame(1).map((input) => input.action), ['look']);
events.emit('wave:completed', { wave: 1 });
assert.equal(replay.finish(tape.outcome).divergences, 0, 'Expected replay events and final outcome to match');

// Final run outcome mismatches must be detected even when the event tape is empty.
replay.start(99, { mission: 'test-mission', class: 'test-class' });
replay.beginFrame(0.01);
replay.endFrame();
replay.finish({ victory: true, score: 50 });
const mismatchTape = replay.getTape();
replay.load(mismatchTape);
replay.startPlayback();
replay.nextFrame();
assert.equal(replay.finish({ victory: false, score: 0 }).divergences, 1, 'Final outcome mismatch must be reported');

console.log('Phase 7 tests: PASS (RNG, isolation, snapshots, event bus, replay)');
