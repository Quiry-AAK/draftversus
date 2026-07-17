/* ============================================================
   DraftVersus — sunucu
   - Statik dosyaları sunar (index.html, css, js, assets)
   - WebSocket ile online 1v1 oda yönetimi (host-otoriter relay)
   PORT ortam değişkeninden okunur (Coolify/VPS uyumlu).
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
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

/* ---------- SEO: robots.txt + sitemap.xml (domain'i istekten algılar) ---------- */
const SITE_PAGES = ['/', '/nasil-oynanir.html', '/hakkinda.html', '/iletisim.html', '/gizlilik.html', '/kullanim-kosullari.html'];
function siteBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return proto + '://' + host;
}

/* ---------- statik dosya sunumu (path traversal korumalı) ---------- */
const server = http.createServer((req, res) => {
  try {
    if (req.url === '/healthz') { res.writeHead(200); res.end('ok'); return; }
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': MIME['.txt'] });
      res.end('User-agent: *\nAllow: /\n\nSitemap: ' + siteBase(req) + '/sitemap.xml\n');
      return;
    }
    if (urlPath === '/sitemap.xml') {
      const base = siteBase(req);
      const lastmod = new Date().toISOString().slice(0, 10);
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + SITE_PAGES.map((p) => '  <url><loc>' + base + p + '</loc><lastmod>' + lastmod
            + '</lastmod><changefreq>' + (p === '/' ? 'weekly' : 'monthly')
            + '</changefreq><priority>' + (p === '/' ? '1.0' : '0.7') + '</priority></url>').join('\n')
        + '\n</urlset>\n';
      res.writeHead(200, { 'Content-Type': MIME['.xml'] });
      res.end(xml);
      return;
    }
    if (urlPath === '/') urlPath = '/index.html';
    const safePath = path.normalize(path.join(ROOT, urlPath));
    if (!safePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    const serveFile = (fp, code) => {
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(code || 200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    };
    const notFound = () => {
      const p404 = path.join(ROOT, '404.html');
      fs.stat(p404, (e, s) => {
        if (!e && s.isFile()) { serveFile(p404, 404); return; }
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
            serveFile(alt);
          });
          return;
        }
        notFound(); return;
      }
      serveFile(safePath);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
});

/* ============================================================
   Oda yönetimi
   rooms[CODE] = { host: ws, guest: ws|null, config }
   Her ws'e ._room (kod) ve ._side ('a'|'b') iliştirilir.
   ============================================================ */
const rooms = Object.create(null);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karıştırılması zor karakterler
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

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws._room = null; ws._side = null; ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    switch (m.t) {
      case 'create': {
        if (ws._room) return;
        const code = newCode();
        rooms[code] = { host: ws, guest: null, config: m.config || {} };
        ws._room = code; ws._side = 'a';
        send(ws, { t: 'created', code, side: 'a' });
        break;
      }
      case 'join': {
        if (ws._room) return;
        const code = String(m.code || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room) { send(ws, { t: 'error', code: 'NO_ROOM', msg: 'Böyle bir oda yok' }); return; }
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

  ws.on('close', () => cleanup(ws, false));
  ws.on('error', () => cleanup(ws, false));
});

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

/* ölü bağlantıları temizle */
const ping = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; try { ws.ping(); } catch (_) {}
  });
}, 30000);
wss.on('close', () => clearInterval(ping));

server.listen(PORT, () => {
  console.log(`DraftVersus çalışıyor → http://localhost:${PORT}  (WS: /ws)`);
});
