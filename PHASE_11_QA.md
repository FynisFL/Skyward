# Phase 11 — Combat Depth & Enemy AI Evolution

## Goals

Move combat beyond enemies that share one orbit-and-fire loop. Each archetype should create a distinct decision for the player, attacks must be readable before impact, and damage pressure must have counterplay.

## Enemy roles

| Enemy | Combat role | Behavior | Player counterplay |
|---|---|---|---|
| Drone | Ranged support | Holds a longer firing lane, strafes, and locks an aimed shot before firing. Firing tempo increases when a Brute is close to the player. | Break line of sight, move after the red aim line appears, or focus fire to stagger during the tell. |
| Speeder | Flanker / disruptor | Sweeps laterally, locks the player's position, then lunges through the marked lane. Recovers after hitting or missing. | Dash or sidestep after the orange direction line appears; use focused damage to interrupt its wind-up. |
| Brute | Frontline disruptor | Advances into close range and marks a ground-slam radius before resolving the attack at the locked position. | Leave the red ground marker or interrupt the wind-up with concentrated fire. |
| Commander | Boss / area pressure | Three health phases change movement and projectile fan size. Fires a telegraphed volley and exposes its reactor briefly after the volley. | Dodge the fan, then prioritize the glowing reactor during its exposed window. |

## Combat rules

- Drone aimed shot wind-up: 0.64 seconds.
- Speeder charge: 0.72-second tell, 5.5–13.4-unit charge window, 0.5-second lunge and recovery.
- Brute ground slam: 0.96-second tell, 3.55-unit radius, 1.75-unit vertical tolerance, 23 base damage and 4.7-second cooldown. Elevated platforms outside the height tolerance avoid the floor slam.
- Aimed attacks lock the target position at telegraph start. The player can evade the locked location.
- A telegraph is interrupted when accumulated damage during the wind-up reaches that enemy's stagger threshold.
- Stagger decays over simulation time; it does not carry indefinitely between unrelated attacks.
- AI and cooldown variation use the seeded `ai` RNG stream. No unseeded randomness is added.

## Commander phase and reactor

| Phase | Health | Volley pattern | Movement / fire tempo |
|---|---|---|---|
| I | Above 65% | 1 aimed projectile | Baseline |
| II | 30–65% | 3-projectile fan | Faster movement and firing |
| III | 30% or less | 5-projectile fan | Highest movement and firing pressure |

After each volley, the reactor is exposed for 1.15 seconds. Shots to the closed reactor deal normal weapon damage; shots during exposure receive a 2.5× multiplier. The boss can also be staggered by focused damage during its telegraph.

## Weapon and hit feedback

- Rifle remains the sustained pressure / stagger tool.
- Revolver remains the high-impact option for punishing a short opening or interrupting a telegraph.
- Sniper remains the precision option, with the largest reward when the Commander reactor is exposed.
- The three weapons keep their established base damage, fire-rate, magazine and recoil profiles in this phase; Phase 11 changes the target windows and interruption rules rather than introducing a broad DPS rework.
- Damage events now include hit source and weakpoint/exposure metadata.

## Determinism and replay

The AI emits ordered events for:
- `enemy:telegraph`
- `enemy:attack`
- `enemy:staggered`
- `enemy:phase`
- `enemy:weakpoint-open`
- `boss:weakpoint-hit`

Replay v2 checkpoints include enemy role state, current telegraph/attack state, target/direction, stagger, Commander phase, weakpoint timer and projectiles. This allows replay divergence checks to detect AI state differences, not merely score or player-position differences.

## Automated checks

Run from repository root with Node.js 20+:

```bash
node tools/qa/phase11.test.mjs
node tools/qa/validate.mjs
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Tests validate role profiles, role-specific movement intent, the Speeder charge window, Brute radial hit resolution, stagger interruption, Commander phase thresholds and projectile fan geometry. The repository validator checks runtime script order, integration contracts, replay checkpoint fields and Android mirror parity.

## Manual combat matrix

- [ ] Drone: confirm aim line is visible before every shot; use cover and evade after the tell.
- [ ] Speeder: confirm it changes lane, locks direction, lunges once and enters recovery after hit/miss.
- [ ] Brute: confirm ground radius appears at the locked position; step outside the marker to avoid damage.
- [ ] Stagger: confirm focused damage interrupts Drone, Speeder and Brute telegraphs; validate Commander interruption with heavy/focused fire.
- [ ] Commander phase I: confirm one projectile and baseline tempo.
- [ ] Commander phase II: confirm a three-shot fan after crossing 65% HP.
- [ ] Commander phase III: confirm a five-shot fan after crossing 30% HP.
- [ ] Reactor: closed core receives normal damage; exposed core receives the 2.5× multiplier for 1.15 seconds.
- [ ] Mixed squad: verify Drone support pressure increases while a Brute is close; Speeders flank instead of stacking in the same firing lane.
- [ ] Original missions, Blackout Offensive and Endless Protocol: complete representative runs and verify enemy counts, wave timing, upgrade choices and difficulty scaling remain intact.
- [ ] Export/replay a combat tape and confirm no event/checkpoint divergences on the same environment.
- [ ] Repeat on Android WebView in landscape; compare telegraph readability, collision and frame-time impact.

## Exit criteria

- Phase 7–11 unit tests and repository validator pass.
- Web and Android runtime JavaScript mirrors are byte-identical.
- Desktop and Android manual combat matrices are documented separately.
- No enemy attack lands without a visible telegraph or a clearly readable contact/area rule.
- Role-specific counters work without relying on pixel-identical rendering.

## Known limits

- Automated tests validate deterministic profile logic and source integration, not full 3D perception, collision feel or weapon balance in a real match.
- The telegraph line/ground marker and attack damage/radii require playtesting at desktop and Android viewport scales.
- Weapon base DPS values have not been broadly retuned; combat balance conclusions require benchmarked time-to-kill and survival runs.
