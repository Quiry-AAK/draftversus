/* Davranış probu: hücum sırasında kaç oyuncu ileri çıkıyor, genişlik kullanılıyor mu, kutuya doluş. */
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..'); const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'outside-only' });
const { window } = dom;
const ctxProxy = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : () => {} });
window.HTMLCanvasElement.prototype.getContext = () => ctxProxy;
window.requestAnimationFrame = () => 0; window.setInterval = () => 0; window.clearInterval = () => {};
window.eval(read('js/data.js')); window.eval(read('js/engine.js'));
const D = window.KD_DATA, E = window.KD_ENGINE;
function makeClub(name, color, phil, ment) {
  const c = { name, color, side: 'a', squad: [], lineup: [], bench: [], formation: '4-3-3',
    philosophy: phil, mentality: ment, focus: { Pres: 2, Tempo: 2, Genişlik: 2, 'Defans Hattı': 1, Yaratıcılık: 1, Fizik: 1 } };
  c.lineup = D.FORMATIONS[c.formation].map(s => D.makePlayer(s[0], { ovr: D.randi(74, 84) }));
  c.bench = [0,1,2,3,4].map(() => D.makePlayer('MOS')); c.squad = [...c.lineup, ...c.bench];
  return c;
}
function probe(phil, ment) {
  const A = makeClub('A', '#3b6fe0', phil, ment), B = makeClub('B', '#e8893b', 'Dengeli'.length ? 'Defansif Blok' : 'Dengeli', 'Temkinli');
  const m = new E.LiveMatch(window.document.createElement('canvas'), A, B, { speed: 4 });
  let samples = 0, committed = 0, widthSum = 0, boxOnCorner = 0, cornerSamples = 0, inWideAtt = 0;
  let frames = 0, lastInbox = 0, wasCorner = false, crossCrowds = [];
  while (!m.ended && frames < 40000) {
    m.step(); frames++;
    if (m.phase === 'paused') m.resumeSecondHalf();
    // korner ortası anındaki kutu kalabalığını yakala
    const isCorner = m.ballMode === 'restart' && m.restart && m.restart.cross;
    if (isCorner) { const team = m.restart.team; let n = 0; for (let i = 0; i < 22; i++) { const p = m.players[i]; if (p && p.ref && p.team === team && !p.isGK && m.inPenaltyBox(p, 1 - team)) n++; } lastInbox = n; wasCorner = true; }
    else if (wasCorner) { crossCrowds.push(lastInbox); wasCorner = false; }
    const poss = m.poss; const dir = poss === 0 ? 1 : -1;
    const ballAdv = poss === 0 ? m.ball.x > m.W * 0.6 : m.ball.x < m.W * 0.4;
    if (m.ballMode === 'held' && ballAdv) {
      // hücum eden takımın orta saha çizgisini geçen oyuncu sayısı + genişlik
      let fwdN = 0; const ys = [];
      for (let i = 0; i < 22; i++) { const p = m.players[i]; if (!p || !p.ref || p.team !== poss || p.isGK) continue;
        const past = poss === 0 ? p.x > m.W * 0.5 : p.x < m.W * 0.5; if (past) fwdN++;
        ys.push(p.y);
        if (Math.abs(p.y - m.H / 2) > m.H * 0.30 && (poss === 0 ? p.x > m.W * 0.55 : p.x < m.W * 0.45)) inWideAtt++;
      }
      const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
      const sd = Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length);
      committed += fwdN; widthSum += sd; samples++;
    }
    if (m.ballMode === 'restart' && m.restart && m.restart.cross) {
      const team = m.restart.team; let n = 0;
      for (let i = 0; i < 22; i++) { const p = m.players[i]; if (p && p.ref && p.team === team && !p.isGK && m.inPenaltyBox(p, 1 - team)) n++; }
      boxOnCorner += n; cornerSamples++;
    }
  }
  const crossAvg = crossCrowds.length ? (crossCrowds.reduce((s, v) => s + v, 0) / crossCrowds.length).toFixed(1) : '-';
  console.log(`${phil}/${ment}: ileri çıkan ort = ${(committed/samples).toFixed(1)}/10 · genişlik = ${(widthSum/samples).toFixed(0)}px · korner ortası anında kutuda = ${crossAvg} (${crossCrowds.length} korner)`);
}
probe('Yüksek Pres', 'Çok Cesur');
probe('Topa Sahip Olma', 'Cesur');
probe('Defansif Blok', 'Çok Temkinli');
