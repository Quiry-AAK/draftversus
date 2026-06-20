/* ============================================================
   DraftVersus — Veri Katmanı
   Mevkiler, uygunluk (fit) sistemi, dizilişler, oyuncu havuzu
   ============================================================ */

/* Fine-grained positions. line = sahanın derinliği (0 kaleci .. 6 forvet),
   side = R/L/C (sağ/sol/merkez). Fit hesabı bunları kullanır. */
const POS = {
  KL:  { name: 'Kaleci',              line: 0, side: 'C' },
  SĞB: { name: 'Sağ Bek',             line: 1, side: 'R' },
  STP: { name: 'Stoper',              line: 1, side: 'C' },
  SLB: { name: 'Sol Bek',             line: 1, side: 'L' },
  DOS: { name: 'Defansif Orta Saha',  line: 2, side: 'C' },
  MOS: { name: 'Merkez Orta Saha',    line: 3, side: 'C' },
  OOS: { name: '10 Numara',           line: 4, side: 'C' },
  SĞA: { name: 'Sağ Açık',            line: 4, side: 'R' },
  SLA: { name: 'Sol Açık',            line: 4, side: 'L' },
  SĞK: { name: 'Sağ Kanat',           line: 5, side: 'R' },
  SLK: { name: 'Sol Kanat',           line: 5, side: 'L' },
  SF:  { name: 'Santrafor',           line: 6, side: 'C' },
};
const ALL_POS = Object.keys(POS);

/* Mevki geometrisi: d = derinlik (0 kaleci .. 4.3 santrafor), s = kanat (-1 sol, 0 merkez, 1 sağ).
   Uygunluk bu mesafeden çıkar — kanat uyuşmazlığı ağır cezalı, böylece stoper bek gibi "esnek" görünmez. */
const POS_GEO = {
  KL:  { d: 0,   s: 0 }, STP: { d: 1,   s: 0 }, SĞB: { d: 1,   s: 1 }, SLB: { d: 1,   s: -1 },
  DOS: { d: 1.9, s: 0 }, MOS: { d: 2.7, s: 0 }, OOS: { d: 3.3, s: 0 },
  SĞA: { d: 3.2, s: 1 }, SLA: { d: 3.2, s: -1 }, SĞK: { d: 3.5, s: 1 }, SLK: { d: 3.5, s: -1 }, SF: { d: 4.3, s: 0 },
};
function posDistance(a, b) {
  if (a === b) return 0;
  if ((a === 'KL') !== (b === 'KL')) return 9;   // kaleci yalnızca kaleci oynar
  const A = POS_GEO[a], B = POS_GEO[b]; if (!A || !B) return 9;
  let sd; if (A.s === B.s) sd = 0; else if (A.s === 0 || B.s === 0) sd = 1.15; else sd = 1.95;
  return Math.abs(A.d - B.d) + sd;
}
/* best (yeşil) · ok (sarı) · poor (kırmızı, kötü oynar) · none (boş, oynayamaz) */
function posAffinity(player, pos) {
  if (player.positions.includes(pos)) return 'best';
  let m = 99; player.positions.forEach(p => { const d = posDistance(p, pos); if (d < m) m = d; });
  return m <= 1.0 ? 'ok' : m <= 1.6 ? 'poor' : 'none';
}
function fitLevel(player, slotPos) {
  const a = posAffinity(player, slotPos);
  return a === 'best' ? 'high' : a === 'ok' ? 'mid' : a === 'poor' ? 'low' : 'none';
}
/* Uygunluğun güç çarpanı — maç motoru bunu kullanır. */
const FIT_MULT = { high: 1.0, mid: 0.85, low: 0.62, none: 0.45 };
const FIT_META = {
  high: { label: 'Yüksek', col: '#13a76a', bg: '#e7f8f0', bd: '#c5edd9' },
  mid:  { label: 'Orta',   col: '#b9870f', bg: '#fdf6e6', bd: '#f3e2bd' },
  low:  { label: 'Düşük',  col: '#e5484d', bg: '#fdeced', bd: '#f3c6c8' },
  none: { label: 'Uygun değil', col: '#9aa1ac', bg: '#f2f3f5', bd: '#e6e8ec' },
};

/* Dizilişler: her slotun mevkisi + saha üzerindeki konumu (% — y büyüdükçe kale).
   Forvet üstte (y küçük), kaleci altta (y büyük). */
