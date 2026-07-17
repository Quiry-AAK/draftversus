/* ============================================================
   DraftVersus — Adsterra reklam yöneticisi
   İlke: oyun bağırmasın. Banner yalnızca menü/ara ekranlarında
   (home, online, lobby, between, result) görünür; draft/düello/
   taktik/maç sırasında tamamen kaldırılır.
   - Key'ler KD_CONFIG.ADSTERRA içinde; boşsa hiçbir şey yüklenmez.
   - Banner, izole bir iframe içine yazılır (atOptions çakışmaz).
   ============================================================ */
(function () {
  const A = (window.KD_CONFIG && window.KD_CONFIG.ADSTERRA) || {};
  const MENU_SCREENS = { home: 1, online: 1, lobby: 1, between: 1, result: 1 };
  let active = false;

  function slot() { return document.getElementById('ad-slot'); }

  function pick() {
    const mobile = window.innerWidth < 760;
    if (mobile && A.banner320) return { key: A.banner320, w: 320, h: 50 };
    if (!mobile && A.banner728) return { key: A.banner728, w: 728, h: 90 };
    if (A.banner320) return { key: A.banner320, w: 320, h: 50 };
    if (A.banner728) return { key: A.banner728, w: 728, h: 90 };
    return null;
  }

  function show() {
    const el = slot();
    if (!el || active) return;
    const b = pick();
    if (!b) return;
    const ifr = document.createElement('iframe');
    ifr.width = b.w; ifr.height = b.h;
    ifr.setAttribute('frameborder', '0');
    ifr.setAttribute('scrolling', 'no');
    ifr.title = 'Reklam';
    ifr.style.cssText = 'border:0;overflow:hidden;display:block;max-width:100%';
    el.appendChild(ifr);
    el.style.display = 'flex';
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;display:flex;justify-content:center">'
      + '<scr' + 'ipt>atOptions={"key":"' + b.key + '","format":"iframe","height":' + b.h + ',"width":' + b.w + ',"params":{}};</scr' + 'ipt>'
      + '<scr' + 'ipt src="https://' + (A.bannerHost || 'www.highperformanceformat.com') + '/' + b.key + '/invoke.js"></scr' + 'ipt>'
      + '</body></html>');
    doc.close();
    active = true;
  }

  function hide() {
    const el = slot();
    if (!el) return;
    el.innerHTML = '';
    el.style.display = 'none';
    active = false;
  }

  window.KD_ADS = {
    onScreen(name) { if (MENU_SCREENS[name]) show(); else hide(); },
  };

  /* Social Bar — opsiyonel, yalnızca src verilmişse (tüm sayfa geneli) */
  if (A.socialBarSrc) {
    const s = document.createElement('script');
    s.src = A.socialBarSrc;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    document.body.appendChild(s);
  }
})();
