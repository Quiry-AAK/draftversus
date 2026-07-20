# DraftVersus — DDoS Koruması & Multiplayer Senkronizasyon Planı

> Durum tespiti: 17 Temmuz 2026. Mevcut mimari: tek Node süreci; statik dosya + `/ws`
> WebSocket relay (host-otoriter). Coolify (Traefik proxy) arkasında, draftversus.com.

## Uygulama durumu (20 Tem 2026)

- ✅ **Katman B (uygulama)** — WS ve HTTP sertleştirmesi **tamamlandı** (aşağıda ✅ işaretli).
- ⏳ **Katman A (Cloudflare/DNS)** — kullanıcı tercihiyle **en sona** bırakıldı. Volumetrik
  (L3/L4) DDoS için tek gerçek çözüm budur; uygulama katmanı bunu tam ikame edemez ama
  L7 kötüye kullanımın büyük kısmını (flood, slowloris, brute-force) origin'de karşılıyoruz.
- ⏳ **Coolify/Traefik rate-limit** — DNS gerektirmez, opsiyonel ek katman (aşağıda hazır etiketler).

---

## BÖLÜM 1 — DDoS / Kötüye Kullanım Koruması

### Mevcut açıklar (tespit)

| # | Açık | Risk |
|---|------|------|
| 1 | Proxy önünde CDN/WAF yok — origin IP'si doğrudan internete açık | L3/L4 volumetrik saldırı sunucuyu doğrudan vurur |
| 2 | `ws` `maxPayload` varsayılan (~100MB) | Tek büyük mesajla bellek şişirme |
| 3 | Mesaj hız limiti yok (`relay` sınırsız) | Bir istemci CPU/bant tüketebilir |
| 4 | IP başına bağlantı limiti yok | Tek IP binlerce WS açabilir |
| 5 | `join` kod denemesi sınırsız | 4 haneli kod (32⁴ ≈ 1M) brute-force edilebilir |
| 6 | Oda sayısı/ömrü sınırsız | `create` spam → bellek büyümesi |

### Katman A — Ağ/CDN (kod değişikliği yok, en yüksek etki) — ÖNCELİK 1

1. **Cloudflare (ücretsiz plan) önüne al:**
   - DNS'i Cloudflare'e taşı, kaydı "proxied" (turuncu bulut) yap. WebSocket ücretsiz planda destekleniyor; `/ws` sorunsuz geçer.
   - Etki: L3/L4 volumetrik DDoS **tamamen** Cloudflare'de emilir; L7 için Bot Fight Mode + "Under Attack" modu hazır bekler.
   - Rate Limiting Rule (ücretsiz 1 kural): `/ws` haricine dakikada IP başına ~120 istek.
