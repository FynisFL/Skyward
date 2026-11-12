# Phase 7 — Deterministic Foundation & QA

## Runtime modules
- `js/rng.js`: seeded xorshift32 streams for gameplay, AI, weapons, VFX, cosmetics, audio and procedural textures.
- `js/events.js`: publish/subscribe bus with one-shot listeners, unsubscribe, wildcard observers and listener diagnostics.
- `js/replay.js`: replay tapes with run metadata, keyboard/mouse transitions, simulation frame deltas and ordered event comparison.

## Seed control
Every normal run starts with a fresh seed. To reproduce a run, set `?seed=123456` in the URL or define `window.__SKYWARD_SEED__ = 123456` before the game scripts initialize. The active run seed is exposed through `window.__SKYWARD__.runSeed()`.

Random streams are independent. Cosmetics, VFX and audio cannot advance the gameplay RNG stream.

## Replay
From the browser console:
```js
const tape = window.__SKYWARD__.replay.export();
window.__SKYWARD__.playReplay(tape);
```
The tape stores frame deltas and keyboard/mouse transitions. Playback uses the recorded simulation deltas and reports event-trace divergences.

**Current limitation:** replay captures keyboard and mouse input only. Touch joystick, touch-look, mobile action buttons, browser blur/visibility changes and pause caused by pointer-lock loss are not recorded. Runs containing those platform-driven inputs are not claimed to be replay-complete.

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
