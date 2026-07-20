/* ============================================================
   DraftVersus — sunucu
   - Statik dosyaları sunar (gzip + önbellek başlıkları + 304)
   - WebSocket ile online 1v1 oda yönetimi (host-otoriter relay)
   - Kötüye kullanım korumaları: mesaj boyutu/hızı, IP başına
     bağlantı, oda kodu brute-force, oda sayısı/ömrü sınırları
   PORT ortam değişkeninden okunur (Coolify/VPS uyumlu).
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};
/* metin tabanlılar gzip'lenir; görsel/font zaten sıkışık */
const COMPRESSIBLE = { '.html': 1, '.js': 1, '.css': 1, '.json': 1, '.svg': 1, '.txt': 1, '.xml': 1, '.webmanifest': 1 };
/* önbellek: html her zaman taze; js/css kısa (versiyonlama yok); görsel/font uzun */
function cacheControl(ext) {
  if (ext === '.html') return 'no-cache';
  if (ext === '.js' || ext === '.css' || ext === '.webmanifest') return 'public, max-age=300';
  return 'public, max-age=86400';
}

/* ---------- SEO: robots.txt + sitemap.xml (domain'i istekten algılar) ---------- */
const SITE_PAGES = ['/', '/nasil-oynanir.html', '/hakkinda.html', '/iletisim.html', '/gizlilik.html', '/kullanim-kosullari.html'];
function siteBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return proto + '://' + host;
}

/* ---------- istemci IP'si (Cloudflare/Traefik proxy'leri arkasında) ---------- */
function ipOf(req) {
  return req.headers['cf-connecting-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || (req.socket && req.socket.remoteAddress) || '?';
}

/* ---------- güvenlik başlıkları (her yanıta) ----------
   Not: Adsterra rotasyonlu alan adlarından script/iframe çektiği için
   katı bir CSP reklamları bozar → CSP koymuyoruz; kırılmayan başlıklar. */
function secHeaders(req) {
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  };
  // HSTS yalnız https'te anlamlı (proxy x-forwarded-proto'ya bakar)
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'https') h['Strict-Transport-Security'] = 'max-age=15552000';
  return h;
}

/* ---------- HTTP hız limiti (IP başına kayan pencere) ----------
   İlk ziyaret ~17 dosya çeker; sonraki yüklemeler 304/cache ile ucuz.
   Cömert: 100 istek / 10 sn (≈5 tam sayfa yükü) → aşan 429 alır. */
const HTTP_WINDOW_MS = 10000, HTTP_MAX = 100;
const httpHits = new Map();   // ip → { n, t }
function httpLimited(ip) {
  const now = Date.now();
  let e = httpHits.get(ip);
  if (!e || now - e.t > HTTP_WINDOW_MS) { e = { n: 0, t: now }; httpHits.set(ip, e); }
  e.n++;
  return e.n > HTTP_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of httpHits) if (now - e.t > HTTP_WINDOW_MS) httpHits.delete(ip);
  if (httpHits.size > 50000) httpHits.clear();
}, 30000).unref();

