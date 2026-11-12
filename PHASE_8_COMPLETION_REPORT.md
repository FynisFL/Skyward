# Phase 8 — Implementation Report

## Implemented

- Added js/performance.js, a standalone classic-script module for device profile selection and adaptive render-resolution control.
- Applied conservative render-scale ceilings for constrained devices using available device-memory and hardware-concurrency hints.
- Added a two-second frame-rate sampling controller with sustained low/high thresholds, hysteresis, scale clamping, and gradual recovery.
- Integrated the controller into the game loop without changing simulation delta, seeded RNG streams, or replay frame timing.
- Added viewport sizing through visualViewport, resize, orientation-change, and Android native-resume events.
- Extended F3 and window.__SKYWARD__.getPerformanceSnapshot() with active/max/min render scale, adaptive FPS, and downshift/upshift counts.
- Added Phase 8 unit tests and CI / repository-validator gates.
- Synchronized index.html, js/main.js, and the new performance module into the Android WebView asset mirror.

## Verification

| Check | Status |
|---|---|
| Device profile and adaptive-controller unit tests | See Phase 8 CI run |
| Existing deterministic RNG / event / replay tests | See Phase 8 CI run |
| JavaScript syntax and repository validator | See Phase 8 CI run |
| Web / Android mirror parity | Enforced by repository validator and Android build workflow |
| Desktop gameplay on a real browser | Manual test required |
| Android WebView lifecycle and GPU behavior | Physical-device test required |
| Actual FPS / GPU-memory improvement | Not claimed; measure on target hardware with F3 |

## Tuning policy

The starting render scale is constrained by quality preset, DPR, viewport class, and available hardware hints. During active gameplay, sustained frame rate below 42 FPS triggers 0.10 downshifts after approximately four seconds; sustained frame rate above 57 FPS triggers 0.05 recovery steps after approximately ten seconds. Minimum and maximum scale bounds prevent runaway adjustment.

## Architecture constraints preserved

- Three.js r128 remains local and vendored.
- Classic JavaScript script loading remains in place.
- No framework, bundler, CDN, or runtime network dependency was introduced.
- Web and Android runtime files remain byte-identical.
- Gameplay simulation and RNG are independent of adaptive render scale.
