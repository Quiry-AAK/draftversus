/* ============================================================
   DraftVersus — küçük çerez bildirimi
   Yalnızca analitik/reklam gerçekten yapılandırılmışsa görünür;
   "Tamam" sonrası localStorage ile bir daha gösterilmez.
   Dil ve konum farkında: /en/ altında İngilizce metin ve doğru
   gizlilik sayfası bağlantısı kullanılır (aksi halde /en/gizlilik.html
   gibi kırık bir bağlantı oluşurdu).
   ============================================================ */
(function () {
  try { if (localStorage.getItem('kd_cookie_ok')) return; } catch (_) { return; }
  const c = window.KD_CONFIG || {};
  /* Portal derlemesi: kendi reklam ağımız yok ve onay yönetimi portala ait —
     üstüne ikinci bir çerez çubuğu basmak hem gereksiz hem de gizlilik
     sayfamıza kırık bağlantı verir (o sayfa pakete girmiyor). */
  if (c.BUILD === 'portal') return;
  const a = c.ADSTERRA || {};
  const s = c.ADSENSE || {};
  if (!c.GA_ID && !s.client && !a.banner728 && !a.banner320 && !a.socialBarSrc) return;

  /* İngilizce sürüm: sayfa /en/ altındaysa ya da dil EN'e zorlanmışsa */
  const isEN = window.KD_FORCE_LANG === 'en' || /(^|\/)en\//.test(location.pathname);
  const txt = isEN
    ? 'This site uses cookies to measure the experience and serve ads. '
    : 'Bu site, deneyimi ölçmek ve reklam sunmak için çerez kullanır. ';
  const more = isEN ? 'Details' : 'Detaylar';
  const okLabel = isEN ? 'Got it' : 'Tamam';
  const href = isEN ? 'privacy.html' : 'gizlilik.html';

  const bar = document.createElement('div');
  bar.id = 'cookie-bar';
  bar.innerHTML = '<span>' + txt + '<a href="' + href + '">' + more + '</a></span>'
    + '<button id="cookie-ok" type="button">' + okLabel + '</button>';
  document.body.appendChild(bar);
  document.getElementById('cookie-ok').onclick = function () {
    try { localStorage.setItem('kd_cookie_ok', '1'); } catch (_) {}
    bar.remove();
  };
})();
