# Phase 12 — Critical Rendering & Camera Control Stabilization

## Scope

Stabilize enemy model visibility, hitscan registration and vertical camera control without adding new gameplay features.

## Automated regression suite

Run from the repository root with Node.js 20+:

```bash
node tools/qa/phase12.test.mjs
node tools/qa/phase11.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

The Phase 12 suite covers:

- Camera look input ignores non-finite pointer deltas.
- Sensitivity is clamped to the supported range and invalid sensitivity falls back safely.
- Invert-Y preserves its direction.
- Pitch is clamped just inside the vertical singularity in both directions.
- A nearer enemy receives a ray-sphere proxy even when a farther enemy has a real mesh hit.
- An enemy with a real mesh hit does not also receive a proxy; dead, spawning and out-of-range enemies are excluded.
- glTF enemy validation rejects missing roots, missing meshes, missing/undersized position attributes, degenerate bounds and non-finite bounds.
- Valid geometry returns finite world-space center and a positive target-height scale.
- Web and Android runtime mirrors remain byte-identical for the affected files.
- Hitscan candidates remain blocked by nearer world geometry.

The repository-wide validator and both quality/Android workflows execute this suite.

## Manual gameplay matrix

Automated regression tests do not establish visual correctness or control feel. Complete these checks on an actual browser and Android device.

### Desktop browser

- [ ] Capture/release pointer lock repeatedly; no camera jump or poisoned rotation occurs.
- [ ] Test small, fast and long mouse movements on both axes.
- [ ] Look down to the ground and up to the sky; pitch stops smoothly near vertical and does not flip.
- [ ] Verify low/high sensitivity settings and both invert-Y states.
- [ ] Track moving Drone, Speeder, Brute and Commander models from front, side and elevated angles.
- [ ] Confirm animated enemy meshes remain visible while moving and attacking, including near screen/frustum edges.
- [ ] Fire at a nearer enemy when its animated mesh raycast misses while a farther enemy mesh is intersected; the nearer enemy must be selected.
- [ ] Confirm a nearer wall/solid world object blocks both mesh hits and proxy hits.
- [ ] Confirm weakpoint hits still require a real weakpoint mesh intersection and the exposed Commander window.

### Android WebView — landscape

- [ ] Repeat vertical camera, sensitivity and invert-Y checks using touch-look.
- [ ] Test short swipes, long swipes, rapid repeated swipes and touch interruption/resume.
- [ ] Confirm camera behavior remains stable after pause/resume and focus changes.
- [ ] Verify enemy visibility and hit registration while moving/attacking.
- [ ] Confirm foreground enemy selection and world-obstruction behavior.
- [ ] Check layout and controls do not prevent aiming near the lower edge of the screen.

## Evidence to record

For each manual run, record:

- Build commit SHA, browser/device model and OS version.
- Web or Android runtime, display resolution and orientation.
- Sensitivity and invert-Y settings.
- Enemy archetype, engagement distance and relative height.
- Whether the model was visible, whether the hit registered, and whether world obstruction behaved correctly.
- Screen recording or screenshot and exact reproduction steps for each defect.

## CI evidence

- Quality validation #159: [PASS](https://github.com/FynisFL/Skyward/actions/runs/43357274166).
- Quality validation #160: [PASS](https://github.com/FynisFL/Skyward/actions/runs/43357297885).
- Android APK build #165, including Phase 12 tests and Web/Android byte parity: [PASS](https://github.com/FynisFL/Skyward/actions/runs/43357268846).
- Web deployment #177: [PASS](https://github.com/FynisFL/Skyward/actions/runs/43357299038).

## Exit criteria

- [x] Automated Phase 12 regression suite passes.
- [x] Repository QA validator passes.
- [x] Web and Android runtime mirrors are byte-identical.
- [x] Quality validation workflow passes.
- [x] Android APK build and asset parity checks pass.
- [ ] Desktop manual camera, rendering and hit-registration checks pass.
- [ ] Physical Android manual camera, rendering and hit-registration checks pass.
- [ ] Phase 12 completion report records actual commit and test evidence.

**Do not mark Phase 12 fully closed based on CI alone.** Desktop and physical Android gameplay checks are required for the final sign-off.
