(function (root) {
  'use strict';

  const METRICS = [
    'fps', 'p50Ms', 'p95Ms', 'p99Ms', 'frameMaxMs',
    'drawCalls', 'triangles', 'geometries', 'textures',
    'particles', 'decals', 'enemies', 'renderScale', 'adaptiveFps'
  ];

  function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function rounded(value) {
    return Math.round(value * 1000) / 1000;
  }

  function safeClone(value, fallback) {
    try {
      const json = JSON.stringify(value === undefined ? fallback : value);
      if (!json || json.length > 20000) return fallback;
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function percentile(values, ratio) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
    return sorted[index];
  }

  function summarize(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    return {
      min: rounded(sorted[0]),
      avg: rounded(total / sorted.length),
      p50: rounded(percentile(sorted, 0.50)),
      p95: rounded(percentile(sorted, 0.95)),
      max: rounded(sorted[sorted.length - 1])
    };
  }

  function createRecorder(options) {
    const opts = options || {};
    const sampleIntervalMs = Math.min(60000, Math.max(100, finiteOrNull(opts.sampleIntervalMs) || 1000));
    const maxSamples = Math.min(3600, Math.max(1, Math.floor(finiteOrNull(opts.maxSamples) || 1800)));
    const now = typeof opts.now === 'function' ? opts.now : function () { return Date.now(); };

    let active = false;
    let startedAtMs = null;
    let endedAtMs = null;
    let lastSampleAtMs = null;
    let metadata = {};
    let samples = [];
    let stopReason = null;
    let truncated = false;
    let lastReport = null;

    function readNow() {
      const value = finiteOrNull(now());
      return value === null ? Date.now() : value;
    }

    function projectSnapshot(snapshot, timestamp) {
      const source = snapshot || {};
      const p50 = finiteOrNull(source.p50);
      const row = {
        tMs: rounded(Math.max(0, timestamp - startedAtMs)),
        state: typeof source.state === 'string' ? source.state : 'unknown',
        mission: typeof source.mission === 'string' ? source.mission : 'unknown',
        wave: finiteOrNull(source.wave)
      };
      row.fps = p50 !== null && p50 > 0 ? rounded(1000 / p50) : null;
      row.p50Ms = p50;
      row.p95Ms = finiteOrNull(source.p95);
      row.p99Ms = finiteOrNull(source.p99);
      row.frameMaxMs = finiteOrNull(source.max);
      row.drawCalls = finiteOrNull(source.drawCalls);
      row.triangles = finiteOrNull(source.triangles);
      row.geometries = finiteOrNull(source.geometries);
      row.textures = finiteOrNull(source.textures);
      row.particles = finiteOrNull(source.particles);
      row.decals = finiteOrNull(source.decals);
      row.enemies = finiteOrNull(source.enemies);
      row.renderScale = finiteOrNull(source.renderScale);
      row.adaptiveFps = finiteOrNull(source.adaptiveFps);
      return row;
    }

    function buildReport(endedAt, reason) {
      const metricSummary = {};
      METRICS.forEach(function (key) {
        const values = samples
          .map(function (sample) { return sample[key]; })
          .filter(function (value) { return typeof value === 'number' && Number.isFinite(value); });
        const summary = summarize(values);
        if (summary) metricSummary[key] = summary;
      });

      return {
        schemaVersion: 1,
        startedAt: startedAtMs === null ? null : new Date(startedAtMs).toISOString(),
        endedAt: endedAt === null ? null : new Date(endedAt).toISOString(),
        durationMs: startedAtMs === null || endedAt === null ? 0 : Math.max(0, rounded(endedAt - startedAtMs)),
        sampleIntervalMs: sampleIntervalMs,
        sampleCount: samples.length,
        stopReason: reason || null,
        truncated: truncated,
        metadata: safeClone(metadata, {}),
        summary: metricSummary,
        samples: samples.map(function (sample) { return Object.assign({}, sample); })
      };
    }

    function start(nextMetadata) {
      if (active) return false;
      const timestamp = readNow();
      active = true;
      startedAtMs = timestamp;
      endedAtMs = null;
      lastSampleAtMs = timestamp;
      metadata = safeClone(nextMetadata, {});
      samples = [];
      stopReason = null;
      truncated = false;
      lastReport = null;
      return status();
    }

    function sample(snapshotOrReader, timestampValue) {
      if (!active) return false;
      const timestamp = timestampValue === undefined ? readNow() : finiteOrNull(timestampValue);
      if (timestamp === null || timestamp < lastSampleAtMs ||
          timestamp - lastSampleAtMs < sampleIntervalMs) return false;

      let snapshot = snapshotOrReader;
      if (typeof snapshotOrReader === 'function') {
        try {
          snapshot = snapshotOrReader();
        } catch (error) {
          return false;
        }
      }
      if (!snapshot || typeof snapshot !== 'object') return false;

      samples.push(projectSnapshot(snapshot, timestamp));
      lastSampleAtMs = timestamp;
      if (samples.length >= maxSamples) {
        truncated = true;
        active = false;
        endedAtMs = timestamp;
        stopReason = 'sample-limit';
        lastReport = buildReport(endedAtMs, stopReason);
      }
      return true;
    }

    function stop(reason) {
      if (!active) return report();
      active = false;
      endedAtMs = readNow();
      stopReason = typeof reason === 'string' && reason ? reason : 'manual';
      lastReport = buildReport(endedAtMs, stopReason);
      return report();
    }

    function status() {
      const timestamp = active ? readNow() : endedAtMs;
      return {
        active: active,
        sampleCount: samples.length,
        sampleIntervalMs: sampleIntervalMs,
        durationMs: startedAtMs === null || timestamp === null
          ? 0
          : Math.max(0, rounded(timestamp - startedAtMs)),
        scenario: typeof metadata.scenario === 'string' ? metadata.scenario : null,
        truncated: truncated,
        stopReason: stopReason
      };
    }

    function report() {
      if (lastReport) return safeClone(lastReport, null);
      if (!startedAtMs) return null;
      return safeClone(buildReport(active ? readNow() : endedAtMs, active ? 'in-progress' : stopReason), null);
    }

    function exportJSON() {
      const value = report();
      return value ? JSON.stringify(value, null, 2) : '';
    }

    function reset() {
      active = false;
      startedAtMs = null;
      endedAtMs = null;
      lastSampleAtMs = null;
      metadata = {};
      samples = [];
      stopReason = null;
      truncated = false;
      lastReport = null;
      return status();
    }

    return Object.freeze({
      start: start,
      sample: sample,
      stop: stop,
      status: status,
      report: report,
      exportJSON: exportJSON,
      reset: reset
    });
  }

  root.SkywardBenchmark = Object.freeze({ createRecorder: createRecorder });
})(typeof window !== 'undefined' ? window : globalThis);
