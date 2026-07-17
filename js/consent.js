/* ============================================================
   DraftVersus — küçük çerez bildirimi
   Yalnızca analitik/reklam gerçekten yapılandırılmışsa görünür;
   "Tamam" sonrası localStorage ile bir daha gösterilmez.
   ============================================================ */
(function () {
  try { if (localStorage.getItem('kd_cookie_ok')) return; } catch (_) { return; }
  const c = window.KD_CONFIG || {};
  const a = c.ADSTERRA || {};
  if (!c.GA_ID && !a.banner728 && !a.banner320 && !a.socialBarSrc) return;
  const bar = document.createElement('div');
  bar.id = 'cookie-bar';
  bar.innerHTML = '<span>Bu site, deneyimi ölçmek ve reklam sunmak için çerez kullanır. '
    + '<a href="gizlilik.html">Detaylar</a></span><button id="cookie-ok" type="button">Tamam</button>';
  document.body.appendChild(bar);
  document.getElementById('cookie-ok').onclick = function () {
    try { localStorage.setItem('kd_cookie_ok', '1'); } catch (_) {}
    bar.remove();
  };
})();