2. **Origin'i gizle:** VPS firewall'unda 80/443'ü yalnızca [Cloudflare IP aralıklarına](https://www.cloudflare.com/ips/) aç. Saldırgan origin IP'yi bilse bile doğrudan vuramaz.
3. **VPS firewall:** 22 (SSH, tercihen sadece kendi IP'n) + 80/443 dışındaki tüm portlar kapalı. Coolify panel portu internete açık olmasın.

### Katman B — Uygulama (server.js) — ✅ TAMAMLANDI

**WebSocket:**
- ✅ `maxPayload: 4096` — 4KB üstü mesaj bağlantıyı kapatır (bellek şişirme kapandı).
- ✅ IP başına eş-zamanlı WS limiti: **4** (`cf-connecting-ip` / `x-forwarded-for` önceliğiyle).
- ✅ Soket başına mesaj hız limiti (token bucket): **40 msj/sn, patlama 80**. Aşan soket kapatılır.
- ✅ `join` brute-force: soket başına **5 hatalı kod → 1008 ile kapat**; IP başına dakikada 10 create/join.
- ✅ Oda hijyeni: rakipsiz oda **10 dk**'da süpürülür; oda tavanı **500**; bağlantı tavanı 2000.

**HTTP (yeni — DNS gerektirmez):**
- ✅ IP başına HTTP hız limiti: **100 istek / 10 sn → 429** (tek sayfa yükü ~17 dosya, rahat sığar).
- ✅ Sadece GET/HEAD; POST/PUT vb. gövde tabanlı saldırılar erkenden düşürülür.
- ✅ Slowloris zaman aşımları: `headersTimeout 10s`, `requestTimeout 20s`, `keepAliveTimeout 15s`, `maxConnections 1200`.
- ✅ Güvenlik başlıkları: `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, https'te `HSTS`.
- ✅ Gizli/iç dosya sızıntısı kapalı (`.git`, `node_modules`, `server.js`, `package.json`…).
- ⚠️ **CSP bilinçli olarak konmadı** — Adsterra rotasyonlu alan adlarından script/iframe çektiği için katı CSP reklam gelirini bozar.

**İstemci (game.js):**
- ✅ Ağdan gelen tüm serbest metinler (rakip/oyuncu/kulüp adları, spiker, olaylar, havuz) DOM'a yazılmadan temizlenir → manipüle rakip istemcisinden **XSS kapandı**.

### Katman B+ — Coolify/Traefik rate-limit (opsiyonel, DNS gerektirmez) — ÖNCELİK 2b

Coolify → uygulama → **Labels** kısmına (proxy önünde ikinci bir hız katmanı):

```
traefik.http.middlewares.dv-rl.ratelimit.average=100
traefik.http.middlewares.dv-rl.ratelimit.period=1m
traefik.http.middlewares.dv-rl.ratelimit.burst=50
traefik.http.routers.<router-adı>.middlewares=dv-rl
```
> `<router-adı>` Coolify'ın ürettiği router etiketiyle aynı olmalı. WS (`/ws`) uzun ömürlü tek
> bağlantı olduğundan bu limit maçları etkilemez.

### Katman C — İzleme — ÖNCELİK 3

- UptimeRobot (ücretsiz) → `https://draftversus.com/healthz` 1 dk aralıkla.
- `healthz` çıktısına hafif metrik ekle: `{ok, rooms, clients}` — tek bakışta anomali görülür.
- Coolify kaynak grafikleri: CPU/bellek ani sıçrama alarmı.

---

## BÖLÜM 2 — Multiplayer Senkronizasyon & Optimizasyon

### Mevcut durum (tespit)

- **Model:** Host-otoriter. Host motoru çalıştırır; **45 ms'de bir (~22 Hz)** tüm oyuncu
  koordinatları + top + hakem + skor içeren **tam JSON snapshot** yayınlar (`m-frame`).
  Guest motoru hiç çalıştırmaz, gelen kareyi çizer.
- **Güçlü yanı:** Basit, çelişkisiz (tek doğruluk kaynağı), hile yüzeyi dar (guest yalnız izleyici).
- **Zayıf yanları:**
  1. Guest 22 Hz ham kare çizer → 60 Hz ekranda **seğirme**; ağ titremesinde (jitter) donma.
  2. Her kare **tam** durum → bant gereksiz yüksek (~8-12 KB/s), mobil veride hissedilir.
  3. **Reconnect yok:** kopan taraf maçı kaybeder; host koparsa oda ölür.
  4. RTT/bağlantı kalitesi ölçülmüyor; kullanıcı "neden takılıyor" göremiyor.

### Faz 1 — Akıcılık (istemci tarafı, sunucu değişmez) — ✅ TAMAMLANDI

1. ✅ **Interpolation tamponu (guest):** Gelen kareler zaman damgasıyla tampona alınır;
   ekran **120 ms geçmişte** render edilir, iki kare arası lineer ara değerlenir (60fps).
   Skor/kart/gol gibi ayrık durum ANINDA uygulanır (gecikmez); yalnız pozisyonlar yumuşatılır.
   Ağ durursa en yeni kareye tutunur (extrapolasyon yok). rAF döngüsü kuşak-korumalı.
2. ✅ **RTT göstergesi:** Guest 2 sn'de bir `png` yollar, host `pong`'lar → gerçek RTT;
   skorbordda renkli nokta (🟢/🟡/🔴) + `ms`. Gerçek 2-istemci testinde "4ms" ölçüldü.

> **Test notu:** Gerçek 2-sekme WebSocket testi bu fazı doğrularken **kritik bir regresyon**
> yakaladı: güvenlik turunda konan `maxPayload: 4096`, seri başı `start` mesajını (draft havuzu)
> kesip host'u düşürüyordu → **64KB'a yükseltildi** (commit 01b9f03). Online maç uçtan uca
> çalışıyor: bağlantı, oda, draft senkron, host-otoriter maç, guest interpolation render, RTT.

### Faz 2 — Bant optimizasyonu — ✅ TAMAMLANDI (kısmi; delta işe yaramadı)

4. ✅ **Yayın frekansı 45→66 ms (15 Hz):** Guest'teki 140ms interpolasyon tamponu
   düşük frekansı görünmez kılıyor. **Ölçülen tasarruf ~%26** (harness ölçümü:
   7.02→5.18 KB/s, tek yön). Host CPU'su da düşüyor.
3. ❌ **Delta + keyframe — DENENDİ, KALDIRILDI.** Bu simülasyonda oyuncular 66ms'de
   neredeyse hep >2px oynadığından, delta `[indeks,x,y]` (3 değer) tam kare `[x,y]`
   (2 değer) yerine indeks yükü ekleyip mesajı **büyütüyordu** (343B vs 324B, ölçüldü).
   Eşik (>2px) de kurtarmadı (%28). Basit ve karesel daha küçük olan tam-kare korundu.
   → Plandaki "%60-70" tahmini seyrek-hareket varsayıyordu; hızlı maç simülasyonunda geçersiz.
5. ~~Görünmeyen ayrıntıyı at~~ — tam kare zaten küçük; gereksiz karmaşa, yapılmadı.

> **Daha büyük tasarruf yolu (gerekirse):** JSON yerine **binary WS** (int16 pozisyonlar)
> pozisyon yükünü ~yarıya indirir (metin "1180" 4 bayt → 2 bayt), 15Hz ile birlikte ~%55-60.
> Bedeli: relay sunucusunun binary çerçeveyi de taşıması (şu an JSON-only). Küçük oyun için
> şimdilik orantısız; ihtiyaç doğarsa ilk adım budur.

### Faz 3 — Dayanıklılık (sunucu + istemci) — ✅ TAMAMLANDI

6. ✅ **Reconnect/resume:**
   - Sunucu: `create`/`join`'de her tarafa **resume token'ı** verilir. İstemsiz kopmada oda
     hemen kapatılmaz → **45 sn askı** (`away` timer); peer'a `peer-away` gider (maç sürer).
     Token'la dönen taraf aynı `side`'a oturur (`resume`→`resumed`), peer `peer-back` alır.
     Grace dolarsa `finalizeLeave` → `peer-left`. Kötü token/dolu slot reddedilir.
   - İstemci (net.js): kopmayı algılar, `reconnecting` yayar, token'la otomatik `resume` dener
     (2sn aralık, 44sn pencere). Yayın kareleri kopukken biriktirilmez (bayatlar). Gönüllü
     `leave` reconnect'i bastırır. Başarısızlıkta `reconnect-failed` → maç sonlanır.
   - UI: yıkıcı olmayan üst şerit (`.net-banner`) — "yeniden bağlanılıyor…" / "rakip bekleniyor…".
   - Not: motor host'un sekmesinde yaşadığından geçici WS kopmalarını (wifi/proxy blip, sunucu
     kısa restart) kurtarır; **sekme kapanmasını** değil (o durumda motor kaybolur).
   - **Test:** gerçek WS protokol testi (drop→peer-away→resume→peer-back→relay, kötü token reddi)
     ve tarayıcıda istemci oto-reconnect (created→reconnecting→resumed, banner, gönüllü-leave bastırma).
