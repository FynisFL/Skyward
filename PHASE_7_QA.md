# Phase 7 — Deterministic Foundation & QA

## Runtime modules
- `js/rng.js`: seeded xorshift32 streams for gameplay, AI, weapons, VFX, cosmetics, audio and procedural textures.
- `js/events.js`: publish/subscribe bus with one-shot listeners, unsubscribe, wildcard observers and listener diagnostics.
- `js/replay.js`: replay v2 tapes with keyboard, mouse and touch input timelines, frame deltas, lifecycle state transitions, ordered event comparison and gameplay checkpoints. V1 tapes remain importable.

## Seed control
Every normal run starts with a fresh seed. To reproduce a run, set `?seed=123456` in the URL or define `window.__SKYWARD_SEED__ = 123456` before the game scripts initialize. The active run seed is exposed through `window.__SKYWARD__.runSeed()`.

Random streams are independent. Cosmetics, VFX and audio cannot advance the gameplay RNG stream.

## Replay
From the browser console:
```js
const tape = window.__SKYWARD__.replay.export();
window.__SKYWARD__.playReplay(tape);
```
The original Phase 7 format stored frame deltas and keyboard/mouse transitions. Phase 10 upgrades new recordings to v2; see [PHASE_10_QA.md](PHASE_10_QA.md) for touch input, lifecycle events and state checkpoints.

**Phase 7 historical limitation:** v1 tapes do not contain touch or platform lifecycle input. Phase 10 adds v2 capture and retains v1 import compatibility. The cross-device manual test matrix is still required before claiming cross-platform replay validation.

## Automated checks
Run from the repository root:
```bash
node tools/qa/phase7.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```
Unit tests cover RNG repeatability, stream isolation, state restore, deterministic shuffle, event subscriptions and replay tape round-trip/event comparison. The repo validator checks script loading, `Math.random()` removal, syntax and web/Android mirror parity.

## Manual validation still required
- Desktop browser gameplay and replay playback.
- Replay divergence check after representative combat runs.
- Android WebView lifecycle, touch input, background/resume and WebGL context-loss behavior.
- Device-specific performance and memory checks.

Source-level checks are not a substitute for those device tests.