/* ---------- statik dosya sunumu (path traversal korumalı) ---------- */
const server = http.createServer((req, res) => {
  try {
    const SEC = secHeaders(req);
    // sadece GET/HEAD servis edilir (POST/PUT vb. gövde temelli saldırıları erken kes)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.destroy(); return;
    }
    // HTTP flood koruması (IP başına) — healthz hariç
    if (req.url !== '/healthz' && httpLimited(ipOf(req))) {
      res.writeHead(429, Object.assign({ 'Retry-After': '10', 'Content-Type': 'text/plain' }, SEC));
      res.end('Too Many Requests'); return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200, Object.assign({ 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }, SEC));
      res.end(JSON.stringify({ ok: 1, rooms: Object.keys(rooms).length, clients: wss ? wss.clients.size : 0 }));
      return;
    }
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/robots.txt') {
      res.writeHead(200, Object.assign({ 'Content-Type': MIME['.txt'], 'Cache-Control': 'public, max-age=3600' }, SEC));
      res.end('User-agent: *\nAllow: /\n\nSitemap: ' + siteBase(req) + '/sitemap.xml\n');
      return;
    }
    if (urlPath === '/sitemap.xml') {
      const base = siteBase(req);
      const modOf = (p) => {
        // gerçek dosya değişim tarihi — her istekte "bugün" demek Google'a yanlış sinyal olur
        const f = p === '/' ? 'index.html' : p.slice(1);
        try { return fs.statSync(path.join(ROOT, f)).mtime.toISOString().slice(0, 10); }
        catch (_) { return new Date().toISOString().slice(0, 10); }
      };
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + SITE_PAGES.map((p) => '  <url><loc>' + base + p + '</loc><lastmod>' + modOf(p)
            + '</lastmod><changefreq>' + (p === '/' ? 'weekly' : 'monthly')
            + '</changefreq><priority>' + (p === '/' ? '1.0' : '0.7') + '</priority></url>').join('\n')
        + '\n</urlset>\n';
      res.writeHead(200, Object.assign({ 'Content-Type': MIME['.xml'], 'Cache-Control': 'public, max-age=3600' }, SEC));
      res.end(xml);
      return;
    }
    if (urlPath === '/') urlPath = '/index.html';
    const safePath = path.normalize(path.join(ROOT, urlPath));
    // kardeş dizin prefix bypass'ına karşı ayraçlı karşılaştırma (…/draftversusX != …/draftversus)
    if (safePath !== ROOT && !safePath.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    // gizli dosyalar (.git vb.) ve sunucu iç dosyaları dışarı sunulmaz
    const rel = safePath.slice(ROOT.length + 1).toLowerCase();
    const segs = rel.split(path.sep);
    const PRIVATE_DIRS = { 'node_modules': 1, 'test': 1, 'docs': 1 };
    const PRIVATE_FILES = { 'server.js': 1, 'package.json': 1, 'package-lock.json': 1, 'dockerfile': 1, 'readme.md': 1 };
    if (segs.some(s => s.startsWith('.')) || PRIVATE_DIRS[segs[0]] || (segs.length === 1 && PRIVATE_FILES[segs[0]])) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const serveFile = (fp, st, code) => {
      const ext = path.extname(fp).toLowerCase();
      const headers = Object.assign({
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': code === 404 ? 'no-store' : cacheControl(ext),
      }, SEC);
      if (st && !code) {
        headers['Last-Modified'] = st.mtime.toUTCString();
        const ims = req.headers['if-modified-since'];
        if (ims && Math.floor(st.mtime.getTime() / 1000) <= Math.floor(new Date(ims).getTime() / 1000)) {
          res.writeHead(304, { 'Cache-Control': headers['Cache-Control'] }); res.end(); return;
        }
      }
      const gzipOk = COMPRESSIBLE[ext] && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (COMPRESSIBLE[ext]) headers['Vary'] = 'Accept-Encoding';
      if (gzipOk) headers['Content-Encoding'] = 'gzip';
      else if (st && !code) headers['Content-Length'] = st.size;
      res.writeHead(code || 200, headers);
      const stream = fs.createReadStream(fp);
      if (gzipOk) stream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
      else stream.pipe(res);
    };
    const notFound = () => {
      const p404 = path.join(ROOT, '404.html');
      fs.stat(p404, (e, s) => {
        if (!e && s.isFile()) { serveFile(p404, s, 404); return; }
        res.writeHead(404); res.end('Not found');
      });
    };
    fs.stat(safePath, (err, st) => {
      if (err || !st.isFile()) {
        // temiz URL: /gizlilik → gizlilik.html
        if (!path.extname(safePath)) {
          const alt = safePath + '.html';
          fs.stat(alt, (e2, s2) => {
            if (e2 || !s2.isFile()) { notFound(); return; }
            serveFile(alt, s2);
          });
          return;
        }
        notFound(); return;
      }
      serveFile(safePath, st);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
});

/* ============================================================
   Oda yönetimi
   rooms[CODE] = { host: ws, guest: ws|null, config, created }
   Her ws'e ._room (kod) ve ._side ('a'|'b') iliştirilir.
   ============================================================ */
const rooms = Object.create(null);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karıştırılması zor karakterler
const MAX_ROOMS = 500;            // bellek üst sınırı
const MAX_CLIENTS = 2000;         // yeni bağlantı kabul tavanı
const MAX_CONN_PER_IP = 4;        // aynı IP'den eş zamanlı soket
const ROOM_IDLE_MS = 10 * 60 * 1000; // rakipsiz oda ömrü
const OPS_PER_MIN = 10;           // IP başına dakikada create/join
const MSG_RATE = 40;              // soket başına mesaj/sn (yayın ~22Hz)
const MSG_BURST = 80;

function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms[c]);
  return c;
}
function send(ws, obj) { if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); }
function peerOf(ws) {
  const room = rooms[ws._room]; if (!room) return null;
  return ws._side === 'a' ? room.guest : room.host;
}

/* maxPayload: çoğu relay ~1KB, ama seri başında 'start' mesajı tüm draft
   havuzunu, 'ready' ise tam kadroyu taşır (birkaç on KB) → 64KB güvenli tavan
   (100MB varsayılana kıyasla hâlâ bellek-bombasına kapalı). */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 65536 });

const ipConns = new Map();   // ip → açık soket sayısı
const ipOps = new Map();     // ip → { n, t } dakikalık create/join sayacı
function overOpsLimit(ip) {
  const now = Date.now();
  let e = ipOps.get(ip);
  if (!e || now - e.t > 60000) { e = { n: 0, t: now }; ipOps.set(ip, e); }
  e.n++;
  return e.n > OPS_PER_MIN;
}

