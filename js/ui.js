/* ============================================================
   SKYWARD SALVAGE — ui.js
   HUD, menu, cài đặt, màn kết thúc.
   ============================================================ */

const MISSIONS = [
  {
    id: 'beryl', tag: 'CHIẾN DỊCH', title: 'Tín hiệu Beryl',
    desc: 'Dọn sạch turbine trung tâm khỏi lũ drone. Ba đợt, cường độ chuẩn.',
    meta: '3 ĐỢT · CƯỜNG ĐỘ THƯỜNG',
    mods: { countMul: 1, hpMul: 1 }, mood: 'clear', unlockLevel: 1
  },
  {
    id: 'squall', tag: 'HỢP TÁC', title: 'Xuyên qua cơn giông',
    desc: 'Cơn giông quay lại, kẻ thù đông hơn và trâu hơn. Cần kỹ sư giỏi mà thở.',
    meta: '3 ĐỢT · +50% KẺ THÙ',
    mods: { countMul: 1.5, hpMul: 1.15 }, mood: 'squall', unlockLevel: 1
  },
  {
    id: 'gale', tag: 'THỬ THÁCH', title: 'Thử thách bởi gió',
    desc: 'Sống sót 120 giây dưới cơn gió mạnh và giành điểm cao nhất có thể.',
    meta: '120 GIÂY · ĐIỂM CAO',
    mods: { countMul: 1, hpMul: 1, timeLimit: 120 }, mood: 'gale', unlockLevel: 1
  },
  {
    id: 'endless', tag: 'ROGUELITE SURVIVAL', title: 'Endless Protocol',
    desc: 'Không giới hạn wave. Chọn mô-đun nâng cấp sau mỗi đợt; boss xuất hiện định kỳ.',
    meta: 'WAVE VÔ HẠN · NÂNG CẤP NGẪU NHIÊN', mods: { countMul: 1, hpMul: 0.9, endless: true }, mood: 'gale', unlockLevel: 4
  },
  {
    id: 'blackout', tag: 'BOSS PROTOCOL', title: 'Blackout Offensive',
    desc: 'Năm đợt phòng thủ cường độ cao. Đợt cuối có chỉ huy bọc giáp.',
    meta: '5 ĐỢT · BOSS CUỐI', mods: { countMul: 1.2, hpMul: 1.16, waveCount: 5 }, mood: 'blackout', unlockLevel: 2
  }
];

const CLASSES = [
  {
    id: 'thermal', name: 'Kỹ sư nhiệt', icon: '⚙',
    sub: 'Sát thương +20% · Máu −10%',
    mods: { damage: 1.2, speed: 1.0, maxHp: 0.9, cooldown: 1.0 }
  },
  {
    id: 'wind', name: 'Kỹ sư gió', icon: '🌀',
    sub: 'Tốc độ +15% · Hồi chiêu −20%',
    mods: { damage: 1.0, speed: 1.15, maxHp: 1.0, cooldown: 0.8 }
  },
  {
    id: 'aegis', name: 'Kỹ sư lái', icon: '🛡',
    sub: 'Máu +30% · Sát thương −10%',
    mods: { damage: 0.9, speed: 0.95, maxHp: 1.3, cooldown: 1.0 }
  }
];

const $ = id => document.getElementById(id);

