/* ============================================================
   DraftVersus — yayın yapılandırması (TEK YERDEN)
   Aşağıdaki değerleri kendi panellerinden alıp doldur.
   Boş bırakılan her özellik kendini otomatik kapatır
   (kod yüklenmez, konsol hatası olmaz).
   ============================================================ */
window.KD_CONFIG = {
  /* Google Analytics 4
     analytics.google.com → Yönetici → Veri Akışları → akışını seç
     → "Ölçüm Kimliği" (G-XXXXXXXXXX) buraya. */
  GA_ID: 'G-QJJH9DB3JR',

  /* ---------- Firebase (opsiyonel giriş + ilerleme senkronu) ----------
     Proje: draftversus (Auth: Google, Firestore: europe-west3)
     NOT: Web API anahtarı gizli değildir; güvenlik Firestore kurallarıyla
     sağlanır (kullanıcı yalnızca kendi /users/{uid} belgesine erişebilir).
     Boş bırakılırsa giriş özelliği tamamen kapanır, oyun yerel profille çalışır. */
  FIREBASE: {
    apiKey: 'AIzaSyCbE16HTyR1YLRb_DlM88wSXCLTxEN5qWw',
    authDomain: 'draftversus.firebaseapp.com',
    projectId: 'draftversus',
    storageBucket: 'draftversus.firebasestorage.app',
    messagingSenderId: '301901642422',
    appId: '1:301901642422:web:b2dd213ba9d02ceb940417',
  },

  /* ---------- Google AdSense (öncelikli reklam ağı) ----------
     CPM'i Adsterra'nın birkaç katı. Onay gelince aşağıyı doldur:
       1) adsense.google.com → Siteler → draftversus.com ekle, onayı bekle
       2) Reklamlar → Reklam birimine göre → "Görüntülü reklam" oluştur
          (responsive) → verilen koddaki:
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"  → client
            data-ad-slot="1234567890"                 → slot
     client doluyken AdSense yüklenir; boşken otomatik Adsterra'ya düşer. */
  ADSENSE: {
    client: 'ca-pub-3889797797438326',   // yayıncı kimliği (site doğrulaması için yeterli)
    /* slot: onay geldikten sonra AdSense → Reklamlar → "Reklam birimine göre"
       → Görüntülü reklam (responsive) oluştur, data-ad-slot değerini buraya yaz.
       Boş kaldığı sürece banner alanında Adsterra gösterilmeye devam eder. */
    slot: '',
  },

  /* Adsterra — AdSense onaylanana kadar (ya da reddedilirse) yedek ağ.
     adsterra.com → Websites → Add new code; koddaki atOptions.key buraya. */
  ADSTERRA: {
    /* Ana şalter: false yaparsan Adsterra hiç yüklenmez (AdSense onayı
       riskli görünürse tek satırla kapatabilirsin). */
    enabled: true,
    /* Hangi oyun ekranlarında gösterilsin. Az ekran = az gösterim = az risk.
       Tümü:     ['home','online','lobby','between','result']
       Kısıtlı:  ['between','result']   ← sadece maç arası ve seri sonu
       NOT: İçerik sayfalarında (SSS, strateji, hakkında…) zaten hiç
       gösterilmez — oraya reklam alanı konmadı, Google incelemesi temiz görür. */
    screens: ['home', 'online', 'lobby', 'between', 'result'],
    bannerHost: 'smelthrsfranz.com',                 // invoke.js'in geldiği domain (Adsterra kodundaki src)
    banner728: 'b64c736efcc75620a0e7018f54c5d781',   // 728x90 masaüstü banner key'i
    banner320: 'fdf3cb6cfae271166f6a89ae6a120597',   // 320x50 mobil banner key'i
    /* Social Bar KAPALI: pop-under tarzı agresif format AdSense onayını
       riske atar (ve oyun deneyimini bozar). AdSense'ten vazgeçilirse
       eski değeri geri koyabilirsin:
       'https://smelthrsfranz.com/f7/c2/b9/f7c2b9f4996a679c4e9ee6d625543d51.js' */
    socialBarSrc: '',
  },
};
