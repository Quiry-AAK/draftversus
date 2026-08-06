/* ============================================================
   DraftVersus — kalıcı oyuncu profili (hesapsız)
   Tüm istatistikler tarayıcıda (localStorage) birikir; giriş
   gerekmez, sunucuya bir şey gönderilmez. Firebase ile giriş
   yapılırsa auth.js bu veriyi buluta yansıtır (opsiyonel katman).

   Dışa açılan API:
     KD_PROFILE.get()                → istatistik nesnesi (kopya)
     KD_PROFILE.recordSeries(info)   → seri sonucunu işler
     KD_PROFILE.merge(remote)        → bulut verisiyle birleştirir
     KD_PROFILE.reset()              → sıfırlar
     KD_PROFILE.onChange(fn)         → değişimde haber verir
   ============================================================ */
(function () {
  const KEY = 'kd_profile_v1';
  const BLANK = {
    v: 1,
    seriesPlayed: 0, seriesWon: 0,
    matchesPlayed: 0, matchesWon: 0,
    goalsFor: 0, goalsAgainst: 0,
    streak: 0, bestStreak: 0,          // üst üste kazanılan seri
    aiSeries: 0, onlineSeries: 0,
    createdAt: 0, lastPlayedAt: 0,
  };
  const handlers = [];
  let cache = null;

  function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }
  function load() {
    if (cache) return cache;
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) {}
    const p = (raw && safeParse(raw)) || null;
    cache = Object.assign({}, BLANK, p && typeof p === 'object' ? p : {});
    if (!cache.createdAt) cache.createdAt = Date.now();
    return cache;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
    handlers.forEach(fn => { try { fn(get()); } catch (_) {} });
  }
  function get() { return Object.assign({}, load()); }

  /* info: { mode:'ai'|'online', won:bool, matches:[{a,b,winner}], format } */
  function recordSeries(info) {
    if (!info) return get();
    const p = load();
    p.seriesPlayed++;
    if (info.won) { p.seriesWon++; p.streak++; if (p.streak > p.bestStreak) p.bestStreak = p.streak; }
    else p.streak = 0;
    if (info.mode === 'online') p.onlineSeries++; else p.aiSeries++;
    (info.matches || []).forEach(m => {
      p.matchesPlayed++;
      const a = +m.a || 0, b = +m.b || 0;
      p.goalsFor += a; p.goalsAgainst += b;
      if (m.winner === 'a') p.matchesWon++;
    });
    p.lastPlayedAt = Date.now();
    save();
    return get();
  }

  /* Bulut verisiyle birleştir: her alanda daha yüksek olan kazanır
     (farklı cihazlarda oynanmış olabilir; veri kaybetmemek esas). */
  function merge(remote) {
    if (!remote || typeof remote !== 'object') return get();
    const p = load();
    ['seriesPlayed', 'seriesWon', 'matchesPlayed', 'matchesWon', 'goalsFor', 'goalsAgainst',
     'bestStreak', 'aiSeries', 'onlineSeries'].forEach(k => {
      const r = +remote[k]; if (isFinite(r) && r > (+p[k] || 0)) p[k] = r;
    });
    if (+remote.lastPlayedAt > (+p.lastPlayedAt || 0)) { p.lastPlayedAt = +remote.lastPlayedAt; p.streak = +remote.streak || p.streak; }
    if (+remote.createdAt && (!p.createdAt || +remote.createdAt < p.createdAt)) p.createdAt = +remote.createdAt;
    save();
    return get();
  }

  function reset() { cache = Object.assign({}, BLANK, { createdAt: Date.now() }); save(); return get(); }

  window.KD_PROFILE = {
    get, recordSeries, merge, reset,
    onChange(fn) { if (typeof fn === 'function') handlers.push(fn); },
    /* kullanışlı türetilmiş değerler */
    winRate() { const p = load(); return p.seriesPlayed ? Math.round(p.seriesWon / p.seriesPlayed * 100) : 0; },
    hasData() { return load().seriesPlayed > 0; },
  };
})();
