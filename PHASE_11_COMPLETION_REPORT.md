# Phase 11 — Implementation Report

## Implemented

- Added `js/combat_ai.js` with deterministic profiles and pure combat decision helpers.
- Split enemy movement intent into ranged support, flanking, frontline and Commander roles.
- Drone now marks an aimed shot before firing; Speeder telegraphs a locked charge lane and recovers after hit/miss; Brute telegraphs a ground-slam radius and resolves against the locked position.
- Focused damage during telegraphs accumulates stagger and can interrupt an attack. The meter decays with simulation time.
- Commander now has three HP phases: single shot, three-projectile fan and five-projectile fan.
- Commander reactor damage is conditional: normal damage while closed, 2.5× during the 1.15-second post-volley exposure window.
- Added combat event trace for telegraphs, attacks, stagger interrupts, phase changes and weakpoint interactions.
- Added player damage source and weakpoint metadata.
- Extended replay checkpoints with attack state, timers, locked target/direction, stagger, Commander phase and exposure timer.
- Added Phase 11 deterministic unit tests and quality / Android CI gates.
- Synced combat AI, enemies, weapons, main runtime and HTML script order to the Android WebView mirror.

## Automated verification

The current CI result must be recorded after the Phase 11 workflow completes.

| Check | Status |
|---|---|
| JavaScript syntax | CI |
| Phase 7 deterministic tests | CI |
| Phase 8 adaptive-rendering tests | CI |
| Phase 9 benchmark tests | CI |
| Phase 10 Replay v2 tests | CI |
| Phase 11 combat AI tests | CI |
| Repository QA validator | CI |
| Web/Android runtime parity | CI |
| Android debug APK build | CI |
| Desktop mixed-combat playtest | NOT RUN |
| Android mixed-combat playtest | NOT RUN |
| Weapon TTK / survival balance pass | NOT RUN |

## Manual verification still required

Follow [PHASE_11_QA.md](PHASE_11_QA.md). Test every archetype, mixed squads, Commander phases and reactor exposure on desktop and Android. Record seed, mission, class, weapon, difficulty modifiers and replay divergence status.

## Balance note

Base weapon damage, rate of fire, magazine and recoil remain unchanged. Phase 11 introduces role-specific threat windows and interruption opportunities; a global weapon DPS rebalance is deferred until time-to-kill and survival data are collected from real playtests.

## Architecture constraints preserved

- Three.js r128 and classic script loading remain unchanged.
- No bundler, framework, CDN or runtime network dependency was added.
- AI/cooldown variation uses the seeded `ai` RNG stream.
- Web and Android runtime files are kept byte-identical.
