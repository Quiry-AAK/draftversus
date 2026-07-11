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
  };

  function detect() {
    const saved = localStorage.getItem('kd_lang');
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
