# Phase 10 — Replay 2.0 & Cross-Platform Determinism

## Scope

Phase 10 upgrades the replay format to version 2 and expands input capture from keyboard/mouse to touch and platform-driven state transitions. It also adds deterministic gameplay checkpoints so replay validation compares simulation state and gameplay RNG streams rather than rendered pixels.

The project remains Three.js r128, classic scripts, local assets, no CDN, no bundler, and byte-identical web/Android runtime sources.

## Replay v2 input coverage

| Input | Capture representation |
|---|---|
| Keyboard | key-down / key-up with physical code |
| Mouse | button-down / button-up and relative look deltas |
| Touch joystick | normalized x/y axis updates and zero-axis release |
| Touch look | coalesced relative look delta applied on the next frame |
| Touch actions | semantic press/release for fire, aim, sprint, jump, reload, dash, grenade, strike and weapon cycle |
| Pause / resume | explicit state transition with source metadata |
| Platform interruption | window blur, visibility hide, page hide, Android pause/back and pointer-lock loss recorded through pause transition |

Replay v2 stores frame deltas and ordered inputs. Touch movement is normalized to -1..1 so it does not depend on the original screen's pixel dimensions.

## Deterministic checkpoints

Every 120 replay frames, the runtime emits a `replay:checkpoint` event. The checkpoint contains quantized values for:

- Mission, class, score, kills, shots, wave and run timers.
- Player position/velocity, look rotation, health, movement/input state and active cooldowns.
- Weapon selection, ammunition, cooldown, reload and aim/fire state.
- Wave state, spawn queue, enemy type/health/position/AI timers and active enemy projectiles.
- Active pickup state and selected run upgrades.
- Seeded RNG state for gameplay, AI and weapon streams.

Numeric gameplay values are rounded to three decimal places before comparison. The checkpoint event is added to the existing ordered event trace; divergence count is available from `window.__SKYWARD__.replay.status()`.

This is a gameplay-state check, not pixel-identical rendering. GPU, shader, animation rasterization, audio output and visual effects may differ between browsers/devices.

## Capture and playback

Start a normal run and complete or abandon it. Export its replay tape from DevTools:

```js
const tape = window.__SKYWARD__.replay.export();
copy(tape);
```

Load and play the tape in the game:

```js
window.__SKYWARD__.playReplay(tape);
```

Inspect the result:

```js
window.__SKYWARD__.replay.status();
```

A clean replay should report `divergences: 0`. To preserve evidence, save the exported tape and the final status together with the device/browser details.

Replay v1 tapes remain importable. New recordings use v2.

## Automated checks

Run from the repository root with Node.js 20+:

```bash
node tools/qa/phase7.test.mjs
node tools/qa/phase8.test.mjs
node tools/qa/phase9.test.mjs
node tools/qa/phase10.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Phase 10 tests cover:
- V2 schema and ordered input-frame validation.
- Keyboard, mouse, touch, and lifecycle input timeline records.
- Event trace and outcome comparison.
- Trailing inputs captured at the final frame boundary.
- Import compatibility for legacy v1 tapes.
- Invalid JSON, invalid deltas, malformed inputs/events and unsupported versions.
- Seeded RNG stream isolation.

## Manual cross-platform matrix

- [ ] Record a desktop keyboard/mouse run with all three weapons, abilities, pause/resume and at least one boss encounter.
- [ ] Export the tape, replay it on the same desktop browser and confirm zero event/checkpoint divergences.
- [ ] Record a touch run using joystick, touch-look, simultaneous fire/aim, sprint, jump, reload, dash, grenade, strike and weapon cycle.
- [ ] Replay the touch tape on the same Android WebView device and confirm zero divergences.
- [ ] Import a desktop tape on Android and an Android tape on desktop. Compare gameplay checkpoints and note any engine/device-specific drift.
- [ ] During recording, test window blur/focus, tab visibility, Android background/resume and pointer-lock loss; confirm the state transition appears in the input timeline and playback does not remain stuck.
- [ ] Confirm no touch input from the physical device can interfere while a replay is playing.
- [ ] Test long sessions and large tapes; export, reload and replay the saved JSON.
- [ ] Import a representative v1 tape and verify compatibility.

## Exit criteria

- Phase 7, 8, 9 and 10 unit tests pass.
- Repository validator passes and every runtime file is byte-identical in the Android mirror.
- Replay v2 records all supported keyboard/mouse/touch input transitions and pause/resume state changes.
- Checkpoint/event divergence is visible and repeatable on the same environment.
- Desktop and physical Android test results are documented separately. Cross-device pixel identity is not required.

## Known limits

- Automated tests validate replay format, input timeline, deterministic utilities and source wiring; they do not run a full browser gameplay session.
- Physical Android WebView and desktop cross-playback still require the manual matrix above.
- A WebGL context restoration still reloads the page; a context-loss event can interrupt a replay.
- Checkpoints compare gameplay state at 120-frame intervals. They do not capture every transient render/VFX/audio state or prove identical GPU output.
