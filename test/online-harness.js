/* Online uçtan uca testi — iki jsdom penceresi (host + guest), sahte relay ile bağlı.
   Tüm seriyi (draft → düello → taktik → host-otoriter maç → sonuç) sürer, JS hatası arar. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/* ---- sahte sunucu/relay ---- */
const server = {
  host: null, guest: null, config: null,
  create(net, config) { net.side = 'a'; net.code = 'TEST'; this.host = net; this.config = config; net.emit({ t: 'created', code: 'TEST', side: 'a' }); },
  join(net, code, profile) {
    net.side = 'b'; net.code = 'TEST'; this.guest = net; net.peer = this.host; this.host.peer = this.guest;
    net.emit({ t: 'joined', code: 'TEST', side: 'b', config: this.config, peer: (this.config && this.config.profile) || null });
    this.host.emit({ t: 'peer-joined', profile });
  },
};
function makeNet() {
  return {
    side: null, code: null, peer: null, _h: [],
    available() { return true; },
    on(fn) { this._h.push(fn); },
    emit(m) { this._h.slice().forEach(h => h(m)); },
    connect(ok) { ok && ok(); },
    create(config) { server.create(this, config); },
    join(code, profile) { server.join(this, code, profile); },
    send(d) { if (this.peer) this.peer.emit(Object.assign({ _relay: true }, JSON.parse(JSON.stringify(d)))); },
    leave() {},
    isHost() { return this.side === 'a'; },
  };
}

/* ---- pencere kur ---- */
function makeWindow(label, net) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom; const { document } = window;
  const W = { window, document, label, rafQ: [], intervals: [], errors: [] };
  window.requestAnimationFrame = (cb) => { W.rafQ.push(cb); return W.rafQ.length; };
  window.cancelAnimationFrame = () => {};
  window.setInterval = (cb) => { W.intervals.push(cb); return W.intervals.length; };
  window.clearInterval = (id) => { if (id) W.intervals[id - 1] = () => {}; };
  window.setTimeout = (cb) => { try { cb(); } catch (e) { W.errors.push('setTimeout: ' + e.message); } return 0; };
  window.clearTimeout = () => {};
  window.scrollTo = () => {};
  const ctxProxy = new Proxy({}, { get: (t, k) => { if (k === 'measureText') return () => ({ width: 10 }); if (k === 'canvas') return { width: 1180, height: 560 }; return () => {}; } });
  window.HTMLCanvasElement.prototype.getContext = () => ctxProxy;
  window.addEventListener('error', e => W.errors.push(e.message || String(e.error)));
  window.KD_NET = net;   // game.js bunu yakalar
  const run = (code, name) => { try { window.eval(code); } catch (e) { console.error('LOAD ERROR ' + label + '/' + name + ':', e); process.exit(1); } };
  run(read('js/data.js'), 'data'); run(read('js/engine.js'), 'engine'); run(read('js/game.js'), 'game');
  W.$ = sel => document.querySelector(sel);
  W.$$ = sel => [...document.querySelectorAll(sel)];
  return W;
}

const ev = () => ({ preventDefault() {}, stopPropagation() {}, dataTransfer: { getData() { return ''; }, setData() {} } });
const clickEl = el => { if (el && typeof el.onclick === 'function') { el.onclick(ev()); return true; } return false; };
const click = (W, sel) => clickEl(W.$(sel));
const stepOf = W => { const a = W.$('.step.active'); return a ? a.textContent : '?'; };

const netA = makeNet(), netB = makeNet();
const host = makeWindow('HOST', netA);
const guest = makeWindow('GUEST', netB);

function setInput(W, sel, val) { const el = W.$(sel); if (el) { el.value = val; if (typeof el.oninput === 'function') el.oninput(); } }

/* ---- 0/0b: mod seçimi + oda kur/katıl ---- */
click(host, '#mode-online-btn');            // host → online ekranı
click(host, '#o-create');                    // oda kur (varsayılan ad/renk/format)
click(guest, '#mode-online-btn');            // guest → online ekranı
click(guest, '[data-otab="join"]');          // katıl sekmesi
setInput(guest, '#o-code', 'TEST');
click(guest, '#o-join');                      // odaya katıl
click(host, '#host-start');                   // host drafti başlatır

function err(W, e) { W.errors.push(e.message || String(e)); }

