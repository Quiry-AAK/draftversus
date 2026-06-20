/* Motor dengesi: çok sayıda maç simüle et, skor/şut/gol mesafesi istatistiği çıkar. */
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'outside-only' });
const { window } = dom;
const ctxProxy = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : () => {} });
window.HTMLCanvasElement.prototype.getContext = () => ctxProxy;
window.requestAnimationFrame = () => 0; window.setInterval = () => 0; window.clearInterval = () => {};
window.eval(read('js/data.js')); window.eval(read('js/engine.js'));
const D = window.KD_DATA, E = window.KD_ENGINE;

function makeClub(name, color) {
  const c = { name, color, side: 'a', squad: [], lineup: [], bench: [], formation: '4-3-3',
    philosophy: 'Yüksek Pres', mentality: 'Dengeli', focus: { Pres: 2, Tempo: 2, Genişlik: 1, 'Defans Hattı': 2, Yaratıcılık: 1, Fizik: 1 } };
  const slots = D.FORMATIONS[c.formation];
  c.lineup = slots.map(s => D.makePlayer(s[0] === 'KL' ? 'KL' : s[0], { ovr: D.randi(72, 84) }));
  c.bench = [0,1,2,3,4].map(() => D.makePlayer('MOS'));
  c.squad = [...c.lineup, ...c.bench];
  return c;
}

const canvas = window.document.createElement('canvas');
let totA = 0, totB = 0, games = 0, maxGoal = 0, htCount = 0, penCount = 0, clocks = [], totShots = 0, totSot = 0, totCorners = 0;
const tally = { pen: 0, off: 0, throwin: 0 };
const N = 200;
for (let g = 0; g < N; g++) {
  const A = makeClub('A', '#3b6fe0'), B = makeClub('B', '#e8893b');
  const m = new E.LiveMatch(canvas, A, B, { speed: 4, onCommentary: (txt) => {
    if (/PENALTI/.test(txt)) tally.pen++; if (/Ofsayt/.test(txt)) tally.off++; if (/Taç/.test(txt)) tally.throwin++;
  } });
  let frames = 0; let sawHalf = false;
  while (!m.ended && frames < 60000) {
    m.step(); frames++;
    if (m.phase === 'paused') { sawHalf = true; m.resumeSecondHalf(); }
  }
  if (sawHalf) htCount++;
  totA += m.a; totB += m.b; games++; maxGoal = Math.max(maxGoal, m.a + m.b);
  totShots += m.stats.shotsA + m.stats.shotsB; totSot += m.stats.sotA + m.stats.sotB; totCorners += (m.stats.cornersA||0)+(m.stats.cornersB||0);
  clocks.push(Math.round(m.clock));
}
console.log('Maç sayısı:', games);
console.log('Ortalama skor: A', (totA/games).toFixed(2), '— B', (totB/games).toFixed(2), '| toplam gol/maç', ((totA+totB)/games).toFixed(2));
console.log('Maks toplam gol:', maxGoal);
console.log('Ortalama şut/maç:', (totShots/games).toFixed(1), '| isabetli:', (totSot/games).toFixed(1), '| korner:', (totCorners/games).toFixed(1));
console.log('Set piece toplamları —', games, 'maçta: penaltı', tally.pen, '· ofsayt', tally.off, '· taç', tally.throwin);
console.log('Devre arası (paused) yakalanan maç:', htCount, '/', games);
console.log('Bitiş saati örnekleri:', clocks.slice(0, 8).join(', '));

// GK stat seti doğrulama
const gk = D.makePlayer('KL', { ovr: 80 });
console.log('Kaleci statları:', Object.keys(gk.stats).join(','), '| keys fonk:', D.statKeysFor(gk).join(','));
const out = D.makePlayer('SF', { ovr: 80 });
console.log('Forvet statları:', Object.keys(out.stats).join(','));
