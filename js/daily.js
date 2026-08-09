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
    const d = new Date();
    return d.getDate() + ' ' + AY[d.getMonth()];
  }
  /* gece yarısına kalan süre: "6s 12dk" */
  function untilReset() {
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const ms = next - now, h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
    return h > 0 ? (h + 's ' + m + 'dk') : (m + 'dk');
  }

  window.KD_DAILY = { id: todayId, seed, read, save, playedToday, label, untilReset };
})();
