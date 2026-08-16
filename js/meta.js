/* ============================================================
   DraftVersus — Meta ilerleme (run'lar arası kalıcı açılımlar)
   Oyun yapı olarak run-tabanlı: her seri başlar, biter, sıfırlanır.
   Eksik olan tek parça run'lar arası ilerlemeydi — bu modül onu ekler.

   TASARIM İLKESİ: Açılımlar GÜÇ vermez, SEÇENEK verir (yatay ilerleme).
   Aksi halde online 1v1 adaleti bozulur ve oyun "pay-to-win" hissettirir.
   Kilitli diziliş/felsefe yalnızca çeşitlilik sunar; hiçbiri diğerinden
   güçlü değildir.

   XP geriye dönük hesaplanır: mevcut oyuncular (KD_PROFILE verisi olanlar)
   seviyelerini kaybetmiş hissetmez — geçmiş serileri sayılır.
   ============================================================ */
(function () {
  const KEY = 'kd_meta_v1';
  const handlers = [];
  let cache = null;

  /* ---- Seviye eğrisi: ilk seviyeler hızlı, sonrakiler yavaşlar ---- */
  const THRESHOLDS = [0, 40, 100, 190, 320, 500, 740, 1050, 1450, 1950, 2600];
  function levelOf(xp) {
    let lv = 1;
    for (let i = 0; i < THRESHOLDS.length; i++) if (xp >= THRESHOLDS[i]) lv = i + 1;
    return lv;
  }
  function levelBounds(lv) {
    const lo = THRESHOLDS[lv - 1] != null ? THRESHOLDS[lv - 1] : THRESHOLDS[THRESHOLDS.length - 1];
    const hi = THRESHOLDS[lv] != null ? THRESHOLDS[lv] : null;   // null = son seviye
    return { lo, hi };
  }

  /* ---- Açılımlar: seviye → içerik. İçerik zaten oyunda var, sadece kademelendi. ----
     Başlangıçta 2 diziliş + 3 felsefe açık: yeni oyuncu boğulmaz, tecrübeli oyuncu
     ilerledikçe repertuvarı genişler. */
  const UNLOCKS = [
    { lv: 2, kind: 'formation', id: '4-2-3-1', label: '4-2-3-1 dizilişi' },
    { lv: 3, kind: 'philosophy', id: 'Defansif Blok', label: 'Defansif Blok felsefesi' },
    { lv: 4, kind: 'formation', id: '3-5-2', label: '3-5-2 dizilişi' },
    { lv: 5, kind: 'philosophy', id: 'Direkt', label: 'Direkt oyun felsefesi' },
    { lv: 6, kind: 'formation', id: '5-3-2', label: '5-3-2 dizilişi' },
    { lv: 7, kind: 'philosophy', id: 'Kanat', label: 'Kanat oyunu felsefesi' },
  ];
  /* Başlangıç seti kulübün VARSAYILANLARINI içermek zorunda (newClub: 4-3-3 +
     Yüksek Pres) — aksi halde yeni oyuncu kilitli bir seçimle başlar ve
     değiştirdikten sonra geri dönemez. */
  const BASE_FORMATIONS = ['4-4-2', '4-3-3'];
  const BASE_PHILOSOPHIES = ['Topa Sahip Olma', 'Kontra', 'Yüksek Pres'];

  function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }
  function load() {
    if (cache) return cache;
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) {}
    const p = raw && safeParse(raw);
    cache = { v: 1, xp: 0, seen: [] };   // seen: kullanıcıya gösterilmiş açılımlar
    if (p && typeof p === 'object') {
      cache.xp = +p.xp || 0;
      cache.seen = Array.isArray(p.seen) ? p.seen.slice(0, 60) : [];
    } else {
      cache.xp = backfillXP();   // ilk çalıştırma: geçmiş serilerden XP türet
    }
    return cache;
  }
  /* Mevcut oyuncu kilitli hissetmesin: eski istatistiklerden XP üret. */
  function backfillXP() {
    if (!window.KD_PROFILE) return 0;
    const p = KD_PROFILE.get();
    return Math.round((p.seriesPlayed || 0) * 12 + (p.seriesWon || 0) * 18
      + (p.matchesWon || 0) * 4 + (p.bestStreak || 0) * 25);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
    handlers.forEach(fn => { try { fn(get()); } catch (_) {} });
  }

  function get() {
    const c = load(), lv = levelOf(c.xp), b = levelBounds(lv);
    return {
      xp: c.xp, level: lv,
      levelStart: b.lo, levelEnd: b.hi,
      intoLevel: c.xp - b.lo,
      needed: b.hi != null ? b.hi - b.lo : null,
      pct: b.hi != null ? Math.max(0, Math.min(100, Math.round((c.xp - b.lo) / (b.hi - b.lo) * 100))) : 100,
      maxed: b.hi == null,
    };
  }

  /* Seri sonucundan XP: oynamak her zaman kazandırır, kazanmak daha çok. */
  function addForSeries(info) {
    const c = load();
    let gain = 12;
    if (info) {
      if (info.won) gain += 18;
      gain += Math.min(3, (info.matches || []).filter(m => m.winner === 'a').length) * 4;
      if (info.daily) gain += 10;               // günlük meydan okuma teşviki
      if (info.mode === 'online') gain += 6;    // insan rakip daha değerli
    }
    const before = levelOf(c.xp);
    c.xp += gain;
    const after = levelOf(c.xp);
    save();
    return { gain, levelUp: after > before, from: before, to: after,
      unlocked: UNLOCKS.filter(u => u.lv > before && u.lv <= after) };
  }

  /* ---- Kilit sorguları (oyun bunları kullanır) ---- */
  function unlockedIds(kind) {
    const lv = levelOf(load().xp);
    return UNLOCKS.filter(u => u.kind === kind && u.lv <= lv).map(u => u.id);
  }
  function formations() { return BASE_FORMATIONS.concat(unlockedIds('formation')); }
  function philosophies() { return BASE_PHILOSOPHIES.concat(unlockedIds('philosophy')); }
  function isUnlocked(kind, id) {
    if (kind === 'formation') return formations().indexOf(id) >= 0;
    if (kind === 'philosophy') return philosophies().indexOf(id) >= 0;
    return true;
  }
  /* Kilitli bir şeyin hangi seviyede açılacağı (arayüzde ipucu için) */
  function lockLevel(kind, id) {
    const u = UNLOCKS.find(x => x.kind === kind && x.id === id);
    return u ? u.lv : null;
  }
  /* Sıradaki açılım — ilerleme çubuğunun altında hedef göstermek için */
  function nextUnlock() {
    const lv = levelOf(load().xp);
    return UNLOCKS.find(u => u.lv > lv) || null;
  }

  window.KD_META = {
    get, addForSeries, formations, philosophies, isUnlocked, lockLevel, nextUnlock,
    UNLOCKS, THRESHOLDS,
    reset() { cache = { v: 1, xp: 0, seen: [] }; save(); },
    onChange(fn) { if (typeof fn === 'function') handlers.push(fn); },
  };
})();
