# Phase 6 — Quality Assurance & Benchmark

## Scope

Add repeatable source and packaging checks plus a consistent runtime benchmark procedure. The game remains Three.js r128, classic scripts, no bundler and no new runtime dependency. Web and Android game assets must remain byte-identical.

## Automated validation

Run from the repository root:

```bash
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

The validator checks local script dependencies, unique HTML IDs, JavaScript syntax, web/Android mirror parity, core gameplay contracts, diagnostic metrics and Android CI wiring. GitHub Actions runs it before APK packaging.

## Runtime benchmark

Use the same device, browser/WebView version, display orientation, resolution, quality preset and mission for every comparison.

1. Load the game and confirm there are no uncaught console errors.
2. Start the same mission with the same class and weapon.
3. Press F3 and play for at least 30 seconds.
4. Record average FPS and frame-time p50/p95/p99/max, draw calls, triangles, geometries, textures, particles, decals and alive enemy count.
5. Measure three scenarios: menu/initial load; ordinary combat; peak load with boss, multiple enemies and active VFX.
6. Repeat each scenario three times and compare median run values.
7. Repeat on Android in portrait and landscape. Do not compare desktop and mobile numbers as equivalent hardware.

The read-only browser-console snapshot is:

```js
window.__SKYWARD__.getPerformanceSnapshot()
```

Frame-time values are in milliseconds. Percentiles use a rolling window of up to 600 rendered frames.

## Manual regression checklist

- [ ] Boot, menu, mission/class selection, settings and audio unlock.
- [ ] Start, pause, resume, return to menu and retry.
- [ ] Complete each original mission with expected wave count.
- [ ] Blackout Offensive reaches the final Commander wave.
- [ ] Endless Protocol pauses for one upgrade choice and resumes.
- [ ] Weapon switching, ADS, reload, semi-auto and automatic fire.
- [ ] Accuracy counts firearm hits only; abilities do not inflate it.
- [ ] Grenade/airstrike damage, cooldown and cleanup.
- [ ] Player and enemy projectiles respect map cover.
- [ ] Enemies navigate around major props without getting stuck.
- [ ] Death, victory, retry and menu return clean projectiles and pickups.
- [ ] Settings and progression survive reload.
- [ ] Touch joystick, touch-look, multi-touch and pointer cancellation.
- [ ] Background/resume and WebGL context loss do not leave stuck input.

## Known limits

- Automated checks are source/packaging validation, not a full browser playthrough.
- No screenshot visual-regression baseline is included because the project does not yet have a pinned browser automation dependency or deterministic capture mode.
- Core gameplay still uses Math.random(); deterministic replay and reproducible visual captures remain future work.
- CI does not claim device FPS or memory performance. Collect those metrics on target hardware.
