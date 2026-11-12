# Phase 8 — Adaptive Rendering & Cross-Platform Runtime QA

## Scope

Phase 8 adds device-aware renderer limits and automatic render-resolution adjustment while preserving Three.js r128, classic scripts, local assets, offline gameplay, and byte-identical Web/Android game sources.

## Runtime behavior

- The initial render scale is derived from the selected Low / Medium / High preset, device pixel ratio, touch viewport class, and available device memory / logical CPU hints.
- Low-memory or low-core devices receive a conservative render-scale ceiling.
- While a run is active, the controller samples frame time in two-second windows.
- Sustained performance below 42 FPS for approximately four seconds lowers render scale by 0.10.
- Sustained performance above 57 FPS for approximately ten seconds raises render scale by 0.05.
- The controller clamps scale to its configured minimum and maximum and uses hysteresis to avoid rapid quality oscillation.
- Resize, orientationchange, visualViewport.resize, and Android native resume update the renderer and camera dimensions.

Adaptive resolution changes the renderer pixel ratio only. It does not change simulation delta, movement speed, weapon timing, enemy logic, RNG streams, or replay frame data.

## Automated checks

Run from the repository root:

```bash
node tools/qa/phase8.test.mjs
node tools/qa/phase7.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

The Phase 8 unit tests cover:
- Desktop, mobile, constrained-hardware, and quality-preset profile selection.
- Sustained low-FPS downshift behavior.
- Mid-band hysteresis / no oscillation.
- Sustained high-FPS recovery.
- Minimum and maximum scale clamping.
- Display-cap updates, reset behavior, and invalid frame-delta handling.

The repository validator additionally checks the new script is loaded locally and mirrored byte-for-byte into Android assets.

## Manual browser / device checklist

- [ ] Open the deployed game and verify the menu and a complete mission start.
- [ ] Press F3 and record render scale, adaptive FPS, frame-time p50/p95/p99, draw calls, and texture/geometry counts.
- [ ] Test Low / Medium / High presets on the same device and resolution.
- [ ] Run a sustained combat scenario with multiple enemies and VFX; confirm scale downshifts only after the low-FPS threshold persists.
- [ ] Let the game run in a light scene; confirm scale recovery is gradual and capped at the profile maximum.
- [ ] Resize the desktop browser and change device orientation; verify the camera aspect and canvas fit the viewport.
- [ ] On Android, background and resume the app; verify touch input is released and the viewport is refreshed.
- [ ] Verify the Web and Android JS/HTML mirrors remain identical.

## Pass criteria

- Unit tests, syntax checks, repository validation, and Web/Android mirror parity pass.
- No change to gameplay simulation timing or seeded RNG behavior.
- No unbounded render-scale changes; controller stays within min/max.
- Browser and physical Android tests are reported separately from automated source checks.

## Known verification limit

Automated tests prove controller behavior and source integration, not GPU performance or the feel of a real playthrough. Device FPS improvements must be measured on target hardware using F3; do not treat the configured heuristics as a measured performance result.
