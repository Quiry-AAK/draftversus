/* ============================================================
   DraftVersus — Günün Meydan Okuması
   Her gün herkes AYNI draft havuzuyla oynar (tarihten türetilen tohum).
   Sonuç tarayıcıda saklanır; ertesi gün otomatik sıfırlanır.
   Hesap gerekmez.
   ============================================================ */
(function () {
  const KEY = 'kd_daily_v1';

  function todayId() {
    const d = new Date();
    const p = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function seed() { return 'dv-daily-' + todayId(); }

  function read() {
    try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return (r && r.id === todayId()) ? r : null; }
    catch (_) { return null; }
  }
  function save(res) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ id: todayId() }, res))); } catch (_) {}
  }
  function playedToday() { return !!read(); }

  /* insan okunur tarih: "20 Temmuz" */
  function label() {
    const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date();
    /* İngilizce sürümde ay adı ve sıralama İngilizce biçimde ("17 August"
       yerine "August 17") — sözlükten geçirilemez, çünkü tarih her gün değişir. */
    if (window.KD_I18N && KD_I18N.lang() === 'en') return MO[d.getMonth()] + ' ' + d.getDate();
    return d.getDate() + ' ' + AY[d.getMonth()];
  }
  /* gece yarısına kalan süre: "6s 12dk" */
  function untilReset() {
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const ms = next - now, h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
    if (window.KD_I18N && KD_I18N.lang() === 'en') return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
    return h > 0 ? (h + 's ' + m + 'dk') : (m + 'dk');
  }

  window.KD_DAILY = { id: todayId, seed, read, save, playedToday, label, untilReset };
})();
