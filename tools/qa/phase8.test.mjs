import assert from 'node:assert/strict';
import '../../js/performance.js';

const performance = globalThis.SkywardPerformance;
assert.ok(performance, 'Phase 8 performance module must initialize in Node');

const desktop = performance.getDeviceProfile({
  quality: 'high',
  dpr: 3,
  touchCapable: false,
  width: 1440,
  height: 900,
  deviceMemory: 8,
  hardwareConcurrency: 8
});
assert.equal(desktop.mobile, false);
assert.equal(desktop.constrainedHardware, false);
assert.equal(desktop.maxScale, 1.85);

const mobile = performance.getDeviceProfile({
  quality: 'high',
  dpr: 3,
  touchCapable: true,
  width: 390,
  height: 844,
  deviceMemory: 8,
  hardwareConcurrency: 8
});
assert.equal(mobile.mobile, true);
assert.equal(mobile.maxScale, 1.5);

const constrained = performance.getDeviceProfile({
  quality: 'high',
  dpr: 3,
  touchCapable: true,
  width: 390,
  height: 844,
  deviceMemory: 4,
  hardwareConcurrency: 4
});
assert.equal(constrained.constrainedHardware, true);
assert.equal(constrained.maxScale, 1.1);
assert.ok(constrained.minScale <= constrained.maxScale);

const lowQuality = performance.getDeviceProfile({
  quality: 'low', dpr: 2, touchCapable: false,
  width: 1280, height: 720
});
assert.equal(lowQuality.maxScale, 1);

function runFor(controller, fps, seconds) {
  const frames = Math.ceil(fps * seconds);
  for (let i = 0; i < frames; i++) controller.update(1 / fps);
}

const adaptive = performance.createAdaptiveResolution({
  maxScale: 1.5,
  minScale: 0.9
});
runFor(adaptive, 30, 5);
const afterLowFps = adaptive.snapshot();
assert.ok(afterLowFps.downshifts >= 1, 'Sustained low FPS should reduce render scale');
assert.ok(afterLowFps.scale < 1.5);
assert.ok(afterLowFps.scale >= 0.9);

// A middle-band frame rate should not cause repeated resolution oscillation.
const stable = performance.createAdaptiveResolution({ maxScale: 1.5, minScale: 0.9 });
runFor(stable, 50, 12);
assert.equal(stable.snapshot().downshifts, 0);
assert.equal(stable.snapshot().upshifts, 0);
assert.equal(stable.snapshot().scale, 1.5);

// High FPS must persist before resolution is restored.
runFor(adaptive, 60, 12);
assert.ok(adaptive.snapshot().upshifts >= 1);
assert.ok(adaptive.snapshot().scale <= 1.5);

// Long low-FPS periods clamp at the configured minimum.
const floor = performance.createAdaptiveResolution({ maxScale: 1, minScale: 0.75 });
runFor(floor, 20, 60);
assert.equal(floor.snapshot().scale, 0.75);

// A display/DPR change may lower the cap; the active scale must be clamped immediately.
adaptive.setMaxScale(0.8, 0.7);
assert.equal(adaptive.snapshot().maxScale, 0.8);
assert.ok(adaptive.snapshot().scale <= 0.8);
assert.ok(adaptive.snapshot().scale >= 0.7);

// Invalid deltas must not contaminate the controller.
adaptive.update(NaN);
adaptive.update(-1);
assert.ok(Number.isFinite(adaptive.snapshot().scale));
adaptive.reset();
assert.equal(adaptive.snapshot().scale, 0.8);
assert.equal(adaptive.snapshot().downshifts, 0);
assert.equal(adaptive.snapshot().upshifts, 0);

console.log('Phase 8 tests: PASS (device profile, adaptive thresholds, hysteresis, clamping, reset)');
