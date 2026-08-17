/* ============================================================
   DraftVersus — portal SDK adaptörü (CrazyGames)
   YALNIZCA portal derlemesinde yüklenir (KD_CONFIG.BUILD === 'portal').
   Kendi sitemizde (draftversus.com) bu dosya hiç bulunmaz.

   Görevi: oyunun zaten kullandığı iki API'yi portala bağlamak —
     KD_ADS.rewarded(placement)  → window.KD_REWARDED_PROVIDER
     KD_ADS.moment(name)         → window.KD_PORTAL.moment

   Tasarım ilkesi: SDK gelmezse OYUN BOZULMAZ. Her çağrı sessizce
   false/no-op döner; hiçbir buton kilitlenmez, hiçbir hata sızmaz.
   ============================================================ */
(function () {
  if ((window.KD_CONFIG || {}).BUILD !== 'portal') return;

  const SDK_SRC = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
  const AD_TIMEOUT_MS = 30000;   // reklam bu sürede bitmezse ödül verilmez, oyun devam eder

  let sdk = null;          // hazır SDK nesnesi
  let ready = null;        // Promise<sdk|null> — tek sefer çözülür
  let gameplayOn = false;  // gameplayStart/Stop dengesi (SDK çift çağrıdan hoşlanmaz)

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('sdk yüklenemedi'));
      document.head.appendChild(s);
    });
  }

  /* SDK'yı bir kez yükle + init et. Başarısızlıkta null'a çözülür (reject etmez). */
  function ensureSDK() {
    if (ready) return ready;
    ready = loadScript(SDK_SRC)
      .then(() => {
        const CG = window.CrazyGames;
        if (!CG || !CG.SDK) throw new Error('SDK nesnesi yok');
        return CG.SDK.init().then(() => CG.SDK);
      })
      .then((s) => {
        sdk = s;
        /* Yükleme ekranı bittiğini bildir: portal bunu "oyun açıldı"
           metriği için kullanıyor. Oyun senkron açıldığı için hemen. */
        try { s.game.loadingStart(); s.game.loadingStop(); } catch (_) {}
        /* Ödüllü sağlayıcıyı ancak SDK GERÇEKTEN hazırken tak — böylece
           ödül butonları SDK gelmediyse hiç görünmez (hayal kırıklığı yok). */
        window.KD_REWARDED_PROVIDER = requestRewarded;
        return s;
      })
      .catch(() => { sdk = null; return null; });
    return ready;
  }

  /* Reklam boyunca oyun sesini kes (portal kuralı). Kalıcı tercihe dokunmaz. */
  function mute(v) { try { if (window.KD_SFX && KD_SFX.suspend) KD_SFX.suspend(v); } catch (_) {} }

  /* ---------- Ödüllü video ----------
     Sözleşme: Promise<boolean>. true → ödül verilir.
     adFinished  → izlendi, ödül ver
     adError     → envanter yok / hata → sessizce false
     zaman aşımı → false (oyun asla kilitlenmez) */
  function requestRewarded(placement) {
    if (!sdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(!!v); } };
      const timer = setTimeout(() => finish(false), AD_TIMEOUT_MS);
      const end = (v) => { clearTimeout(timer); finish(v); };
      try {
        sdk.ad.requestAd('rewarded', {
          adStarted: () => { mute(true); },
          adFinished: () => { mute(false); end(true); },
          adError: () => { mute(false); end(false); },
        });
      } catch (_) { end(false); }
      /* Ölçüm: hangi yerleşim ne kadar dönüşüyor (Faz 0 hunisiyle aynı kanal) */
      try { if (window.KD_ANALYTICS) KD_ANALYTICS.event('rewarded_request', { placement: placement || '' }); } catch (_) {}
    });
  }

  /* ---------- Oyun anları ----------
     gameplayStart/Stop: portal reklam zamanlamasını buna göre yapar
     (maç sırasında araya reklam sokmaz). happytime: kutlama anı. */
  window.KD_PORTAL = {
    moment(name) {
      ensureSDK().then((s) => {
        if (!s) return;
        try {
          if (name === 'gameplayStart') {
            if (!gameplayOn) { s.game.gameplayStart(); gameplayOn = true; }
          } else if (name === 'gameplayStop') {
            if (gameplayOn) { s.game.gameplayStop(); gameplayOn = false; }
          } else if (name === 'happytime') {
            s.game.happytime();
          }
        } catch (_) {}
      });
    },
    /* Maç aralarındaki doğal duraklarda ara reklam. gameplay AÇIKKEN
       çağrılmaz — portal kuralı bunu yasaklıyor, önce durdurulur. */
    midgame() {
      return ensureSDK().then((s) => {
        if (!s || gameplayOn) return false;
        return new Promise((resolve) => {
          let done = false;
          const fin = (v) => { if (!done) { done = true; resolve(v); } };
          const t = setTimeout(() => fin(false), AD_TIMEOUT_MS);
          try {
            s.ad.requestAd('midgame', {
              adFinished: () => { clearTimeout(t); fin(true); },
              adError: () => { clearTimeout(t); fin(false); },
            });
          } catch (_) { clearTimeout(t); fin(false); }
        });
      });
    },
    available() { return !!sdk; },
  };

  /* Sayfa açılır açılmaz SDK'yı hazırla — ilk ödül isteği beklemesin. */
  ensureSDK();
})();