class UI {
  constructor(handlers) {
    this.h = handlers;
    this.el = {
      hud: $('hud'), loading: $('loading'), fatal: $('fatal'), fatalMsg: $('fatal-msg'),
      menu: $('menu'), dest: $('dest-screen'), eng: $('eng-screen'),
      settings: $('settings-screen'), controls: $('controls-screen'),
      pause: $('pause-screen'), over: $('over-screen'),
      waveLabel: $('wave-label'), objective: $('objective-pill'), score: $('score-val'),
      hpNum: $('hp-num'), hpFill: $('hp-fill'), className: $('class-name'),
      wpnName: $('wpn-name'), ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'), reloadHint: $('reload-hint'),
      timer: $('timer'), enemiesLeft: $('enemies-left'),
      waveBanner: $('wave-banner'), waveTitle: $('wave-title'), waveSub: $('wave-sub'),
      hitmarker: $('hitmarker'), killfeed: $('killfeed'),
      dmg: $('damage-vignette'), lowhp: $('lowhp-vignette'),
      minimap: $('minimap-canvas'),
      menuClassName: $('menu-class-name'), menuClassSub: $('menu-class-sub'), bestScore: $('best-score'),
      overTitle: $('over-title'), overSub: $('over-sub'), rank: $('rank-badge'),
      stScore: $('st-score'), stKills: $('st-kills'), stTime: $('st-time'), stAcc: $('st-acc'),
      overNote: $('over-note'), combo: $('combo-val'), enemyOverlay: $('enemy-overlay'), damageDirection: $('damage-direction'),
      upgrade: $('upgrade-screen'), upgradeCards: $('upgrade-cards'),
      profileLevel: $('profile-level'), profileXpFill: $('profile-xp-fill'), profileXp: $('profile-xp'), profileStats: $('profile-stats'), profileUnlocks: $('profile-unlocks'), profileAchievements: $('profile-achievements'),
      touchControls: $('touch-controls'),
      setSens: $('set-sens'), setVol: $('set-vol'), setInvert: $('set-invert'),
      setMotion: $('set-motion'), setQuality: $('set-quality'),
      setSensVal: $('set-sens-val'), setVolVal: $('set-vol-val')
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this._hitT = null;
    this._bannerT = null;
    this.enemyMarkers = [];
    this._damageDirT = 0;
    this._wire();
    if (this.el.enemyOverlay) {
      for (let i = 0; i < 40; i++) {
        const marker = document.createElement('div'); marker.className = 'enemy-marker hidden';
        marker.innerHTML = '<div class="em-label"></div><div class="em-bar"><i></i></div>';
        this.el.enemyOverlay.appendChild(marker); this.enemyMarkers.push(marker);
      }
    }
  }

  _wire() {
    const h = this.h;
    const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', () => { Sound.unlock(); Music.init(); Music.resume(); Sound.ui(); fn(); }); };

    on('btn-launch', () => h.play());
    on('btn-settings', () => this.show('settings'));
    on('btn-controls', () => this.show('controls'));
    on('btn-resume', () => h.resume());
    on('btn-pause-settings', () => this.show('settings', 'pause'));
    on('btn-quit', () => h.toMenu());
    on('btn-retry', () => h.play());
    on('btn-menu', () => h.toMenu());
    on('btn-reset-best', () => h.resetBest());
    on('btn-mute', () => h.toggleMute());
    on('btn-mute-2', () => h.toggleMute());

    document.querySelectorAll('.nav-btn[data-nav]').forEach(b => {
      b.addEventListener('click', () => {
        Sound.unlock(); Sound.ui();
        const nav = b.getAttribute('data-nav');
        document.querySelectorAll('.nav-btn[data-nav]').forEach(x => x.classList.toggle('active', x === b));
        if (nav === 'play') this.show('menu');
        else if (nav === 'dest') this.show('dest');
        else if (nav === 'eng') this.show('eng');
      });
    });

    document.querySelectorAll('[data-back]').forEach(b => {
      b.addEventListener('click', () => { Sound.ui(); this.show(this._backTo || 'menu'); });
    });

    // settings
    this.el.setSens.addEventListener('input', () => {
      this.el.setSensVal.textContent = Number(this.el.setSens.value).toFixed(1);
      h.setSensitivity(parseFloat(this.el.setSens.value));
    });
    this.el.setVol.addEventListener('input', () => {
      const v = parseFloat(this.el.setVol.value);
      this.el.setVolVal.textContent = Math.round(v * 100) + '%';
      h.setVolume(v);
    });
    this.el.setMusicVol = $('set-music-vol');
    this.el.setMusicVolVal = $('set-music-vol-val');
    if (this.el.setMusicVol) {
      this.el.setMusicVol.addEventListener('input', () => {
        const v = parseFloat(this.el.setMusicVol.value);
        this.el.setMusicVolVal.textContent = Math.round(v * 100) + '%';
        h.setMusicVolume(v);
      });
    }
    this.el.setMasterVol = $('set-master');
    this.el.setMasterVolVal = $('set-master-val');
    if (this.el.setMasterVol) {
      this.el.setMasterVol.addEventListener('input', () => {
        const v = parseFloat(this.el.setMasterVol.value);
        this.el.setMasterVolVal.textContent = Math.round(v * 100) + '%';
        h.setMasterVolume(v);
      });
    }
    this.el.setInvert.addEventListener('change', () => h.setInvert(this.el.setInvert.checked));
    this.el.setMotion.addEventListener('change', () => h.setMotion(this.el.setMotion.checked));
    this.el.setQuality.addEventListener('change', () => h.setQuality(this.el.setQuality.value));

    this._buildCards();
  }

  _buildCards() {
    const dc = $('dest-cards');
    if (dc) {
      dc.innerHTML = '';
      MISSIONS.forEach(m => {
        const b = document.createElement('button');
        const unlocked = !this.h.isMissionUnlocked || this.h.isMissionUnlocked(m);
        b.className = 'dest-card' + (unlocked ? '' : ' locked');
        b.dataset.id = m.id;
        b.innerHTML = `<div class="dc-tag">${m.tag}</div><div class="dc-title">${m.title}</div>
          <div class="dc-desc">${m.desc}</div><div class="dc-meta">${unlocked ? m.meta : 'KHÓA · MỞ Ở CẤP ' + m.unlockLevel}</div>`;
        b.disabled = !unlocked;
        b.addEventListener('click', () => { if (!b.disabled) { Sound.ui(); this.h.selectMission(m.id); } });
        dc.appendChild(b);
      });
    }
    const dg = $('dest-grid');
    if (dg) {
      dg.innerHTML = '';
      MISSIONS.forEach(m => {
        const b = document.createElement('button');
        const unlocked = !this.h.isMissionUnlocked || this.h.isMissionUnlocked(m);
        b.className = 'pick-card' + (unlocked ? '' : ' locked');
        b.dataset.id = m.id;
        b.innerHTML = `<div class="pc-tag">${m.tag}</div><div class="pc-title">${m.title}</div>
          <div class="pc-desc">${m.desc}</div><div class="pc-stats">
          <div class="ps-row"><b>Độ khó</b><div class="ps-bar"><i style="width:${m.id === 'beryl' ? 35 : m.id === 'squall' ? 70 : m.id === 'endless' ? 95 : 82}%"></i></div></div>
          <div class="ps-row"><b>Đợt</b><div class="ps-bar"><i style="width:${m.id === 'blackout' ? 100 : m.id === 'endless' ? 100 : 75}%"></i></div></div>
          <div class="ps-row"><b>Phần thưởng</b><div class="ps-bar"><i style="width:${m.id === 'beryl' ? 45 : m.id === 'squall' ? 80 : 95}%"></i></div></div>
          </div>${unlocked ? '' : '<div class="pc-lock">MỞ Ở CẤP ' + m.unlockLevel + '</div>'}`;
        b.disabled = !unlocked;
        b.addEventListener('click', () => { if (!b.disabled) { Sound.ui(); this.h.selectMission(m.id); } });
        dg.appendChild(b);
      });
    }
    const eg = $('eng-grid');
    if (eg) {
      eg.innerHTML = '';
      CLASSES.forEach(c => {
        const b = document.createElement('button');
        b.className = 'pick-card';
        b.dataset.id = c.id;
        b.innerHTML = `<div class="pc-tag">${c.icon} LỚP KỸ SƯ</div><div class="pc-title">${c.name}</div>
          <div class="pc-desc">${c.sub}</div><div class="pc-stats">
          <div class="ps-row"><b>Sát thương</b><div class="ps-bar"><i style="width:${Math.round(c.mods.damage * 70)}%"></i></div></div>
          <div class="ps-row"><b>Tốc độ</b><div class="ps-bar"><i style="width:${Math.round(c.mods.speed * 70)}%"></i></div></div>
          <div class="ps-row"><b>Máu</b><div class="ps-bar"><i style="width:${Math.round(c.mods.maxHp * 65)}%"></i></div></div>
          </div>`;
        b.addEventListener('click', () => { Sound.ui(); this.h.selectClass(c.id); });
        eg.appendChild(b);
      });
    }
  }

  syncSelection(missionId, classId) {
    document.querySelectorAll('[data-id]').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === missionId || el.dataset.id === classId);
    });
    const m = MISSIONS.find(x => x.id === missionId);
    const c = CLASSES.find(x => x.id === classId);
    if (m) { this.el.objective.textContent = m.id === 'gale' ? 'SỐNG SÓT 120s' : m.id === 'endless' ? 'ENDLESS SURVIVAL' : m.id === 'blackout' ? 'BOSS ELIMINATION' : 'LÀM SẠCH TURBINE'; const label = document.querySelector('.map-label'); if (label) label.textContent = m.id === 'blackout' ? 'STORMGLASS OUTPOST' : 'CIRRUS REACH'; }
    if (c) {
      this.el.menuClassName.textContent = c.name;
      this.el.menuClassSub.textContent = c.sub;
      this.el.className.textContent = c.name.toUpperCase();
    }
  }

  show(name, backTo) {
    ['menu', 'dest', 'eng', 'settings', 'controls', 'pause', 'over'].forEach(k => {
      const el = this.el[k];
      if (el) el.classList.toggle('hidden', k !== name);
    });
    if (name === 'menu') this.el.hud.classList.add('hidden');
    this._backTo = backTo || (name === 'settings' ? this._backTo : 'menu');
  }

  hideAll() {
    ['menu', 'dest', 'eng', 'settings', 'controls', 'pause', 'over'].forEach(k => {
      if (this.el[k]) this.el[k].classList.add('hidden');
    });
  }

  hideLoading() { this.el.loading.classList.add('hidden'); }
  fatal(msg) {
    this.el.loading.classList.add('hidden');
    this.el.fatal.classList.remove('hidden');
    if (msg) this.el.fatalMsg.textContent = msg;
  }

  setMuteLabel(muted) {
    const t = muted ? 'TẮT ÂM THANH' : 'BẬT ÂM THANH';
    const b1 = $('btn-mute'); if (b1) b1.textContent = t;
    const b2 = $('btn-mute-2'); if (b2) b2.textContent = t;
    const b3 = $('btn-settings'); if (b3) b3.textContent = muted ? '🔇 CÀI ĐẶT' : '⚙ CÀI ĐẶT';
  }

  setBest(v) { this.el.bestScore.textContent = 'ĐIỂM CAO NHẤT: ' + v; }

  // ---------------- HUD ----------------
  updateHUD(g) {
    const p = g.player, w = g.weapons;
    this.el.hpNum.textContent = Math.ceil(p.health);
    const pct = Math.max(0, p.health / p.maxHealth);
    this.el.hpFill.style.width = (pct * 100) + '%';
    this.el.hpFill.classList.toggle('low', pct < 0.35);
    this.el.lowhp.classList.toggle('on', pct < 0.3 && !p.dead);

    this.el.score.textContent = g.score;
    this.el.waveLabel.textContent = 'ĐỢT ' + g.wave + '/' + (g.totalWaves === Infinity ? '∞' : g.totalWaves);
    if (this.el.combo) {
      this.el.combo.textContent = g.combo > 1 ? 'COMBO ×' + g.multiplier.toFixed(1) : '';
      this.el.combo.classList.toggle('hidden', g.combo < 2);
    }
    this.el.enemiesLeft.textContent = g.enemiesLeft + ' KẺ THÙ';

    const a = w.ammo();
    this.el.ammoMag.textContent = a.mag;
    this.el.ammoRes.textContent = '/ ' + a.reserve;
    this.el.ammoMag.classList.toggle('empty', a.mag === 0);
    this.el.wpnName.textContent = w.def().name;
    this.el.reloadHint.classList.toggle('show', w.reloading > 0 || (a.mag <= w.def().mag * 0.25 && a.reserve > 0));

    document.querySelectorAll('#wpn-slots .slot').forEach(s => {
      const key = WEAPON_ORDER[parseInt(s.dataset.slot, 10) - 1];
      s.classList.toggle('active', key === w.current);
    });

    ['q', 'e', 'f'].forEach(k => {
      const el = $('ab-' + k);
      const f = p.cooldownFraction(k);
      el.querySelector('.ab-cd').style.height = (f * 100) + '%';
      el.classList.toggle('ready', f <= 0);
    });

    const t = Math.max(0, g.timeLeft);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    this.el.timer.textContent = mm + ':' + ss;
  }

  updateProgression(p) {
    if (!p || !this.el.profileLevel) return;
    const need = Math.max(250, p.level * 250);
    this.el.profileLevel.textContent = 'LV. ' + p.level;
    this.el.profileXp.textContent = p.xp + ' / ' + need + ' XP';
    this.el.profileXpFill.style.width = Math.min(100, p.xp / need * 100) + '%';
    this.el.profileStats.textContent = p.runs + ' NHIỆM VỤ · ' + p.kills + ' HẠ GỤC';
    this.el.profileUnlocks.textContent = 'MỞ KHÓA: ' + (p.level >= 2 ? 'Blackout' : 'Blackout ở LV.2') + ' · ' + (p.level >= 4 ? 'Endless' : 'Endless ở LV.4') + (p.level >= 3 ? ' · Skin nâng cao' : '');
    if (this.el.profileAchievements) { const names = { 'first-kill':'First Blood', 'ten-kills':'Eliminator', 'first-win':'Mission Complete', 'wave-ten':'Wave 10' }; this.el.profileAchievements.textContent = 'ACHIEVEMENTS ' + p.achievements.length + '/4 · ' + p.achievements.map(id => names[id] || id).join(' / '); }
  }

  showUpgrade(options, onChoose) {
    if (!this.el.upgrade || !this.el.upgradeCards) return;
    this.el.upgradeCards.innerHTML = '';
    options.forEach((o, index) => {
      const b = document.createElement('button'); b.className = 'upgrade-card';
      b.innerHTML = `<div class="uc-index">MODULE 0${index + 1}</div><div class="uc-title">${o.title}</div><div class="uc-desc">${o.desc}</div><div class="uc-select">CHỌN MÔ-ĐUN →</div>`;
      b.addEventListener('click', () => { Sound.ui(); this.el.upgrade.classList.add('hidden'); onChoose(o.id); });
      this.el.upgradeCards.appendChild(b);
    });
    this.el.upgrade.classList.remove('hidden');
  }

  hideUpgrade() { if (this.el.upgrade) this.el.upgrade.classList.add('hidden'); }

  damageDirection(worldPos, player) {
    if (!this.el.damageDirection || !worldPos || !player) return;
    const dx = worldPos.x - player.pos.x, dz = worldPos.z - player.pos.z;
    const angle = Math.atan2(dx, -dz) - player.yaw.rotation.y;
    this.el.damageDirection.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    this.el.damageDirection.classList.add('on');
    clearTimeout(this._damageDirT);
    this._damageDirT = setTimeout(() => this.el.damageDirection.classList.remove('on'), 650);
  }

  showDamageNumber(camera, enemy, amount, killed) {
    if (!this.el.enemyOverlay || !camera || !enemy || !enemy.group) return;
    const p = enemy.group.position.clone();
    p.y += enemy.radius * (enemy.isBoss ? 0.9 : 0.7);
    p.project(camera);
    if (p.z > 1 || p.z < -1) return;
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    const node = document.createElement('div');
    node.className = 'damage-number' + (killed ? ' kill' : '');
    node.textContent = Math.round(amount).toString();
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    this.el.enemyOverlay.appendChild(node);
    setTimeout(() => node.remove(), 850);
  }

  updateEnemyIndicators(camera, enemies) {
    if (!this.enemyMarkers.length) return;
    let used = 0;
    const w = window.innerWidth, h = window.innerHeight;
    for (const enemy of enemies) {
      if (!enemy.alive || used >= this.enemyMarkers.length) continue;
      const marker = this.enemyMarkers[used++];
      const pos = enemy.group.position.clone(); pos.y += enemy.radius * (enemy.isBoss ? 1.35 : 1.1);
      pos.project(camera);
      const behind = pos.z > 1;
      // Khi mục tiêu ở sau camera, phép chiếu cho tọa độ bị đảo 180 độ.
      // Đảo lại quanh tâm viewport để off-screen marker chỉ đúng hướng thực tế.
      let sx = (pos.x * 0.5 + 0.5) * w;
      let sy = (-pos.y * 0.5 + 0.5) * h;
      if (behind) { sx = w - sx; sy = h - sy; }
      const visible = !behind && sx > 28 && sx < w - 28 && sy > 30 && sy < h - 30;
      const x = Math.max(24, Math.min(w - 24, sx));
      const y = Math.max(34, Math.min(h - 34, sy));
      marker.classList.toggle('hidden', false);
      marker.classList.toggle('offscreen', !visible);
      marker.classList.toggle('boss', !!enemy.isBoss);
      marker.style.left = x + 'px'; marker.style.top = y + 'px';
      marker.querySelector('.em-label').textContent = enemy.isBoss ? 'COMMANDER' : enemy.type.toUpperCase();
      marker.querySelector('.em-bar i').style.width = Math.max(0, enemy.hp / enemy.maxHp * 100) + '%';
      if (!visible) marker.style.transform = `translate(-50%,-50%) rotate(${Math.atan2(sx - w / 2, -(sy - h / 2))}rad)`;
      else marker.style.transform = 'translate(-50%,-50%)';
    }
    for (let i = used; i < this.enemyMarkers.length; i++) this.enemyMarkers[i].classList.add('hidden');
  }

  hitmarker(kill) {
    const el = this.el.hitmarker;
    el.classList.remove('pop', 'kill');
    void el.offsetWidth;
    if (kill) el.classList.add('kill');
    el.classList.add('pop');
  }

  damageFlash() {
    const el = this.el.dmg;
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity .45s ease';
      el.style.opacity = '0';
    });
  }

  waveBanner(title, sub) {
    const b = this.el.waveBanner;
    this.el.waveTitle.textContent = title;
    this.el.waveSub.textContent = sub;
    b.classList.remove('hidden', 'out');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.classList.add('hidden'), 480);
    }, 1700);
  }

  killfeed(text) {
    const d = document.createElement('div');
    d.className = 'kf-item';
    d.innerHTML = text;
    this.el.killfeed.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2100);
    setTimeout(() => d.remove(), 2600);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.firstChild.remove();
  }

  // ---------------- minimap ----------------
  drawMinimap(player, enemies, bounds) {
    const ctx = this.mapCtx;
    const S = 150, C = S / 2;
    const scale = (C - 12) / bounds;
    ctx.clearRect(0, 0, S, S);

    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(10,22,30,.72)';
    ctx.fillRect(0, 0, S, S);

    // vòng sân
    ctx.strokeStyle = 'rgba(143,208,255,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(C, C, bounds * scale, 0, Math.PI * 2);
    ctx.stroke();

    // turbine trung tâm
    ctx.fillStyle = 'rgba(255,122,47,.9)';
    ctx.beginPath();
    ctx.arc(C, C, 4, 0, Math.PI * 2);
    ctx.fill();

    const yaw = player.yaw.rotation.y;
    const cos = Math.cos(-yaw), sin = Math.sin(-yaw);

    enemies.forEach(e => {
      if (!e.alive) return;
      const dx = e.group.position.x - player.pos.x;
      const dz = e.group.position.z - player.pos.z;
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      const px = C + rx * scale;
      const py = C + rz * scale;
      ctx.fillStyle = e.type === 'brute' ? '#c07aff' : e.type === 'speeder' ? '#ffb066' : '#ff5a5a';
      ctx.beginPath();
      ctx.arc(px, py, e.type === 'brute' ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // người chơi (mũi tên hướng lên = hướng nhìn)
    ctx.fillStyle = '#8fd0ff';
    ctx.beginPath();
    ctx.moveTo(C, C - 7);
    ctx.lineTo(C + 5, C + 6);
    ctx.lineTo(C, C + 3);
    ctx.lineTo(C - 5, C + 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ---------------- game over ----------------
  showGameOver(data) {
    this.el.overTitle.textContent = data.victory
      ? 'CIRRUS REACH ĐÃ ĐƯỢC GIẢI PHÓNG.'
      : 'CÂU CHUYỆN CỦA BẠN CHƯA KẾT THÚC.';
    this.el.overSub.textContent = data.victory
      ? 'Turbine đã được làm sạch — mây tan, ánh sáng trở lại cho Kỹ sư.'
      : 'Con giông đã thắng trận này. Hít thở sâu, thay đổi chiến thuật và vươn lên một lần nữa.';
    this.el.rank.textContent = data.rank;
    this.el.rank.className = 'rank-badge r-' + data.rank.toLowerCase();
    this.el.stScore.textContent = data.score;
    this.el.stKills.textContent = data.kills;
    this.el.stTime.textContent = data.time;
    this.el.stAcc.textContent = data.accuracy + '%';
    this.el.overNote.textContent = (data.newBest ? 'KỶ LỤC MỚI! ' : '') +
      ' +' + (data.xpEarned || 0) + ' XP · LV.' + (data.level || 1) + ' · Tiến trình đã lưu.';
    this.show('over');
  }
}
