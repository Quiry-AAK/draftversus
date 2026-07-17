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

## Yayın kurulumu — Analytics · Adsterra · Search Console

Tüm ID'ler **tek dosyada**: [`js/config.js`](js/config.js). Boş bırakılan özellik kendini kapatır.

### 1) Google Analytics (GA4)
1. [analytics.google.com](https://analytics.google.com) → mülk oluştur → **Web** veri akışı ekle (site domainin).
2. **Ölçüm Kimliği**'ni (G-XXXXXXXXXX) kopyala → `js/config.js` → `GA_ID`'ye yapıştır.
3. Ekran geçişleri (`/#home`, `/#match`…) otomatik page_view olarak; `room_created`, `room_joined`, `series_end` özel olay olarak gider.

### 2) Adsterra
1. [adsterra.com](https://adsterra.com) → Publisher hesabı → **Websites → Add website** (site onayı için alt sayfalar + gizlilik politikası hazır).
2. İki ad unit oluştur: **Banner 728x90** ve **Banner 320x50** → verilen koddaki `atOptions.key` değerlerini `js/config.js` → `ADSTERRA.banner728` / `banner320`'ye yapıştır.
3. Banner yalnızca menü/ara ekranlarında görünür (home, online, lobi, devre arası, sonuç); **maç/draft sırasında gösterilmez**. İstersen Social Bar script src'sini `socialBarSrc`'ye ekleyebilirsin (daha agresif format, varsayılan kapalı).

### 3) Search Console
1. [search.google.com/search-console](https://search.google.com/search-console) → **URL öneki** ile domaini ekle.
2. Doğrulama: **HTML etiketi** yöntemini seç → verilen `content="..."` kodunu `index.html` içindeki `google-site-verification` meta'sına yapıştır → deploy → Doğrula.
3. Doğrulama sonrası **Site Haritaları** bölümüne `sitemap.xml` gönder (sunucu `/sitemap.xml` ve `/robots.txt`'yi domaine göre otomatik üretir).

### Ek sayfalar
`nasil-oynanir.html` · `hakkinda.html` · `iletisim.html` · `gizlilik.html` · `kullanim-kosullari.html` — footer'dan bağlı; temiz URL de çalışır (`/gizlilik` → `gizlilik.html`).

## Mimari

- `server.js` — http statik + `ws` oda yöneticisi (sadece relay; oyun mantığı istemcide).
- `js/net.js` — WebSocket istemci sarıcısı + oda protokolü.
- `js/data.js`, `js/engine.js`, `js/game.js` — oyun (veri / maç motoru / ekran akışı).