const FORMATIONS = {
  '4-4-2': [
    ['KL', 50, 90], ['SĞB', 84, 68], ['STP', 62, 74], ['STP', 38, 74], ['SLB', 16, 68],
    ['SĞK', 82, 44], ['MOS', 60, 48], ['MOS', 40, 48], ['SLK', 18, 44],
    ['SF', 60, 18], ['SF', 40, 18],
  ],
  '4-3-3': [
    ['KL', 50, 90], ['SĞB', 82, 70], ['STP', 62, 75], ['STP', 38, 75], ['SLB', 18, 70],
    ['DOS', 30, 52], ['MOS', 50, 55], ['MOS', 70, 52],
    ['SĞK', 80, 24], ['SF', 50, 18], ['SLK', 20, 24],
  ],
  '4-2-3-1': [
    ['KL', 50, 90], ['SĞB', 84, 68], ['STP', 62, 74], ['STP', 38, 74], ['SLB', 16, 68],
    ['DOS', 38, 56], ['DOS', 62, 56], ['OOS', 50, 36],
    ['SĞK', 82, 32], ['SLK', 18, 32], ['SF', 50, 16],
  ],
  '3-5-2': [
    ['KL', 50, 90], ['STP', 30, 77], ['STP', 50, 79], ['STP', 70, 77],
    ['SĞK', 88, 52], ['MOS', 64, 52], ['DOS', 50, 58], ['MOS', 36, 52], ['SLK', 12, 52],
    ['SF', 60, 20], ['SF', 40, 20],
  ],
  '5-3-2': [
    ['KL', 50, 90], ['SĞB', 88, 64], ['STP', 68, 76], ['STP', 50, 79], ['STP', 32, 76], ['SLB', 12, 64],
    ['MOS', 64, 50], ['DOS', 50, 54], ['MOS', 36, 50],
    ['SF', 60, 22], ['SF', 40, 22],
  ],
};
const FORMATION_NAMES = Object.keys(FORMATIONS);

/* Taktik seçenekleri */
const PHILOSOPHIES = ['Topa Sahip Olma', 'Kontra', 'Yüksek Pres', 'Defansif Blok', 'Direkt', 'Kanat'];
const MENTALITIES = ['Çok Temkinli', 'Temkinli', 'Dengeli', 'Cesur', 'Çok Cesur'];
const FOCUS_KEYS = ['Pres', 'Tempo', 'Genişlik', 'Defans Hattı', 'Yaratıcılık', 'Fizik'];

/* Mevkiye göre rol seçenekleri (taktik panelinde) */
const ROLES = {
  KL:  ['Süpürücü Kaleci', 'Çizgi Kalecisi'],
  SĞB: ['Akıncı Bek', 'Bek', 'Stoper Bek'],
  SLB: ['Akıncı Bek', 'Bek', 'Stoper Bek'],
  STP: ['Stoper', 'Çıkışçı Stoper', 'Bekçi'],
  DOS: ['Derin Kurucu', 'Top Toplayıcı', 'Yarı Stoper'],
  MOS: ['Box-to-Box', 'Mezzala', 'Kurucu Orta Saha'],
  OOS: ['Numara 10', 'Gölge Forvet', 'Serbest Adam'],
  SĞA: ['İçe Kat Eden', 'Klasik Açık'],
  SLA: ['İçe Kat Eden', 'Klasik Açık'],
  SĞK: ['Kanat', 'İçe Kat Eden', 'Akıncı Kanat'],
  SLK: ['Kanat', 'İçe Kat Eden', 'Akıncı Kanat'],
  SF:  ['Hedef Adam', 'Tamamlayıcı Forvet', 'Yalancı 9'],
};

/* Görev → renk (sahadaki nokta belirteci) */
const TASKS = ['Hücum', 'Denge', 'Savunma'];
const TASK_COL = { 'Hücum': '#e5484d', 'Denge': '#d9a017', 'Savunma': '#3b6fe0' };
/* Mevkiye göre varsayılan görev */
function defaultTask(pos) {
  const line = POS[pos].line;
  if (line >= 5) return 'Hücum';
  if (line >= 3) return 'Denge';
  return 'Savunma';
}

/* Kulüp renk seçenekleri */
const CLUB_COLORS = ['#3b6fe0', '#e8893b', '#19c37d', '#e5484d', '#8b5cf6', '#0ea5b7', '#eab308', '#ec4899'];

