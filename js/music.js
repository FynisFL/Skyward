/* ============================================================
   SKYWARD SALVAGE — music.js  (V2)
   Nhạc nền generative bằng WebAudio: menu (ambient công nghiệp,
   căng thẳng thấp) và combat (synth + percussion điện tử).
   Cường độ tăng theo trạng thái chiến đấu, crossfade mượt.
   Không dùng file audio ngoài.
   ============================================================ */

const Music = (() => {
  let ac = null;
  let bus = null;          // music gain → destination
  let comp = null;
  let ready = false;

  let mode = 'menu';       // 'menu' | 'combat'
  let fadeMode = 'menu';   // mode đang phát thực tế (để crossfade)
  let intensity = 0;       // 0..1
  let volume = 0.45;
  let muted = false;

  let bpm = 96;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  const LOOKAHEAD = 0.12;
  const TICK = 40;

  // Hợp âm: A minor, âm hưởng tối (i – VI – iv – v)
  const PROG = [
    { root: 55.00, chord: [220.00, 261.63, 329.63] },   // Am
    { root: 43.65, chord: [174.61, 220.00, 261.63] },   // F
    { root: 65.41, chord: [261.63, 329.63, 392.00] },   // C
    { root: 49.00, chord: [196.00, 246.94, 293.66] }    // G
  ];
  const PENTA = [440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

  function init() {
    if (ready) return true;
    try {
      ac = Sound.ctx();
      if (!ac) return false;
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;

      bus = ac.createGain();
      bus.gain.value = muted ? 0 : volume * 0.9;
      bus.connect(comp);
      comp.connect(Sound.masterBus());

      ready = true;
      nextTime = ac.currentTime + 0.1;
      step = 0;
      timer = setInterval(tick, TICK);
      return true;
    } catch (e) {
      return false;
    }
  }

  function now() { return ac ? ac.currentTime : 0; }

  // ---------- synth primitives ----------
  function pad(freq, t, dur, gain, bright) {
    const o1 = ac.createOscillator();
    const o2 = ac.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 1.005, t);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(bright ? 1400 : 700, t);
    f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(f); o2.connect(f);
    f.connect(g); g.connect(bus);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  function bass(freq, t, dur, gain) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function kick(t, gain) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.24);
  }

  function hat(t, gain, open) {
    const len = open ? 0.16 : 0.05;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf(len);
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + len + 0.02);
  }

  function lead(freq, t, dur, gain) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // delay nhẹ để tạo không gian
    const dly = ac.createDelay(0.5);
    dly.delayTime.value = 0.28;
    const fb = ac.createGain();
    fb.gain.value = 0.32;
    const wet = ac.createGain();
    wet.gain.value = 0.28;
    o.connect(g);
    g.connect(bus);
    g.connect(dly);
    dly.connect(fb); fb.connect(dly);
    dly.connect(wet); wet.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  let _noise = null;
  function noiseBuf(dur) {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    if (!_noise || _noise.length < len) {
      const b = ac.createBuffer(1, Math.max(len, ac.sampleRate), ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = SkywardRNG.random('audio') * 2 - 1;
      _noise = b;
    }
    const out = ac.createBuffer(1, len, ac.sampleRate);
    out.getChannelData(0).set(_noise.getChannelData(0).subarray(0, len));
    return out;
  }

  // ---------- sequencer ----------
  function tick() {
    if (!ready || !ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }

    // crossfade menu ↔ combat
    const targetBpm = (mode === 'combat') ? 126 : 84;
    bpm += (targetBpm - bpm) * 0.06;

    while (nextTime < ac.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextTime);
      const beat = 60 / bpm;
      nextTime += beat / 2;   // 8th note
      step++;
    }
  }

  function scheduleStep(s, t) {
    const bar = Math.floor(s / 8);
    const beatInBar = s % 8;
    const chord = PROG[bar % PROG.length];
    const isCombat = fadeMode === 'combat' || mode === 'combat';
    const inten = intensity;

    // ---- pad: đổi hợp âm mỗi 2 ô nhịp (1 bar) ----
    if (beatInBar === 0) {
      const dur = (60 / bpm) * 4.2;
      const bright = isCombat && inten > 0.25;
      for (let i = 0; i < chord.chord.length; i++) {
        pad(chord.chord[i], t, dur, isCombat ? 0.055 : 0.075, bright);
      }
    }

    if (isCombat) {
      // ---- bass 8th note ----
      const bf = chord.root * (beatInBar % 4 === 3 ? 1.5 : 1);
      bass(bf, t, (60 / bpm) * 0.42, 0.16 + inten * 0.14);

      // ---- kick ----
      if (beatInBar === 0 || beatInBar === 4) kick(t, 0.30 + inten * 0.22);
      if (inten > 0.55 && beatInBar === 6) kick(t, 0.18);

      // ---- hat ----
      hat(t, 0.045 + inten * 0.05, beatInBar === 6);
      if (inten > 0.4 && beatInBar % 2 === 1) hat(t + (60 / bpm) * 0.25, 0.03, false);

      // ---- arpeggio 16th khi cường độ cao ----
      if (inten > 0.5 && beatInBar % 2 === 0) {
        const n = PENTA[(s * 3 + bar) % PENTA.length];
        lead(n, t, 0.16, 0.05 + inten * 0.05);
      }
    } else {
      // ---- menu: lead thưa ----
      if (beatInBar === 0 && bar % 2 === 0) {
        const n = PENTA[(bar / 2) % PENTA.length | 0];
        lead(n, t, 1.4, 0.055);
      }
      if (beatInBar === 4 && bar % 2 === 1) {
        const n = PENTA[((bar - 1) / 2 + 2) % PENTA.length | 0];
        lead(n * 0.5, t, 1.6, 0.04);
      }
    }
  }

  // ---------- public ----------
  function applyVolume() {
    if (!bus) return;
    bus.gain.setTargetAtTime(muted ? 0 : volume * 0.9, now(), 0.05);
  }

  return {
    init,
    get ready() { return ready; },
    setScene(m) {
      if (m !== 'menu' && m !== 'combat') return;
      mode = m;
      fadeMode = m;
    },
    setIntensity(v) { intensity = Math.max(0, Math.min(1, v || 0)); },
    setVolume(v) { volume = Math.max(0, Math.min(1, v || 0)); applyVolume(); },
    getVolume() { return volume; },
    setMuted(m) { muted = !!m; applyVolume(); },
    isMuted() { return muted; },
    resume() { if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} } }
  };
})();
