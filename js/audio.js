/* ============================================================
   SKYWARD SALVAGE — audio.js
   Toàn bộ âm thanh được tổng hợp bằng WebAudio, không cần file ngoài.
   ============================================================ */
const Sound = (() => {
  let ctx = null;
  let master = null;      // bus SFX
  let masterBus = null;   // bus tổng
  let muted = false;
  let volume = 0.6;
  let masterVolume = 0.8;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    masterBus = ctx.createGain();
    masterBus.gain.value = muted ? 0 : masterVolume;
    master.connect(masterBus);
    masterBus.connect(ctx.destination);
    return true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function noiseBuffer(dur) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function env(g, t, attack, decay, peak) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function tone(freq, dur, type, peak, slideTo) {
    if (!ensure()) return;
    resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    env(g, t, 0.005, dur, peak || 0.3);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, peak, filterFreq, type) {
    if (!ensure()) return;
    resume();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    env(g, t, 0.004, dur, peak || 0.3);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  const later = (fn, ms) => setTimeout(fn, ms);

  return {
    unlock() { ensure(); resume(); },
    ctx() { ensure(); return ctx; },
    masterBus() { ensure(); return masterBus; },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    getVolume() { return volume; },
    setMasterVolume(v) {
      masterVolume = v;
      if (masterBus) masterBus.gain.setTargetAtTime(muted ? 0 : masterVolume, ctx.currentTime, 0.03);
    },
    getMasterVolume() { return masterVolume; },
    setMuted(m) {
      muted = m;
      if (masterBus) masterBus.gain.setTargetAtTime(m ? 0 : masterVolume, ctx.currentTime, 0.03);
    },
    isMuted() { return muted; },

    shoot(kind) {
      if (kind === 'handcannon') { noise(0.18, 0.45, 900); tone(150, 0.16, 'square', 0.22, 60); }
      else if (kind === 'scout') { noise(0.1, 0.3, 2400, 'bandpass'); tone(420, 0.08, 'sawtooth', 0.16, 180); }
      else { noise(0.08, 0.28, 1800); tone(320, 0.06, 'square', 0.14, 140); }
    },
    reload() {
      tone(700, 0.05, 'square', 0.14);
      later(() => tone(500, 0.05, 'square', 0.14), 110);
      later(() => tone(900, 0.06, 'square', 0.18), 250);
    },
    dry() { tone(1200, 0.04, 'square', 0.09); },
    hit() { tone(1250, 0.05, 'square', 0.14, 900); },
    kill() { tone(880, 0.1, 'triangle', 0.2, 220); later(() => tone(1320, 0.08, 'triangle', 0.12), 60); },
    explosion(big) {
      noise(big ? 0.6 : 0.35, big ? 0.55 : 0.38, big ? 480 : 780);
      tone(big ? 90 : 120, big ? 0.5 : 0.3, 'sine', 0.36, 40);
    },
    hurt() { tone(180, 0.18, 'sawtooth', 0.26, 70); noise(0.12, 0.18, 600); },
    dash() { noise(0.26, 0.22, 3200, 'highpass'); },
    jump() { tone(300, 0.1, 'sine', 0.12, 520); },
    wave() { [523, 659, 784, 1047].forEach((f, i) => later(() => tone(f, 0.16, 'triangle', 0.2), i * 90)); },
    gameover() { [440, 349, 262, 196].forEach((f, i) => later(() => tone(f, 0.35, 'sawtooth', 0.18), i * 170)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => later(() => tone(f, 0.25, 'triangle', 0.2), i * 110)); },
    ui() { tone(900, 0.04, 'square', 0.09); },
    uiBig() { tone(660, 0.09, 'triangle', 0.14, 990); },
    enemyShot() { tone(300, 0.12, 'sawtooth', 0.1, 120); }
  };
})();
