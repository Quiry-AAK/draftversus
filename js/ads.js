/* ============================================================
   DraftVersus — reklam yöneticisi (AdSense öncelikli, Adsterra yedek)
   İlke: oyun bağırmasın. Banner yalnızca menü/ara ekranlarında
   (home, online, lobby, between, result) görünür; draft/düello/
   taktik/maç sırasında tamamen kaldırılır.

   Ağ seçimi KD_CONFIG'e göre otomatik:
     ADSENSE.client varsa            → doğrulama/Auto-ads script'i yüklenir
     ADSENSE.client + slot doluysa   → banner AdSense birimi olur (yüksek CPM)
     slot henüz yoksa                → banner Adsterra'da kalır (gelir kesilmez)
     hiçbiri yoksa                   → hiçbir şey yüklenmez
   ============================================================ */
(function () {
  const CFG = window.KD_CONFIG || {};
  const S = CFG.ADSENSE || {};
  const A = CFG.ADSTERRA || {};
  const HAS_CLIENT = !!S.client;
  const USE_ADSENSE = !!(S.client && S.slot);
  const ADSTERRA_ON = A.enabled !== false;
  /* Banner'ın görüneceği ekranlar: AdSense tüm menü ekranlarında,
     Adsterra ise config'te izin verilenlerde (kontrollü gösterim). */
  const DEFAULT_SCREENS = ['home', 'online', 'lobby', 'between', 'result'];
  const allow = USE_ADSENSE ? DEFAULT_SCREENS : (Array.isArray(A.screens) ? A.screens : DEFAULT_SCREENS);
  const MENU_SCREENS = {};
  allow.forEach(s => { MENU_SCREENS[s] = 1; });
  let active = false, senseLoaded = false;

  function slot() { return document.getElementById('ad-slot'); }
  function barHeight() { return window.innerWidth < 760 ? 60 : 90; }

  /* ---------- AdSense ---------- */
  function loadSenseScript() {
    if (senseLoaded) return;
    senseLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(S.client);
    document.head.appendChild(s);
  }
  function showSense(el) {
    loadSenseScript();
    const h = barHeight();
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;width:100%;height:' + h + 'px';
    ins.setAttribute('data-ad-client', S.client);
    ins.setAttribute('data-ad-slot', S.slot);
    ins.setAttribute('data-ad-format', 'horizontal');
    ins.setAttribute('data-full-width-responsive', 'true');
    el.appendChild(ins);
    el.style.display = 'flex';
    document.body.classList.add('has-ad');
    document.body.style.setProperty('--ad-h', h + 'px');
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
  }

  /* ---------- Adsterra (yedek) ---------- */
  function pickAdsterra() {
    if (!ADSTERRA_ON) return null;   // ana şalter kapalı
    const mobile = window.innerWidth < 760;
    if (mobile && A.banner320) return { key: A.banner320, w: 320, h: 50 };
    if (!mobile && A.banner728) return { key: A.banner728, w: 728, h: 90 };
    if (A.banner320) return { key: A.banner320, w: 320, h: 50 };
    if (A.banner728) return { key: A.banner728, w: 728, h: 90 };
    return null;
  }
  function showAdsterra(el) {
    const b = pickAdsterra();
    if (!b) return false;
    const ifr = document.createElement('iframe');
    ifr.width = b.w; ifr.height = b.h;
    ifr.setAttribute('frameborder', '0');
    ifr.setAttribute('scrolling', 'no');
    ifr.title = 'Reklam';
    ifr.style.cssText = 'border:0;overflow:hidden;display:block;max-width:100%';
    el.appendChild(ifr);
    el.style.display = 'flex';
    document.body.classList.add('has-ad');
    document.body.style.setProperty('--ad-h', b.h + 'px');
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;display:flex;justify-content:center">'
      + '<scr' + 'ipt>atOptions={"key":"' + b.key + '","format":"iframe","height":' + b.h + ',"width":' + b.w + ',"params":{}};</scr' + 'ipt>'
      + '<scr' + 'ipt src="https://' + (A.bannerHost || 'www.highperformanceformat.com') + '/' + b.key + '/invoke.js"></scr' + 'ipt>'
      + '</body></html>');
    doc.close();
    return true;
  }

  function show() {
    const el = slot();
    if (!el || active) return;
    if (USE_ADSENSE) { showSense(el); active = true; return; }
    if (showAdsterra(el)) active = true;
  }
  function hide() {
    const el = slot();
    if (!el) return;
    el.innerHTML = '';
    el.style.display = 'none';
    document.body.classList.remove('has-ad');
    active = false;
  }

  window.KD_ADS = {
    onScreen(name) { if (MENU_SCREENS[name]) show(); else hide(); },
    network: USE_ADSENSE ? 'adsense' : (pickAdsterra() ? 'adsterra' : 'none'),
    verifying: HAS_CLIENT && !USE_ADSENSE,   // onay bekleniyor: script var, birim yok
  };

  /* AdSense script'i client varsa sayfa açılışında yüklenir — site doğrulaması
     ve Auto ads bunu gerektirir (slot henüz yokken de). */
  if (HAS_CLIENT) loadSenseScript();

  /* Social Bar — yalnızca src verilmişse. AdSense sürecinde HİÇ yüklenmez
     (pop-under tarzı formatlar onay/politika riski yaratır). */
  if (!HAS_CLIENT && ADSTERRA_ON && A.socialBarSrc) {
    const s = document.createElement('script');
    s.src = A.socialBarSrc;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    document.body.appendChild(s);
  }
})();
