# DraftVersus — Gelir ve Retention Planı (durum takibi)

Ürün kararı: **tam Football Manager klonu YAPILMAYACAK.** Draft/düello çekirdeği
(oyunun tek gerçek farklılaştırıcısı) korunur, üzerine **hafif meta-progression**
eklenir — her seri bir "run", run'lar arası kalıcı açılımlar.

Gelir sırası: **önce kullanıcı başına geliri çarp** (reklam verimi → ödüllü →
İngilizce), **sonra trafiği çarp** (portal). Tersi israf olurdu: trafik yokken
CPM optimizasyonu, CPM düşükken trafik satın almak gibi.

---

## Faz 0 — Reklam verimi + ölçüm · ✅ TAMAMLANDI

- ✅ **Banner yenileme hatası düzeltildi.** `ads.js`'te `if (!el || active) return;`
  yüzünden banner bir kez basılınca menü ekranları arası geçişte yenilenmiyordu.
  Artık ekran **değiştiyse**, ≥30 sn geçtiyse ve sekme görünürse tazeleniyor.
  Ekran geçişi kullanıcı eylemi olduğu için AdSense'in otomatik yenileme yasağını
  ihlal etmiyor. Bir Bo3 serisi ~3 yerine ~5 gösterim üretiyor.
- ✅ **Ödüllü API iskeleti.** `KD_ADS.rewarded(placement)` → `Promise<boolean>`.
  Sağlayıcı yokken `false` döner ve butonlar hiç görünmez.
- ✅ **Huni ölçümü.** `startSeries` / `goDuello` / `goTactics` / `goMatch` /
  `goResult` noktalarına GA4 olayları eklendi.

## Faz 1 — Meta-progression ("bir tur daha" motoru) · ✅ TAMAMLANDI

- ✅ `js/meta.js` — XP/seviye ve açılım defteri, `kd_meta_v1` anahtarında
  (KD_PROFILE'ın "yüksek olan kazanır" merge'ü açılım listesini bozardı).
- ✅ Açılımlar **güç değil seçenek** veriyor (yatay ilerleme) — online 1v1 adaleti
  ve portal kitlesinin "pay-to-win" algısı korunuyor.
  Diziliş: 4-2-3-1 (Lv2), 3-5-2 (Lv4), 5-3-2 (Lv6). Felsefe: Defansif Blok (Lv3),
  Direkt (Lv5), Kanat (Lv7).
- ✅ `backfillXP()` — mevcut oyuncular geçmiş istatistiklerinden XP alır, yeni
  sistem onları kilitli başlatmaz.
- ✅ Başlangıç dizilişleri ve felsefeleri kilitsiz (`newClub` varsayılanı olan
  'Yüksek Pres' bir ara Lv3'e kilitlenmişti — yeni oyuncu kilitli bir seçimle
  başlayıp geri dönemiyordu).

## Faz 2 — Ödüllü reklam yerleşimleri · ✅ TAMAMLANDI (sağlayıcı bekliyor)

Dört doğal durak kodlandı; sağlayıcı bağlanınca butonlar kendiliğinden belirir:

| Nokta | Ödül |
|---|---|
| Değişiklik hakkı bitti | +1 değişiklik |
| Maç arası | kadroya kondisyon |
| Sakat oyuncu | `injuredMatches` −1 |
| Günlük meydan okuma bitti | ikinci deneme |

Draft havuzunu yenileme **bilerek eklenmedi** — çekirdek mekaniği bozar.

⚠️ Kendi sitemizde ödüllü video pratikte yok: AdSense H5 Games Ads ayrı onay
ister, Adsterra'nın ödüllü envanteri zayıf. **Ödüllü gerçekte portal SDK'sıyla
geliyor** (bkz. Faz 4).

## Faz 3 — İngilizce sürüm · ✅ TAMAMLANDI

- ✅ `/en/` altında 8 sayfa (oyun + 7 statik), hreflang çiftleri, EN sitemap.
- ✅ **Oyun içi metinlerin tamamı çevrildi.** Üç katman:
  1. `T()` — tekil dizeler, `head()` merkezi olarak uyguluyor.
  2. `KD_I18N.translateHTML()` — ekran HTML'i DOM'a girmeden etiket arası metni
     sözlükten geçirir. **Öznitelikler korunur**, bu yüzden motor anahtarları
     (`data-phil`, `MENT_ATT['Çok Temkinli']`, `f['Defans Hattı']`) Türkçe kalır;
     yalnızca gösterim çevrilir.
  3. `KD_I18N.phrase()` — maç anlatımı adlarla iç içe olduğu için sabit kalıplar
     parça parça çevrilir, kulüp/oyuncu adları korunur. Canvas'a çizilen saha
     yazıları (FAUL, DEVRE ARASI, GOOOL!) de bu yoldan geçer.
