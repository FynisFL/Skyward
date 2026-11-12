# Phase 11 — Combat Depth & Enemy AI Evolution

## Implemented

- Added `js/combat_ai.js` with deterministic archetype profiles and pure combat decision helpers.
- Split movement and attack behavior into ranged-support, flanker, frontline-disruptor and Commander roles.
- Drone marks an aimed shot before firing; Speeder telegraphs a locked charge lane; Brute telegraphs a ground-slam radius.
- Speeder charges and Brute slams respect vertical separation, allowing elevated platforms to serve as counterplay.
- Focused damage during telegraphs accumulates stagger and can interrupt attacks. Stagger decays with simulation time.
- Commander has three HP phases: single shot, three-projectile fan and five-projectile fan. Movement speed, fire interval and reactor scale are centralized and unit-tested.
- Commander reactor receives normal damage while closed and 2.5× weapon damage during its 1.15-second post-volley exposure window.
- Added combat event trace for telegraphs, attacks, stagger interrupts, Commander phase changes and weakpoint interactions.
- Added attack state, locked targets/direction, stagger, phase and weakpoint timers to Replay v2 checkpoints.
- Added Phase 11 deterministic tests, repository validator checks and quality/Android CI gates.
- Disabled frustum culling for animated enemy glTF meshes to avoid rest-pose bounds hiding moving models.
- Added a ray-sphere fallback for hitscan only when no actual enemy mesh is hit; this preserves real weakpoint mesh hits and respects world obstruction distance.
- Synchronized combat AI, enemies, weapons, main runtime and HTML script loading to the Android WebView mirror.

## Automated verification

Verified on runtime commit `f079a64c8a3487eef464109668869b8798de6b8c`.

| Check | Status |
|---|---|
| JavaScript syntax | PASS |
| Phase 7 deterministic tests | PASS |
| Phase 8 adaptive-rendering tests | PASS |
| Phase 9 benchmark tests | PASS |
| Phase 10 Replay v2 tests | PASS |
| Phase 11 combat AI tests | PASS |
| Repository QA validator | PASS |
| Web/Android runtime parity | PASS |
| Android debug APK build and artifact upload | PASS |
| Web deployment | PASS |
| GitHub Pages build/deploy | PASS |
| Desktop mixed-combat playtest | NOT RUN |
| Android mixed-combat playtest | NOT RUN |
| Weapon TTK / survival balance pass | NOT RUN |

## CI evidence

- [Quality validation — PASS](https://github.com/FynisFL/Skyward/actions/runs/43189737669)
- [Web deployment — PASS](https://github.com/FynisFL/Skyward/actions/runs/43189737721)
- [GitHub Pages build/deploy — PASS](https://github.com/FynisFL/Skyward/actions/runs/43189737082)
- [Android QA + APK build + artifact upload — PASS](https://github.com/FynisFL/Skyward/actions/runs/43189737655)

The Android artifact is named `Skyward-Salvage-Android-APK`, is approximately 18.16 MB, and expires on 26 November 2026.

## Enemy model / hitscan regression fix

The follow-up fix for the reported issue was validated on runtime commit `59c4c552a7229778e145c340b0dbeeb8534842a6`:

- Animated enemy meshes have frustum culling disabled so their render visibility does not depend on rest-pose bounds.
- Hitscan uses a deterministic ray-sphere fallback only when mesh raycasting produces no live enemy hit. World obstruction ordering is still checked, and actual mesh hits retain priority so Commander reactor weakpoint detection remains intact.
- [Quality validation including Phase 11 tests — PASS](https://github.com/FynisFL/Skyward/actions/runs/43191807612)
- [Android QA, mirror parity, APK build and artifact upload — PASS](https://github.com/FynisFL/Skyward/actions/runs/43191807653)
- [Latest web deployment — PASS](https://github.com/FynisFL/Skyward/actions/runs/43191832353)
- [Latest GitHub Pages build/deploy — PASS](https://github.com/FynisFL/Skyward/actions/runs/43191832402)

Android artifact: `Skyward-Salvage-Android-APK`, approximately 18.16 MB, artifact ID `13930727943`, expires 26 November 2026.

## Manual verification still required

Follow [PHASE_11_QA.md](PHASE_11_QA.md). Test every archetype, mixed squads, Commander phases and reactor exposure on desktop and Android. Record seed, mission, class, weapon, difficulty modifiers and replay divergence status. Verify telegraph legibility at desktop and Android landscape viewport sizes.

## Balance note

Base weapon damage, fire rate, magazine and recoil remain unchanged. Phase 11 introduces role-specific threat windows and interruption opportunities; a global weapon DPS rebalance is deferred until time-to-kill, ammo efficiency and survival data are collected from real playtests.

## Architecture constraints preserved

- Three.js r128 and classic script loading remain unchanged.
- No bundler, framework, CDN or runtime network dependency was added.
- AI/cooldown variation uses the seeded `ai` RNG stream.
- Web and Android runtime files are byte-identical.