7. ⏳ **Heartbeat sıkılaştır** — mevcut 30sn ping yeterli çalışıyor; istemci reconnect zaten
   kopmayı hızlı yakalıyor. Gerekirse ping 10sn'ye çekilebilir (küçük iyileştirme, ertelendi).

### Faz 4 — İleri seviye (gerekirse, büyüyünce)

8. **Deterministik lockstep alternatifi:** Motor tüm rastgeleliği tek seed'den alırsa iki taraf
   simülasyonu bağımsız koşturur, yalnız **girdiler** (taktik/oyuncu değişikliği) senkronize edilir
   → bant ~sıfır. Bedeli: motorun %100 deterministik olması (float tutarlılığı dahil) — büyük refactor.
   Mevcut oyun tipinde (izleyici-simülasyon) Faz 1-3 yeterli; bunu ancak mobil uygulama/turnuva
   modu gelirse değerlendir.
9. **Çoklu instance:** Tek Node süreci binlerce eş-zamanlı maça yeter (relay çok hafif).
   Aşılırsa: oda-bazlı sharding + Redis pub/sub veya sticky-session ile yatay ölçek.
10. **Maç sonucu çift raporu (hafif anti-cheat):** İki istemci seri sonucunu ayrı bildirir;
    uyuşmazlık loglanır. Sıralama/lig özelliği eklenirse şart.

### Önerilen sıra ve efor özeti

| Sıra | İş | Efor | Etki |
|------|-----|------|------|
| 1 | Cloudflare + origin firewall (Katman A) | ~1 saat, kod yok | DDoS riskinin ~%90'ı |
| 2 | server.js sertleştirme (Katman B) | ~2 saat | Kötüye kullanım kapanır |
| 3 | Guest interpolation (Faz 1) | ~yarım gün | Online akıcılık hissi |
| 4 | Delta+keyframe & 15 Hz (Faz 2) | ~yarım gün | Bant %60-70 ↓ |
| 5 | Reconnect/resume (Faz 3) | ~1 gün | Kopan maç kurtulur |
| 6 | Heartbeat/İzleme | ~1 saat | Erken uyarı |
