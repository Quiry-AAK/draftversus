# DraftVersus

vs-AI ve **online 1v1** futbol kadro düellosu. Saf JavaScript istemci (derleme yok) + küçük Node sunucusu (statik dosyalar + WebSocket oda relay).

## Yerelde çalıştırma

```bash
npm install
npm start
# http://localhost:3000
```

> Not: Online mod için oyunu **sunucu üzerinden** açmalısın (`http://localhost:3000`), `index.html`'i dosyadan (file://) açarsan WebSocket bağlanamaz. AI modu file:// ile de çalışır.

## Modlar

- **Yapay Zekâ ile Oyna** — tek kişilik, rakip AI. Sunucu gerekmez.
- **Online (Oda)** — bir oyuncu oda kurar (4 haneli kod alır), diğeri kodu girip katılır. Maç **host-otoriter** yayınla senkronize olur; canlı maç ikisi de taktiğini bitirip "Hazır" demeden başlamaz.

## Coolify ile deploy (GitHub'dan)

1. Bu klasörü bir GitHub deposuna gönder.
2. Coolify → **New Resource → Application → Public/Private Repository**, depoyu seç.
3. Build Pack: **Dockerfile** (bu repoda hazır) — ya da Nixpacks (package.json `start` script'i var).
4. Port: **3000** (Dockerfile `EXPOSE 3000`; Coolify otomatik algılar). Gerekirse `PORT` env'ini ayarla.
5. Domain bağla — Coolify WebSocket'i (`/ws`) proxy üzerinden otomatik geçirir.
6. Deploy. Her GitHub push'unda otomatik yeniden kurulum (webhook) açabilirsin.

### Düz VPS (Coolify'sız)

```bash
git clone <repo> && cd draftversus
npm install --omit=dev
PORT=3000 node server.js
# kalıcılık için: pm2 start server.js --name kadro
```
Nginx/Caddy ile ters proxy yaparken `/ws` için WebSocket upgrade başlıklarını geçirmeyi unutma.

## Hostinger

- **VPS planı**: yukarıdaki "Düz VPS" adımları + PM2 ile çalışır (WebSocket destekli).
- **Paylaşımlı Node hosting**: kalıcı WebSocket genelde desteklenmez → online maç çalışmayabilir. Bu durumda yalnızca AI modu güvenlidir; online sunucuyu Coolify/VPS'te tut.

## Mimari

- `server.js` — http statik + `ws` oda yöneticisi (sadece relay; oyun mantığı istemcide).
- `js/net.js` — WebSocket istemci sarıcısı + oda protokolü.
- `js/data.js`, `js/engine.js`, `js/game.js` — oyun (veri / maç motoru / ekran akışı).
