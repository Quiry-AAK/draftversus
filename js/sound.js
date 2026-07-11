/* ============================================================
   Kadro Düellosu — ses efektleri (WebAudio sentezi, dosya yok)
   KD_SFX.play('pass'|'kick'|'net'|'save'|'goal'|'whistle')
   İlk kullanıcı etkileşiminde AudioContext başlar/devam eder.
   Ayar: localStorage 'kd_sfx' === '0' → kapalı.
   ============================================================ */
(function () {
  let ctx = null, master = null;
  let enabled = (localStorage.getItem('kd_sfx') !== '0');
  let noiseBuf = null;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    // beyaz gürültü tamponu
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  // ilk etkileşimde aç
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, function once() { init(); resume(); }, { once: true, passive: true }));

  function noise(dur, freq, q, gain, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = type || 'bandpass'; bp.frequency.value = freq; bp.Q.value = q || 1;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
  }
  function tone(freq, dur, gain, type, glideTo) {
    const o = ctx.createOscillator(); o.type = type || 'sine'; const g = ctx.createGain(); const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  const SND = {
    pass() { tone(420, 0.09, 0.18, 'triangle', 240); noise(0.06, 1800, 1.5, 0.12); },
    kick() { tone(150, 0.12, 0.4, 'sine', 60); noise(0.05, 900, 1, 0.18); },
    net() { noise(0.28, 700, 0.8, 0.16, 'bandpass'); tone(120, 0.1, 0.18, 'sine', 80); },
    save() { noise(0.22, 1400, 0.7, 0.16); tone(260, 0.12, 0.16, 'square', 180); },
    whistle() { tone(2300, 0.12, 0.13, 'square'); setTimeout(() => { resume(); tone(2500, 0.16, 0.13, 'square'); }, 120); },
    clap() { for (let i = 0; i < 3; i++) setTimeout(() => { resume(); noise(0.05, 1500, 1.2, 0.16); }, i * 110); },
    splash() { noise(0.32, 900, 0.5, 0.2, 'lowpass'); tone(600, 0.2, 0.1, 'sine', 200); },
    cheer() {
      if (!ctx) return; const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(1300, t + 0.3); bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.9);
      src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.95);
    },
    pop() { tone(520, 0.07, 0.14, 'triangle', 360); },
    goal() {
      const t = ctx.currentTime;
      // seyirci coşkusu: yükselen filtreli gürültü
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 0.5); bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.34, t + 0.25); g.gain.setValueAtTime(0.34, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.1);
      src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 2.2);
      // düdük + neşe tonları
      tone(700, 0.5, 0.08, 'sawtooth', 900);
    },
  };

  window.KD_SFX = {
    play(type) { if (!enabled) return; if (!init()) return; resume(); try { (SND[type] || (() => {}))(); } catch (_) {} },
    setEnabled(v) { enabled = !!v; localStorage.setItem('kd_sfx', v ? '1' : '0'); if (v) { init(); resume(); } },
    isEnabled() { return enabled; },
  };
})();