/* ---- İsim havuzu (karma uluslar) ---- */
const FIRST_INITIALS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'V', 'W', 'Y', 'Z'];
const SURNAMES = [
  // Türk
  'Yılmaz', 'Demir', 'Şahin', 'Kaya', 'Aydın', 'Korkmaz', 'Çetin', 'Polat', 'Toprak', 'Aksoy', 'Doğan', 'Öztürk', 'Yıldız',
  // İngiliz/İrlanda
  'Smith', 'Walker', 'Carter', 'Bell', 'Foster', 'Reed', 'Hughes', 'Murphy', 'Kane', 'Shaw', 'Grealish', 'Ward',
  // İspanyol/Portekiz
  'García', 'Torres', 'Ramos', 'Silva', 'Costa', 'Mendes', 'Reyes', 'Bravo', 'Núñez', 'Vega', 'Soto', 'Lima',
  // Alman/Hollanda
  'Müller', 'Schneider', 'Wagner', 'Klein', 'Vermeer', 'Bakker', 'de Jong', 'Visser', 'Kraus', 'Werner',
  // İtalyan/Fransız
  'Rossi', 'Conti', 'Marino', 'Greco', 'Bernard', 'Laurent', 'Moreau', 'Girard', 'Lucas', 'Petit',
  // Slav
  'Kovač', 'Novak', 'Petrov', 'Ivanov', 'Marković', 'Horvat', 'Sokolov', 'Jankovic', 'Lewandowski', 'Kowalski',
  // Afrika
  'Okafor', 'Mensah', 'Diallo', 'Traoré', 'Adeyemi', 'Osei', 'Mbeki', 'Sané', 'Koné', 'Bah',
  // Arap/Orta Doğu
  'Hassan', 'Ahmadi', 'Karimi', 'Nasri', 'Salah', 'Haidar', 'Mansour',
  // Asya/Latin
  'Tanaka', 'Kim', 'Nakamura', 'Chen', 'Nguyen', 'Suzuki', 'Santos', 'Vidal', 'Herrera', 'Ortega', 'Cruz',
];

let _uid = 1;
function shortName(name) {
  const parts = name.split('. ');
  const last = parts[parts.length - 1];
  return last.slice(0, 3).toLocaleUpperCase('tr-TR');
}
const STAT_KEYS = ['HIZ', 'ŞUT', 'PAS', 'DRP', 'DEF', 'FİZ'];
/* Kaleciler ayrı stat seti kullanır — saha oyuncusu statları kaleci için anlamsız. */
const GK_STAT_KEYS = ['REF', 'KON', 'ELK', 'AYK', 'HIZ', 'FİZ'];
/* REF Refleks · KON Konumlanma · ELK El (tutuş) · AYK Ayakla Oyun · HIZ · FİZ */
function statKeysFor(player) { return player && player.pos === 'KL' ? GK_STAT_KEYS : STAT_KEYS; }

/* Mevkiye göre stat profili (vurgular). Saha: HIZ ŞUT PAS DRP DEF FİZ · Kaleci: REF KON ELK AYK HIZ FİZ */
function statProfile(primary, ovr) {
  const line = POS[primary].line;
  const base = {};
  const r = (n) => Math.max(20, Math.min(99, Math.round(n)));
  const jitter = () => (Math.random() * 10 - 5);
  if (primary === 'KL') {
    return { REF: r(ovr + 2 + jitter()), KON: r(ovr - 1 + jitter()), ELK: r(ovr + jitter()),
             AYK: r(ovr - 9 + jitter()), HIZ: r(ovr - 20 + jitter()), FİZ: r(ovr - 1 + jitter()) };
  }
  if (line === 1) { // defans
    return { HIZ: r(ovr - 4 + jitter()), ŞUT: r(ovr - 36 + jitter()), PAS: r(ovr - 12 + jitter()),
             DRP: r(ovr - 18 + jitter()), DEF: r(ovr + 3 + jitter()), FİZ: r(ovr + 2 + jitter()) };
  }
  if (line === 2 || line === 3) { // orta saha
    return { HIZ: r(ovr - 4 + jitter()), ŞUT: r(ovr - 8 + jitter()), PAS: r(ovr + 4 + jitter()),
             DRP: r(ovr + 1 + jitter()), DEF: r(ovr - 6 + jitter()), FİZ: r(ovr - 2 + jitter()) };
  }
  // hücum hatları (4-6)
  return { HIZ: r(ovr + 5 + jitter()), ŞUT: r(ovr + 3 + jitter()), PAS: r(ovr - 4 + jitter()),
           DRP: r(ovr + 4 + jitter()), DEF: r(ovr - 28 + jitter()), FİZ: r(ovr - 6 + jitter()) };
}

