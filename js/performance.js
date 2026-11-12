(function (root) {
  'use strict';

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundScale(value) {
    return Math.round(value * 1000) / 1000;
  }

  function getDeviceProfile(options) {
    const opts = options || {};
    const quality = ['low', 'med', 'high'].indexOf(opts.quality) >= 0 ? opts.quality : 'med';
    const width = Math.max(1, finite(opts.width, 1280));
    const height = Math.max(1, finite(opts.height, 720));
    const dpr = clamp(finite(opts.dpr, 1), 0.5, 4);
    const memory = Math.max(0, finite(opts.deviceMemory, 0));
    const cores = Math.max(0, finite(opts.hardwareConcurrency, 0));
    const mobile = !!opts.touchCapable && Math.min(width, height) < 1100;

    const qualityScale = quality === 'low'
      ? 1
      : quality === 'high'
        ? (mobile ? 1.5 : 1.85)
        : (mobile ? 1.2 : 1.5);

    const constrainedHardware =
      (memory > 0 && memory <= 4) ||
      (cores > 0 && cores <= 4);

    const hardwareScale = constrainedHardware
      ? Math.min(qualityScale, 1.1)
      : qualityScale;

    const maxScale = roundScale(Math.min(dpr, hardwareScale));
    const minScale = roundScale(Math.min(maxScale, Math.max(0.65, maxScale * 0.65)));

    return {
      quality: quality,
      mobile: mobile,
      constrainedHardware: constrainedHardware,
      deviceMemory: memory || null,
      hardwareConcurrency: cores || null,
      devicePixelRatio: dpr,
      maxScale: maxScale,
      minScale: minScale
    };
  }

  function createAdaptiveResolution(options) {
    const opts = options || {};
    let maxScale = clamp(finite(opts.maxScale, 1), 0.5, 4);
    let minScale = clamp(finite(opts.minScale, Math.max(0.65, maxScale * 0.65)), 0.5, maxScale);
    let scale = maxScale;

    const sampleWindow = Math.max(0.5, finite(opts.sampleWindow, 2));
    const lowFpsThreshold = Math.max(1, finite(opts.lowFpsThreshold, 42));
    const highFpsThreshold = Math.max(lowFpsThreshold + 1, finite(opts.highFpsThreshold, 57));
    const downshiftAfter = Math.max(sampleWindow, finite(opts.downshiftAfter, 4));
    const upshiftAfter = Math.max(sampleWindow, finite(opts.upshiftAfter, 10));
    const downStep = Math.max(0.01, finite(opts.downStep, 0.1));
    const upStep = Math.max(0.01, finite(opts.upStep, 0.05));

    let sampleElapsed = 0;
    let sampleFrames = 0;
    let lowFpsElapsed = 0;
    let highFpsElapsed = 0;
    let lastFps = 0;
    let downshifts = 0;
    let upshifts = 0;

    function snapshot() {
      return {
        scale: roundScale(scale),
        maxScale: roundScale(maxScale),
        minScale: roundScale(minScale),
        lastFps: roundScale(lastFps),
        downshifts: downshifts,
        upshifts: upshifts,
        sampleElapsed: roundScale(sampleElapsed)
      };
    }

    function setMaxScale(value, nextMinScale) {
      const nextMax = clamp(finite(value, maxScale), 0.5, 4);
      maxScale = nextMax;
      minScale = clamp(
        finite(nextMinScale, Math.max(0.65, maxScale * 0.65)),
        0.5,
        maxScale
      );
      scale = Math.min(scale, maxScale);
      if (scale < minScale) scale = minScale;
      lowFpsElapsed = 0;
      highFpsElapsed = 0;
      sampleElapsed = 0;
      sampleFrames = 0;
      return snapshot();
    }

    function update(frameDelta) {
      const delta = clamp(finite(frameDelta, 0), 0, 0.25);
      if (delta <= 0) return snapshot();

      sampleElapsed += delta;
      sampleFrames += 1;
      if (sampleElapsed < sampleWindow) return snapshot();

      lastFps = sampleFrames / sampleElapsed;
      if (lastFps < lowFpsThreshold) {
        lowFpsElapsed += sampleElapsed;
        highFpsElapsed = 0;
      } else if (lastFps > highFpsThreshold) {
        highFpsElapsed += sampleElapsed;
        lowFpsElapsed = 0;
      } else {
        lowFpsElapsed = Math.max(0, lowFpsElapsed - sampleElapsed * 0.5);
        highFpsElapsed = 0;
      }

      if (lowFpsElapsed >= downshiftAfter && scale > minScale + 0.0001) {
        scale = roundScale(Math.max(minScale, scale - downStep));
        downshifts += 1;
        lowFpsElapsed = 0;
        highFpsElapsed = 0;
      } else if (highFpsElapsed >= upshiftAfter && scale < maxScale - 0.0001) {
        scale = roundScale(Math.min(maxScale, scale + upStep));
        upshifts += 1;
        lowFpsElapsed = 0;
        highFpsElapsed = 0;
      }

      sampleElapsed = 0;
      sampleFrames = 0;
      return snapshot();
    }

    function reset() {
      scale = maxScale;
      sampleElapsed = 0;
      sampleFrames = 0;
      lowFpsElapsed = 0;
      highFpsElapsed = 0;
      lastFps = 0;
      downshifts = 0;
      upshifts = 0;
      return snapshot();
    }

    return {
      update: update,
      snapshot: snapshot,
      setMaxScale: setMaxScale,
      reset: reset
    };
  }

  root.SkywardPerformance = Object.freeze({
    getDeviceProfile: getDeviceProfile,
    createAdaptiveResolution: createAdaptiveResolution
  });
})(typeof window !== 'undefined' ? window : globalThis);
