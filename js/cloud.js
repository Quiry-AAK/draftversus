/* ============================================================
   DraftVersus — opsiyonel bulut senkronu (Firebase Auth + Firestore)
   İlke: giriş ZORUNLU DEĞİL. Oyun her zaman yerel profille çalışır;
   kullanıcı isterse Google ile giriş yapıp ilerlemesini cihazlar
   arasında taşır.

   Performans: Firebase SDK yalnızca gerektiğinde (giriş isteğinde ya da
   daha önce giriş yapılmışsa) dinamik import ile yüklenir — giriş
   yapmayan ziyaretçi tek bayt fazladan indirmez.

   Veri: /users/{uid} → profil istatistikleri. Firestore kuralları
   kullanıcıyı yalnızca kendi belgesine kısıtlar.
   ============================================================ */
(function () {
  const CFG = (window.KD_CONFIG || {}).FIREBASE || {};
  const ENABLED = !!(CFG.apiKey && CFG.projectId);
  const FLAG = 'kd_cloud_on';          // daha önce giriş yapıldı mı
  const V = '10.12.2';
  const BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';

  let mods = null, app = null, auth = null, db = null;
  let user = null, busy = false, ready = false;

  function flagged() { try { return localStorage.getItem(FLAG) === '1'; } catch (_) { return false; } }
  function setFlag(on) { try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch (_) {} }
  function rerender() { if (window.KD_GAME_RENDER) try { KD_GAME_RENDER(); } catch (_) {} }

  async function load() {
    if (mods) return mods;
    const [a, b, c] = await Promise.all([
      import(BASE + 'firebase-app.js'),
      import(BASE + 'firebase-auth.js'),
      import(BASE + 'firebase-firestore.js'),
    ]);
    mods = { app: a, auth: b, fs: c };
    app = a.initializeApp(CFG);
    auth = b.getAuth(app);
    db = c.getFirestore(app);
    return mods;
  }

  /* oturumu izle: giriş/çıkışta profil şeridi güncellenir */
  async function watch() {
    const m = await load();
    m.auth.onAuthStateChanged(auth, async (u) => {
      user = u || null;
      ready = true;
      if (user) { setFlag(true); await pull(); }
      rerender();
    });
  }

  async function signIn() {
    if (!ENABLED || busy) return;
    busy = true; rerender();
    try {
      const m = await load();
      const provider = new m.auth.GoogleAuthProvider();
      await m.auth.signInWithPopup(auth, provider);   // user onAuthStateChanged ile gelir
    } catch (e) {
      if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        if (window.KD_TOAST) KD_TOAST('Giriş yapılamadı, tekrar dene');
      }
    } finally { busy = false; rerender(); }
  }

  async function signOutNow() {
    if (!auth) return;
    busy = true; rerender();
    try { await mods.auth.signOut(auth); user = null; setFlag(false); }
    catch (_) {} finally { busy = false; rerender(); }
  }

  /* buluttaki veriyi çekip yerelle birleştir (veri kaybı olmasın) */
  async function pull() {
    if (!user || !db || !window.KD_PROFILE) return;
    try {
      const m = mods.fs;
      const snap = await m.getDoc(m.doc(db, 'users', user.uid));
      if (snap.exists()) KD_PROFILE.merge(snap.data().profile || {});
      await push();   // birleşmiş hali geri yaz
    } catch (_) {}
  }

  /* yerel profili buluta yaz (seri bitince game.js çağırır) */
  async function push() {
    if (!user || !db || !window.KD_PROFILE) return;
    try {
      const m = mods.fs;
      await m.setDoc(m.doc(db, 'users', user.uid), {
        profile: KD_PROFILE.get(),
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (_) {}
  }

  /* profil şeridinde gösterilen giriş durumu */
  function statusHTML() {
    if (!ENABLED) return '';
    if (busy) return '<div class="ps-cloud"><span>bağlanılıyor…</span></div>';
    if (user) {
      const name = (user.displayName || user.email || 'Hesap').split(' ')[0].slice(0, 14);
      return '<div class="ps-cloud"><span class="ps-who"><span class="ps-dot"></span>'
        + name.replace(/[<>&"']/g, '') + ' · kayıtlı</span>'
        + '<button class="ps-btn" id="cloud-out" type="button">Çıkış</button></div>';
    }
    return '<div class="ps-cloud"><button class="ps-btn" id="cloud-in" type="button">☁ İlerlemeni kaydet</button></div>';
  }
  /* profil şeridi her render edildiğinde butonları bağla */
  function bind() {
    const i = document.getElementById('cloud-in'); if (i) i.onclick = signIn;
    const o = document.getElementById('cloud-out'); if (o) o.onclick = signOutNow;
  }

  window.KD_CLOUD = {
    enabled: ENABLED,
    statusHTML, bind, push, signIn, signOut: signOutNow,
    user() { return user; },
  };

  // daha önce giriş yapılmışsa oturumu sessizce geri getir
  if (ENABLED && flagged()) watch().catch(() => {});
})();