/* Mevki kümeleri — ikincil mevkiler gerçekçi/aynı kanat; çoğu oyuncu tek mevki. */
const POS_CLUSTERS = [
  { primary: 'KL',  extras: [] },
  { primary: 'STP', extras: ['DOS', 'SĞB', 'SLB'] },
  { primary: 'SĞB', extras: ['SĞK', 'STP'] },
  { primary: 'SLB', extras: ['SLK', 'STP'] },
  { primary: 'DOS', extras: ['MOS', 'STP'] },
  { primary: 'MOS', extras: ['DOS', 'OOS'] },
  { primary: 'OOS', extras: ['MOS', 'SF'] },
  { primary: 'SĞK', extras: ['SĞA', 'OOS'] },
  { primary: 'SLK', extras: ['SLA', 'OOS'] },
  { primary: 'SF',  extras: ['OOS'] },
];

/* Oyuncu tipleri (arketip) — her mevkide farklı karakterler; statları belirgin değiştirir.
   m = stat modifikasyonları (HIZ ŞUT PAS DRP DEF FİZ). Taktiksel derinlik buradan gelir. */
const ARCHETYPES = {
  KL:  [{ n: 'Klasik Kaleci', m: { KON: 4, ELK: 4, AYK: -5 } }, { n: 'Süpürücü Kaleci', m: { AYK: 11, HIZ: 9, KON: 3, REF: -3 } }, { n: 'Refleks Kalecisi', m: { REF: 10, ELK: 4, AYK: -6, KON: -2 } }],
  STP: [{ n: 'Bekçi Stoper', m: { FİZ: 9, DEF: 8, HIZ: -12, PAS: -7, DRP: -5 } }, { n: 'Çıkışçı Stoper', m: { PAS: 10, DRP: 5, HIZ: 2, FİZ: -4 } }, { n: 'Hızlı Stoper', m: { HIZ: 12, DEF: 2, FİZ: -3 } }],
  SĞB: [{ n: 'Akıncı Bek', m: { HIZ: 9, DRP: 5, PAS: 3, DEF: -6 } }, { n: 'Defansif Bek', m: { DEF: 9, FİZ: 5, HIZ: -2, DRP: -3 } }],
  SLB: [{ n: 'Akıncı Bek', m: { HIZ: 9, DRP: 5, PAS: 3, DEF: -6 } }, { n: 'Defansif Bek', m: { DEF: 9, FİZ: 5, HIZ: -2, DRP: -3 } }],
  DOS: [{ n: 'Top Toplayıcı', m: { DEF: 9, FİZ: 7, PAS: -2, HIZ: -3 } }, { n: 'Pivot (Derin Kurucu)', m: { PAS: 11, DRP: 5, DEF: -2, FİZ: -2 } }],
  MOS: [{ n: 'Box-to-Box', m: { FİZ: 7, DEF: 5, HIZ: 3 } }, { n: 'Oyun Kurucu', m: { PAS: 11, DRP: 7, DEF: -7, FİZ: -3 } }, { n: 'Mezzala', m: { ŞUT: 7, HIZ: 5, DRP: 5, DEF: -5 } }],
  OOS: [{ n: 'Numara 10', m: { PAS: 9, DRP: 9, ŞUT: 4, DEF: -10, FİZ: -3 } }, { n: 'Gölge Forvet', m: { ŞUT: 9, HIZ: 5, DRP: 4, DEF: -8 } }],
  SĞK: [{ n: 'Hız Kanadı', m: { HIZ: 13, DRP: 7, FİZ: -5, DEF: -4 } }, { n: 'İçe Kat Eden Kanat', m: { ŞUT: 9, DRP: 4, PAS: 3, DEF: -2 } }],
  SLK: [{ n: 'Hız Kanadı', m: { HIZ: 13, DRP: 7, FİZ: -5, DEF: -4 } }, { n: 'İçe Kat Eden Kanat', m: { ŞUT: 9, DRP: 4, PAS: 3, DEF: -2 } }],
  SĞA: [{ n: 'Klasik Açık', m: { HIZ: 9, PAS: 6, DRP: 5, DEF: -4 } }],
  SLA: [{ n: 'Klasik Açık', m: { HIZ: 9, PAS: 6, DRP: 5, DEF: -4 } }],
  SF:  [{ n: 'Hedef Adam (Pivot)', m: { FİZ: 13, ŞUT: 6, HIZ: -12, DRP: -7, PAS: -3 } }, { n: 'Hızlı Forvet', m: { HIZ: 13, DRP: 7, FİZ: -6, ŞUT: 2 } }, { n: 'Bitirici', m: { ŞUT: 13, HIZ: 2, DRP: -2, PAS: -4 } }, { n: 'Yalancı 9', m: { PAS: 9, DRP: 9, FİZ: -7, ŞUT: -2 } }],
};

