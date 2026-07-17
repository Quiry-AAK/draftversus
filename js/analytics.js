/* ============================================================
   DraftVersus — Google Analytics 4 sarıcısı
   - KD_CONFIG.GA_ID boşsa hiçbir şey yüklemez (no-op).
   - SPA ekran geçişleri page_view olarak gönderilir (/#ekran).
   - Statik sayfalar (gizlilik, hakkında…) kendi görüntülenmesini
     otomatik gönderir; index.html KD_GAME_PAGE bayrağı koyar,
     orada ilk page_view'i oyun ekran takibi atar.
   ============================================================ */
(function () {
  const ID = (window.KD_CONFIG && window.KD_CONFIG.GA_ID) || '';
  let ready = false, lastScreen = null;
  function gtag() { window.dataLayer.push(arguments); }

  if (ID) {
    window.dataLayer = window.dataLayer || [];
    gtag('js', new Date());
    gtag('config', ID, { send_page_view: false });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);
    ready = true;
  }

  function page(path, title) {
    if (!ready) return;
    gtag('event', 'page_view', {
      page_location: location.origin + path,
      page_path: path,
      page_title: title || document.title,
    });
  }

  window.KD_ANALYTICS = {
    /* oyun ekranı değişimi (home, draft, match…) — aynı ekranı tekrarlamaz */
    screen(name) {
      if (!ready || !name || name === lastScreen) return;
      lastScreen = name;
      page('/#' + name, 'DraftVersus · ' + name);
    },
    /* özel olay: KD_ANALYTICS.event('series_end', { mode:'ai', won:1 }) */
    event(name, params) { if (ready) gtag('event', name, params || {}); },
    page,
  };

  if (!window.KD_GAME_PAGE) page(location.pathname || '/');
})();
