/* ============================================================
   SKYWARD SALVAGE — main.js
   Khởi tạo, vòng lặp game, máy trạng thái, input, tính điểm.
   ============================================================ */

(function () {
  const rng = window.SkywardRNG, events = window.SkywardEvents, replay = window.SkywardReplay;
  const performanceTools = window.SkywardPerformance, benchmarkTools = window.SkywardBenchmark;
  if (!rng || !events || !replay || !performanceTools || !benchmarkTools) throw new Error('[Skyward] Runtime modules failed to load');
  const configuredSeed = rng.getConfiguredSeed();
  let activeRunSeed = rng.reset(configuredSeed === null ? rng.createSeed() : configuredSeed);
  const canvas = document.getElementById('game-canvas');

  // Chỉ bật touch UI khi thiết bị nhập chính là cảm ứng; laptop touchscreen vẫn giữ chuột + bàn phím.
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const touchCapable = mq('(pointer: coarse)') ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
    (('ontouchstart' in window) && !mq('(any-pointer: fine)'));

  // ---------- kiểm tra môi trường ----------
  if (!window.THREE) {
    const l = document.getElementById('loading'); if (l) l.classList.add('hidden');
    const f = document.getElementById('fatal'); if (f) f.classList.remove('hidden');
    const m = document.getElementById('fatal-msg');
    if (m) m.textContent = 'Không tải được thư viện 3D (vendor/three.min.js). Hãy kiểm tra thư mục vendor/.';
    return;
  }

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !touchCapable, powerPreference: 'high-performance' });
  } catch (e) {
    const l = document.getElementById('loading'); if (l) l.classList.add('hidden');
    const f = document.getElementById('fatal'); if (f) f.classList.remove('hidden');
    return;
  }

  // ---------- cài đặt ----------
  const SETTINGS_KEY = 'skyward-settings-v1';
  const BEST_KEY = 'skyward-best-v1';
  const CLASS_KEY = 'skyward-class-v1';
  const MISSION_KEY = 'skyward-mission-v1';
  const PROGRESS_KEY = 'skyward-profile-v1';

  function readJSON(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : {}; } catch (e) { return {}; }
  }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }


  const savedSettingsRaw = readJSON(SETTINGS_KEY);
  const savedSettings = savedSettingsRaw && typeof savedSettingsRaw === 'object' ? savedSettingsRaw : {};
  const settings = Object.assign({
    sens: 1, vol: 0.6, musicVol: 0.45, masterVol: 0.8,
    invert: false, motion: false, quality: touchCapable ? 'low' : 'med', muted: false
  }, savedSettings);
  if (['low', 'med', 'high'].indexOf(settings.quality) < 0) settings.quality = touchCapable ? 'low' : 'med';
  if (window.SkywardAssetFactory) window.SkywardAssetFactory.setQuality(settings.quality);

  function saveSettings() { saveJSON(SETTINGS_KEY, settings); }
  const progression = Object.assign({ level: 1, xp: 0, runs: 0, kills: 0, wins: 0, bestWave: 0, achievements: [] }, readJSON(PROGRESS_KEY));
  progression.level = Math.max(1, parseInt(progression.level, 10) || 1);
  progression.xp = Math.max(0, parseInt(progression.xp, 10) || 0);
  ['runs', 'kills', 'wins', 'bestWave'].forEach(k => { progression[k] = Math.max(0, parseInt(progression[k], 10) || 0); });
  progression.achievements = Array.isArray(progression.achievements) ? progression.achievements : [];
  function saveProgression() { saveJSON(PROGRESS_KEY, progression); }
  function missionUnlocked(m) { return progression.level >= (m.unlockLevel || 1); }

  // ---------- renderer / scene ----------
  function getViewportSize() {
    const viewport = window.visualViewport;
    return {
      width: Math.max(1, viewport ? viewport.width : window.innerWidth),
      height: Math.max(1, viewport ? viewport.height : window.innerHeight)
    };
  }
  function getRendererProfile() {
    const viewport = getViewportSize();
    return performanceTools.getDeviceProfile({
      quality: settings.quality,
      dpr: window.devicePixelRatio || 1,
      touchCapable: touchCapable,
      width: viewport.width,
      height: viewport.height,
      deviceMemory: navigator.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency
    });
  }
  let rendererProfile = getRendererProfile();
  const adaptiveResolution = performanceTools.createAdaptiveResolution({
    maxScale: rendererProfile.maxScale,
    minScale: rendererProfile.minScale
  });
  const initialViewport = getViewportSize();
  renderer.setPixelRatio(adaptiveResolution.snapshot().scale);
  renderer.setSize(initialViewport.width, initialViewport.height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Tone mapping kiểu điện ảnh, giữ chi tiết vùng sáng của vật liệu PBR.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = settings.quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // texture procedural theo preset (LOW 256 / MED 512 / HIGH 1024)
  const texSize = settings.quality === 'low' ? 256 : settings.quality === 'high' ? 1024 : 512;
  Tex.init({
    size: texSize,
    anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4)
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, initialViewport.width / initialViewport.height, 0.1, 1200);

  const __w0 = performance.now();
  const world = World.create(scene, settings.quality);
  // Environment map từ bầu trời scene giúp vật liệu kim loại có nguồn phản chiếu.
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    window.SKYWARD_ENV = pmrem.fromScene(scene, 0.03, 1, 1500).texture;
    pmrem.dispose();
  } catch (e) { console.warn('[Skyward] Env map unavailable', e); }
  if (window.SkywardAssetFactory) {
    world.scifiProps = window.SkywardAssetFactory.addWorldProps(scene);
    if (world.registerPlayerColliders) world.registerPlayerColliders(world.scifiProps);
  }
  window.__WORLD_MS__ = +(performance.now() - __w0).toFixed(1);
  const particles = new ParticleSystem(scene, settings.quality === 'low' ? 500 : 900);
  const dustParticles = new ParticleSystem(scene, settings.quality === 'low' ? 200 : 420, {
    blending: THREE.NormalBlending, opacity: 0.5
  });

  // Chỉ đưa các bề mặt gameplay vào raycast; loại sky, cloud và mesh trang trí.
  const worldMeshes = [];
  scene.traverse(o => {
    if (o.isMesh && (o.userData.blocksBullets === true || !!o.userData.surface)) worldMeshes.push(o);
  });
  function visibleInScene(object) {
    for (let node = object; node; node = node.parent) if (node.visible === false) return false;
    return true;
  }
  function getVisibleWorldMeshes() { return worldMeshes.filter(visibleInScene); }

  // ---------- VFX (tracer, vỏ đạn, khói, decal, shockwave, nổ) ----------
  const vfx = new Vfx(scene, particles, dustParticles, { quality: settings.quality });

  // ---------- trạng thái game ----------
  const G = {
    state: 'menu',
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    wave: 0,
    totalWaves: 3,
    combo: 0, multiplier: 1, comboTimer: 0, xpEarned: 0,
    enemiesLeft: 0,
    elapsed: 0,
    timeLeft: 0,
    overTimer: 0,
    timeScale: 1,
    victory: false,
    newBest: false,
    best: parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0,
    mission: MISSIONS.find(m => m.id === localStorage.getItem(MISSION_KEY) && progression.level >= (m.unlockLevel || 1)) || MISSIONS[0],
    cls: CLASSES.find(c => c.id === localStorage.getItem(CLASS_KEY)) || CLASSES[0],
    player: null,
    weapons: null
  };

  // ---------- player ----------
  const player = new Player(camera, G.cls.mods);
  player.sensitivity = settings.sens;
  player.invertY = settings.invert;
  scene.add(player.yaw);
  G.player = player;

  // ---------- weapons ----------
  const weapons = new WeaponSystem({
    camera: camera,
    scene: scene,
    particles: particles,
    player: player,
    sound: Sound,
    vfx: vfx,
    getEnemies: () => waves.enemies,
    getHitMeshes: () => waves.hitMeshes(),
    getWorldMeshes: getVisibleWorldMeshes,
    onShot: () => { G.shotsFired++; events.emit('weapon:fire', { weapon: weapons.current, shotsFired: G.shotsFired }); },
    onHit: (e, dmg, killed, source) => {
      // Accuracy chỉ đo phát bắn từ vũ khí; kỹ năng diện rộng không phải viên đạn.
      if (source === 'firearm') {
        G.shotsHit++;
        G.score += 10;
      }
      events.emit('damage:dealt', { target: e.type, damage: Number(dmg.toFixed(3)), killed: !!killed, source: source || 'unknown' });
      ui.hitmarker(killed);
      ui.showDamageNumber(camera, e, dmg, killed);
    },
    onKill: (e) => {
      G.kills++;
      events.emit('enemy:death', { enemyType: e.type, boss: !!e.isBoss, kills: G.kills });
      if (G.mission.mods && G.mission.mods.endless) {
        G.combo++; G.comboTimer = 4.2;
        G.multiplier = Math.min(3, 1 + Math.floor(Math.max(0, G.combo - 1) / 4) * 0.25);
      } else { G.combo = 0; G.multiplier = 1; }
      const points = Math.round(e.score * G.multiplier);
      G.score += points;
      ui.hitmarker(true);
      ui.killfeed((e.isBoss ? '<b>COMMANDER ELIMINATED</b> ' : 'Hạ <b>' + e.type.toUpperCase() + '</b> ') + '+' + points);
      if (player.mods.vampiric) player.heal(player.mods.vampiric);
      if (G.mission.mods && G.mission.mods.endless && SkywardRNG.random('gameplay') < (e.isBoss ? 1 : 0.24)) spawnPickup(e.group.position, e.isBoss ? 'both' : (SkywardRNG.random('gameplay') < 0.5 ? 'health' : 'ammo'));
    }
  });
  G.weapons = weapons;

  // ---------- waves ----------
  const waves = new WaveManager(scene, particles, Sound, {
    onWaveStart: (n, total) => {
      G.wave = n;
      events.emit('wave:started', { wave: n, total: total === '∞' ? null : total });
      G.totalWaves = total === '∞' ? Infinity : total;
      ui.waveBanner('ĐỢT ' + n, total === '∞' ? 'ENDLESS PROTOCOL' : total + ' ĐỢT');
      ui.killfeed('Đợt <b>' + n + '</b> bắt đầu');
    },
    onWaveClear: (n, total) => {
      events.emit('wave:completed', { wave: n, total: total === '∞' ? null : total });
      G.score += 250;
      ui.waveBanner('ĐỢT ' + n + ' XONG', '+250 ĐIỂM');
      ui.killfeed('Dọn sạch đợt <b>' + n + '</b> +250');
      Sound.win();
      const endless = !!(G.mission.mods && G.mission.mods.endless);
      const finalWave = !endless && n >= (G.mission.mods.waveCount || 3);
      if (endless || (!finalWave && n % 2 === 0)) presentUpgradeChoice();
    },
    onAllClear: () => { events.emit('mission:completed', { mission: G.mission.id, wave: G.wave }); endRound(true); },
    onPlayerHit: (dmg, pos) => {
      if (G.state !== 'playing' || player.dead) return;
      player.damage(dmg);
      events.emit('damage:taken', { damage: Number(dmg.toFixed(3)), health: player.health });
      ui.damageDirection(pos, player);
      ui.damageFlash();
      Sound.hurt();
      particles.burst(pos, { count: 12, color: [1, 0.4, 0.3], speed: 5, life: 0.4, gravity: 6 });
    }
  });

  // ---------- UI ----------
  const ui = new UI({
    isMissionUnlocked: missionUnlocked,
    play: startRound,
    prepare: prepareHudSetup,
    resume: resumeGame,
    toMenu: toMenu,
    resetBest: () => {
      G.best = 0;
      try { localStorage.removeItem(BEST_KEY); } catch (e) {}
      ui.setBest(0);
      ui.killfeed('Đã xóa điểm cao nhất');
    },
    toggleMute: () => {
      settings.muted = !settings.muted;
      Sound.setMuted(settings.muted);
      Music.setMuted(settings.muted);
      ui.setMuteLabel(settings.muted);
      saveSettings();
    },
    selectMission: (id) => {
      const selected = MISSIONS.find(m => m.id === id) || MISSIONS[0];
      G.mission = missionUnlocked(selected) ? selected : MISSIONS[0];
      try { localStorage.setItem(MISSION_KEY, G.mission.id); } catch (e) {}
      world.setMood(G.mission.mood); if (world.setMap) world.setMap(G.mission.id);
      ui.syncSelection(G.mission.id, G.cls.id);
      ui.show('menu');
    },
    selectClass: (id) => {
      G.cls = CLASSES.find(c => c.id === id) || CLASSES[0];
      try { localStorage.setItem(CLASS_KEY, G.cls.id); } catch (e) {}
      player.mods = G.cls.mods;
      player.maxHealth = Math.round(100 * G.cls.mods.maxHp);
      player.health = player.maxHealth;
      ui.syncSelection(G.mission.id, G.cls.id);
      ui.show('menu');
    },
    setSensitivity: (v) => { settings.sens = v; player.sensitivity = v; saveSettings(); },
    setVolume: (v) => { settings.vol = v; Sound.setVolume(v); saveSettings(); },
    setMusicVolume: (v) => { settings.musicVol = v; Music.setVolume(v); saveSettings(); },
    setMasterVolume: (v) => { settings.masterVol = v; Sound.setMasterVolume(v); saveSettings(); },
    setInvert: (v) => { settings.invert = v; player.invertY = v; saveSettings(); },
    setMotion: (v) => { settings.motion = v; saveSettings(); },
    setQuality: (q) => {
      settings.quality = ['low', 'med', 'high'].indexOf(q) >= 0 ? q : 'med';
      saveSettings();
      // texture sinh lúc khởi tạo theo preset → cần tải lại trang
      const old = document.getElementById('loading');
      if (old) {
        old.classList.remove('hidden');
        const t = old.querySelector('.loader-text');
        if (t) t.textContent = 'ĐANG ÁP DỤNG CÀI ĐẶT ĐỒ HỌA…';
      }
      setTimeout(() => { try { location.reload(); } catch (e) {} }, 260);
    }
  });
  ui.updateProgression(progression);

  // ---------- progression, drops and roguelite upgrades ----------
  const pickups = [];
  const pickupMaterials = {
    health: new THREE.MeshStandardMaterial({ color: 0x53e2a0, emissive: 0x168f5e, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.35 }),
    ammo: new THREE.MeshStandardMaterial({ color: 0x8fd0ff, emissive: 0x236b9a, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.35 }),
    both: new THREE.MeshStandardMaterial({ color: 0xffc06a, emissive: 0xb15a14, emissiveIntensity: 0.8, metalness: 0.55, roughness: 0.3 })
  };
  function spawnPickup(position, type) {
    let mesh = null;
    if (window.SkywardAssetFactory) {
      mesh = new THREE.Group();
      mesh.name = 'SciFi_' + type + '_Pickup';
      const addPickupModel = (name, x, scale) => {
        const model = window.SkywardAssetFactory.createStatic(name);
        if (!model) return false;
        model.position.set(x, -0.12, 0);
        model.scale.setScalar(scale);
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.pickupVisual = true; } });
        mesh.add(model);
        return true;
      };
      if (type === 'health') addPickupModel('Prop_HealthPack', 0, 1.65);
      else if (type === 'ammo') addPickupModel('Prop_Ammo', 0, 0.72);
      else {
        addPickupModel('Prop_HealthPack', -0.28, 1.05);
        addPickupModel('Prop_Ammo', 0.28, 0.52);
      }
      if (!mesh.children.length) mesh = null;
    }
    if (!mesh) mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), pickupMaterials[type]);
    mesh.position.copy(position); mesh.position.y = Math.max(0.8, mesh.position.y + 0.8);
    mesh.userData.baseY = mesh.position.y; mesh.userData.phase = SkywardRNG.random('cosmetic') * Math.PI * 2;
    scene.add(mesh); pickups.push({ mesh, type, life: 18 });
  }
  function clearPickups() {
    while (pickups.length) {
      const d = pickups.pop(); scene.remove(d.mesh);
      if (d.mesh.geometry) d.mesh.geometry.dispose();
    }
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const d = pickups[i]; d.life -= dt; d.mesh.rotation.y += dt * 1.7;
      const pickupAge = Math.max(0, 18 - d.life);
      d.mesh.position.y = d.mesh.userData.baseY + Math.sin(pickupAge * 1.7 + d.mesh.userData.phase) * 0.18;
      const distance = d.mesh.position.distanceTo(player.pos);
      if (distance < 2.25) {
        if (d.type === 'health' || d.type === 'both') player.heal(d.type === 'both' ? 40 : 28);
        if (d.type === 'ammo' || d.type === 'both') {
          WEAPON_ORDER.forEach(k => { weapons.state[k].reserve = Math.min(WEAPONS[k].reserve * 2, weapons.state[k].reserve + Math.ceil(WEAPONS[k].mag * 1.5)); });
        }
        G.score += d.type === 'both' ? 120 : 55;
        ui.killfeed(d.type === 'health' ? 'Đã nhận <b>MED-CHARGE</b>' : d.type === 'ammo' ? 'Đã nhận <b>AMMO CACHE</b>' : 'Đã nhận <b>FIELD SUPPLY</b>');
        scene.remove(d.mesh); d.mesh.geometry.dispose(); pickups.splice(i, 1);
      } else if (d.life <= 0) {
        scene.remove(d.mesh); d.mesh.geometry.dispose(); pickups.splice(i, 1);
      }
    }
  }

  const UPGRADE_POOL = [
    { id:'overclock', title:'Overclock Core', rarity:'rare', desc:'Sát thương vũ khí và kỹ năng +15%.' },
    { id:'reinforced', title:'Reinforced Plating', rarity:'common', desc:'Tăng 25 máu tối đa và hồi 25 máu.' },
    { id:'gyro', title:'Gyro Stabilizer', rarity:'common', desc:'Tốc độ di chuyển +8%, hồi chiêu kỹ năng nhanh hơn 10%.' },
    { id:'fast-hands', title:'Combat Reflex', rarity:'rare', desc:'Tốc độ bắn +10%, tốc độ nạp đạn +18%.' },
    { id:'scavenger', title:'Field Scavenger', rarity:'common', desc:'Bổ sung đạn dự trữ và hồi 20 máu.' },
    { id:'surge', title:'Capacitor Surge', rarity:'rare', desc:'Giảm 12% thời gian hồi Q, E và F.' },
    { id:'critical', title:'Critical Protocol', rarity:'epic', desc:'Tăng sát thương gây ra thêm 20%.' },
    { id:'vampiric', title:'Vampiric Core', rarity:'epic', desc:'Hồi 2 máu khi hạ gục kẻ địch.' },
    { id:'last-stand', title:'Last Stand', rarity:'legendary', desc:'Sát thương vũ khí và kỹ năng +25%.' }
  ];
  let offeredUpgradeIds = [];
  function presentUpgradeChoice() {
    const weights = { common:55, rare:28, epic:14, legendary:3 };
    const available = UPGRADE_POOL.filter(x => !offeredUpgradeIds.includes(x.id));
    const pool = (available.length >= 3 ? available : UPGRADE_POOL).slice();
    const picks = [];
    while (picks.length < 3 && pool.length) {
      const total = pool.reduce((sum,x) => sum + weights[x.rarity],0);
      let roll = SkywardRNG.random('gameplay')*total, chosen = pool[0];
      for (const item of pool) { roll -= weights[item.rarity]; if (roll <= 0) { chosen=item; break; } }
      picks.push(chosen); pool.splice(pool.indexOf(chosen),1);
    }
    ui.showUpgrade(picks, (id) => {
      offeredUpgradeIds.push(id);
      const upgrade = UPGRADE_POOL.find(x => x.id === id);
      if (id === 'overclock') player.mods.damage *= 1.15;
      else if (id === 'reinforced') { player.maxHealth += 25; player.heal(25); }
      else if (id === 'gyro') { player.mods.speed *= 1.08; player.mods.cooldown *= 0.9; }
      else if (id === 'fast-hands') { player.mods.fireRate = (player.mods.fireRate || 1) * 1.1; player.mods.reloadSpeed = (player.mods.reloadSpeed || 1) * 1.18; }
      else if (id === 'scavenger') { WEAPON_ORDER.forEach(k => weapons.state[k].reserve = Math.min(WEAPONS[k].reserve * 2, weapons.state[k].reserve + WEAPONS[k].mag * 2)); player.heal(20); }
      else if (id === 'surge') player.mods.cooldown *= 0.88;
      else if (id === 'critical') player.mods.damage *= 1.20;
      else if (id === 'vampiric') player.mods.vampiric = (player.mods.vampiric || 0) + 2;
      else if (id === 'last-stand') player.mods.damage *= 1.25;
      ui.killfeed('Đã cài <b>' + (upgrade ? upgrade.title : 'MODULE') + '</b>');
      waves.continueAfterUpgrade();
    });
  }

  function awardProgression(victory) {
    const xp = Math.max(10, Math.floor(G.score / 100) + G.kills * 4 + (victory ? 50 : 10));
    G.xpEarned = xp;
    progression.xp += xp; progression.runs++; progression.kills += G.kills;
    if (victory) progression.wins++;
    progression.bestWave = Math.max(progression.bestWave, G.wave);
    let leveled = false;
    while (progression.xp >= progression.level * 250) {
      progression.xp -= progression.level * 250; progression.level++; leveled = true;
    }
    const achievements = [
      { id: 'first-kill', ok: progression.kills >= 1, xp: 40 },
      { id: 'ten-kills', ok: progression.kills >= 10, xp: 75 },
      { id: 'first-win', ok: progression.wins >= 1, xp: 100 },
      { id: 'wave-ten', ok: progression.bestWave >= 10, xp: 120 }
    ];
    achievements.forEach(a => { if (a.ok && progression.achievements.indexOf(a.id) < 0) { progression.achievements.push(a.id); progression.xp += a.xp; G.xpEarned += a.xp; } });
    while (progression.xp >= progression.level * 250) { progression.xp -= progression.level * 250; progression.level++; leveled = true; }
    saveProgression(); ui.updateProgression(progression); ui._buildCards(); weapons.setCosmeticLevel(progression.level);
    if (leveled) ui.killfeed('<b>LEVEL UP</b> · KỸ SƯ LV.' + progression.level);
    return xp;
  }

  // ---------- input ----------
  let triggerDown = false;
  let dragging = false;
  let locked = false;
  let pendingTouchMoveRecord = null;
  let replayCheckpointFrame = 0;

  function recordInput(action, data) {
    if (replay.isRecording()) return replay.recordInput(action, data || {});
    return false;
  }

  function applyTouchAction(action, pressed) {
    if (pressed) {
      if (action === 'sprint') player.keys.add('ShiftLeft');
      else if (action === 'fire') triggerDown = true;
      else if (action === 'aim') weapons.setAiming(true);
      else if (action === 'jump' && player.onGround && !player.dead) {
        player.vel.y = player.jumpVelocity; player.onGround = false; Sound.jump();
      } else if (action === 'reload') weapons.startReload();
      else if (action === 'dash') { if (player.tryDash()) Sound.dash(); }
      else if (action === 'grenade') weapons.throwGrenade();
      else if (action === 'strike') weapons.callSuper();
      else if (action === 'cycle') weapons.cycle(1);
    } else {
      if (action === 'sprint') player.keys.delete('ShiftLeft');
      else if (action === 'fire') triggerDown = false;
      else if (action === 'aim') weapons.setAiming(false);
    }
  }

  function applyReplayInput(input) {
    const data = input.data || {};
    const action = input.action;
    const replayVersion = replay.status().version || 1;
    if (action === 'key-down') {
      const code = data.code;
      if (!code) return;
      if (!(replayVersion >= 2 && G.state === 'paused' && code === 'KeyP')) player.keys.add(code);
      if (code === 'KeyR') weapons.startReload();
      else if (code === 'KeyX') weapons.inspect();
      else if (code === 'KeyQ') { if (player.tryDash()) { Sound.dash(); particles.burst(player.pos.clone(), { count: 16, color: [0.5, 0.8, 1], speed: 5, life: 0.4, gravity: 1 }); } }
      else if (code === 'KeyE') weapons.throwGrenade();
      else if (code === 'KeyF') weapons.callSuper();
      else if (code === 'Digit1') weapons.switchWeapon('auto');
      else if (code === 'Digit2') weapons.switchWeapon('handcannon');
      else if (code === 'Digit3') weapons.switchWeapon('scout');
      else if (code === 'KeyP' && replayVersion === 1) {
        if (G.state === 'playing') pauseGame('legacy-keyboard');
        else if (G.state === 'paused') resumeGame('legacy-keyboard');
      } else if (code === 'Space' && player.onGround && !player.dead) {
        player.vel.y = player.jumpVelocity; player.onGround = false; Sound.jump();
      }
    } else if (action === 'key-up') {
      if (data.code) player.keys.delete(data.code);
    } else if (action === 'look') {
      player.look(Number(data.dx) || 0, Number(data.dy) || 0);
    } else if (action === 'mouse-down') {
      if (data.button === 0) { triggerDown = true; dragging = true; }
      else if (data.button === 2) weapons.setAiming(true);
    } else if (action === 'mouse-up') {
      if (data.button === 0) { triggerDown = false; dragging = false; }
      else if (data.button === 2) weapons.setAiming(false);
    } else if (action === 'touch-move') {
      player.touchMove.x = Math.max(-1, Math.min(1, Number(data.x) || 0));
      player.touchMove.y = Math.max(-1, Math.min(1, Number(data.y) || 0));
    } else if (action === 'touch-action-down') {
      applyTouchAction(data.action, true);
    } else if (action === 'touch-action-up') {
      applyTouchAction(data.action, false);
    } else if (action === 'game-pause') {
      pauseGame(data.source || 'replay');
    } else if (action === 'game-resume') {
      resumeGame(data.source || 'replay');
    }
  }

  function playReplay(input) {
    const tape = replay.load(input), meta = tape.metadata || {};
    if (!MISSIONS.some(item => item.id === meta.mission)) throw new Error('Replay references an unknown mission');
    if (!CLASSES.some(item => item.id === meta.class)) throw new Error('Replay references an unknown class');
    if (meta.weapon && ['auto', 'handcannon', 'scout'].indexOf(meta.weapon) < 0) throw new Error('Replay references an unknown weapon');
    if (G.state !== 'menu') toMenu();
    G.mission = MISSIONS.find(item => item.id === meta.mission);
    G.cls = CLASSES.find(item => item.id === meta.class);
    startRound(); return replay.status();
  }

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    lockHint();
    if (!locked && G.state === 'playing' && !touchCapable && !replay.isPlaying()) pauseGame('pointer-lock-lost');
  });

  document.addEventListener('mousemove', (e) => {
    if (G.state !== 'playing' || replay.isPlaying()) return;
    if (locked || dragging) {
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      if (dx || dy) { recordInput('look', { dx, dy }); player.look(dx, dy); }
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (G.state !== 'playing' || replay.isPlaying()) return;
    recordInput('mouse-down', { button: e.button });
    Sound.unlock();
    if (e.button === 0) {
      triggerDown = true;
      dragging = true;
      if (!locked) canvas.requestPointerLock && canvas.requestPointerLock();
    } else if (e.button === 2) {
      weapons.setAiming(true);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (replay.isPlaying()) return;
    if (replay.isRecording()) recordInput('mouse-up', { button: e.button });
    if (e.button === 0) { triggerDown = false; dragging = false; }
    else if (e.button === 2) weapons.setAiming(false);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (replay.isPlaying()) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

    if (G.state === 'playing') {
      if (!e.repeat) recordInput('key-down', { code: e.code });
      player.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'KeyR') weapons.startReload();
        else if (e.code === 'KeyX') weapons.inspect();
        else if (e.code === 'KeyQ') { if (player.tryDash()) { Sound.dash(); particles.burst(player.pos.clone(), { count: 16, color: [0.5, 0.8, 1], speed: 5, life: 0.4, gravity: 1 }); } }
        else if (e.code === 'KeyE') weapons.throwGrenade();
        else if (e.code === 'KeyF') weapons.callSuper();
        else if (e.code === 'Digit1') weapons.switchWeapon('auto');
        else if (e.code === 'Digit2') weapons.switchWeapon('handcannon');
        else if (e.code === 'Digit3') weapons.switchWeapon('scout');
        else if (e.code === 'Space') { if (player.onGround && !player.dead) { player.vel.y = player.jumpVelocity; player.onGround = false; Sound.jump(); } }
        else if (e.code === 'KeyP') pauseGame('keyboard');
      }
    } else if (G.state === 'paused' && e.code === 'KeyP') {
      recordInput('key-down', { code: e.code });
      resumeGame('keyboard');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (replay.isPlaying()) return;
    if (replay.isRecording()) recordInput('key-up', { code: e.code });
    player.keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    if (replay.isPlaying()) return;
    releaseAllInputs();
    if (G.state === 'playing') pauseGame('window-blur');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (replay.isPlaying()) return;
      benchmarkRecorder.stop('document-hidden');
      releaseAllInputs();
      if (G.state === 'playing') pauseGame('visibility-hidden');
    }
  });
  window.addEventListener('pagehide', () => {
    if (replay.isPlaying()) return;
    benchmarkRecorder.stop('pagehide');
    releaseAllInputs();
    if (G.state === 'playing') pauseGame('pagehide');
  });
  window.addEventListener('skyward-native-pause', () => {
    if (replay.isPlaying()) return;
    benchmarkRecorder.stop('android-native-pause');
    releaseAllInputs();
    if (G.state === 'playing') pauseGame('android-native-pause');
  });
  window.addEventListener('skyward-native-resume', () => {
    resizeGameRenderer();
  });
  window.addEventListener('skyward-native-back', () => {
    if (replay.isPlaying()) return;
    benchmarkRecorder.stop('android-native-back');
    if (G.state === 'playing') pauseGame('android-native-back');
  });

  // Khôi phục WebGL context trên Android; pause ngay khi GPU reset.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (replay.isPlaying()) return;
    benchmarkRecorder.stop('webgl-context-lost');
    releaseAllInputs();
    if (G.state === 'playing') pauseGame('webgl-context-lost');
  });
  canvas.addEventListener('webglcontextrestored', () => { location.reload(); });

  function resizeGameRenderer() {
    const viewport = getViewportSize();
    const nextProfile = getRendererProfile();
    const current = adaptiveResolution.snapshot();
    if (Math.abs(nextProfile.maxScale - current.maxScale) > 0.001 ||
        Math.abs(nextProfile.minScale - current.minScale) > 0.001) {
      adaptiveResolution.setMaxScale(nextProfile.maxScale, nextProfile.minScale);
    }
    rendererProfile = nextProfile;
    const resolution = adaptiveResolution.snapshot();
    if (Math.abs(resolution.scale - current.scale) > 0.001) {
      renderer.setPixelRatio(resolution.scale);
    }
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height);
  }
  window.addEventListener('resize', resizeGameRenderer, { passive: true });
  window.addEventListener('orientationchange', resizeGameRenderer, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeGameRenderer, { passive: true });
  }

  // ---------- mobile / touch input ----------
  const touchControls = document.getElementById('touch-controls');
  const touchStick = document.getElementById('touch-stick');
  const touchKnob = document.getElementById('touch-stick-knob');
  if (touchControls && touchCapable) touchControls.classList.remove('hidden');

  // ---------- custom HUD editor ----------
  let hudEditMode = false;
  let hudWasPaused = false;
  let hudSetupMode = false;
  const HUD_LAYOUT_KEY = 'skyward_hud_layout_v2';
  const hudEditable = touchControls ? Array.from(touchControls.querySelectorAll('[data-touch], #touch-stick, #touch-look-zone')) : [];
  let hudLayout = {};
  try { hudLayout = JSON.parse(localStorage.getItem(HUD_LAYOUT_KEY) || '{}') || {}; } catch (e) { hudLayout = {}; }
  const hudSetupBar = document.createElement('section');
  hudSetupBar.id = 'hud-setup-bar'; hudSetupBar.className = 'hidden';
  hudSetupBar.innerHTML = '<div class="hud-setup-copy"><b>HUD SETUP</b><span>Kéo thả các nút để sắp xếp theo thói quen của bạn.</span></div><div class="hud-setup-actions"><button id="hud-setup-edit">CHỈNH BỐ CỤC</button><button id="hud-setup-start" class="primary">START MISSION →</button><button id="hud-setup-back">QUAY LẠI</button></div>';
  if (touchControls) touchControls.appendChild(hudSetupBar);
  const hudEditor = document.createElement('section');
  hudEditor.id = 'hud-editor-panel';
  hudEditor.className = 'hidden';
  hudEditor.innerHTML = '<h3>CUSTOM HUD</h3><div class="hud-edit-row"><label>Kích thước</label><input id="hud-size" type="range" min="60" max="160" value="100"><output id="hud-size-val">100%</output></div><div class="hud-edit-row"><label>Độ trong suốt</label><input id="hud-opacity" type="range" min="20" max="100" value="85"><output id="hud-opacity-val">85%</output></div><div class="hud-edit-actions"><button id="hud-reset">RESET</button><button id="hud-cancel">CANCEL</button><button id="hud-save" class="primary">SAVE</button></div><p class="hud-edit-tip">Kéo trực tiếp nút trên màn hình để đổi vị trí. Chọn nút để chỉnh kích thước và độ trong suốt.</p>';
  if (touchControls) touchControls.appendChild(hudEditor);
  const sizeSlider = hudEditor.querySelector('#hud-size'), opacitySlider = hudEditor.querySelector('#hud-opacity');
  let selectedHud = null, hudSnapshot = null;
  function hudKey(el) { return el.id || el.dataset.touch || 'look'; }
  const hudDefaultLayout = {};
  const hudBaseStyles = new Map();
  const hudOriginalStyles = new Map();
  const hudActions = touchControls ? touchControls.querySelector('#touch-actions') : null;
  const hudActionsBaseStyle = hudActions ? hudActions.style.cssText : '';
  let hudActionsOriginalStyle = '';
  function itemCenter(el) {
    const r=el.getBoundingClientRect(), p=touchControls.getBoundingClientRect();
    return {x:((r.left+r.width/2-p.left)/p.width)*100,y:((r.top+r.height/2-p.top)/p.height)*100};
  }
  function applyHudItem(el,data) {
    if(!data)return;
    el.style.position='absolute';
    el.style.left=data.x+'%'; el.style.top=data.y+'%';
    el.style.right='auto'; el.style.bottom='auto';
    el.style.transform='translate(-50%,-50%)';
    el.style.width=(data.baseW*data.scale)+'px';
    el.style.height=(data.baseH*data.scale)+'px';
    el.style.opacity=data.opacity == null ? 0.85 : data.opacity;
  }
  function selectHud(el) {
    if(selectedHud)selectedHud.classList.remove('hud-selected');
    selectedHud=el; el.classList.add('hud-selected');
    const data=hudLayout[hudKey(el)]||hudDefaultLayout[hudKey(el)];
    sizeSlider.value=Math.round((data.scale||1)*100);
    opacitySlider.value=Math.round((data.opacity == null ? 0.85 : data.opacity)*100);
    hudEditor.querySelector('#hud-size-val').textContent=sizeSlider.value+'%';
    hudEditor.querySelector('#hud-opacity-val').textContent=opacitySlider.value+'%';
  }
  function updateSelectedHud() {
    if(!selectedHud)return;
    const k=hudKey(selectedHud), old=hudLayout[k]||hudDefaultLayout[k];
    const data={...old,scale:Number(sizeSlider.value)/100,opacity:Number(opacitySlider.value)/100};
    hudLayout[k]=data; applyHudItem(selectedHud,data);
    hudEditor.querySelector('#hud-size-val').textContent=sizeSlider.value+'%';
    hudEditor.querySelector('#hud-opacity-val').textContent=opacitySlider.value+'%';
  }
  function enterHudEdit(fromSetup) {
    if (!touchControls || (G.state!=='playing' && G.state!=='paused' && G.state!=='setup') || hudEditMode) return;
    hudWasPaused = G.state === 'paused';
    if (fromSetup) { hudSetupMode = true; hudSetupBar.classList.add('hidden'); }
    const settingsScreen = document.getElementById('settings-screen');
    if (settingsScreen) settingsScreen.classList.add('hidden');
    hudSnapshot=JSON.stringify(hudLayout);
    hudOriginalStyles.clear();

    // HUD is display:none at boot. Restore native CSS before measuring visible controls.
    hudEditable.forEach(el=>{
      hudOriginalStyles.set(el,el.style.cssText);
      el.style.cssText = hudBaseStyles.get(el) || '';
    });
    if (hudActions) {
      hudActionsOriginalStyle = hudActions.style.cssText;
      hudActions.style.cssText = hudActionsBaseStyle;
    }
    touchControls.getBoundingClientRect();

    hudEditable.forEach(el=>{
      const k=hudKey(el), rect=el.getBoundingClientRect(), center=itemCenter(el);
      const base={x:center.x,y:center.y,scale:1,opacity:.85,baseW:rect.width,baseH:rect.height};
      hudDefaultLayout[k]=base;
      const saved=JSON.parse(hudSnapshot||'{}')[k];
      const data=saved ? {...base,...saved,baseW:base.baseW,baseH:base.baseH} : {...base};
      hudLayout[k]={...data};
      el.dataset.hudBaseW=rect.width; el.dataset.hudBaseH=rect.height;
      el.dataset.hudEditable='1';
    });
    if (hudActions) hudActions.style.position = 'static';
    hudEditable.forEach(el=>applyHudItem(el,hudLayout[hudKey(el)]));
    hudEditMode=true;
    triggerDown=false; player.touchMove.x=0; player.touchMove.y=0; weapons.setAiming(false);
    touchControls.classList.add('hud-editing'); hudEditor.classList.remove('hidden');
    if (hudEditable.length) selectHud(hudEditable[0]);
  }
  function exitHudEdit(save) {
    if (!hudEditMode) return;
    if (save) { try { localStorage.setItem(HUD_LAYOUT_KEY,JSON.stringify(hudLayout)); } catch(e){} }
    else {
      hudLayout=JSON.parse(hudSnapshot||'{}');
      hudEditable.forEach(el=>{el.style.cssText=hudOriginalStyles.get(el)||'';});
      if (hudActions) hudActions.style.cssText = hudActionsOriginalStyle;
    }
    hudEditMode=false; touchControls.classList.remove('hud-editing'); hudEditor.classList.add('hidden');
    hudEditable.forEach(el=>{delete el.dataset.hudEditable;el.classList.remove('hud-selected');});
    selectedHud=null;
    if (hudWasPaused) ui.show('pause', true);
    if (hudSetupMode) hudSetupBar.classList.remove('hidden');
    hudWasPaused = false;
  }
  if (touchControls) {
    // Capture inline baselines only; measure geometry lazily when HUD is visible.
    hudEditable.forEach(el=>hudBaseStyles.set(el,el.style.cssText));
    hudEditable.forEach(el=>{
      const key=hudKey(el);
      el.addEventListener('pointerdown',e=>{
        if(!hudEditMode || (e.pointerType!=='touch' && e.pointerType!=='pen')) return;
        e.preventDefault(); e.stopImmediatePropagation(); selectHud(el);
        try{el.setPointerCapture(e.pointerId);}catch(err){}
        const parent=touchControls.getBoundingClientRect(), startX=e.clientX, startY=e.clientY;
        const current=hudLayout[key] || {x:((el.getBoundingClientRect().left+el.offsetWidth/2-parent.left)/parent.width)*100,y:((el.getBoundingClientRect().top+el.offsetHeight/2-parent.top)/parent.height)*100,scale:1,opacity:.85,baseW:Number(el.dataset.hudBaseW),baseH:Number(el.dataset.hudBaseH)};
        const move=ev=>{
          if(ev.pointerId!==e.pointerId)return;
          ev.preventDefault();
          const w=el.getBoundingClientRect().width, h=el.getBoundingClientRect().height;
          const minX=(w/2)/parent.width*100, maxX=100-minX;
          const minY=(h/2)/parent.height*100, maxY=100-minY;
          const x=Math.max(minX,Math.min(maxX,current.x+(ev.clientX-startX)/parent.width*100));
          const y=Math.max(minY,Math.min(maxY,current.y+(ev.clientY-startY)/parent.height*100));
          hudLayout[key]={...current,x,y};applyHudItem(el,hudLayout[key]);
        };
        const end=ev=>{if(ev.pointerId!==e.pointerId)return;el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);};
        el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
      },true);
      el.addEventListener('click',e=>{if(hudEditMode){e.preventDefault();e.stopImmediatePropagation();selectHud(el);}},true);
    });
  }
  hudSetupBar.querySelector('#hud-setup-edit').addEventListener('click', () => { hudSetupBar.classList.add('hidden'); enterHudEdit(true); });
  hudSetupBar.querySelector('#hud-setup-start').addEventListener('click', () => startRound());
  hudSetupBar.querySelector('#hud-setup-back').addEventListener('click', () => {
    hudSetupMode = false; hudSetupBar.classList.add('hidden'); touchControls.classList.add('hidden');
    ui.el.hud.classList.add('hidden'); G.state = 'menu'; ui.show('menu');
  });
  const settingsHudBtn = document.getElementById('btn-custom-hud');
  if(settingsHudBtn) settingsHudBtn.addEventListener('click', () => {
    if (G.state === 'paused' || G.state === 'playing') enterHudEdit();
    else {
      const note = document.getElementById('hud-setting-note');
      if (note) note.textContent = 'Dùng HUD Setup trước trận để sắp xếp bố cục điều khiển.';
    }
  });
  sizeSlider.addEventListener('input',updateSelectedHud); opacitySlider.addEventListener('input',updateSelectedHud);
  hudEditor.querySelector('#hud-save').addEventListener('click',()=>exitHudEdit(true));
  hudEditor.querySelector('#hud-cancel').addEventListener('click',()=>exitHudEdit(false));
  hudEditor.querySelector('#hud-reset').addEventListener('click',()=>{
    hudLayout={};
    hudEditable.forEach(el=>{const key=hudKey(el);hudLayout[key]={...hudDefaultLayout[key]};applyHudItem(el,hudLayout[key]);});
    if(hudEditable.length)selectHud(hudEditable[0]);
  });

  let stickPointer = null, lookPointer = null, lookX = 0, lookY = 0;
  const touchPointerSets = new Map();
  function releaseAllInputs() {
    pendingTouchMoveRecord = null;
    player.keys.clear();
    triggerDown = false;
    dragging = false;
    player.touchMove.x = 0;
    player.touchMove.y = 0;
    weapons.setAiming(false);
    stickPointer = null;
    lookPointer = null;
    lookX = 0;
    lookY = 0;
    pendingLookX = 0;
    pendingLookY = 0;
    touchPointerSets.forEach(set => set.clear());
    if (touchControls) touchControls.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
    if (touchKnob) touchKnob.style.transform = 'translate(-50%,-50%)';
    if (lookZone) lookZone.classList.remove('looking');
  }
  // Accumulate touch-look movement and apply it once per rendered frame.
  // This avoids camera micro-stutter when Android/WebView emits uneven pointermove bursts.
  let pendingLookX = 0, pendingLookY = 0;
  if (touchStick) {
    touchStick.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (hudEditMode || G.state !== 'playing' || stickPointer !== null) return;
      e.preventDefault(); stickPointer = e.pointerId;
      try { touchStick.setPointerCapture(e.pointerId); } catch (err) {}
      updateStick(e);
    });
    touchStick.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickPointer) { e.preventDefault(); updateStick(e); }
    });
    const endStick = (e) => {
      if (e.pointerId !== stickPointer) return;
      stickPointer = null; player.touchMove.x = 0; player.touchMove.y = 0;
      pendingTouchMoveRecord = { x: 0, y: 0 };
      touchKnob.style.transform = 'translate(-50%,-50%)';
    };
    touchStick.addEventListener('pointerup', endStick);
    touchStick.addEventListener('pointercancel', endStick);
    touchStick.addEventListener('lostpointercapture', endStick);
    window.addEventListener('pointerup', endStick);
    window.addEventListener('pointercancel', endStick);
  }
  function updateStick(e) {
    if (G.state !== 'playing' || replay.isPlaying()) { player.touchMove.x = 0; player.touchMove.y = 0; return; }
    const r = touchStick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const max = r.width * 0.34;
    const len = Math.hypot(dx, dy); if (len > max) { dx *= max / len; dy *= max / len; }
    player.touchMove.x = dx / max; player.touchMove.y = dy / max;
    pendingTouchMoveRecord = { x: player.touchMove.x, y: player.touchMove.y };
    touchKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  // Dedicated look surface: controls and camera gestures never compete for
  // the same pointer. Each finger keeps its own pointerId through capture.
  const lookZone = document.getElementById('touch-look-zone');
  if (lookZone) {
    lookZone.addEventListener('pointerdown', (e) => {
      if (hudEditMode || replay.isPlaying() || (e.pointerType !== 'touch' && e.pointerType !== 'pen') || G.state !== 'playing' || lookPointer !== null) return;
      e.preventDefault();
      lookPointer = e.pointerId; lookX = e.clientX; lookY = e.clientY;
      try { lookZone.setPointerCapture(e.pointerId); } catch (err) {}
      lookZone.classList.add('looking');
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (replay.isPlaying() || e.pointerId !== lookPointer || G.state !== 'playing') return;
      e.preventDefault();
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      const samples = events && events.length ? events : [e];
      let dx = 0, dy = 0;
      for (const sample of samples) {
        dx += sample.clientX - lookX;
        dy += sample.clientY - lookY;
        lookX = sample.clientX;
        lookY = sample.clientY;
      }
      pendingLookX += dx;
      pendingLookY += dy;
    });
    const endLook = (e) => {
      if (e.pointerId !== lookPointer) return;
      lookPointer = null; lookX = 0; lookY = 0;
      pendingLookX = 0; pendingLookY = 0;
      lookZone.classList.remove('looking');
    };
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);
    lookZone.addEventListener('lostpointercapture', endLook);
    window.addEventListener('pointerup', endLook);
    window.addEventListener('pointercancel', endLook);
  }
  if (touchControls) {
    touchControls.querySelectorAll('[data-touch]').forEach(btn => {
      const action = btn.dataset.touch;
      const activePointers = new Set();
      touchPointerSets.set(btn, activePointers);
      btn.addEventListener('pointerdown', (e) => {
        if (hudEditMode || replay.isPlaying() || (e.pointerType !== 'touch' && e.pointerType !== 'pen') || activePointers.size) return;
        e.preventDefault();
        activePointers.add(e.pointerId);
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        btn.classList.add('pressed');
        if (G.state !== 'playing') return;
        if (action === 'pause') { pauseGame('touch-control'); return; }
        recordInput('touch-action-down', { action: action });
        applyTouchAction(action, true);
      });
      const release = (e) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.delete(e.pointerId);
        if (activePointers.size) return;
        btn.classList.remove('pressed');
        if (!replay.isPlaying() && G.state === 'playing') {
          recordInput('touch-action-up', { action: action });
          applyTouchAction(action, false);
        }
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // ---------- lock hint ----------
  const lockHintEl = document.createElement('div');
  lockHintEl.style.cssText = 'position:absolute;left:50%;top:60%;transform:translateX(-50%);z-index:25;' +
    'background:rgba(8,16,22,.8);border:1px solid rgba(143,208,255,.3);border-radius:9px;' +
    'padding:10px 18px;font-size:12px;letter-spacing:.14em;color:#e8f2f8;display:none;pointer-events:none;';
  lockHintEl.textContent = 'NHẤP VÀO MÀN HÌNH ĐỂ KHÓA CHUỘT';
  document.getElementById('hud').appendChild(lockHintEl);

  function lockHint() {
    lockHintEl.style.display = (!touchCapable && G.state === 'playing' && !locked) ? 'block' : 'none';
  }

  // ---------- máy trạng thái ----------
  function startRound() {
    const playbackTape = replay.isReady() ? replay.getTape() : null;
    replayCheckpointFrame = 0;
    pendingTouchMoveRecord = null;
    pendingLookX = 0; pendingLookY = 0;
    if (playbackTape) {
      const meta = playbackTape.metadata || {};
      const replayMission = MISSIONS.find(item => item.id === meta.mission);
      const replayClass = CLASSES.find(item => item.id === meta.class);
      if (replayMission) G.mission = replayMission;
      if (replayClass) G.cls = replayClass;
      activeRunSeed = rng.reset(playbackTape.seed);
      replay.startPlayback();
    } else {
      activeRunSeed = rng.reset(configuredSeed === null ? rng.createSeed() : configuredSeed);
      replay.start(activeRunSeed, {
        mission: G.mission.id,
        class: G.cls.id,
        weapon: 'auto',
        input: 'keyboard-mouse+touch',
        inputSchema: 2,
        viewport: { width: Math.round(getViewportSize().width), height: Math.round(getViewportSize().height) },
        devicePixelRatio: window.devicePixelRatio || 1,
        touchCapable: !!touchCapable
      });
    }
    if (hudSetupMode) { hudSetupMode = false; hudSetupBar.classList.add('hidden'); }
    Sound.unlock();
    Music.init();
    Music.setScene('combat');
    ui.hideAll();
    ui.el.hud.classList.remove('hidden');
    player.reset(world);
    weapons.reset();
    if (playbackTape && playbackTape.metadata && ['auto', 'handcannon', 'scout'].indexOf(playbackTape.metadata.weapon) >= 0) {
      weapons.switchWeapon(playbackTape.metadata.weapon);
    }
    waves.clearAll(); clearPickups(); ui.hideUpgrade();
    world.setMood(G.mission.mood); if (world.setMap) world.setMap(G.mission.id);
    G.state = 'playing';
    events.emit('run:started', { seed: activeRunSeed, mission: G.mission.id, class: G.cls.id, weapon: weapons.current });
    G.score = 0; G.kills = 0;
    G.shotsFired = 0; G.shotsHit = 0;
    G.wave = 0; G.totalWaves = G.mission.mods.endless ? Infinity : (G.mission.mods.waveCount || 3); G.elapsed = 0; G.timeLeft = 0;
    G.combo = 0; G.multiplier = 1; G.comboTimer = 0; G.xpEarned = 0;
    offeredUpgradeIds = [];
    G.overTimer = 0; G.timeScale = 1;
    G.victory = false; G.newBest = false;
    player.mods = Object.assign({}, G.cls.mods);
    player.maxHealth = Math.round(100 * G.cls.mods.maxHp);
    player.health = player.maxHealth;
    waves.start(G.mission.mods);
    ui.syncSelection(G.mission.id, G.cls.id);
    ui.waveBanner('BẮT ĐẦU', G.mission.title.toUpperCase());
    lockHint();
    if (!touchCapable && !replay.isPlaying()) canvas.requestPointerLock && canvas.requestPointerLock();
  }

  function prepareHudSetup() {
    if (!touchCapable) { startRound(); return; }
    G.state = 'setup'; triggerDown = false; dragging = false; player.keys.clear();
    player.touchMove.x = 0; player.touchMove.y = 0;
    ui.hideAll(); ui.el.hud.classList.remove('hidden'); touchControls.classList.remove('hidden');
    hudSetupMode = true; hudSetupBar.classList.remove('hidden'); enterHudEdit(true);
  }

  function pauseGame(source) {
    if (G.state !== 'playing') return;
    recordInput('game-pause', { source: source || 'manual' });
    benchmarkRecorder.stop('game-paused');
    G.state = 'paused';
    events.emit('game:paused', { mission: G.mission.id, wave: G.wave });
    releaseAllInputs();
    ui.show('pause', true);
    if (document.exitPointerLock) document.exitPointerLock();
    lockHint();
  }

  function resumeGame(source) {
    if (G.state !== 'paused') return;
    recordInput('game-resume', { source: source || 'manual' });
    G.state = 'playing';
    events.emit('game:resumed', { mission: G.mission.id, wave: G.wave });
    ui.hideAll();
    lockHint();
    if (!touchCapable && !replay.isPlaying()) canvas.requestPointerLock && canvas.requestPointerLock();
  }

  function toMenu() {
    if (G.state === 'playing' || G.state === 'paused') {
      replay.finish({ abandoned: true, mission: G.mission.id, wave: G.wave });
      events.emit('run:abandoned', { mission: G.mission.id, wave: G.wave, elapsed: Number(G.elapsed.toFixed(3)) });
    }
    G.state = 'menu';
    triggerDown = false; dragging = false; player.keys.clear();
    player.touchMove.x = 0; player.touchMove.y = 0; weapons.setAiming(false);
    waves.clearAll(); clearPickups(); ui.hideUpgrade(); weapons.reset();
    Music.setScene('menu');
    ui.hideAll();
    ui.el.hud.classList.add('hidden');
    ui.show('menu');
    ui.syncSelection(G.mission.id, G.cls.id);
    ui.setBest(G.best);
    weapons.setCosmeticLevel(progression.level);
    if (document.exitPointerLock) document.exitPointerLock();
    lockHint();
  }

  function endRound(victory) {
    if (G.state !== 'playing') return;
    G.victory = victory;
    G.state = 'over';
    events.emit('run:completed', { victory: !!victory, mission: G.mission.id, score: G.score, kills: G.kills, wave: G.wave, elapsed: Number(G.elapsed.toFixed(3)) });
    replay.finish({ victory: !!victory, mission: G.mission.id, score: G.score, kills: G.kills, wave: G.wave, elapsed: Number(G.elapsed.toFixed(3)) });
    triggerDown = false; dragging = false; player.keys.clear();
    player.touchMove.x = 0; player.touchMove.y = 0; weapons.setAiming(false);
    Music.setScene('menu');
    if (document.exitPointerLock) document.exitPointerLock();

    const acc = G.shotsFired > 0 ? Math.round((G.shotsHit / G.shotsFired) * 100) : 0;
    const t = G.elapsed;
    const timeStr = fmtTime(t);
    G.newBest = G.score > G.best;
    awardProgression(victory);
    clearPickups(); ui.hideUpgrade(); weapons.reset();
    if (G.newBest) {
      G.best = G.score;
      try { localStorage.setItem(BEST_KEY, String(G.best)); } catch (e) {}
    }
    if (victory) Sound.win(); else Sound.gameover();
    ui.showGameOver({
      victory: victory,
      score: G.score,
      kills: G.kills,
      time: timeStr,
      accuracy: acc,
      rank: computeRank(victory, G.score, acc, t),
      newBest: G.newBest, xpEarned: G.xpEarned, level: progression.level
    });
    ui.setBest(G.best);
    weapons.setCosmeticLevel(progression.level);
    lockHint();
  }

  function computeRank(victory, score, acc, timeSec) {
    if (victory) {
      if (acc >= 55 && timeSec <= 200) return 'S';
      if (acc >= 40) return 'A';
      return 'B';
    }
    if (score >= 2000) return 'B';
    if (score >= 1000) return 'C';
    return 'D';
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  // ---------- hiệu ứng môi trường thụ động (khói đài thọ, bụi gió) ----------
  const wreckSmokeA = new THREE.Vector3(28, 3.8, 22);
  const wreckSmokeB = new THREE.Vector3(-26, 3.4, 18);
  let smokeTimer = 0;
  let dustTimer = 0;
  const dustPos = new THREE.Vector3();
  const dustVel = new THREE.Vector3();

  function updateAmbient(dt) {
    if (!vfx) return;
    smokeTimer -= dt;
    if (smokeTimer <= 0) {
      smokeTimer = 0.22;
      const base = SkywardRNG.random('vfx') < 0.5 ? wreckSmokeA : wreckSmokeB;
      dustPos.set(base.x + (SkywardRNG.random('vfx') - 0.5) * 0.6, base.y, base.z + (SkywardRNG.random('vfx') - 0.5) * 0.6);
      vfx.smoke(dustPos, {
        size: 1.5 + SkywardRNG.random('vfx') * 0.8, grow: 1.9, rise: 1.3,
        life: 2.6 + SkywardRNG.random('vfx'), color: 0x3c3a37, opacity: 0.26
      });
    }
    // bụi trôi trên sân
    dustTimer -= dt;
    if (dustTimer <= 0) {
      dustTimer = 0.09;
      const a = SkywardRNG.random('vfx') * Math.PI * 2;
      const r = 6 + SkywardRNG.random('vfx') * 44;
      dustPos.set(Math.cos(a) * r, 0.3 + SkywardRNG.random('vfx') * 1.6, Math.sin(a) * r);
      dustVel.set(2.2 + SkywardRNG.random('vfx') * 2.4, 0.15 + SkywardRNG.random('vfx') * 0.3, (SkywardRNG.random('vfx') - 0.5) * 1.2);
      dustParticles.spawn(
        dustPos.x, dustPos.y, dustPos.z,
        dustVel.x, dustVel.y, dustVel.z,
        0.42, 0.40, 0.36,
        1.6 + SkywardRNG.random('vfx'), -0.2
      );
    }
  }

  // ---------- vòng lặp ----------
  const menuTarget = new THREE.Vector3(0, 8, 0);
  const menuPos = new THREE.Vector3();
  const menuMat = new THREE.Matrix4();
  const menuQuat = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  let menuAngle = 0.6;
  let last = performance.now();

  function update(dt) {
    world.update(dt, settings.motion);
    particles.update(dt);
    dustParticles.update(dt);
    updateAmbient(dt);

    if (G.state === 'playing') {
      const choosingUpgrade = waves.state === 'upgrade';
      const sdt = choosingUpgrade ? 0 : dt * G.timeScale;
      if (!choosingUpgrade) {
        player.update(sdt, world.bounds, world);
        weapons.update(sdt, triggerDown);
        waves.update(sdt, player, world.bounds, world);
        updatePickups(sdt);
      } else {
        player.keys.clear(); triggerDown = false;
      }
      if (G.comboTimer > 0) { G.comboTimer -= sdt; if (G.comboTimer <= 0) { G.combo = 0; G.multiplier = 1; } }
      if (vfx) {
        vfx.reducedMotion = settings.motion;
        if (vfx.shake > player.shake) player.shake = vfx.shake;
      }
      Music.setIntensity(Math.min(1, waves.aliveCount() * 0.18 + (waves.state === 'intermission' ? 0 : 0.15)));

      G.elapsed += sdt;
      const timeLimit = (G.mission.mods && G.mission.mods.timeLimit) || 0;
      if (timeLimit) {
        G.timeLeft = Math.max(0, timeLimit - G.elapsed);
        if (G.timeLeft <= 0) { endRound(true); }
      } else {
        G.timeLeft = G.elapsed;
      }
      G.enemiesLeft = waves.aliveCount();

      if (player.dead && G.overTimer <= 0) {
        G.overTimer = 1.4;
        G.timeScale = 0.32;
        ui.killfeed('<b>KỸ SƯ GỤC NGÃ</b>');
      }
      if (G.overTimer > 0) {
        G.overTimer -= dt;
        if (G.overTimer <= 0) endRound(false);
      }

      ui.updateHUD(G);
      ui.drawMinimap(player, waves.enemies, world.bounds);
      ui.updateEnemyIndicators(camera, waves.enemies);
    } else if (G.state === 'menu' || G.state === 'over') {
      // camera menu / kết thúc: quay quanh turbine; giữ nguyên camera khi pause.
      menuAngle += dt * 0.07;
      const r = 56;
      menuPos.set(Math.cos(menuAngle) * r, 25 + Math.sin(menuAngle * 0.7) * 3, Math.sin(menuAngle) * r);
      player.pos.copy(menuPos);
      menuMat.lookAt(menuPos, menuTarget, UP);
      menuQuat.setFromRotationMatrix(menuMat);
      player.yaw.quaternion.slerp(menuQuat, Math.min(1, dt * 2.2));
      player.pitch.rotation.set(0, 0, 0);
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
    }
  }

  function replayNumber(value) {
    return Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : null;
  }
  function replayVector(vector) {
    return vector ? {
      x: replayNumber(vector.x),
      y: replayNumber(vector.y),
      z: replayNumber(vector.z)
    } : null;
  }
  function getReplayCheckpoint(frameNumber) {
    const rngState = rng.snapshot();
    const gameplayStreams = {};
    ['gameplay', 'ai', 'weapon'].forEach(name => {
      if (rngState.streams && rngState.streams[name] !== undefined) gameplayStreams[name] = rngState.streams[name];
    });
    return {
      frame: frameNumber,
      game: {
        state: G.state,
        mission: G.mission.id,
        class: G.cls.id,
        score: G.score,
        kills: G.kills,
        shotsFired: G.shotsFired,
        shotsHit: G.shotsHit,
        wave: G.wave,
        elapsed: replayNumber(G.elapsed),
        timeLeft: replayNumber(G.timeLeft),
        combo: G.combo,
        multiplier: replayNumber(G.multiplier),
        comboTimer: replayNumber(G.comboTimer),
        timeScale: replayNumber(G.timeScale),
        victory: !!G.victory
      },
      player: {
        position: replayVector(player.pos),
        velocity: replayVector(player.vel),
        yaw: replayNumber(player.yaw.rotation.y),
        pitch: replayNumber(player.pitch.rotation.x),
        health: replayNumber(player.health),
        maxHealth: replayNumber(player.maxHealth),
        dead: !!player.dead,
        onGround: !!player.onGround,
        keys: Array.from(player.keys).sort(),
        touchMove: { x: replayNumber(player.touchMove.x), y: replayNumber(player.touchMove.y) },
        dashCooldown: replayNumber(player.dashCd),
        dashTime: replayNumber(player.dashTime),
        grenadeCooldown: replayNumber(player.grenadeCd),
        superCooldown: replayNumber(player.superCd),
        mods: Object.assign({}, player.mods)
      },
      weapon: {
        current: weapons.current,
        ammo: Object.keys(weapons.state).sort().map(key => ({
          key: key,
          mag: weapons.state[key].mag,
          reserve: weapons.state[key].reserve
        })),
        cooldown: replayNumber(weapons.cooldown),
        reloading: replayNumber(weapons.reloading),
        aiming: !!weapons.aiming,
        triggerDown: !!triggerDown,
        wasTriggerDown: !!weapons._wasTriggerDown,
        grenades: weapons.grenades.map(grenade => ({
          position: replayVector(grenade.mesh && grenade.mesh.position),
          velocity: replayVector(grenade.vel),
          life: replayNumber(grenade.life),
          fuse: replayNumber(grenade.fuse)
        })),
        strikes: weapons.strikes.map(strike => ({
          x: replayNumber(strike.x),
          z: replayNumber(strike.z),
          time: replayNumber(strike.t)
        }))
      },
      waves: {
        state: waves.state,
        waveIndex: waves.waveIndex,
        timer: replayNumber(waves.timer),
        spawnTimer: replayNumber(waves.spawnTimer),
        spawnQueue: waves.spawnQueue.slice(),
        enemies: waves.enemies.map(enemy => ({
          type: enemy.type,
          alive: !!enemy.alive,
          hp: replayNumber(enemy.hp),
          maxHp: replayNumber(enemy.maxHp),
          position: replayVector(enemy.group && enemy.group.position),
          spawnT: replayNumber(enemy.spawnT),
          time: replayNumber(enemy.t),
          fireTimer: replayNumber(enemy.fireTimer),
          strafePhase: replayNumber(enemy.strafePhase),
          strafeDir: replayNumber(enemy.strafeDir),
          flinchTime: replayNumber(enemy.flinchT),
          deathTime: replayNumber(enemy.deathT),
          projectiles: (enemy.projectiles || []).map(projectile => ({
            position: replayVector(projectile.mesh && projectile.mesh.position),
            velocity: replayVector(projectile.vel),
            life: replayNumber(projectile.life),
            damage: replayNumber(projectile.damage)
          }))
        }))
      },
      pickups: pickups.map(pickup => ({
        type: pickup.type,
        life: replayNumber(pickup.life),
        position: replayVector(pickup.mesh && pickup.mesh.position)
      })),
      upgrades: offeredUpgradeIds.slice(),
      rng: { seed: rngState.seed, streams: gameplayStreams }
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const replaying = replay.isPlaying();
    let replayFrame = null;
    if (replaying) {
      const step = replay.nextFrame();
      if (!step) { pauseGame(); return; }
      replayFrame = step;
      replay.drainInputsForFrame(step.index).forEach(applyReplayInput);
    }
    if (!replaying && G.state === 'playing' && pendingTouchMoveRecord) {
      recordInput('touch-move', pendingTouchMoveRecord);
      pendingTouchMoveRecord = null;
    }
    if (!replaying && G.state === 'playing' && (pendingLookX !== 0 || pendingLookY !== 0)) {
      const dx = pendingLookX, dy = pendingLookY;
      pendingLookX = 0; pendingLookY = 0;
      const lookInput = { dx: dx * 1.12, dy: dy * 1.12, source: 'touch' };
      recordInput('look', lookInput);
      player.look(lookInput.dx, lookInput.dy);
    }
    let frameDt = (now - last) / 1000;
    last = now;
    if (!(frameDt > 0)) frameDt = 0.016;
    if (G.state === 'playing') {
      const previousScale = adaptiveResolution.snapshot().scale;
      const resolution = adaptiveResolution.update(frameDt);
      if (Math.abs(resolution.scale - previousScale) > 0.001) {
        renderer.setPixelRatio(resolution.scale);
      }
    }
    const perfDt = frameDt;
    let dt = Math.min(frameDt, 0.06);
    if (replaying && replayFrame) dt = replayFrame.dt;
    if (replay.isRecording()) replay.beginFrame(dt);
    update(dt);
    if ((replay.isRecording() || replay.isPlaying()) && (replay.status().version || 1) >= 2) {
      replayCheckpointFrame += 1;
      if (replayCheckpointFrame % 120 === 0) {
        events.emit('replay:checkpoint', getReplayCheckpoint(replayCheckpointFrame));
      }
    }
    replay.endFrame();
    renderer.render(scene, camera);
    updateDebug(perfDt);
    benchmarkRecorder.sample(getPerformanceSnapshot, Date.now());
  }

  // ---------- khởi động ----------
  function boot() {
    // tôn trọng prefers-reduced-motion của hệ điều hành
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (!settings.motion) { settings.motion = true; saveSettings(); }
      }
    } catch (e) {}

    Sound.setVolume(settings.vol);
    Sound.setMuted(settings.muted);
    Sound.setMasterVolume(settings.masterVol);
    Music.setVolume(settings.musicVol);
    Music.setMuted(settings.muted);
    ui.setMuteLabel(settings.muted);
    ui.setBest(G.best);
    weapons.setCosmeticLevel(progression.level);
    ui.el.setSens.value = settings.sens;
    ui.el.setSensVal.textContent = Number(settings.sens).toFixed(1);
    ui.el.setVol.value = settings.vol;
    ui.el.setVolVal.textContent = Math.round(settings.vol * 100) + '%';
    if (ui.el.setMasterVol) {
      ui.el.setMasterVol.value = settings.masterVol;
      ui.el.setMasterVolVal.textContent = Math.round(settings.masterVol * 100) + '%';
    }
    if (ui.el.setMusicVol) {
      ui.el.setMusicVol.value = settings.musicVol;
      ui.el.setMusicVolVal.textContent = Math.round(settings.musicVol * 100) + '%';
    }
    ui.el.setInvert.checked = settings.invert;
    ui.el.setMotion.checked = settings.motion;
    ui.el.setQuality.value = settings.quality;
    ui.syncSelection(G.mission.id, G.cls.id);
    ui.show('menu');
    ui.hideLoading();
    world.setMood(G.mission.mood); if (world.setMap) world.setMap(G.mission.id);
    requestAnimationFrame(frame);
  }

  // ---------- overlay debug (F3) ----------
  const dbgEl = document.createElement('div');
  dbgEl.id = 'debug-overlay';
  dbgEl.style.display = 'none';
  document.getElementById('app').appendChild(dbgEl);
  let dbgOn = false;
  let dbgAccum = 0, dbgFrames = 0, dbgMax = 0, dbgTimer = 0;
  const perfSamples = [];
  const PERF_SAMPLE_LIMIT = 600;
  let perfTimer = 0;
  let perfSnapshot = { p50: 0, p95: 0, p99: 0, max: 0, samples: 0 };
  const benchmarkRecorder = benchmarkTools.createRecorder({ sampleIntervalMs: 1000, maxSamples: 1800 });
  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[index];
  }
  function getPerformanceSnapshot() {
    const info = renderer.info;
    const resolution = adaptiveResolution.snapshot();
    return {
      p50: perfSnapshot.p50, p95: perfSnapshot.p95, p99: perfSnapshot.p99,
      max: perfSnapshot.max, samples: perfSnapshot.samples,
      fps: perfSnapshot.p50 > 0 ? 1000 / perfSnapshot.p50 : 0,
      drawCalls: info.render.calls, triangles: info.render.triangles,
      geometries: info.memory.geometries, textures: info.memory.textures,
      particles: particles.activeCount + dustParticles.activeCount,
      decals: vfx.decals.activeCount, enemies: waves.aliveCount(),
      renderScale: resolution.scale, renderScaleMax: resolution.maxScale,
      renderScaleMin: resolution.minScale, adaptiveFps: resolution.lastFps,
      resolutionDownshifts: resolution.downshifts, resolutionUpshifts: resolution.upshifts,
      mission: G.mission.id, state: G.state, wave: G.wave
    };
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      dbgOn = !dbgOn;
      dbgEl.style.display = dbgOn ? 'block' : 'none';
      if (!dbgOn) dbgEl.innerHTML = '';
    }
  });

  function updateDebug(dt) {
    perfSamples.push(dt);
    if (perfSamples.length > PERF_SAMPLE_LIMIT) perfSamples.shift();
    perfTimer -= dt;
    if (perfTimer <= 0 && perfSamples.length) {
      perfTimer = 0.5;
      const sorted = perfSamples.slice().sort((a, b) => a - b);
      perfSnapshot = {
        p50: percentile(sorted, 0.50) * 1000,
        p95: percentile(sorted, 0.95) * 1000,
        p99: percentile(sorted, 0.99) * 1000,
        max: sorted[sorted.length - 1] * 1000,
        samples: sorted.length
      };
    }
    if (!dbgOn) return;
    dbgAccum += dt;
    dbgFrames++;
    if (dt > dbgMax) dbgMax = dt;
    dbgTimer -= dt;
    if (dbgTimer > 0) return;
    dbgTimer = 0.5;
    const avg = dbgAccum / Math.max(1, dbgFrames);
    const info = renderer.info;
    const fps = Math.round(1 / Math.max(0.0001, avg));
    const over = avg > 0.0167 ? ' <span class="dbg-warn">OVER</span>' : '';
    dbgEl.innerHTML =
      '<span class="dbg-title">DEBUG · F3</span><br>' +
      'FPS avg    ' + fps + '<br>' +
      'frame avg  ' + (avg * 1000).toFixed(2) + ' ms' + over + '<br>' +
      'frame p50  ' + perfSnapshot.p50.toFixed(2) + ' ms<br>' +
      'frame p95  ' + perfSnapshot.p95.toFixed(2) + ' ms<br>' +
      'frame p99  ' + perfSnapshot.p99.toFixed(2) + ' ms<br>' +
      'frame max  ' + perfSnapshot.max.toFixed(2) + ' ms<br>' +
      'draw calls ' + info.render.calls + '<br>' +
      'triangles  ' + (info.render.triangles / 1000).toFixed(1) + 'k<br>' +
      'geometries ' + info.memory.geometries + '<br>' +
      'textures   ' + info.memory.textures + '<br>' +
      'particles  ' + particles.activeCount + '+' + dustParticles.activeCount + '<br>' +
      'decals     ' + vfx.decals.activeCount + '/' + vfx.decals.max + '<br>' +
      'enemies    ' + waves.aliveCount() + '<br>' +
      'render     ' + adaptiveResolution.snapshot().scale.toFixed(2) + ' / ' + adaptiveResolution.snapshot().maxScale.toFixed(2) + '<br>' +
      'adaptive   ' + adaptiveResolution.snapshot().lastFps.toFixed(1) + ' FPS<br>' +
      'mission    ' + G.mission.id;
    dbgAccum = 0; dbgFrames = 0; dbgMax = 0;
  }

  function getBenchmarkMetadata() {
    const viewport = getViewportSize();
    return {
      userAgent: navigator.userAgent || '',
      platform: navigator.platform || '',
      viewport: { width: Math.round(viewport.width), height: Math.round(viewport.height) },
      devicePixelRatio: window.devicePixelRatio || 1,
      touchCapable: !!touchCapable,
      quality: settings.quality,
      mission: G.mission.id,
      gameState: G.state,
      runSeed: activeRunSeed
    };
  }
  const benchmarkApi = Object.freeze({
    start: (metadata) => benchmarkRecorder.start(Object.assign(getBenchmarkMetadata(), metadata || {})),
    stop: (reason) => benchmarkRecorder.stop(reason || 'manual'),
    status: () => benchmarkRecorder.status(),
    report: () => benchmarkRecorder.report(),
    export: () => benchmarkRecorder.exportJSON(),
    reset: () => benchmarkRecorder.reset()
  });

  // Read-only diagnostic surface for automated QA and browser-console inspection.
  window.__SKYWARD__ = {
    G: G, player: player, weapons: weapons, waves: waves, world: world,
    ui: ui, vfx: vfx, tex: Tex, renderer: renderer,
    rng: rng, events: events, replay: replay, runSeed: () => activeRunSeed,
    start: startRound, menu: toMenu, playReplay: playReplay,
    getPerformanceSnapshot: getPerformanceSnapshot, benchmark: benchmarkApi
  };

  boot();
})();