wss.on('connection', (ws, req) => {
  const ip = ipOf(req);
  const cur = ipConns.get(ip) || 0;
  if (wss.clients.size > MAX_CLIENTS || cur >= MAX_CONN_PER_IP) { ws.close(1013, 'busy'); return; }
  ipConns.set(ip, cur + 1);
  ws._ip = ip;
  ws._room = null; ws._side = null; ws.isAlive = true;
  ws._tokens = MSG_BURST; ws._tLast = Date.now(); ws._joinFails = 0;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    /* hız limiti: token bucket — meşru trafik (22Hz yayın) rahat sığar */
    const now = Date.now();
    ws._tokens = Math.min(MSG_BURST, ws._tokens + (now - ws._tLast) / 1000 * MSG_RATE);
    ws._tLast = now;
    if (ws._tokens < 1) { ws.terminate(); return; }
    ws._tokens--;

    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    switch (m.t) {
      case 'create': {
        if (ws._room) return;
        if (Object.keys(rooms).length >= MAX_ROOMS || overOpsLimit(ws._ip)) { send(ws, { t: 'error', code: 'BUSY', msg: 'Sunucu yoğun, birazdan tekrar dene' }); return; }
        const code = newCode();
        rooms[code] = { host: ws, guest: null, config: m.config || {}, created: Date.now() };
        ws._room = code; ws._side = 'a';
        send(ws, { t: 'created', code, side: 'a' });
        break;
      }
      case 'join': {
        if (ws._room) return;
        if (overOpsLimit(ws._ip)) { send(ws, { t: 'error', code: 'BUSY', msg: 'Çok sık deneme — biraz bekle' }); return; }
        const code = String(m.code || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room) {
          if (++ws._joinFails >= 5) { ws.close(1008, 'too many attempts'); return; }  // kod brute-force koruması
          send(ws, { t: 'error', code: 'NO_ROOM', msg: 'Böyle bir oda yok' }); return;
        }
        if (room.guest) { send(ws, { t: 'error', code: 'FULL', msg: 'Oda dolu' }); return; }
        room.guest = ws; ws._room = code; ws._side = 'b';
        // katılana: oda yapılandırması + host profili
        send(ws, { t: 'joined', code, side: 'b', config: room.config, peer: room.config.profile || null, guestProfile: m.profile || null });
        // host'a: rakip geldi
        send(room.host, { t: 'peer-joined', profile: m.profile || null });
        break;
      }
      case 'relay': {
        // oyun mesajlarını diğer oyuncuya aktar (sunucu içeriği yorumlamaz)
        const peer = peerOf(ws);
        if (peer) send(peer, { t: 'relay', d: m.d });
        break;
      }
      case 'leave': {
        cleanup(ws, true);
        break;
      }
      default: break;
    }
  });

  ws.on('close', () => { closeConn(ws); });
  ws.on('error', () => { closeConn(ws); });
});

function closeConn(ws) {
  cleanup(ws, false);
  if (ws._ip) {
    const n = (ipConns.get(ws._ip) || 1) - 1;
    if (n <= 0) ipConns.delete(ws._ip); else ipConns.set(ws._ip, n);
  }
}

function cleanup(ws, voluntary) {
  const code = ws._room; if (!code) return;
  const room = rooms[code]; if (!room) { ws._room = null; return; }
  const peer = peerOf(ws);
  if (peer) send(peer, { t: 'peer-left', voluntary: !!voluntary });
  // odadan çıkar; host giderse oda kapanır
  if (ws._side === 'a') {
    if (room.guest) room.guest._room = null;
    delete rooms[code];
  } else {
    room.guest = null;
  }
  ws._room = null; ws._side = null;
}

/* ölü bağlantıları temizle + rakipsiz eski odaları süpür */
const ping = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; try { ws.ping(); } catch (_) {}
  });
  const now = Date.now();
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (!room.guest && now - room.created > ROOM_IDLE_MS) {
      send(room.host, { t: 'error', code: 'ROOM_EXPIRED', msg: 'Oda zaman aşımına uğradı — yeniden kurabilirsin' });
      if (room.host) room.host._room = null;
      delete rooms[code];
    }
  }
  if (ipOps.size > 10000) ipOps.clear();   // sayaç tablosu şişmesin
}, 30000);
wss.on('close', () => clearInterval(ping));

/* Slowloris / yavaş-istek saldırılarına karşı zaman aşımları + bağlantı tavanı.
   (WS el sıkışması hızlı tamamlanıp yükseltildiği için bu değerlerden etkilenmez.) */
server.headersTimeout = 10000;    // başlıkları göndermek için 10 sn
server.requestTimeout = 20000;    // tam istek için 20 sn
server.keepAliveTimeout = 15000;  // boşta HTTP keep-alive
server.maxConnections = 1200;     // eş zamanlı soket sert tavanı
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, () => {
  console.log(`DraftVersus çalışıyor → http://localhost:${PORT}  (WS: /ws)`);
});
