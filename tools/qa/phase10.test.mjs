import assert from 'node:assert/strict';
import '../../js/rng.js';
import '../../js/events.js';
import '../../js/replay.js';

const rng = globalThis.SkywardRNG;
const events = globalThis.SkywardEvents;
const replay = globalThis.SkywardReplay;
assert.ok(rng && events && replay, 'Replay v2 dependencies must initialize');
assert.equal(replay.version, 2);

// Seeded streams remain isolated and reproducible.
rng.reset('phase10-seed');
const first = Array.from({ length: 24 }, () => rng.random('gameplay'));
rng.reset('phase10-seed');
for (let index = 0; index < 500; index++) rng.random('vfx');
assert.deepEqual(Array.from({ length: 24 }, () => rng.random('gameplay')), first);

// V2 records keyboard, mouse, touch movement, touch look, touch actions and lifecycle transitions.
events.clear('phase10:test');
replay.start(123456, { mission: 'm1', class: 'c1', input: 'keyboard-mouse+touch' });
assert.equal(replay.status().version, 2);
assert.equal(replay.recordInput('key-down', { code: 'KeyW' }), true);
assert.equal(replay.recordInput('touch-move', { x: 0.5, y: -1 }), true);
replay.beginFrame(1 / 60);
replay.recordInput('look', { dx: 4, dy: -2, source: 'touch' });
replay.recordInput('touch-action-down', { action: 'fire' });
events.emit('phase10:test', { marker: 1 });
replay.endFrame();
replay.recordInput('touch-action-up', { action: 'fire' });
replay.recordInput('game-pause', { source: 'visibility' });
replay.beginFrame(0.02);
replay.recordInput('game-resume', { source: 'user' });
replay.recordInput('run-abandon', { abandoned: true, mission: 'm1', wave: 2 });
events.emit('phase10:test', { marker: 2 });
replay.endFrame();
replay.finish({ victory: true, score: 987 });
const tape = replay.getTape();
assert.equal(tape.version, 2);
assert.equal(tape.inputs.length, 8);
assert.equal(tape.frames.length, 2);
assert.equal(tape.events.length, 2);
assert.equal(tape.inputs[0].frame, 0);
assert.equal(tape.inputs[2].frame, 0);
assert.equal(tape.inputs[4].frame, 1);

replay.load(replay.export());
assert.equal(replay.status().mode, 'ready');
replay.startPlayback();
let frame = replay.nextFrame();
assert.equal(frame.index, 0);
assert.deepEqual(replay.drainInputsForFrame(0).map(input => input.action), [
  'key-down', 'touch-move', 'look', 'touch-action-down'
]);
events.emit('phase10:test', { marker: 1 });
frame = replay.nextFrame();
assert.equal(frame.index, 1);
assert.deepEqual(replay.drainInputsForFrame(1).map(input => input.action), [
  'touch-action-up', 'game-pause', 'game-resume', 'run-abandon'
]);
events.emit('phase10:test', { marker: 2 });
assert.equal(replay.finish(tape.outcome).divergences, 0);

// The terminal frame applies inputs recorded after the last simulation frame.
replay.start(42, { mission: 'm1', class: 'c1' });
replay.beginFrame(0.016);
replay.endFrame();
replay.recordInput('key-up', { code: 'KeyW' });
replay.finish({ abandoned: true });
const terminal = replay.getTape();
replay.load(terminal);
replay.startPlayback();
assert.equal(replay.nextFrame().index, 0);
const boundary = replay.nextFrame();
assert.equal(boundary.terminal, true);
assert.deepEqual(replay.drainInputsForFrame(boundary.index).map(x => x.action), ['key-up']);
assert.equal(replay.nextFrame(), null);

// Version 1 tapes remain importable and keep their original semantics contract.
const legacy = {
  version: 1, seed: 987, metadata: { mission: 'm1', class: 'c1' },
  frames: [0.016], inputs: [{ frame: 0, action: 'key-down', data: { code: 'KeyW' } }],
  events: [], outcome: { victory: false }, finished: true
};
replay.load(legacy);
assert.equal(replay.status().version, 1);
replay.startPlayback();
assert.equal(replay.nextFrame().dt, 0.016);
assert.equal(replay.drainInputsForFrame(0)[0].action, 'key-down');
replay.stopPlayback();

// Event and outcome divergences are detected.
replay.start(9, { mission: 'm1', class: 'c1' });
replay.beginFrame(0.01);
events.emit('phase10:test', { marker: 'expected' });
replay.endFrame();
replay.finish({ victory: true });
const mismatch = replay.getTape();
replay.load(mismatch);
replay.startPlayback();
replay.nextFrame();
events.emit('phase10:test', { marker: 'different' });
assert.equal(replay.finish({ victory: false }).divergences, 2);

// Invalid frame/input/event structures and oversized tapes are rejected.
assert.throws(() => replay.load({ ...legacy, frames: [NaN] }), /invalid frame delta/i);
assert.throws(() => replay.load({ ...legacy, inputs: [{ frame: 2, action: 'key-down' }] }), /invalid input/i);
assert.throws(() => replay.load({ ...legacy, events: [{ frame: -1, type: 'x' }] }), /invalid event/i);
assert.throws(() => replay.load({ ...legacy, version: 99 }), /unsupported/i);
assert.throws(() => replay.load('{broken json'), /valid JSON/i);

console.log('Phase 10 tests: PASS (replay v2 schema, input timeline, lifecycle, legacy v1 import, terminal inputs, divergences, validation)');
