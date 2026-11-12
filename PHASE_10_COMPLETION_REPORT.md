# Phase 10 — Implementation Report

## Implemented

- Upgraded new replay recordings to schema v2 while keeping v1 tape import support.
- Added ordered touch joystick axis, touch-look delta and touch action press/release input records.
- Recorded Endless upgrade selection IDs and restored look sensitivity / Y-axis inversion from replay metadata.
- Added explicit pause/resume and abandon-to-menu records, including source metadata for browser and Android lifecycle interruptions.
- Prevented physical touch, keyboard and mouse interaction from interfering with an active replay.
- Added deterministic gameplay checkpoints every 120 replay frames.
- Checkpoints compare player, weapon, grenade/airstrike state, wave, enemy projectiles and AI timers, pickup phase/position, available/selected upgrades and gameplay/AI/weapon RNG state.
- Quantized checkpoint numeric values to three decimal places; pixel-identical GPU rendering remains out of scope.
- Replaced wall-clock-driven pickup bob animation with simulation-time-driven animation to avoid gameplay-affecting nondeterminism.
- Added Phase 10 replay schema/timeline/legacy/import validation tests and CI / Android build gates.
- Synchronized replay v2 and main runtime files into the Android WebView mirror.

## Automated verification

Verified by GitHub Actions on runtime commit `42b65bd1` for quality validation, web deployment and Android APK build. The Pages build also passed on the immediately preceding web-identical source commit. Manual gameplay and cross-device replay remain separate checks.

| Check | Status |
|---|---|
| JavaScript syntax | PASS |
| Phase 7 deterministic tests | PASS |
| Phase 8 adaptive rendering tests | PASS |
| Phase 9 benchmark tests | PASS |
| Phase 10 Replay v2 tests | PASS |
| Repository QA validator | PASS |
| Web/Android runtime parity | PASS |
| Android debug APK build + artifact upload | PASS on runtime commit `42b65bd1` |
| Desktop replay manual test | NOT RUN until performed |
| Android WebView replay manual test | NOT RUN until performed |
| Cross-device replay matrix | NOT RUN until performed |

## CI evidence

- [Quality validation — PASS](https://github.com/FynisFL/Skyward/actions/runs/43185869023)
- [Web deployment — PASS](https://github.com/FynisFL/Skyward/actions/runs/43185868984)
- [GitHub Pages build/deploy — PASS](https://github.com/FynisFL/Skyward/actions/runs/43185868915)
- [Android QA + APK build + artifact upload — PASS](https://github.com/FynisFL/Skyward/actions/runs/43185869123)

The Android artifact is named `Skyward-Salvage-Android-APK` and was uploaded by the workflow. It includes Replay v2, touch/lifecycle input capture, Endless upgrade recording, control-setting metadata and gameplay checkpoints.

## Compatibility note

Replay v1 tapes remain importable at the schema level. Because the old format did not record touch input, platform lifecycle transitions or Endless upgrade selections, those historical actions cannot be reconstructed during playback. Full deterministic replay of those actions requires a v2 recording.

## Manual verification still required

- Follow [PHASE_10_QA.md](PHASE_10_QA.md).
- Capture and replay desktop keyboard/mouse sessions.
- Capture and replay Android touch sessions.
- Replay Endless upgrade selections and confirm non-default sensitivity / inverted-Y settings are restored.
- Test desktop-to-Android and Android-to-desktop playback.
- Retain exported replay tapes, final replay status and device/browser metadata.

## Architecture constraints preserved

- Three.js r128 remains local and vendored.
- Classic JavaScript script loading remains in place.
- No framework, bundler, CDN, or runtime network dependency was introduced.
- Web and Android runtime files remain byte-identical.
- Replay input/checkpoint capture does not change simulation delta or RNG stream consumption.
