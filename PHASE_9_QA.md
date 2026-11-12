# Phase 9 — Runtime Validation & Performance Benchmark

## Scope

Phase 9 adds a repeatable runtime benchmark recorder and strengthens repository-level checks for browser lifecycle, WebGL handling, and Web/Android parity. It does not claim that an automated source test is equivalent to a real browser playthrough or physical-device test.

Architecture remains Three.js r128, classic scripts, local assets, no bundler, no CDN, and byte-identical Web/Android game runtime files.

## Automated checks

Run from the repository root with Node.js 20+:

```bash
node tools/qa/phase7.test.mjs
node tools/qa/phase8.test.mjs
node tools/qa/phase9.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Phase 9 tests cover benchmark capture start/stop, sampling interval enforcement, aggregation, JSON export, sample safety cap, invalid metric handling, and reset behavior. The repository validator checks that the benchmark script is loaded before the game entry point, its Android mirror is byte-identical, and the runtime exposes the expected lifecycle and benchmark hooks.

## Runtime benchmark console API

The recorder is available after the game initializes:

```js
window.__SKYWARD__.benchmark.start({
  scenario: 'menu-idle',
  trial: 1,
  notes: 'Low preset, desktop Chrome'
});
```

Leave the selected scenario running for at least 30 seconds, then stop and export:

```js
const report = window.__SKYWARD__.benchmark.stop('manual');
copy(JSON.stringify(report, null, 2));
```

Or export the JSON string directly:

```js
copy(window.__SKYWARD__.benchmark.export());
```

The recorder samples once per second by default, up to 1,800 samples. It records FPS derived from frame-time p50, frame-time p50/p95/p99/max, draw calls, triangles, geometries, textures, particles, decals, live enemies, render scale, adaptive FPS, mission, wave, and game state. Device metadata includes user agent, platform hint, viewport, DPR, touch capability, quality preset, and run seed. The recorder stops automatically when gameplay is paused, the document is hidden, the page is being unloaded, the Android wrapper pauses/back action fires, or WebGL context is lost.

Reports include per-metric min/average/p50/p95/max, the raw one-second samples, capture duration, scenario metadata and stop reason. Frame p50/p95/p99/max values are rolling-window measurements captured once per second; aggregate p95/p99 summaries describe the distribution of those one-second readings, not a single percentile recomputed over every frame in the entire run. Run captures separately for each scenario and trial; do not combine menu and combat data into one report.

## Benchmark matrix

Use identical device, browser/WebView version, orientation, resolution, quality preset, mission, class, weapon, and seed for each comparison. Warm the game for 30 seconds before recording each trial.

| Scenario | Setup | Capture |
|---|---|---|
| Menu idle | Main menu, no interaction | 30 seconds × 3 trials |
| Typical combat | Same mission, same class/weapon/seed, ordinary wave | 60 seconds × 3 trials |
| Peak combat | Blackout Commander wave or a reproducible high-load Endless wave | 60 seconds × 3 trials |
| Adaptive recovery | Start from a sustained heavy-load scene, then return to a low-load scene | 60–90 seconds × 3 trials |

Record PC browser and Android WebView results independently. Do not treat numbers from different hardware as directly comparable. Compare medians across the three trials for each device/scenario/preset.

## Manual runtime regression

- [ ] Fresh load: no fatal screen, missing asset, uncaught console error, or external runtime request.
- [ ] Menu, mission/class selection, settings, audio unlock and local save.
- [ ] Start, pause, resume, retry, return to menu, victory and defeat.
- [ ] Complete all three original missions and verify their expected wave/timer rules.
- [ ] Blackout Offensive reaches its final Commander wave and can be completed.
- [ ] Endless Protocol offers exactly one upgrade choice after a cleared wave and resumes simulation.
- [ ] Rifle, Revolver and Sniper: fire, ADS, reload, inspect, switch and accuracy accounting.
- [ ] Grenade, airstrike, pickups, damage feedback, kill feed and cleanup.
- [ ] Player/enemy projectiles respect cover; enemies navigate around major obstacles.
- [ ] Touch joystick, touch-look, simultaneous buttons, pointercancel and release after interruption.
- [ ] Browser tab hide/show, window blur/focus and Android background/resume never leave stuck input.
- [ ] Rotate/resize viewport; verify canvas and camera aspect remain correct.
- [ ] Force WebGL context loss/restore in a controlled test environment; verify the documented reload recovery path.
- [ ] Repeat core flow after a page reload and after clearing local save data.

## Evidence and exit criteria

A Phase 9 QA result must separate:
1. Automated CI checks and their run URL.
2. Browser manual tests, with browser/version, OS, seed, mission and test outcome.
3. Physical Android tests, with device model, Android/WebView version, orientation and test outcome.
4. Benchmark JSON captures for all completed scenarios and three trials.

Automated gates must pass and Web/Android mirrors must be identical. Any failed manual case must include reproduction steps. Do not claim measured FPS improvement from configured thresholds or CI unit tests.

## Known limits

- Automated tests validate source contracts and the benchmark utility; they do not run the complete game in a real browser.
- Physical Android touch, lifecycle, GPU, thermal behavior, memory pressure and sustained FPS still need device testing.
- WebGL context restoration reloads the page; in-place scene reconstruction is not implemented.
- Replay still does not record touch input and platform lifecycle events; see [PHASE_7_QA.md](PHASE_7_QA.md).
