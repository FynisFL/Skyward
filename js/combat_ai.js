(function (root) {
  'use strict';

  const PROFILES = Object.freeze({
    drone: Object.freeze({
      role: 'ranged-support',
      idealRange: 17,
      retreatRatio: 0.56,
      advanceRatio: 1.18,
      strafe: 0.78,
      attack: 'aimed-shot',
      windup: 0.64,
      staggerThreshold: 22
    }),
    speeder: Object.freeze({
      role: 'flanker',
      idealRange: 10.5,
      retreatRatio: 0.62,
      advanceRatio: 1.2,
      strafe: 1.3,
      attack: 'charge',
      chargeMinRange: 5.5,
      chargeMaxRange: 13.4,
      windup: 0.72,
      chargeDuration: 0.5,
      chargeSpeed: 25,
      hitRadius: 2.05,
      chargeHeightTolerance: 1.75,
      damage: 14,
      cooldown: 3.8,
      recover: 0.72,
      staggerThreshold: 25
    }),
    brute: Object.freeze({
      role: 'frontline-disruptor',
      idealRange: 5.2,
      retreatRatio: 0,
      advanceRatio: 0.98,
      strafe: 0.18,
      attack: 'ground-slam',
      slamRange: 8.6,
      slamRadius: 3.55,
      slamHeightTolerance: 1.75,
      windup: 0.96,
      damage: 23,
      cooldown: 4.7,
      recover: 0.82,
      staggerThreshold: 48
    }),
    boss: Object.freeze({
      role: 'commander',
      idealRange: 22,
      retreatRatio: 0.58,
      advanceRatio: 1.16,
      strafe: 0.62,
      attack: 'command-volley',
      windup: 0.78,
      recover: 0.78,
      weakpointWindow: 1.15,
      staggerThreshold: 125
    })
  });

  function getProfile(type) {
    return PROFILES[type] || PROFILES.drone;
  }

  function getCommanderPhase(hp, maxHp) {
    const ratio = Number(maxHp) > 0 ? Math.max(0, Number(hp) / Number(maxHp)) : 0;
    if (ratio <= 0.3) return 3;
    if (ratio <= 0.65) return 2;
    return 1;
  }

  function getCommanderTuning(phase) {
    const selected = Math.max(1, Math.min(3, Math.floor(Number(phase) || 1)));
    const tuning = {
      1: { moveSpeed: 1.9, fireRate: 1.2, coreScale: 1, volleyCount: 1 },
      2: { moveSpeed: 2.3, fireRate: 0.94, coreScale: 1.25, volleyCount: 3 },
      3: { moveSpeed: 2.8, fireRate: 0.76, coreScale: 1.5, volleyCount: 5 }
    }[selected];
    return Object.freeze({
      phase: selected,
      moveSpeed: tuning.moveSpeed,
      fireRate: tuning.fireRate,
      coreScale: tuning.coreScale,
      volleyCount: tuning.volleyCount
    });
  }

  function getCommanderVolleyOffsets(phase) {
    const tuning = getCommanderTuning(phase);
    const count = tuning.volleyCount;
    const spread = phase >= 3 ? 0.2 : (phase >= 2 ? 0.13 : 0);
    const offsets = [];
    for (let i = 0; i < count; i++) offsets.push(Number(((i - (count - 1) / 2) * spread).toFixed(6)));
    return offsets;
  }

  function isInChargeWindow(distance, profile) {
    const p = profile || PROFILES.speeder;
    return Number.isFinite(distance) &&
      distance >= p.chargeMinRange &&
      distance <= p.chargeMaxRange;
  }

  function isInsideRadialAttack(targetX, targetZ, playerX, playerZ, radius, targetY, playerY, heightTolerance) {
    const dx = Number(playerX) - Number(targetX);
    const dz = Number(playerZ) - Number(targetZ);
    const r = Number(radius);
    if (![dx, dz, r].every(Number.isFinite) || r < 0) return false;
    if (Number.isFinite(Number(targetY)) && Number.isFinite(Number(playerY)) &&
        Math.abs(Number(playerY) - Number(targetY)) > Math.max(0, Number(heightTolerance) || 0)) return false;
    return dx * dx + dz * dz <= r * r;
  }

  function isWithinVerticalTolerance(firstY, secondY, tolerance) {
    const a = Number(firstY), b = Number(secondY), limit = Number(tolerance);
    if (![a, b, limit].every(Number.isFinite) || limit < 0) return false;
    return Math.abs(a - b) <= limit;
  }

  function raySphereDistance(originX, originY, originZ, directionX, directionY, directionZ,
    centerX, centerY, centerZ, radius, maxDistance) {
    const values = [originX, originY, originZ, directionX, directionY, directionZ,
      centerX, centerY, centerZ, radius, maxDistance].map(Number);
    if (!values.every(Number.isFinite) || radius <= 0 || maxDistance < 0) return null;
    const ox = originX - centerX;
    const oy = originY - centerY;
    const oz = originZ - centerZ;
    const a = directionX * directionX + directionY * directionY + directionZ * directionZ;
    if (a < 1e-12) return null;
    const b = 2 * (ox * directionX + oy * directionY + oz * directionZ);
    const c = ox * ox + oy * oy + oz * oz - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    const near = (-b - root) / (2 * a);
    const far = (-b + root) / (2 * a);
    const distance = near >= 0 ? near : far;
    return distance >= 0 && distance <= maxDistance ? distance : null;
  }

  function addStagger(current, damage, threshold) {
    const total = Math.max(0, Number(current) || 0) + Math.max(0, Number(damage) || 0);
    const limit = Math.max(1, Number(threshold) || 1);
    return Object.freeze({
      value: total >= limit ? 0 : total,
      interrupted: total >= limit
    });
  }

  function getMovementIntent(type, distance) {
    const p = getProfile(type);
    const d = Math.max(0, Number(distance) || 0);
    if (type === 'brute') return d > p.idealRange ? 'advance' : 'hold-frontline';
    if (d > p.idealRange * p.advanceRatio) return 'advance';
    if (d < p.idealRange * p.retreatRatio) return 'retreat';
    return type === 'speeder' ? 'flank' : 'orbit';
  }

  root.SkywardCombatAI = Object.freeze({
    version: 1,
    profiles: PROFILES,
    getProfile: getProfile,
    getCommanderPhase: getCommanderPhase,
    getCommanderTuning: getCommanderTuning,
    getCommanderVolleyOffsets: getCommanderVolleyOffsets,
    isInChargeWindow: isInChargeWindow,
    isInsideRadialAttack: isInsideRadialAttack,
    isWithinVerticalTolerance: isWithinVerticalTolerance,
    raySphereDistance: raySphereDistance,
    addStagger: addStagger,
    getMovementIntent: getMovementIntent
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = root.SkywardCombatAI;
})(typeof window !== 'undefined' ? window : globalThis);
