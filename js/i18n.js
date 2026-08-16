/* ============================================================
   Kadro Düellosu — dil desteği (TR varsayılan + EN)
   En az müdahale: TR metni anahtardır; T(tr) → seçili dilde döner.
   Sistem diline göre algılar (navigator.language), localStorage'da saklar.
   ============================================================ */
(function () {
  const EN = {
    // adımlar / chrome
    'Lobi': 'Lobby', 'Draft': 'Draft', 'Düello': 'Duel', 'Taktik': 'Tactics', 'Maç': 'Match', 'Maç Arası': 'Half-time', 'Sonuç': 'Result',
    '← Geri': '← Back', 'Online': 'Online',
    // home
    'Nasıl oynamak istersin?': 'How do you want to play?',
    'Yapay zekâya karşı tek başına ya da bir arkadaşınla online 1v1 — bir oda kur veya kodla katıl.': 'Solo vs the AI, or online 1v1 with a friend — create a room or join with a code.',
    'Yapay Zekâ ile Oyna': 'Play vs AI',
    'Tek kişilik. Rakibin draft, çalma/koruma ve taktik kararlarını yapay zekâ verir. İnternet gerekmez.': 'Single player. The AI handles the opponent\'s draft, steal/protect and tactics. No internet needed.',
    'Tek Kişilik Başla →': 'Start Single Player →',
    'Online Oyna →': 'Play Online →',
    // maç kontrolleri
    'Maç Hızı': 'Match Speed', 'Maç İstatistiği': 'Match Stats', 'Maç İçi': 'In-Match',
    '⚙ Taktik & Diziliş': '⚙ Tactics & Lineup', '⇄ Oyuncu Değiştir': '⇄ Substitute', '👁 Rakip Dizilişi': '👁 Opponent Lineup',
    'Maça Hazırım →': 'I\'m Ready →', 'Rakip bekleniyor…': 'Waiting for opponent…',
    'hak': 'left', 'hız': 'speed',
    '🎥 Görünüm: ': '🎥 View: ',
    // istatistik etiketleri
    'Topa Sahip Olma': 'Possession', 'Şut': 'Shots', 'İsabetli Şut': 'Shots on Target',
    'xG (Beklenen Gol)': 'xG (Expected Goals)', 'Korner': 'Corners', 'Faul': 'Fouls',
    '⚡ Olaylar': '⚡ Events', 'Henüz olay yok…': 'No events yet…',
    'BASKIMETRE': 'PRESSURE', 'baskı': 'pressure',
    'taktik gizli': 'tactics hidden',
    // genel butonlar
    'Kapat': 'Close', 'Devam Et': 'Continue', 'İkinci Yarıyı Başlat': 'Start Second Half', 'Başlat': 'Start',
    'Rövanş': 'Rematch', 'Ana Menü': 'Main Menu', 'Ses': 'Sound',
    // --- ekran başlıkları ve açıklamaları (head() merkezi olarak çevirir) ---
    'Lobi': 'Lobby',
    'Oda kur — maç sayısı, kulüp adı ve renk seç. Rakibin yapay zekâ menajeri olacak.': 'Set up your club — pick series length, club name and colour. Your opponent will be an AI manager.',
    'Açan taraf 6 adaydan ilk seçer; diğeri kalan 5 adaydan seçmek zorunda. Açma sırası dönüşümlü.': 'Whoever opens a position picks first from 6 candidates; the other must choose from the remaining 5. The opener alternates.',
    'Kadro & Taktik': 'Squad & Tactics',
    'Maç Arası': 'Half-time Break',
    'Seri Sonucu': 'Series Result',
    'Best-of serisinin galibi · maç maç skorlar · gelişen oyuncular.': 'Series winner · match-by-match scores · players who developed.',
    'Oyuncuların maç sonrası gelişimini gör — ardından yeni çalma turuna ve taktiğe geç.': 'See how your players developed after the match — then move on to the next steal round and tactics.',
    'Çalma / Koruma Düellosu · Tur ': 'Steal / Protect Duel · Round ',
    'Düello Sonucu · Tur ': 'Duel Result · Round ',
    'Maç ': 'Match ',
    // --- butonlar ---
    'Drafte Başla →': 'Start Draft →',
    "Düello'ya Geç →": 'Go to Duel →',
    'Seçimi Kilitle 🔒': 'Lock In Choice 🔒',
    'Rövanş — Yeni Seri 🔁': 'Rematch — New Series 🔁',
    'Lobiye Dön': 'Back to Lobby',
    '📣 Sonucu Paylaş': '📣 Share Result',
    'Paylaş': 'Share',
    // --- kariyer / meta ilerleme ---
    'Kariyerin': 'Your Career',
    'İlerleme': 'Progress',
    'Seri': 'Series',
    'Seri galibiyeti': 'Series won',
    'Kazanma oranı': 'Win rate',
    'Attığın gol': 'Goals scored',
    'En iyi seri galibiyet zinciri': 'Best win streak',
    'Seviye ': 'Level ',
    'Sıradaki': 'Next',
    'Açıldı: ': 'Unlocked: ',
    'Tüm açılımlar tamamlandı': 'All unlocks complete',
    'Oynadıkça kariyer istatistiklerin burada birikir — hesap gerekmez. Google ile giriş yaparsan ilerlemen cihazların arasında taşınır.': 'Your career stats build up here as you play — no account needed. Sign in with Google to carry your progress across devices.',
    // --- günlük meydan okuma ---
    'GÜNÜN MEYDAN OKUMASI': 'DAILY CHALLENGE',
    'Bugünkü Havuzla Oyna →': "Play Today's Pool →",
    'Bugün herkes aynı draft havuzuyla oynuyor. Aynı adaylardan en iyi kadroyu sen kurabilir misin?': 'Everyone plays the same draft pool today. Can you build the best squad from these candidates?',
    'Bugünü tamamladın. Yeni havuza kalan süre: ': "You've finished today. New pool in: ",
    'Kazandın 🏆': 'You won 🏆',
    'Kaybettin': 'You lost',
    // --- ödüllü reklam ---
    'Tekrar dene': 'Try again',
    'Kadroyu dinlendir': 'Rest the squad',
    'Tedavi et (1 maç azalt)': 'Treat injury (−1 match)',
    '+1 değişiklik hakkı': '+1 substitution',
    'Reklam şu an yüklenemedi': "Ad couldn't load right now",
    'Tedavi uygulandı': 'Treatment applied',
    'Kadro dinlendirildi': 'Squad rested',
    'Bugünkü havuz yeniden açıldı': "Today's pool reopened",

  };

  function detect() {
    // /en/ altındaki İngilizce sürüm dili zorlar (SEO: her dil kendi URL'inde)
    if (window.KD_FORCE_LANG === 'en' || window.KD_FORCE_LANG === 'tr') return window.KD_FORCE_LANG;
    let saved = null;
    try { saved = localStorage.getItem('kd_lang'); } catch (_) {}
    if (saved === 'tr' || saved === 'en') return saved;
    const nav = (navigator.language || navigator.userLanguage || 'tr').toLowerCase();
    return nav.indexOf('tr') === 0 ? 'tr' : 'en';
  }
  let lang = detect();
  function T(s) { return lang === 'en' ? (EN[s] != null ? EN[s] : s) : s; }

  window.KD_I18N = {
    T,
    lang() { return lang; },
    set(l) { lang = (l === 'en') ? 'en' : 'tr'; localStorage.setItem('kd_lang', lang); },
    toggle() { this.set(lang === 'tr' ? 'en' : 'tr'); return lang; },
    EN,
  };
})();
