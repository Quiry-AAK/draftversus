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

  /* Adsterra — adsterra.com → Websites → Add new code
     Banner için "Banner 728x90" ve "Banner 320x50" birimlerini oluştur;
     verilen koddaki  atOptions.key  değerini buraya yapıştır. */
  ADSTERRA: {
    bannerHost: 'smelthrsfranz.com',                 // invoke.js'in geldiği domain (Adsterra kodundaki src)
    banner728: 'b64c736efcc75620a0e7018f54c5d781',   // 728x90 masaüstü banner key'i
    banner320: 'fdf3cb6cfae271166f6a89ae6a120597',   // 320x50 mobil banner key'i
    /* Social Bar (daha agresif format — kapatmak için boş string yap) */
    socialBarSrc: 'https://smelthrsfranz.com/f7/c2/b9/f7c2b9f4996a679c4e9ee6d625543d51.js',
  },
};