function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function makePlayer(primary, opts = {}) {
  const cluster = POS_CLUSTERS.find(c => c.primary === primary) || { primary, extras: [] };
  // esneklik: çoğu oyuncu tek mevki (62%), az kısmı esnek (30%), çok azı çok yönlü (8%)
  let flex;
  if (opts.flex) flex = opts.flex;
  else { const r = Math.random(); flex = r < 0.62 ? 1 : r < 0.92 ? 2 : 3; }
  flex = Math.min(flex, 1 + cluster.extras.length);
  const positions = [primary];
  const epool = shuffle(cluster.extras);
  for (let i = 0; i < flex - 1; i++) positions.push(epool[i]);

  const age = opts.age != null ? opts.age : randi(17, 34);
  const youth = Math.max(0, (24 - age));
  const ovr = opts.ovr != null ? opts.ovr : Math.round(rand(66, 88) + (age >= 26 && age <= 30 ? 2 : 0));
  let pot = opts.pot != null ? opts.pot : Math.min(99, Math.round(ovr + youth * 1.6 + rand(0, 6)));
  pot = Math.max(pot, ovr);

  // arketip seç → tip + stat modifikasyonu (oyuncuları belirgin farklılaştırır)
  const archList = ARCHETYPES[primary] || [{ n: '', m: {} }];
  const arch = opts.arch ? (archList.find(a => a.n === opts.arch) || pick(archList)) : pick(archList);
  const stats = statProfile(primary, ovr);
  Object.entries(arch.m).forEach(([k, v]) => { stats[k] = Math.max(18, Math.min(99, stats[k] + v)); });

  return {
    id: _uid++,
    name: opts.name || (pick(FIRST_INITIALS) + '. ' + pick(SURNAMES)),
    positions, pos: primary, type: arch.n, age, ovr, pot, stats, fatigue: 0,
    role: ROLES[primary] ? ROLES[primary][0] : '', task: defaultTask(primary),
  };
}
function shortOf(p) { return shortName(p.name); }

/* Draft havuzu: iki takıma 16'şar + adaylar için yeterli oyuncu. */
function buildDraftPool() {
  const pool = [];
  // dengeli dağıtım: her mevkiden birkaç oyuncu
  const counts = { KL: 6, STP: 9, SĞB: 5, SLB: 5, DOS: 6, MOS: 8, OOS: 5, SĞK: 6, SLK: 6, SF: 9 };
  Object.entries(counts).forEach(([pos, n]) => {
    for (let i = 0; i < n; i++) pool.push(makePlayer(pos));
  });
  // birkaç "yıldız" ve birkaç "genç cevher"
  for (let i = 0; i < 5; i++) {
    const p = makePlayer(pick(['SF', 'MOS', 'OOS', 'STP', 'SĞK']), { age: randi(24, 29), ovr: randi(85, 90) });
    p.pot = Math.max(p.pot, p.ovr + 2); pool.push(p);
  }
  for (let i = 0; i < 9; i++) {
    const p = makePlayer(pick(ALL_POS_PRIMARY()), { age: randi(17, 20), ovr: randi(66, 74) });
    p.pot = Math.min(99, p.ovr + randi(16, 27)); pool.push(p);
  }
  // genç oyuncuların potansiyeli genelde yüksek olsun — seçmenin bir anlamı olsun
  pool.forEach(p => { if (p.age <= 21) p.pot = Math.min(99, Math.max(p.pot, p.ovr + randi(10, 24))); });
  return shuffle(pool);
}
function ALL_POS_PRIMARY() { return POS_CLUSTERS.map(c => c.primary); }

window.KD_DATA = {
  POS, ALL_POS, POS_GEO, posDistance, posAffinity, fitLevel, FIT_MULT, FIT_META, ARCHETYPES,
  FORMATIONS, FORMATION_NAMES, PHILOSOPHIES, MENTALITIES, FOCUS_KEYS,
  ROLES, TASKS, TASK_COL, defaultTask, CLUB_COLORS, STAT_KEYS, GK_STAT_KEYS, statKeysFor,
  shortName, shortOf, makePlayer, buildDraftPool, rand, randi, pick, shuffle,
};
