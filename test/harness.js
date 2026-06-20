/* Uçtan uca tıklama testi — tüm seriyi sürer, JS hatası var mı bakar. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// ---- stub'lar ----
let rafQ = [];
window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
window.cancelAnimationFrame = () => {};
let intervals = [];
window.setInterval = (cb) => { intervals.push(cb); return intervals.length; };
window.clearInterval = () => {};
window.setTimeout = (cb) => { try { cb(); } catch (e) { console.error('setTimeout cb error:', e.message); } return 0; };
window.clearTimeout = () => {};
window.scrollTo = () => {};

// canvas 2d context no-op
const ctxProxy = new Proxy({}, { get: (t, k) => {
  if (k === 'measureText') return () => ({ width: 10 });
  if (k === 'canvas') return { width: 1180, height: 560 };
  return () => {};
}});
window.HTMLCanvasElement.prototype.getContext = () => ctxProxy;

let errors = [];
window.addEventListener('error', e => errors.push(e.message || String(e.error)));

// ---- kodları yükle ----
function run(code, name) { try { window.eval(code); } catch (e) { console.error('LOAD ERROR ' + name + ':', e); process.exit(1); } }
run(read('js/data.js'), 'data');
run(read('js/engine.js'), 'engine');
run(read('js/net.js'), 'net');
run(read('js/game.js'), 'game');

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const click = el => { if (!el) return false; if (typeof el.onclick === 'function') el.onclick({ preventDefault(){}, dataTransfer:{getData(){return '';},setData(){}} }); return true; };

function drainRaf(maxFrames, onFrame) {
  let n = 0;
  while (rafQ.length && n < maxFrames) {
    const cb = rafQ.shift(); n++;
    try { cb(); } catch (e) { errors.push('rAF: ' + e.message); throw e; }
    if (onFrame && n % 400 === 0) onFrame();
  }
  return n;
}

function screenStep() {
  // appbar'daki aktif adımı oku
  const a = $('.step.active'); return a ? a.textContent : '?';
}

// ---- 0. ANA EKRAN (mod seçimi) ----
if (!$('#mode-ai-btn')) throw new Error('ana ekran render edilmedi');
click($('#mode-ai-btn'));

// ---- 1. LOBİ ----
if (!$('#create-room')) throw new Error('lobby render edilmedi');
click($('#create-room'));

let guard = 0;
function playSeries() {
  while (guard++ < 40) {
    const step = screenStep();
    if (step === 'Draft') { doDraft(); }
    else if (step === 'Düello') { doDuello(); }
    else if (step === 'Taktik') { doTactics(); }
    else if (step === 'Maç') { doMatch(); }
    else if (step === 'Maç Arası') { click($('#to-duello')); }
    else if (step === 'Sonuç') { return 'SONUÇ'; }
    else throw new Error('bilinmeyen ekran: ' + step);
  }
  throw new Error('seri bitmedi (guard)');
}

function doDraft() {
  let i = 0;
  while ($('[data-pick]') && i++ < 60) {
    click($('[data-pick]'));   // hep ilk adayı seç (açan da, kalan-5'ten alan da)
  }
  if (screenStep() === 'Draft') throw new Error('draft bitmedi, ' + i + ' seçim');
}

function doDuello() {
  if ($('#to-tactics')) { click($('#to-tactics')); return; }   // reveal ekranı
  click($('[data-steal]'));                       // çalma hedefi
  // koru
  if ($('[data-rmode="protect"]')) click($('[data-rmode="protect"]'));
  const mine1 = $$('[data-mine]'); click(mine1[0]);
  // takasa ver (farklı oyuncu)
  if ($('[data-rmode="give"]')) click($('[data-rmode="give"]'));
  const mine2 = $$('[data-mine]'); click(mine2[1] || mine2[0]);
  const lock = $('#lock-duello');
  if (lock && lock.disabled) throw new Error('lock disabled — seçimler eksik');
  click(lock);
  // reveal
  if ($('#to-tactics')) click($('#to-tactics'));
  else throw new Error('düello reveal yok');
}

function doTactics() {
  const r = $('#ready-match');
  if (!r) throw new Error('ready-match yok');
  click(r);
}

let halftimes = 0, aiSubsTried = 0;
function doMatch() {
  // loop başladı, rAF kuyruğunda bir frame var
  let safety = 0;
  while (screenStep() === 'Maç' && safety++ < 200) {
    drainRaf(3000, () => { intervals.forEach(cb => { try { cb(); } catch(e){ errors.push('interval: '+e.message); } }); aiSubsTried++; });
    // devre arası / uzatma paneli açıldıysa devam et (auto açılan tek panel bu)
    const apply = $('#panel-apply');
    if (apply && /Başlat|Devam Et/.test(apply.textContent)) { halftimes++; click(apply); }
    else if (!rafQ.length) {
      // kuyruk boş ve hâlâ maçtaysak: olası takılma — interval ile ilerlet
      intervals.forEach(cb => { try { cb(); } catch(e){} });
      if (!rafQ.length) break;
    }
  }
  if (screenStep() === 'Maç') throw new Error('maç bitmedi (safety), halftimes=' + halftimes);
}

const result = playSeries();
console.log('Seri tamamlandı:', result);
console.log('Devre araları yaşandı:', halftimes);
console.log('JS hataları:', errors.length);
if (errors.length) { errors.slice(0, 10).forEach(e => console.log('  - ' + e)); process.exit(1); }
console.log('✅ Hata yok — uçtan uca akış çalışıyor.');
