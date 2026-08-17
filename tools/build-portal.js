#!/usr/bin/env node
/* ============================================================
   DraftVersus — portal paketi üretici
     node tools/build-portal.js
   Çıktı: dist/portal/  (CrazyGames'e yüklenecek klasör)

   Neden betik? İkinci bir index.html'i elle bakımda tutmak
   kaçınılmaz olarak kaymaya yol açar (EN sayfalarında meta.js'in
   unutulması gibi). Paket her seferinde kaynak index.html'den
   TÜRETİLİR, böylece script listesi asla ayrışmaz.

   Portal kurallarına göre yapılan dönüşümler:
     · window.KD_BUILD='portal'  → AdSense/Adsterra HİÇ yüklenmez,
       çerez çubuğu çıkmaz, online 1v1 kapanır (sunucu orada yok)
     · js/portal.js eklenir      → ödüllü video + gameplay kancaları
     · footer / noscript linkleri → portal dışına link yasak, silinir
     · #ad-slot                   → kendi banner alanımız kaldırılır
     · canonical/hreflang/og/ld+json → kendi domainimize işaret ediyordu
     · Firebase                   → portalın kendi hesap sistemi var,
       iframe içinde Google popup'ı zaten engellenir; kapatılır
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'portal');

/* Oyunun çalışması için gereken varlıklar (statik sayfalar DAHİL DEĞİL) */
const ASSETS = ['favicon.svg', 'logo-mark.png', 'icon-192.png', 'icon-512.png'];
const DIRS = ['js', 'css'];

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

/* ---------- index.html'i portal sürümüne dönüştür ---------- */
function buildHTML() {
  /* İngilizce sürümü temel al: portal kitlesi İngilizce.
     Yol önekleri ('../') temizlenir, çünkü paket düz klasör. */
  let h = fs.readFileSync(path.join(ROOT, 'en', 'index.html'), 'utf8');
  h = h.replace(/\.\.\//g, '');

  const drop = [
    [/<link rel="canonical"[^>]*>\s*/g, ''],
    [/<link rel="alternate"[^>]*>\s*/g, ''],
    [/<meta property="og:[^>]*>\s*/g, ''],
    [/<meta name="twitter:[^>]*>\s*/g, ''],
    [/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, ''],
    [/<link rel="manifest"[^>]*>\s*/g, ''],
    [/<noscript>[\s\S]*?<\/noscript>\s*/g,
      '<noscript><div style="max-width:640px;margin:60px auto;font-family:sans-serif;text-align:center">'
      + '<h1>DraftVersus</h1><p>This game needs JavaScript enabled.</p></div></noscript>\n  '],
    [/<div id="ad-slot"><\/div>\s*/g, ''],
    [/<footer class="site-footer">[\s\S]*?<\/footer>\s*/g, ''],
    [/<script src="js\/consent\.js"><\/script>\s*/g, ''],
  ];
  for (const [re, to] of drop) h = h.replace(re, to);

  /* Derleme bayrağı config.js'ten ÖNCE tanımlanmalı */
  h = h.replace(
    /window\.KD_GAME_PAGE = true;[^<]*/,
    "window.KD_BUILD = 'portal'; window.KD_GAME_PAGE = true; window.KD_BASE = ''; window.KD_FORCE_LANG = 'en';"
  );
  /* Portal SDK adaptörü — reklam API'sini o sağlıyor, ads.js'ten hemen sonra */
  h = h.replace('<script src="js/ads.js"></script>',
    '<script src="js/ads.js"></script>\n  <script src="js/portal.js"></script>');

  if (!/KD_BUILD = 'portal'/.test(h)) throw new Error('KD_BUILD enjekte edilemedi — index.html değişmiş olabilir');
  if (!/js\/portal\.js/.test(h)) throw new Error('portal.js eklenemedi — ads.js satırı değişmiş olabilir');
  return h.replace(/\n{3,}/g, '\n\n');
}

/* ---------- Firebase'i kapat (portalda giriş yok) ---------- */
function buildConfig() {
  let c = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  const before = c;
  c = c.replace(/FIREBASE: \{[\s\S]*?\n  \},/, 'FIREBASE: {},   /* portal paketi: giriş kapalı */');
  if (c === before) throw new Error('FIREBASE bloğu bulunamadı — config.js değişmiş olabilir');
  return c;
}

/* ---------- üret ---------- */
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
for (const d of DIRS) copyDir(path.join(ROOT, d), path.join(OUT, d));
for (const a of ASSETS) {
  const s = path.join(ROOT, a);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(OUT, a));
  else console.warn('  ! eksik varlık atlandı:', a);
}
fs.writeFileSync(path.join(OUT, 'index.html'), buildHTML());
fs.writeFileSync(path.join(OUT, 'js', 'config.js'), buildConfig());

/* ---------- doğrula ---------- */
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const problems = [];
if (/adsbygoogle|highperformanceformat|smelthrsfranz/.test(html)) problems.push('HTML içinde reklam ağı izi var');
if (/<a\s+href="http/i.test(html)) problems.push('dışa açılan link var (portal yasağı)');
if (/\.\.\//.test(html)) problems.push('paket dışına çıkan yol (../) kaldı');

/* Boyut: CrazyGames ilk açılış ≤50 MB (mobil ana sayfa ≤20 MB), Poki ≤8 MB */
let bytes = 0, files = 0;
(function walk(p) {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) walk(f); else { bytes += fs.statSync(f).size; files++; }
  }
})(OUT);

const mb = bytes / 1048576;
console.log('\n  dist/portal/ hazır — ' + files + ' dosya, ' + mb.toFixed(2) + ' MB');
console.log('  Poki eşiği (8 MB): ' + (mb <= 8 ? 'geçer' : 'GEÇMEZ'));
console.log('  CrazyGames eşiği (50 MB): ' + (mb <= 50 ? 'geçer' : 'GEÇMEZ'));
if (problems.length) { console.error('\n  HATA:\n   · ' + problems.join('\n   · ')); process.exit(1); }
console.log('  Kontroller temiz.\n');
