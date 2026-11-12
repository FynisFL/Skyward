import assert from 'node:assert/strict';
import '../../js/benchmark.js';

const benchmark = globalThis.SkywardBenchmark;
assert.ok(benchmark, 'Phase 9 benchmark module must initialize in Node');

let clock = 1000;
const recorder = benchmark.createRecorder({
  sampleIntervalMs: 1000,
  maxSamples: 10,
  now: () => clock
});

assert.equal(recorder.sample({}, clock), false, 'Sampling must be disabled before start');
const metadata = { scenario: 'combat', device: 'test-device', tags: ['desktop'] };
assert.equal(recorder.start(metadata).active, true);
metadata.device = 'mutated-after-start';
assert.equal(recorder.start({ scenario: 'duplicate' }), false, 'A running capture must not be replaced');

let reads = 0;
clock += 500;
assert.equal(recorder.sample(() => { reads += 1; return {}; }, clock), false, 'Early sample must be ignored');
assert.equal(reads, 0, 'Snapshot provider must not be called before sample interval');

const snapshots = [
  { p50: 10, p95: 16, p99: 20, max: 25, drawCalls: 100, triangles: 2000, geometries: 20, textures: 12, particles: 5, decals: 2, enemies: 3, renderScale: 1.2, adaptiveFps: 60, state: 'playing', mission: 'm1', wave: 1 },
  { p50: 20, p95: 25, p99: 30, max: 35, drawCalls: 120, triangles: 2400, geometries: 22, textures: 13, particles: 8, decals: 3, enemies: 4, renderScale: 1.1, adaptiveFps: 50, state: 'playing', mission: 'm1', wave: 2 },
  { p50: 30, p95: 36, p99: 42, max: 48, drawCalls: 140, triangles: 2800, geometries: 24, textures: 14, particles: 10, decals: 4, enemies: 5, renderScale: 1.0, adaptiveFps: 40, state: 'playing', mission: 'm1', wave: 3 },
  { p50: 40, p95: 48, p99: 55, max: 60, drawCalls: 160, triangles: 3200, geometries: 26, textures: 15, particles: 12, decals: 5, enemies: 6, renderScale: 0.9, adaptiveFps: 30, state: 'playing', mission: 'm1', wave: 4 }
];

for (const snapshot of snapshots) {
  clock += 1000;
  assert.equal(recorder.sample(() => snapshot, clock), true);
}
const report = recorder.stop('manual');
assert.equal(report.schemaVersion, 1);
assert.equal(report.sampleCount, 4);
assert.equal(report.stopReason, 'manual');
assert.equal(report.metadata.device, 'test-device', 'Metadata must be snapshotted at start');
assert.equal(report.summary.p50Ms.min, 10);
assert.equal(report.summary.p50Ms.avg, 25);
assert.equal(report.summary.p50Ms.p50, 20);
assert.equal(report.summary.p50Ms.p95, 40);
assert.equal(report.summary.drawCalls.max, 160);
assert.equal(report.summary.fps.min, 25);
assert.equal(report.samples[3].wave, 4);
assert.equal(recorder.sample({}, clock + 1000), false, 'Stopped capture must ignore new samples');
assert.equal(recorder.stop('second-stop').stopReason, 'manual', 'Stop must be idempotent');

const exported = JSON.parse(recorder.exportJSON());
assert.equal(exported.sampleCount, 4);
assert.equal(exported.metadata.scenario, 'combat');

recorder.reset();
assert.equal(recorder.status().sampleCount, 0);
assert.equal(recorder.report(), null);

const capped = benchmark.createRecorder({
  sampleIntervalMs: 100,
  maxSamples: 2,
  now: () => clock
});
capped.start({ scenario: 'sample-cap' });
clock += 100;
assert.equal(capped.sample({ p50: 0, state: 'menu' }, clock), true);
clock += 100;
assert.equal(capped.sample({ p50: 0, state: 'menu' }, clock), true);
assert.equal(capped.status().active, false, 'Recorder must stop at the sample safety cap');
assert.equal(capped.report().truncated, true);
assert.equal(capped.report().stopReason, 'sample-limit');

const invalid = benchmark.createRecorder({ now: () => clock });
invalid.start({ scenario: 'invalid-data' });
clock += 1000;
assert.equal(invalid.sample({ p50: 'not-a-number', drawCalls: NaN, state: 'menu' }, clock), true);
assert.equal(invalid.report().summary.p50Ms, undefined, 'Invalid numeric samples must be excluded from summaries');

console.log('Phase 9 tests: PASS (capture lifecycle, interval gating, aggregation, export, safety cap, invalid metrics)');