- ✅ `toast()` ve `netBanner()` metinleri merkezi olarak çevriliyor.
- ✅ Sözlük 59 → 372 girdi.
- ✅ Doğrulama: 8 ekran + maç içi paneller tarandı, çevrilmemiş metin kalmadı.
  `KD_LANG=en node test/harness.js` İngilizce akışı uçtan uca sürüyor.

**Oyuncu adları kasıtlı olarak bölgesel** (TR/ENG/ESP/GER/ITA/SLA/AFR/MEA/ASI/LAT)
— kimlik rozeti özelliği, çeviriye tabi değil.

## Faz 4 — Yük diyeti + portal altyapısı · ✅ TAMAMLANDI (başvuru bekliyor)

- ✅ **three.js tembel yükleme.** İlk yükleme **1.1 MB → 388 KB**
  (gzip'li gerçek transfer **114 KB**). Maçlar 2D başladığı için oyuncuların
  çoğu 594 KB'lık motoru hiç indirmiyor; 3D düğmesine basınca ~1.2 sn'de iniyor.
- ✅ **`KD_CONFIG.BUILD = 'own' | 'portal'`.** Portal derlemesinde AdSense/Adsterra
  HİÇ yüklenmez (iki reklam ağı = sözleşme ihlali), çerez çubuğu çıkmaz, online
  1v1 kapalı (sunucumuz orada yok), Firebase kapalı, dış bağlantı yok.
- ✅ **`js/portal.js`** — CrazyGames SDK adaptörü: `rewarded`, `gameplayStart/Stop`,
  `happytime`, `midgame`. SDK gelmezse oyun bozulmaz (sessiz no-op, buton görünmez).
- ✅ **`tools/build-portal.js`** — `dist/portal/` paketini kaynak `index.html`'den
  **türetir**; ikinci bir index.html elle bakımda tutulmuyor (EN sayfalarında
  `meta.js`'in unutulması tam da böyle olmuştu). Reklam izi / dış link / paket dışı
  yol kontrolü yapar ve boyut eşiklerini raporlar.
  **Ölçüm: 1.32 MB** — Poki (8 MB) ve CrazyGames (50 MB) eşiklerini geçiyor.

```bash
node tools/build-portal.js
```

### Sırada: portal başvurusu
1. **CrazyGames** (non-exclusive — kendi sitemiz kalır). `dist/portal/` zip'lenip
   developer.crazygames.com'a yüklenir. 2 haftalık "Basic Launch" deneme yayını:
   oturum süresi ve dönüş oranı ölçülür, iyi performansta tam yayına alınır.
   Onaylanınca **Faz 2'de hazırlanan ödüllü butonlar otomatik canlanır.**
2. **Poki sonra** — "Web Exclusive" istiyor; kabul edilirse açık webde yalnız
   Poki'de yayınlanırız, yani `draftversus.com` üzerindeki AdSense/SEO yatırımı
   devre dışı kalır. Ancak somut ve yüksek bir teklif gelirse değerlendirilir.

---

## Beklemede

- **AdSense onayı** — geldiğinde `KD_CONFIG.ADSENSE.slot` doldurulur; Adsterra
  otomatik devre dışı kalır (`ads.js` slot doluysa AdSense'e geçer).
- **Google girişi** — popup akışını yalnızca kullanıcı test edebilir.

## Kapsam dışı (şimdilik)

Sezon/lig/kalıcı kulüp katmanı — meta-progression'ın tuttuğu kanıtlanırsa.
Motor büyük ölçüde hazır: `quickSim` yazılmış ama hiç kullanılmamış,
`developSquad` sakatlık/kondisyon/yaş gelişimini zaten yapıyor, `transfer` var.
**Önce `_uid` sorunu çözülmeli** (`data.js`): modül seviyesindeki `let _uid = 1`
sayfa yenilenince sıfırlanır; kalıcı kadro yüklenip yeni havuz üretilince ID
çakışması garanti (`ratings[p.id]`, `byId[p.id]` hep ID'ye dayanıyor).
Çözüm: kalıcı kadroya giren oyuncuya `PERSIST_BASE = 1_000_000`'dan başlayan
ayrı ID uzayından numara ver.