/* ---- draft: sırayla iki pencerede de ilk adayı tıkla (bekleyen pencere no-op) ---- */
function driveDraft() {
  let g = 0;
  while ((stepOf(host) === 'Draft' || stepOf(guest) === 'Draft') && g++ < 80) {
    [host, guest].forEach(W => { if (stepOf(W) === 'Draft') { const p = W.$('[data-pick]'); if (p) clickEl(p); } });
  }
}
/* ---- düello: çal + koru + kilitle; sonra sonucu geç ---- */
function driveDuello() {
  let g = 0;
  while ((stepOf(host) === 'Düello' || stepOf(guest) === 'Düello') && g++ < 25) {
    [host, guest].forEach(W => {
      if (stepOf(W) !== 'Düello') return;
      if (W.$('#to-tactics')) { click(W, '#to-tactics'); return; }
      const s = W.$$('[data-steal]')[0]; if (s) clickEl(s);
      const m = W.$$('[data-mine]')[0]; if (m) clickEl(m);
      const lock = W.$('#lock-duello'); if (lock && !lock.disabled) clickEl(lock);
    });
  }
}
/* ---- taktik: ikisi de hazır ---- */
function driveTactics() {
  let g = 0;
  while ((stepOf(host) === 'Taktik' || stepOf(guest) === 'Taktik') && g++ < 8) {
    [host, guest].forEach(W => { if (stepOf(W) === 'Taktik') { const r = W.$('#ready-match'); if (r && !r.disabled) clickEl(r); } });
  }
}
/* ---- maç: host motoru sürer + kareleri guest'e yayınlar ---- */
function driveMatch() {
  let n = 0; let hts = 0;
  while (stepOf(host) === 'Maç' && host.rafQ.length && n < 600000) {
    const cb = host.rafQ.shift(); n++;
    try { cb(16); } catch (e) { err(host, e); }
    if (n % 50 === 0) host.intervals.forEach(c => { try { c(); } catch (e) { err(host, e); } });
    const ha = host.$('#panel-apply'); const ga = guest.$('#panel-apply');
    if (ha && /Başlat|Devam Et|Uzatma|Yarı/.test(ha.textContent)) { clickEl(ha); hts++; }
    if (ga && /Başlat|Devam Et|Uzatma|Yarı/.test(ga.textContent)) clickEl(ga);
  }
  console.log('  maç frame:', n, '| devre arası geçiş:', hts);
  return n;
}

let big = 0, matches = 0;
while (big++ < 12) {
  driveDraft();
  driveDuello();
  driveTactics();
  if (stepOf(host) !== 'Maç') { console.error('HATA: maç başlamadı. host=' + stepOf(host) + ' guest=' + stepOf(guest)); break; }
  driveMatch(); matches++;
  if (stepOf(host) === 'Maç') { console.error('HATA: maç bitmedi (host hâlâ Maç ekranında)'); break; }
  const hs = stepOf(host), gs = stepOf(guest);
  if (hs === 'Sonuç' || gs === 'Sonuç') { break; }
  if (hs === 'Maç Arası') { click(host, '#to-duello'); click(guest, '#to-duello'); }
  else { console.error('HATA: beklenmeyen ekran host=' + hs + ' guest=' + gs); break; }
}

/* ---- tutarlılık: iki pencere aynı skorları (ayna perspektif) görüyor mu? ---- */
function matchScores(W) { return [...W.document.querySelectorAll('span')].filter(s => s.style && s.style.fontSize === '20px').map(s => s.textContent.trim()); }
let desync = false;
if (stepOf(host) === 'Sonuç' && stepOf(guest) === 'Sonuç') {
  const hsc = matchScores(host), gsc = matchScores(guest);
  if (hsc.length !== gsc.length || hsc.length === 0) desync = true;
  for (let i = 0; i < hsc.length; i += 2) { if (hsc[i] !== gsc[i + 1] || hsc[i + 1] !== gsc[i]) desync = true; }
  console.log('Skorlar — host:', hsc.join(' '), '| guest:', gsc.join(' '), '|', desync ? 'DESYNC ❌' : 'tutarlı ✓');
}

const allErr = host.errors.concat(guest.errors);
console.log('Oynanan maç:', matches);
console.log('Son ekran — host:', stepOf(host), '| guest:', stepOf(guest));
console.log('host hataları:', host.errors.length, '| guest hataları:', guest.errors.length);
if (allErr.length) { console.log('İLK HATALAR:'); allErr.slice(0, 8).forEach(e => console.log('  -', e)); }
if (!allErr.length && !desync && stepOf(host) === 'Sonuç' && stepOf(guest) === 'Sonuç') console.log('✅ Online uçtan uca akış çalışıyor.');
else { console.log('❌ Online akışta sorun var.'); process.exit(1); }
