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

## Manual verification still required

Follow [PHASE_11_QA.md](PHASE_11_QA.md). Test every archetype, mixed squads, Commander phases and reactor exposure on desktop and Android. Record seed, mission, class, weapon, difficulty modifiers and replay divergence status. Verify telegraph legibility at desktop and Android landscape viewport sizes.

## Balance note

Base weapon damage, fire rate, magazine and recoil remain unchanged. Phase 11 introduces role-specific threat windows and interruption opportunities; a global weapon DPS rebalance is deferred until time-to-kill, ammo efficiency and survival data are collected from real playtests.

## Architecture constraints preserved

- Three.js r128 and classic script loading remain unchanged.
- No bundler, framework, CDN or runtime network dependency was added.
- AI/cooldown variation uses the seeded `ai` RNG stream.
- Web and Android runtime files are byte-identical.
