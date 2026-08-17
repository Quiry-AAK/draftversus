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

    /* ---------- oyun akışı: ekran içi metinler ----------
       Bunlar HTML'e doğrudan basılıyor; translateHTML() etiketler arasındaki
       metni sözlükten geçirir, bu yüzden çağrı yerlerini sarmak gerekmez. */
    // ana ekran / online
    'Bir oda kur (4 haneli kod alırsın) ya da arkadaşının kodunu girip katıl. Canlı maç ikiniz de taktiğinizi bitirip "Hazır" demeden başlamaz.': 'Create a room (you get a 4-digit code) or join with your friend\'s code. The live match only starts once you have both finished your tactics and hit "Ready".',
    'Oda kur ya da kodla katıl. Aynı odadaki iki oyuncu draft, düello, taktik ve canlı maçı birlikte oynar.': 'Create a room or join with a code. Both players in a room go through the draft, duel, tactics and live match together.',
    'Not: online için oyunu sunucu üzerinden aç (file:// ile çalışmaz).': 'Note: online needs the game served over http (file:// will not work).',
    'Tarayıcıda oynanan ücretsiz futbol draft ve taktik düellosu. Kadronu kur, rakibinden oyuncu çal, taktiğini seç ve maçı canlı izle — indirme yok, üyelik yok.': 'A free football draft and tactics duel played in your browser. Build your squad, steal a player from your rival, pick your tactics and watch the match live — no download, no sign-up.',
    'Draft & Çalma': 'Draft & Steal',
    'Sınırlı havuzdan kadronu kur; rakibinin yıldızını çal, kendininkini koru.': 'Build your squad from a limited pool; steal your rival\'s star and protect your own.',
    'Taktik Düellosu': 'Tactics Duel',
    'Diziliş, oyun felsefesi, pres ve oyuncu görevlerini ayarla — rakibin taktiği gizli.': 'Set your formation, philosophy, pressing and player duties — your rival\'s tactics stay hidden.',
    'Canlı Maç': 'Live Match',
    'Maçı 2D/3D gerçek zamanlı izle; xG, şut, sahip olma ve baskımetre canlı.': 'Watch the match in real time in 2D/3D; xG, shots, possession and the pressure meter update live.',
    'Oda kur, 4 haneli kodu paylaş, arkadaşınla gerçek zamanlı düello yap.': 'Create a room, share the 4-digit code and duel your friend in real time.',
    'Nasıl oynanır? Ayrıntılı rehber →': 'How to play? Full guide →',
    'Bağlanılıyor…': 'Connecting…',
    'Sunucuya bağlanıyor': 'Connecting to the server',
    'Bağlantı sorunu': 'Connection problem',
    'Bu kodu arkadaşına ver — "Odaya Katıl" kısmına yazıp girsin.': 'Give this code to your friend — they type it into "Join Room".',
    'Odaya katıldın ✓': 'Joined the room ✓',
    'Odaya Katıl': 'Join Room',
    'Odaya Katıl →': 'Join Room →',
    // lobi
    'Seri Formatı': 'Series Format',
    '3 maç · 2 galibiyet': '3 matches · 2 wins',
    '5 maç · 3 galibiyet': '5 matches · 3 wins',
    'Kulüp Adı': 'Club Name',
    'Kulüp Rengi': 'Club Colour',
    'Seri formatını seç, kulübünü oluştur.': 'Pick the series format and create your club.',
    'Rakip · Yapay Zekâ': 'Opponent · AI',
    'Rakibin draft, çalma/koruma ve taktik kararlarını otomatik verir.': 'Your opponent handles draft, steal/protect and tactics decisions automatically.',
    'Rakip Kulüp': 'Rival Club',
    'Rakip Rengi': 'Rival Colour',
    // draft
    'Nasıl oynanır': 'How to play',
    'Sıra sende → diziliş ve mevki seç, aday topla. Maç öncesi gizli çalma/koruma düellosu. Yaşlı oyuncular maçtan sonra düşebilir.': 'Your turn → pick a formation and a position, then gather candidates. A hidden steal/protect duel comes before the match. Older players can decline afterwards.',
    '· Kadro': '· Squad',
    "İlk 11'i Kur": 'Build Your XI',
    '🔒 Rakip seçiyor…': '🔒 Opponent is picking…',
    '🔒 Rakip aldı': '🔒 Opponent took them',
    // düello
    'Solda rakipten almak istediğin oyuncuya dokun': 'On the left, tap the player you want to take from your rival',
    'Sağda kendi korumak istediğin yıldıza dokun': 'On the right, tap the star you want to protect',
    'Aşağıdan "Seçimi Kilitle"ye bas': 'Then hit "Lock In Choice" below',
    'Seçildi ✓': 'Selected ✓',
    'Çalma hedefin': 'Your steal target',
    'Koruduğun': 'Protecting',
    'Kilitleyince geri alınamaz': 'Locking in cannot be undone',
    'Seçimin kilitlendi 🔒': 'Your choice is locked 🔒',
    'Rakibin seçimini kilitlemesi bekleniyor…': 'Waiting for your rival to lock in…',
    'Düello Sonucu': 'Duel Result',
    'Transferler Açıklandı': 'Transfers Revealed',
    'Çalma yapmadın': 'You did not steal',
    'Rakip çalmadı': 'Your rival did not steal',
    'Taktiğe Geç →': 'Go to Tactics →',
    // taktik
    'Dizilişi seç · oyuncuları yerleştir · rol & görev ata · takım odağını ayarla. Yeşil = en iyi mevki, sarı = orta, kırmızı = zorlanır.': 'Pick a formation · place your players · assign roles & duties · set the team focus. Green = best position, yellow = passable, red = out of position.',
    'Diziliş': 'Formation',
    'Takım Odağı': 'Team Focus',
    "Tüm puanlar sende — alanlara dağıt. Dolu bir kademeye tekrar dokun → düşür (0'a kadar inebilir).": 'All the points are yours — spread them across the areas. Tap a filled step again to lower it (down to 0).',
    'Görev:': 'Duty:',
    'Tıkla-seç-yer değiştir': 'Tap to select, tap to swap',
    'Bir oyuncu seç': 'Select a player',
    'Sahadaki ya da yedekteki bir oyuncuya dokun → rolü, görevi ve oynayabildiği mevkiler burada açılır. İki oyuncuya sırayla dokunarak yerlerini değiştir.': 'Tap a player on the pitch or on the bench → their role, duty and playable positions open up here. Tap two players in turn to swap them.',
    'Oynayabildiği Mevkiler': 'Playable Positions',
    'Sahadaki Görevi': 'Duty on the Pitch',
    'Yer değiştirmek için: bu oyuncu seçiliyken başka bir oyuncuya / boş slota dokun.': 'To swap: with this player selected, tap another player or an empty slot.',
    'Diziliş & Taktik': 'Formation & Tactics',
    // maç
    '◀ baskı': '◀ pressure',
    'baskı ▶': 'pressure ▶',
    '📣 Maç başlamak üzere…': '📣 The match is about to start…',
    'Canlı: oyuncular ve top gerçek zamanlı hareket ediyor; skor ve süre ilerliyor.': 'Live: players and the ball move in real time; the score and clock run on.',
    ' — Canlı Simülasyon': ' — Live Simulation',
    'Rakibin gerçek formasyonu ve oyuncuları. Taktik ayrıntıları (felsefe, mentalite, odak) gizli.': "Your rival's actual formation and players. The tactical details (philosophy, mentality, focus) stay hidden.",
    '↓ Çıkıyor': '↓ Coming off',
    '↓ ÇIKIYOR': '↓ COMING OFF',
    'Oyuncu Değişikliği': 'Substitution',
    'Oyuncu Değiştir': 'Substitute',
    'Sahadan çıkacak oyuncuya dokun.': 'Tap the player coming off.',
    '· dokun, anında değişir': '· tap and the swap is instant',
    'İpucu: çıkanı seç → geleni seç (anında) · yedeği sahaya sürükle · sahadaki ikiyi birbirine sürükle = yer değiştir': 'Tip: pick who comes off → pick who comes on (instant) · drag a sub onto the pitch · drag two pitch players together to swap them',
    'Değişikliği Uygula': 'Confirm Substitution',
    'Seçili Oyuncu · Rol': 'Selected Player · Role',
    'Sahadaki bir oyuncuya dokun → rolü ve görevini buradan değiştir. Diziliş, mentalite ve takım odağı soldan ayarlanır.': 'Tap a player on the pitch → change their role and duty here. Formation, mentality and team focus are set on the left.',
    'Hazırsın ✓': "You're ready ✓",
    'Rakibin 2. yarı için hazır olması bekleniyor…': 'Waiting for your rival to be ready for the second half…',
    'host kontrolünde · ': 'host controlled · ',
    'canlı': 'live',
    // maç arası / sonuç
    'En Çok Gelişen': 'Most Improved',
    'En Çok Düşen': 'Biggest Drop',
    'Maçın Oyuncusu': 'Player of the Match',
    'Maçlar peş peşe oynanır — oyuncular tam dinlenmez ama maç sonrası sağlam toparlanır. Oynayanlar daha yorgun, kenardakiler daha taze başlar. Sakat oyuncular iyileşene kadar oynayamaz.': 'Matches run back to back — players do not fully rest, but they recover well afterwards. Those who played start more tired, those on the bench start fresher. Injured players sit out until they heal.',
    'Gelişimi gördün — sıradaki maç için yeni çalma turuna geç.': "You've seen the development — move on to the next steal round for the following match.",
    'Maç İstatistikleri': 'Match Stats',
    '➕ Sakatlar — sıradaki maçta yok': '➕ Injuries — out for the next match',
    'Bu seride gelişen oyuncu kaydı yok.': 'No player development recorded in this series.',
    'Maç Maç': 'Match by Match',
    'Kadro mevcudu': 'Squad available',
    'Son Maçta Gelişenler': 'Developed in the Last Match',

    /* ---------- oyun verisi sözlüğü ----------
       DİKKAT: data.js/engine.js'teki Türkçe dizeler yalnızca ETİKET değil,
       aynı zamanda motor ANAHTARI (MENT_ATT['Çok Temkinli'], f['Defans Hattı'],
       phil === 'Kanat'). Bu yüzden veri ASLA çevrilmez — çeviri sadece
       translateHTML() ile gösterim anında yapılır. Seçimler data-* özniteliğinde
       taşındığı için (data-phil, data-focus) çeviri mantığı bozmaz. */
    // mevkiler
    'Kaleci': 'Goalkeeper', 'Sağ Bek': 'Right Back', 'Stoper': 'Centre Back', 'Sol Bek': 'Left Back',
    'Defansif Orta Saha': 'Defensive Midfielder', 'Merkez Orta Saha': 'Central Midfielder',
    '10 Numara': 'Attacking Midfielder', 'Sağ Açık': 'Right Winger', 'Sol Açık': 'Left Winger',
    'Sağ Kanat': 'Right Midfielder', 'Sol Kanat': 'Left Midfielder', 'Santrafor': 'Striker',
    // mevki kısaltmaları
    'KL': 'GK', 'SĞB': 'RB', 'STP': 'CB', 'SLB': 'LB', 'DOS': 'DM', 'MOS': 'CM',
    'OOS': 'AM', 'SĞA': 'RW', 'SLA': 'LW', 'SĞK': 'RM', 'SLK': 'LM', 'SF': 'ST',
    // nitelik kısaltmaları
    'HIZ': 'PAC', 'ŞUT': 'SHO', 'DRP': 'DRI', 'FİZ': 'PHY',
    'KON': 'POS', 'ELK': 'HAN', 'AYK': 'KIC',
    'GÜÇ': 'OVR',
    // felsefe · mentalite · odak · görev
    'Kontra': 'Counter-Attack', 'Yüksek Pres': 'High Press', 'Defansif Blok': 'Low Block',
    'Direkt': 'Direct', 'Kanat Oyunu': 'Wing Play', 'Kanat': 'Winger',
    'Çok Temkinli': 'Very Cautious', 'Temkinli': 'Cautious', 'Dengeli': 'Balanced',
    'Cesur': 'Positive', 'Çok Cesur': 'Very Attacking',
    'Pres': 'Pressing', 'Tempo': 'Tempo', 'Genişlik': 'Width', 'Defans Hattı': 'Defensive Line',
    'Yaratıcılık': 'Creativity', 'Fizik': 'Physicality',
    'Hücum': 'Attack', 'Denge': 'Balance', 'Savunma': 'Defend',
    // mevki uygunluğu
    'Yüksek': 'High', 'Orta': 'Average', 'Düşük': 'Low', 'Uygun değil': 'Out of position',
    // arketipler ve roller
    'Klasik Kaleci': 'Traditional Keeper', 'Süpürücü Kaleci': 'Sweeper Keeper',
    'Refleks Kalecisi': 'Shot Stopper', 'Çizgi Kalecisi': 'Line Keeper',
    'Bekçi Stoper': 'No-Nonsense Centre Back', 'Çıkışçı Stoper': 'Ball-Playing Defender',
    'Hızlı Stoper': 'Quick Centre Back', 'Bekçi': 'No-Nonsense Defender',
    'Akıncı Bek': 'Attacking Full Back', 'Defansif Bek': 'Defensive Full Back',
    'Bek': 'Full Back', 'Stoper Bek': 'Inverted Full Back', 'Yarı Stoper': 'Half Back',
    'Top Toplayıcı': 'Ball Winner', 'Pivot (Derin Kurucu)': 'Deep-Lying Playmaker',
    'Derin Kurucu': 'Deep-Lying Playmaker', 'Box-to-Box': 'Box-to-Box',
    'Mezzala': 'Mezzala', 'Oyun Kurucu': 'Playmaker', 'Kurucu Orta Saha': 'Advanced Playmaker',
    'Numara 10': 'Number 10', 'Gölge Forvet': 'Shadow Striker', 'Serbest Adam': 'Free Role',
    'İçe Kat Eden': 'Inside Forward', 'İçe Kat Eden Kanat': 'Inside Forward',
    'Klasik Açık': 'Traditional Winger', 'Akıncı Kanat': 'Attacking Winger',
    'Hız Kanadı': 'Pace Winger', 'Hedef Adam': 'Target Man', 'Hedef Adam (Pivot)': 'Target Man',
    'Tamamlayıcı Forvet': 'Complete Forward', 'Yalancı 9': 'False 9',
    'Bitirici': 'Poacher', 'Hızlı Forvet': 'Pacey Forward',

    /* ---------- draft · düello · maç: kalan ekran metinleri ---------- */
    'Sen açıyorsun': 'You open the position', 'Rakip açtı': 'Your rival opened it',
    'Rakip seçiyor…': 'Your rival is picking…',
    'Önce dizilişini seç, sonra açmak istediğin slota dokun.': 'Pick your formation first, then tap the slot you want to open.',
    'Açmak istediğin boş slota dokun → 6 aday açılır. Yeşil slot şu an açık.': 'Tap an empty slot to open it → 6 candidates appear. The green slot is open right now.',
    'Rakip mevki açtı — sağdaki kalan adaylardan seç (en uygun slotuna yerleşir).': 'Your rival opened a position — pick from the remaining candidates on the right (they slot in where they fit best).',
    'adayları': 'candidates', 'ilk seçim senin': 'you pick first',
    'rakip birini aldı, kalan ': 'your rival took one, remaining: ',
    'yaş': 'yrs', 'AÇIK': 'OPEN', 'Seç': 'Pick',
    'ÇAL': 'STEAL', 'SERİ': 'SERIES', 'MAÇ': 'MATCH',
    'Gizli düello: aynı anda BİR rakip oyuncu çal + kendi BİR oyuncunu koru. İkiniz de kilitleyince sonuç açılır.': 'A hidden duel: at the same time, steal ONE rival player and protect ONE of your own. The result opens once you have both locked in.',
    'Seçimini kilitledin. Rakip de kilitleyince sonuç aynı anda açılır.': 'You have locked your choice in. Once your rival locks in too, both are revealed together.',
    'İki seçim aynı anda açıldı.': 'Both choices revealed at once.',
    '👆 Almak istediğin rakip oyuncuya dokun. Henüz seçmedin.': '👆 Tap the rival player you want to take. Nothing selected yet.',
    '🛡 Korumak istediğin kendi yıldızına dokun — rakip onu çalamaz. Henüz seçmedin.': '🛡 Tap your own star to protect them — your rival cannot steal them. Nothing selected yet.',
    '(önce hedef seç)': '(pick a target first)',
    'Otomatik verilecek': 'Given up automatically',
    'Çalman BAŞARILI': 'Your steal WORKED', 'Oyuncunu KAYBETTİN': 'You LOST a player',
    '2D canlı maç · oyuncular ve top gerçek zamanlı hareket eder · maç içi taktik ve oyuncu değişikliği.': 'A live 2D match · players and the ball move in real time · in-match tactics and substitutions.',
    'Casus raporu 🔍': 'Scout report 🔍',
    '☁ İlerlemeni kaydet': '☁ Save your progress',
    /* Aksansız Türkçe kelimeler (iyi, orta, Rol, Tur…): tarama sırasında
       gözden kaçmaları kolay, bu yüzden ayrı blokta toplandı. */
    /* ---------- toast ve bağlantı bildirimleri ----------
       textContent ile basıldıkları için translateHTML görmez; toast() ve
       netBanner() içinde T()'den geçerler. */
    'Kalan odak puanı yok — başka bir alanı düşür': 'No focus points left — lower another area first',
    'Diziliş yalnızca ilk seçimden önce değiştirilebilir': 'The formation can only be changed before your first pick',
    "İlk 11 eksik — tüm slotları doldur": 'Your XI is incomplete — fill every slot',
    'Değişiklik hakkın kalmadı': 'You have no substitutions left',
    'Değişiklik yapıldı: ': 'Substitution made: ',
    'Hazırsın — rakip bekleniyor…': "You're ready — waiting for your rival…",
    'Hazırlanıyor…': 'Preparing…',
    'Paylaşılamadı': 'Could not share',
    'Metin kopyalandı, görsel indirildi': 'Text copied, image downloaded',
    'Görsel indirildi': 'Image downloaded',
    'Sonuç panoya kopyalandı': 'Result copied to clipboard',
    'Paylaşım desteklenmiyor': 'Sharing is not supported',
    'Bir hata oluştu': 'Something went wrong',
    '3D görünüm yüklenemedi': 'The 3D view could not load',
    // online bağlantı durumları
    'Oyun dosyadan açılmış (file://). Online için sunucudan aç.': 'The game was opened from a file (file://). Online needs it served over http.',
    'Sunucuya bağlanılamadı.': 'Could not reach the server.',
    'Bağlantı kurulamadı': 'Could not connect',
    'Bağlantı hatası': 'Connection error',
    'Rakip oyundan ayrıldı': 'Your rival left the game',
    'Rakip bağlantısı koptu — geri dönmesi bekleniyor…': 'Your rival dropped — waiting for them to come back…',
    'Rakip geri döndü': 'Your rival is back',
    'Bağlantın koptu — yeniden bağlanılıyor…': 'You dropped — reconnecting…',
    'Yeniden bağlandın': "You're reconnected",
    'Rakip aldı: ': 'Your rival took: ',
    '× hız': '× speed', ' sakat — sahaya alınamaz': ' is injured — cannot come on',
    // aday esneklik etiketleri · düello sonuç başlıkları · maç içi panel
    'Tek mevki': 'One position', 'Çok yönlü': 'Versatile', 'Esnek': 'Flexible',
    'Henüz seçmedin.': 'Nothing selected yet.', 'Seçildi ✓': 'Selected ✓',
    'Çalman ENGELLENDİ': 'Your steal was BLOCKED', 'Koruman İŞE YARADI': 'Your protection WORKED',
    'hazır ✓': 'ready ✓', 'taktik yapıyor…': 'setting tactics…',
    'Maç İçi Panel': 'In-Match Panel',
    'duraklatıldı': 'paused', 'taktik yap': 'set your tactics', 'skor ': 'score ',
    '⏸ Devre Arası': '⏸ Half Time', '⏸ Uzatma Arası': '⏸ Extra-Time Break', '⏸ Uzatma Molası': '⏸ Extra-Time Break',
    'Devre arası — taktiğini ayarla, hazır olunca ikinci yarıyı başlat': 'Half time — adjust your tactics, then start the second half when you are ready',
    'Bir oyuncu çıkar, yedekten birini al — değişiklik anında sahaya yansır': 'Take one player off and bring a sub on — the change hits the pitch straight away',
    'Diziliş, mentalite ve takım odağı değişiklikleri sahaya anında uygulanır': 'Formation, mentality and team-focus changes are applied to the pitch immediately',
    'VEYA': 'OR', 'Online (Oda) 1v1': 'Online (Room) 1v1',
    'DraftVersus nedir?': 'What is DraftVersus?',
    'Tekrar Dene': 'Try Again',
    'Oda kuruldu': 'Room created', 'Oda kodu:': 'Room code:',
    'Oda Kur': 'Create Room', 'Oda Kur →': 'Create Room →', 'Oda Kodu': 'Room Code',
    'YDK': 'SUB', 'Tur': 'Round', 'Yedekler': 'Substitutes',
    'iyi': 'good', 'orta': 'average', 'oynamaz': 'cannot play',
    'Oyun Felsefesi': 'Philosophy', 'Mentalite': 'Mentality', 'Rol': 'Role',
    'CANLI': 'LIVE', 'Not': 'Note',
    'reyting': 'rating', 'güç': 'overall',
    'Serinin oyuncusu': 'Player of the series',
    'mevkisini açtın — 6 adaydan ilk seçimi sen yaparsın': 'is open — you pick first from 6 candidates',
    'kötü': 'poor', 'seç →': 'pick →', 'sahaya at': 'send on',
    /* Maç içi paneller: butonlar ok ekli varyantla basılıyor, ok'suz
       anahtarla eşleşmiyor — bu yüzden ayrıca yazıldı. */
    'İkinci Yarıyı Başlat →': 'Start Second Half →',
    'Uzatmayı Başlat →': 'Start Extra Time →',
    'Devam Et →': 'Continue →',
    'Bu mevkide uyum:': 'Fit for this position:',
    ' — kötü oynar': ' — will struggle here',
    ' — bu mevkide oynayamaz': ' — cannot play here',
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

  /* ---------- HTML dizesini toplu çevir ----------
     Oyun ekranları şablon dizeleriyle üretiliyor; her metni tek tek T() ile
     sarmak 90'dan fazla dokunuş demekti (ve her yeni satırda unutulma riski).
     Bunun yerine HTML DOM'a girmeden ÖNCE etiketler arasındaki metin
     sözlükten geçirilir: `>Diziliş<` → `>Formation<`.

     Neden dize üstünde, DOM üstünde değil: morph() yeni HTML'i mevcut DOM ile
     karşılaştırıyor. DOM'u sonradan çevirseydik her karşılaştırma "farklı"
     çıkar, ekran sürekli yeniden yazılırdı.

     Yalnızca `>` ve `<` arasındaki tam eşleşmeler değişir — öznitelikler,
     JS ve kullanıcı adları etkilenmez. İngilizce karşılıklar sözlükte anahtar
     olmadığı için işlem tekrarlanabilir (ikinci geçiş hiçbir şey yapmaz). */
  const TEXT_RE = />([^<>]+)</g;
  /* Bir metin parçasını çevir. Tam eşleşme yoksa " · " ile ayrılmış
     bileşenleri tek tek dener: "4-3-3 · Yüksek Pres" → "4-3-3 · High Press".
     Hiçbir parça sözlükte yoksa metin olduğu gibi bırakılır (oyuncu adları,
     skorlar, kulüp adları böyle korunur). */
  function seg(s) {
    if (EN[s] != null) return EN[s];
    const t = s.trim();
    if (t !== s && EN[t] != null) return s.replace(t, EN[t]);
    if (s.indexOf(' · ') < 0) return s;
    let hit = false;
    const parts = s.split(' · ').map(p => {
      const k = p.trim();
      if (EN[k] == null) return p;
      hit = true;
      return p.replace(k, EN[k]);
    });
    return hit ? parts.join(' · ') : s;
  }
  function translateHTML(html) {
    if (lang !== 'en' || !html) return html;
    TEXT_RE.lastIndex = 0;
    return html.replace(TEXT_RE, (m, txt) => '>' + seg(txt) + '<');
  }

  /* ---------- spiker metinleri ----------
     Maç anlatımı kulüp ve oyuncu adlarıyla iç içe kuruluyor
     ('GOOOL! M. Adeyemi ağları sarstı! Liman FK sevinçte!'), bu yüzden tam
     eşleşme çalışmaz. Burada yalnızca SABİT KALIPLAR parça parça değiştirilir;
     aradaki adlar olduğu gibi kalır. Sıra önemli: uzun kalıplar önce gelmeli
     ki kısa bir kalıp uzununun içini bozmasın. */
  const PHRASES = [
    ['Santra yapıldı — top geriye verildi, oyun başlıyor.', 'Kick-off — the ball goes back and we are under way.'],
    ['Oyun yeniden başladı — ', 'Play restarts — '],
    ['90 dakika doldu — uzatma anları oynanıyor.', '90 minutes are up — we are into stoppage time.'],
    ['Uzatmalar da yetmedi — PENALTI ATIŞLARI!', 'Extra time settled nothing — PENALTY SHOOT-OUT!'],
    ['Penaltılarda ', 'On penalties '],
    ['Müthiş kurtarış! Kaleci çıkardı.', 'Wonderful save! The keeper gets there.'],
    ['PENALTI KURTARILDI! Müthiş kaleci.', 'PENALTY SAVED! What a goalkeeper.'],
    ['Gol tekrarı izleniyor…', 'We are watching the goal replay…'],
    ['Korner ortası ceza sahasına geliyor…', 'The corner is swung into the box…'],
    ['Frikikten direkt vuruyor!', 'Going for goal directly from the free kick!'],
    ['İkinci yarı başladı!', 'The second half is under way!'],
    ['Şut auta gitti.', 'The shot goes wide.'],
    ['Ofsayt! ', 'Offside! '],
    [' pozisyonda yakalandı.', ' were caught out.'],
    [' şutu çekiyor', ' get their shot away'],
    ['Korner — ', 'Corner — '],
    ['Taç — ', 'Throw-in — '],
    ['PENALTI! ', 'PENALTY! '],
    [' lehine faul. Topun başında ', ' win the foul. Standing over the ball: '],
    [' koşusunu yaptı, vuruyor!', ' makes the run and strikes!'],
    [' sakatlandı! ', ' is injured! '],
    ['Durumu ciddi — menajer değişiklik yapmalı, yoksa düşük performansla devam.', 'It looks serious — the manager should make a change, or play on at reduced level.'],
    ['Etkilendi, düşük performansla oynuyor.', 'Shaken up, and playing on at a reduced level.'],
    ['GOOOL! ', 'GOOOAL! '],
    [' ağları sarstı! ', ' finds the net! '],
    [' sevinçte!', ' are celebrating!'],
    ['Maç bitti! ', 'Full time! '],
    [' kazandı!', ' win!'],
    [' GOL!', ' SCORES!'],
    [' KAÇIRDI!', ' MISSES!'],
    // faul ve kartlar
    ['KIRMIZI KART! ', 'RED CARD! '],
    [' oyundan atıldı — ', ' is sent off — '],
    [' 10 kişi kaldı!', ' are down to ten men!'],
    ['İkinci sarı → KIRMIZI', 'Second yellow → RED'],
    ['KIRMIZI KART', 'RED CARD'],
    ['Sarı kart! ', 'Yellow card! '],
    ['Sarı kart — ', 'Yellow card — '],
    ['SARI KART', 'YELLOW CARD'],
    ['Faul. ', 'Foul. '],
    ['Faul — ', 'Foul — '],
    [' müdahale etti.', ' made the challenge.'],
    ['FAUL', 'FOUL'],
    // devre arası ve uzatma
    ['Beraberlik! Uzatma öncesi taktik molası — skor ', 'All square! A tactical break before extra time — score '],
    ['Uzatma arası. Skor ', 'Extra-time break. Score '],
    ['Devre arası. Skor ', 'Half-time. Score '],
    ['Uzatmalar başladı!', 'Extra time is under way!'],
    ['Uzatmanın ikinci yarısı!', 'The second period of extra time!'],
    // sahada beliren yazılar (canvas — engine.js çizim anında çevirir)
    ['GOOOL!', 'GOOOAL!'],
    ['PENALTI ATIŞLARI', 'PENALTY SHOOT-OUT'],
    ['UZATMA ARASI', 'EXTRA-TIME BREAK'],
    ['DEVRE ARASI', 'HALF TIME'],
    ['UZATMA', 'EXTRA TIME'],
    ['OFSAYT', 'OFFSIDE'],
    ['SAKATLIK', 'INJURY'],
    ['PENALTI', 'PENALTY'],
    ['KURTARIŞ', 'SAVE'],
    ['MAÇ BİTTİ', 'FULL TIME'],
    ['TEKRAR · GOL', 'REPLAY · GOAL'],
    // atak anlatımı
    ['atağa çıkıyor', 'break forward'],
    ['tehlikeli bölgede', 'are in a dangerous area'],
    ['baskıyı artırıyor', 'are turning up the pressure'],
    ['ileri çıkıyor', 'push up'],
    // sakatlık ve gelişim etiketleri
    ['AĞIR sakatlık', 'SERIOUS injury'],
    ['hafif sakatlık', 'slight injury'],
    ['sakatlık', 'injury'],
    ['maçın oyuncusu', 'player of the match'],
    ['istikrarlı', 'consistent'],
    ['gelişim', 'development'],
  ];
  function phrase(txt) {
    if (lang !== 'en' || !txt) return txt;
    let s = txt;
    for (let i = 0; i < PHRASES.length; i++) s = s.split(PHRASES[i][0]).join(PHRASES[i][1]);
    return s;
  }

  window.KD_I18N = {
    T,
    translateHTML,
    phrase,
    lang() { return lang; },
    set(l) { lang = (l === 'en') ? 'en' : 'tr'; localStorage.setItem('kd_lang', lang); },
    toggle() { this.set(lang === 'tr' ? 'en' : 'tr'); return lang; },
    EN,
  };
})();
