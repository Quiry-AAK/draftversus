/* ============================================================
   DraftVersus — Oyun Akışı / Ekranlar
   Lobi → Draft → Düello → Taktik → Maç → Maç Arası → Sonuç
   ============================================================ */
(function () {
  const D = window.KD_DATA, E = window.KD_ENGINE;
  const { POS, FORMATIONS, FORMATION_NAMES, PHILOSOPHIES, MENTALITIES, FOCUS_KEYS,
          ROLES, TASKS, TASK_COL, defaultTask, CLUB_COLORS, STAT_KEYS, statKeysFor, fitLevel, FIT_MULT, FIT_META,
          shortOf, buildDraftPool, AI_DUMMY, pick, randi } = D;
  const { teamStrength, effOvr, LiveMatch, developSquad, AI } = E;
  const NET = window.KD_NET;

  /* ---------- online yardımcıları ---------- */
  function isOnline() { return G && G.mode === 'online'; }
  function amHost() { return NET && NET.isHost(); }
  function netSend(d) { if (NET) NET.send(d); }
  /* Bir kulübü ağ üzerinden taşımak için sadeleştir (oyuncu nesneleri düz veri). */
  function serializeClub(club) {
    const idsOf = arr => arr.map(p => p ? p.id : null);
    return { name: club.name, color: club.color, side: club.side,
      formation: club.formation, philosophy: club.philosophy, mentality: club.mentality,
      focus: Object.assign({}, club.focus),
      squad: club.squad.map(p => Object.assign({}, p)),
      lineupIds: idsOf(club.lineup), benchIds: idsOf(club.bench) };
  }
  /* Ağdan gelen kulübü, oyuncu nesnelerini paylaşacak şekilde yeniden kur. */
  function deserializeClub(s) {
    const byId = {}; s.squad.forEach(p => byId[p.id] = p);
    const club = { name: s.name, color: s.color, side: s.side,
      formation: s.formation, philosophy: s.philosophy, mentality: s.mentality,
      focus: Object.assign({}, s.focus), squad: s.squad,
      lineup: s.lineupIds.map(id => id == null ? null : byId[id] || null),
      bench: s.benchIds.map(id => id == null ? null : byId[id] || null) };
    return club;
  }

  const FOCUS_BUDGET = 9;
  function focusUsed(club) { return FOCUS_KEYS.reduce((s, k) => s + (club.focus[k] || 0), 0); }
  function setFocus(club, k, v) {
    const cur = club.focus[k] || 0;
    if (v === cur) v = cur - 1;                      // aynı kademeye basınca bir azalt (0'a kadar inebilir)
    v = Math.max(0, Math.min(3, v));
    if (v > cur && focusUsed(club) + (v - cur) > FOCUS_BUDGET) { toast('Kalan odak puanı yok — başka bir alanı düşür'); return false; }
    club.focus[k] = v; return true;
  }
  const T = (s) => window.KD_I18N ? KD_I18N.T(s) : s;   // dil çevirisi (TR varsayılan)
  const STEPS = ['Lobi', 'Draft', 'Düello', 'Taktik', 'Maç', 'Maç Arası', 'Sonuç'];
  const SCREEN_STEP = { lobby: 0, draft: 1, duello: 2, tactics: 3, match: 4, between: 5, result: 6 };

  let G = null;
  const app = () => document.getElementById('app');

  /* ---------- yardımcılar ---------- */
  function newClub(name, color, side) {
    return { name, color, side, squad: [], lineup: Array(11).fill(null), bench: Array(5).fill(null),
      formation: '4-3-3', philosophy: 'Yüksek Pres', mentality: 'Dengeli',
      focus: { Pres: 0, Tempo: 0, Genişlik: 0, 'Defans Hattı': 0, Yaratıcılık: 0, Fizik: 0 } };
  }
  function benchList(club) { return club.bench.filter(Boolean); }
  function isInjured(p) { return !!(p && p.injuredMatches > 0); }   // sakatlık nedeniyle bu maçı kaçırması gereken oyuncu
  function teamOvr(club) { return teamStrength(club).teamOvr; }
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }
  function fitClass(p, pos) { return fitLevel(p, pos); }
  const PITCH_LINES = '<div class="stripes"></div><div class="halfway"></div><div class="circle"></div><div class="boxT"></div><div class="boxB"></div>';

  /* Bir oyuncunun bir mevkideki yatkınlığı: best/ok/poor/none (görsel mini-saha için) */
  const posAffinity = (player, pos) => D.posAffinity(player, pos);
  const AFF_COL = { best: '#19c37d', ok: '#d9a017', poor: '#e5484d', none: '' };
  const MINI_SPOTS = [['KL', 50, 90], ['SĞB', 84, 70], ['STP', 63, 74], ['STP', 37, 74], ['SLB', 16, 70],
    ['DOS', 30, 53], ['MOS', 52, 56], ['MOS', 72, 53], ['SĞK', 82, 26], ['SF', 50, 18], ['SLK', 20, 26]];
  function miniPitchSVG(player) {
    const dots = MINI_SPOTS.map(([pos, x, y]) => {
      const aff = posAffinity(player, pos), col = AFF_COL[aff];
      if (aff === 'none') return `<circle cx="${x}" cy="${y}" r="4.4" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.1"/>`;
      return `<circle cx="${x}" cy="${y}" r="5.2" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
    }).join('');
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" class="minipitch-svg">
      <rect x="1.5" y="1.5" width="97" height="97" rx="7" fill="#2f8d57"/>
      <line x1="1.5" y1="50" x2="98.5" y2="50" stroke="rgba(255,255,255,.28)" stroke-width="1"/>
      <circle cx="50" cy="50" r="13" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1"/>
      ${dots}</svg>`;
  }
  function radarSVG(stats, keys) {
    keys = keys || STAT_KEYS; const n = 6, cx = 46, cy = 46, R = 33;
    const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    const grid = [0.34, 0.67, 1].map(g => `<polygon points="${keys.map((k, i) => pt(i, R * g).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#e6e8ec" stroke-width="1"/>`).join('');
    const poly = keys.map((k, i) => pt(i, R * Math.max(15, Math.min(99, stats[k])) / 99).map(v => v.toFixed(1)).join(',')).join(' ');
    const labels = keys.map((k, i) => { const [lx, ly] = pt(i, R + 8); return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="6.5" fill="#9aa1ac" text-anchor="middle" dominant-baseline="middle" font-family="Geist Mono">${k}</text>`; }).join('');
    return `<svg viewBox="0 0 92 92" class="radar-svg">${grid}<polygon points="${poly}" fill="rgba(25,195,125,.22)" stroke="#19c37d" stroke-width="1.6"/>${labels}</svg>`;
  }

  /* ---------- render kabuğu ---------- */
  /* ---- morphdom-lite: yeni HTML'i mevcut DOM'a yama (flicker yok) ---- */
  function morphAttrs(a, b) {
    const bA = b.attributes;
    for (let i = 0; i < bA.length; i++) { const at = bA[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    const aA = a.attributes;
    for (let i = aA.length - 1; i >= 0; i--) { const nm = aA[i].name; if (!b.hasAttribute(nm)) a.removeAttribute(nm); }
  }
  function morphChildren(a, b) {
    let an = a.firstChild, bn = b.firstChild;
    while (bn) {
      const nextB = bn.nextSibling;
      if (!an) { a.appendChild(bn); bn = nextB; continue; }
      const nextA = an.nextSibling;
      if (an.nodeType !== bn.nodeType || (an.nodeType === 1 && an.tagName !== bn.tagName)) {
        a.replaceChild(bn, an); bn = nextB; an = nextA; continue;
      }
      if (an.nodeType === 3 || an.nodeType === 8) { if (an.nodeValue !== bn.nodeValue) an.nodeValue = bn.nodeValue; }
      else if (an.nodeType === 1) {
        morphAttrs(an, bn);
        if (an.tagName !== 'CANVAS' && an.tagName !== 'svg' && an.tagName !== 'SVG') morphChildren(an, bn);
        else an.innerHTML = bn.innerHTML;
      }
      an = nextA; bn = nextB;
    }
    while (an) { const n = an.nextSibling; a.removeChild(an); an = n; }
  }
  function morph(target, html) {
    const tmp = document.createElement(target.tagName);
    tmp.innerHTML = html;
    morphChildren(target, tmp);
  }
  function render() {
    const root = document.getElementById('screen-root');
    if (!root || G._renderedScreen !== G.screen) {
      app().innerHTML = appbar() + '<div id="screen-root">' + screenHTML() + '</div>';
      G._renderedScreen = G.screen;
    } else {
      morph(root, screenHTML());
    }
    bindScreen();
    if (window.KD_ANALYTICS) KD_ANALYTICS.screen(G.screen);
    if (window.KD_ADS) KD_ADS.onScreen(G.screen);
  }
  function appbar() {
    const langBtn = `<button class="btn btn-ghost" id="lang-btn" style="padding:7px 11px;font-size:12px;font-weight:800">${(window.KD_I18N ? KD_I18N.lang() : 'tr').toUpperCase()}</button>`;
    if (G.screen === 'home' || G.screen === 'online') {
      const tag = G.screen === 'online' ? `<span class="step active">${T('Online')}</span>` : '';
      return `<div class="appbar">
        <div class="brand"><div class="brand-logo"><div></div></div><div class="brand-name">DRAFT<span>VERSUS</span></div></div>
        <div class="steps">${tag}</div>
        <div class="appbar-right">${langBtn}${G.screen === 'online' ? `<button class="btn btn-ghost" id="online-back" style="padding:7px 14px;font-size:12px">${T('← Geri')}</button>` : ''}</div>
      </div>`;
    }
    const cur = SCREEN_STEP[G.screen];
    const steps = STEPS.map((s, i) => {
      if (i === cur) return `<span class="step active">${T(s)}</span>`;
      const cls = i < cur ? 'step done' : 'step';
      return `<span class="${cls}">${i < cur ? '<span class="dot"></span>' : ''}${T(s)}</span>`;
    }).join('<span class="step-sep">·</span>');
    const me = G.me;
    const right = me ? `<div class="club-chip"><span class="sw" style="background:${me.color}"></span>${me.name}</div>
      ${me.squad.length ? `<span class="mono" style="color:var(--green-d);font-weight:800;font-size:14px">${teamOvr(me)}</span>` : ''}` : '';
    return `<div class="appbar">
      <div class="brand"><div class="brand-logo"><div></div></div><div class="brand-name">DRAFT<span>VERSUS</span></div></div>
      <div class="steps">${steps}</div>
      <div class="appbar-right">${right}</div>
    </div>`;
  }
  function screenHTML() {
    switch (G.screen) {
      case 'home': return homeHTML();
      case 'online': return onlineHTML();
      case 'lobby': return lobbyHTML();
      case 'draft': return draftHTML();
      case 'duello': return duelloHTML();
      case 'tactics': return tacticsHTML();
      case 'match': return matchHTML();
      case 'between': return betweenHTML();
      case 'result': return resultHTML();
    }
    return '';
  }
  function bindScreen() {
    ({ home: bindHome, online: bindOnline, lobby: bindLobby, draft: bindDraft, duello: bindDuello, tactics: bindTactics,
       match: bindMatch, between: bindBetween, result: bindResult }[G.screen] || (() => {}))();
  }
  function head(num, title, sub) {
    return `<div class="screen-head"><div class="screen-num">${num}</div>
      <div><div class="screen-title">${title}</div><div class="screen-sub">${sub}</div></div></div>`;
  }
  function colorSwatches(sel, attr) {
    return CLUB_COLORS.map((c, i) => `<div class="sw-opt ${i === sel ? 'sel' : ''}" ${attr}="${i}" style="background:${c}"></div>`).join('');
  }

  /* ============================================================
     0 · ANA EKRAN (mod seçimi)
     ============================================================ */
  function homeHTML() {
    return `<div class="screen">
      ${head('00', T('Nasıl oynamak istersin?'), T('Yapay zekâya karşı tek başına ya da bir arkadaşınla online 1v1 — bir oda kur veya kodla katıl.'))}
      <div class="wrap-frame" style="padding:40px 30px;background:linear-gradient(180deg,#fbfcfd,#fff)">
        <div class="lobby-grid">
          <div class="lobby-card" style="cursor:pointer" id="mode-ai">
            <div class="flexc" style="gap:9px;margin-bottom:4px"><div style="width:30px;height:30px;border-radius:8px;background:#fbf0e6;display:flex;align-items:center;justify-content:center;color:#cf6f24;font-weight:800;font-family:var(--arch)">YZ</div><div style="font-family:var(--arch);font-weight:800;font-size:19px">${T('Yapay Zekâ ile Oyna')}</div></div>
            <div class="muted" style="font-size:13px;margin-bottom:22px;line-height:1.5">${T('Tek kişilik. Rakibin draft, çalma/koruma ve taktik kararlarını yapay zekâ verir. İnternet gerekmez.')}</div>
            <button class="btn btn-dark" id="mode-ai-btn" style="width:100%">${T('Tek Kişilik Başla →')}</button>
          </div>
          <div class="lobby-or"><div class="bar"></div><div style="font:700 11px 'Hanken Grotesk';color:var(--faint);letter-spacing:.08em">VEYA</div><div class="bar"></div></div>
          <div class="lobby-card" style="cursor:pointer" id="mode-online">
            <div class="flexc" style="gap:9px;margin-bottom:4px"><div style="width:30px;height:30px;border-radius:8px;background:#e7f8f0;display:flex;align-items:center;justify-content:center;color:#13a76a;font-weight:800;font-family:var(--arch)">⇆</div><div style="font-family:var(--arch);font-weight:800;font-size:19px">Online (Oda) 1v1</div></div>
            <div class="muted" style="font-size:13px;margin-bottom:22px;line-height:1.5">Bir oda kur (4 haneli kod alırsın) ya da arkadaşının kodunu girip katıl. Canlı maç ikiniz de taktiğinizi bitirip "Hazır" demeden başlamaz.</div>
            <button class="btn btn-green" id="mode-online-btn" style="width:100%">${T('Online Oyna →')}</button>
            ${NET && !NET.available() ? '<div class="muted" style="font-size:11px;margin-top:10px;color:#cf6f24">Not: online için oyunu sunucu üzerinden aç (file:// ile çalışmaz).</div>' : ''}
          </div>
        </div>
      </div>
    </div>`;
  }
  function bindHome() {
    const goAI = () => { G.mode = 'ai'; G.screen = 'lobby'; render(); };
    const goOnline = () => { G.mode = 'online'; enterOnline(); };
    const stop = e => { if (e && e.stopPropagation) e.stopPropagation(); };
    document.getElementById('mode-ai').onclick = goAI;
    document.getElementById('mode-ai-btn').onclick = (e) => { stop(e); goAI(); };
    document.getElementById('mode-online').onclick = goOnline;
    document.getElementById('mode-online-btn').onclick = (e) => { stop(e); goOnline(); };
    bindLangBtn();
  }
  function bindLangBtn() {
    const lb = document.getElementById('lang-btn');
    if (lb) lb.onclick = () => { if (window.KD_I18N) KD_I18N.toggle(); render(); };
  }

  /* ============================================================
     0b · ONLINE — oda kur / katıl / bekleme
     ============================================================ */
  function enterOnline() {
    G.online.status = 'idle'; G.online.msg = ''; G.online.peer = null;
    G.screen = 'online'; render();
  }
  function onlineHTML() {
    const o = G.online;
    const card = (inner) => `<div class="screen">
      ${head('—', 'Online 1v1', 'Oda kur ya da kodla katıl. Aynı odadaki iki oyuncu draft, düello, taktik ve canlı maçı birlikte oynar.')}
      <div class="wrap-frame" style="padding:36px 30px;background:linear-gradient(180deg,#fbfcfd,#fff)">${inner}</div></div>`;

    if (o.status === 'connecting') return card(`<div style="text-align:center;padding:50px 0"><div style="font-family:var(--arch);font-weight:800;font-size:20px;margin-bottom:8px">Bağlanılıyor…</div><div class="muted">Sunucuya bağlanıyor</div></div>`);

    if (o.status === 'error') return card(`<div style="text-align:center;padding:40px 0">
      <div style="font-family:var(--arch);font-weight:800;font-size:20px;color:#e5484d;margin-bottom:8px">Bağlantı sorunu</div>
      <div class="muted" style="margin-bottom:20px">${o.msg || 'Bir hata oluştu'}</div>
      <button class="btn btn-dark" id="online-retry">Tekrar Dene</button></div>`);

    if (o.status === 'hosting') {
      const has = !!o.peer;
      return card(`<div style="max-width:560px;margin:0 auto;text-align:center;padding:14px 0">
        <div style="font-family:var(--arch);font-weight:800;font-size:18px;margin-bottom:6px">Oda kuruldu</div>
        <div class="muted" style="margin-bottom:18px">Bu kodu arkadaşına ver — "Odaya Katıl" kısmına yazıp girsin.</div>
        <div style="display:inline-flex;gap:10px;margin-bottom:22px">${o.code.split('').map(ch => `<div style="width:52px;height:64px;border:2px solid var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:var(--arch);font-weight:900;font-size:34px;background:#fff">${ch}</div>`).join('')}</div>
        <div style="border:1px solid var(--line);border-radius:12px;padding:16px;background:#fbfcfd;margin-bottom:20px">
          <div class="flexc" style="gap:10px;justify-content:center">
            <span style="width:10px;height:10px;border-radius:50%;background:${has ? '#19c37d' : '#d9a017'};${has ? '' : 'animation:livepulse 1.4s ease-in-out infinite'}"></span>
            <span style="font:700 13px 'Hanken Grotesk'">${has ? `Rakip katıldı: ${o.peer.name || 'Oyuncu'}` : 'Rakip bekleniyor…'}</span>
          </div>
        </div>
        <button class="btn btn-green" id="host-start" style="min-width:220px" ${has ? '' : 'disabled'}>${has ? 'Drafte Başla →' : 'Rakip bekleniyor…'}</button>
      </div>`);
    }

    if (o.status === 'joined-wait') {
      return card(`<div style="max-width:520px;margin:0 auto;text-align:center;padding:30px 0">
        <div style="font-family:var(--arch);font-weight:800;font-size:20px;margin-bottom:8px">Odaya katıldın ✓</div>
        <div class="muted" style="margin-bottom:8px">Oda kodu: <b style="color:var(--ink);font-family:var(--mono)">${o.code}</b></div>
        <div style="border:1px solid var(--line);border-radius:12px;padding:20px;background:#fbfcfd;margin-top:14px">
          <div class="flexc" style="gap:10px;justify-content:center"><span style="width:10px;height:10px;border-radius:50%;background:#d9a017;animation:livepulse 1.4s ease-in-out infinite"></span>
          <span style="font:700 13px 'Hanken Grotesk'">Oda kurucusu (${o.oppName || 'rakip'}) başlatınca draft açılacak…</span></div>
        </div>
      </div>`);
    }

    // idle — form (tab: create / join)
    const tab = o.tab || 'create';
    const tabs = `<div class="g2" style="max-width:560px;margin:0 auto 22px">
      <div class="fmt-opt ${tab === 'create' ? 'sel' : ''}" data-otab="create"><div class="big" style="font-size:16px">Oda Kur</div></div>
      <div class="fmt-opt ${tab === 'join' ? 'sel' : ''}" data-otab="join"><div class="big" style="font-size:16px">Odaya Katıl</div></div></div>`;
    let body;
    if (tab === 'create') {
      body = `<div style="max-width:480px;margin:0 auto">
        <div class="label" style="margin-bottom:9px">Seri Formatı</div>
        <div class="g2" style="margin-bottom:18px">
          <div class="fmt-opt ${o.format === 3 ? 'sel' : ''}" data-ofmt="3"><div class="big">Bo3</div><div style="font-size:11.5px;font-weight:600">3 maç · 2 galibiyet</div></div>
          <div class="fmt-opt ${o.format === 5 ? 'sel' : ''}" data-ofmt="5"><div class="big">Bo5</div><div style="font-size:11.5px;font-weight:600">5 maç · 3 galibiyet</div></div>
        </div>
        <div class="label" style="margin-bottom:9px">Kulüp Adı</div>
        <input id="o-name" class="field-input" maxlength="22" value="${o.name}" style="margin-bottom:18px" />
        <div class="label" style="margin-bottom:9px">Kulüp Rengi</div>
        <div class="swatches" id="o-swatches">${colorSwatches(o.color, 'data-ocolor')}</div>
        <button class="btn btn-green" id="o-create" style="width:100%;margin-top:24px">Oda Kur →</button>
      </div>`;
    } else {
      body = `<div style="max-width:480px;margin:0 auto">
        <div class="label" style="margin-bottom:9px">Oda Kodu</div>
        <input id="o-code" class="field-input" maxlength="4" value="${o.code || ''}" placeholder="ÖRN. 7KQP" style="margin-bottom:18px;text-transform:uppercase;letter-spacing:.2em;font-family:var(--mono);font-weight:800" />
        <div class="label" style="margin-bottom:9px">Kulüp Adı</div>
        <input id="o-name" class="field-input" maxlength="22" value="${o.name}" style="margin-bottom:18px" />
        <div class="label" style="margin-bottom:9px">Kulüp Rengi</div>
        <div class="swatches" id="o-swatches">${colorSwatches(o.color, 'data-ocolor')}</div>
        <button class="btn btn-green" id="o-join" style="width:100%;margin-top:24px">Odaya Katıl →</button>
      </div>`;
    }
    return card(tabs + body);
  }
  function bindOnline() {
    const o = G.online;
    const back = document.getElementById('online-back');
    if (back) back.onclick = () => { if (NET) NET.leave(); G.online.status = 'idle'; G.screen = 'home'; render(); };
    bindLangBtn();
    document.querySelectorAll('[data-otab]').forEach(b => b.onclick = () => { o.tab = b.dataset.otab; render(); });
    document.querySelectorAll('[data-ofmt]').forEach(b => b.onclick = () => { o.format = +b.dataset.ofmt; render(); });
    document.querySelectorAll('#o-swatches [data-ocolor]').forEach(b => b.onclick = () => { o.color = +b.dataset.ocolor; render(); });
    const nm = document.getElementById('o-name'); if (nm) nm.oninput = () => o.name = nm.value;
    const cd = document.getElementById('o-code'); if (cd) cd.oninput = () => o.code = cd.value.toUpperCase();
    const retry = document.getElementById('online-retry'); if (retry) retry.onclick = () => { o.status = 'idle'; render(); };
    const create = document.getElementById('o-create');
    if (create) create.onclick = () => {
      o.status = 'connecting'; render();
      NET.connect(() => { NET.create({ format: o.format, profile: { name: o.name.trim() || 'Vadi Spor', color: o.color } }); },
        (why) => { o.status = 'error'; o.msg = why === 'file' ? 'Oyun dosyadan açılmış (file://). Online için sunucudan aç.' : 'Sunucuya bağlanılamadı.'; render(); });
    };
    const join = document.getElementById('o-join');
    if (join) join.onclick = () => {
      const code = (o.code || '').trim();
      if (code.length < 4) { toast('4 haneli oda kodunu gir'); return; }
      o.status = 'connecting'; render();
      NET.connect(() => { NET.join(code, { name: o.name.trim() || 'Liman FK', color: o.color }); },
        (why) => { o.status = 'error'; o.msg = why === 'file' ? 'Oyun dosyadan açılmış (file://). Online için sunucudan aç.' : 'Sunucuya bağlanılamadı.'; render(); });
    };
    const hs = document.getElementById('host-start'); if (hs) hs.onclick = startOnlineSeriesHost;
  }

  /* ---------- online seri kurulumu ---------- */
  function startOnlineSeriesHost() {
    const o = G.online; const peer = o.peer || {};
    let myColor = CLUB_COLORS[o.color];
    let oppColorIdx = peer.color != null ? peer.color : 1;
    let oppColor = CLUB_COLORS[oppColorIdx];
    if (oppColor === myColor) oppColor = CLUB_COLORS[(oppColorIdx + 1) % CLUB_COLORS.length];
    G.me = newClub(o.name.trim() || 'Vadi Spor', myColor, 'a');
    G.opp = newClub((peer.name || 'Liman FK').trim(), oppColor, 'b');
    G.opp.formation = G.me.formation;
    G.series = { format: o.format, winsNeeded: o.format === 3 ? 2 : 3, matchNo: 1, winsA: 0, winsB: 0, matches: [] };
    G.draftPool = buildDraftPool();
    G.draft = { round: 0, opener: 'me', phase: 'open', pos: null, cands: null, activeSlot: 0 };
    netSend({ t: 'start', format: o.format, host: { name: G.me.name, color: myColor }, guest: { name: G.opp.name, color: oppColor }, pool: G.draftPool });
    G.screen = 'draft';
    advanceDraft();
  }
  function startOnlineSeriesGuest(m) {
    G.me = newClub(m.guest.name, m.guest.color, 'b');
    G.opp = newClub(m.host.name, m.host.color, 'a');
    G.opp.formation = G.me.formation;
    G.series = { format: m.format, winsNeeded: m.format === 3 ? 2 : 3, matchNo: 1, winsA: 0, winsB: 0, matches: [] };
    G.draftPool = m.pool;
    G.draft = { round: 0, opener: 'me', phase: 'open', pos: null, cands: null, activeSlot: 0 };
    G.screen = 'draft';
    advanceDraft();
  }

  /* ============================================================
     Ağ mesaj yönlendirici
     ============================================================ */
  function onNetMessage(m) {
    switch (m.t) {
      case 'created': G.online.status = 'hosting'; G.online.code = m.code; if (window.KD_ANALYTICS) KD_ANALYTICS.event('room_created'); if (G.screen === 'online') render(); return;
      case 'joined': G.online.status = 'joined-wait'; G.online.code = m.code; G.online.hostConfig = m.config;
        G.online.oppName = (m.peer && m.peer.name) || 'Rakip'; if (window.KD_ANALYTICS) KD_ANALYTICS.event('room_joined'); if (G.screen === 'online') render(); return;
      case 'peer-joined': G.online.peer = m.profile || { name: 'Oyuncu' }; if (G.screen === 'online') render(); return;
      case 'peer-left': handlePeerLeft(m); return;
      case 'net-down': handlePeerLeft({ down: true }); return;
      case 'error': G.online.status = 'error'; G.online.msg = m.msg || 'Hata'; if (G.screen === 'online') render(); else toast(m.msg || 'Bağlantı hatası'); return;
    }
    if (m._relay) onGameNet(m);
  }
  function handlePeerLeft(m) {
    if (!isOnline()) return;
    if (G.screen === 'online') { G.online.peer = null; if (G.online.status === 'hosting') render(); return; }
    // oyun sırasında rakip düştü
    if (G.match && G.match.live) { try { G.match.live.stop(); } catch (_) {} }
    stopHostStream();
    toast(m.down ? 'Bağlantı koptu' : 'Rakip oyundan ayrıldı');
    if (NET) NET.leave();
    G.mode = 'ai'; G.me = null; G.opp = null; G.series = null; G.screen = 'home'; render();
  }
  function onGameNet(m) {
    const d = G.draft;
    switch (m.t) {
      case 'start': startOnlineSeriesGuest(m); break;
      case 'd-formation': if (G.opp) G.opp.formation = m.f; if (G.screen === 'draft') render(); break;
      case 'd-open-pick': {
        const opener = G.draftPool.find(p => p.id === m.id);
        if (opener) { removeFromPool(opener); assignDraft(G.opp, m.slot, opener); toast('Rakip aldı: ' + opener.name + (m.pos && m.pos !== 'ANY' && POS[m.pos] ? ' · ' + POS[m.pos].name : '')); }
        d.takenByOpener = opener || null; d.pos = m.pos;
        d.cands = m.cands.filter(id => id !== m.id).map(id => G.draftPool.find(p => p.id === id)).filter(Boolean);
        d.phase = 'take'; d.waiting = false; d.activeSlot = null; render();
        break;
      }
      case 'd-take': {
        const pl = G.draftPool.find(p => p.id === m.id);
        if (pl) { removeFromPool(pl); assignDraft(G.opp, m.slot, pl); toast('Rakip aldı: ' + pl.name); }
        d.round++; advanceDraft();
        break;
      }
      case 'du-lock': {
        if (!G.duello) G.duello = { mySteal: null, myProtect: null, revealed: false, locked: false, myLock: null, oppLock: null };
        G.duello.oppLock = { steal: m.steal, protect: m.protect };
        if (G.duello.locked) finishDuelloOnline(); else if (G.screen === 'duello') render();
        break;
      }
      case 'ready': G.tactics = G.tactics || {}; G.tactics.oppReady = true; G._oppClubSerialized = m.club; maybeStartOnlineMatch(); if (G.screen === 'tactics') render(); break;
      case 'm-tactic': if (amHost() && m.club) { G.opp = deserializeClub(m.club); if (G.match && G.match.live) G.match.live.refreshStrength(); } break;
      case 'm-frame': applyGuestFrame(m); break;
      case 'm-update': applyGuestUpdate(m); break;
      case 'm-event': guestEvent(m.ev); break;
      case 'm-comm': pushCommentary(m.txt, m.type); if (window.KD_SFX) { if (m.type === 'goal') { KD_SFX.play('net'); KD_SFX.play('goal'); } else { const mp = { shot: 'kick', save: 'save', foul: 'whistle', set: 'whistle' }; if (mp[m.type]) KD_SFX.play(mp[m.type]); } } break;
      case 'm-halftime': guestHalftime(m.kind); break;
      case 'ht-ready': hostHalftimeReady(); break;
      case 'ht-resume': guestResume(); break;
      case 'm-result': applyGuestResult(m); break;
      case 'between-ready': G._betweenReadyFor = G.series.matchNo; if (G.between) { G.between.oppReady = true; maybeAdvanceBetween(); } break;
    }
  }

  /* ============================================================
     1 · LOBİ
     ============================================================ */
  function lobbyHTML() {
    const L = G.lobby;
    const sw = (sel, taken) => CLUB_COLORS.map((c, i) =>
      `<div class="sw-opt ${i === sel ? 'sel' : ''} ${i === taken ? 'taken' : ''}" data-color="${i}" style="background:${c}"></div>`).join('');
    return `<div class="screen">
      ${head('01', 'Lobi', 'Oda kur — maç sayısı, kulüp adı ve renk seç. Rakibin yapay zekâ menajeri olacak.')}
      <div class="wrap-frame" style="padding:34px 30px;background:linear-gradient(180deg,#fbfcfd,#fff)">
        <div class="lobby-grid">
          <div class="lobby-card">
            <div class="flexc" style="gap:9px;margin-bottom:4px"><div style="width:26px;height:26px;border-radius:7px;background:#e7f8f0;display:flex;align-items:center;justify-content:center;color:#13a76a;font-weight:800;font-family:var(--arch)">+</div><div style="font-family:var(--arch);font-weight:800;font-size:17px">Oda Kur</div></div>
            <div class="muted" style="font-size:12.5px;margin-bottom:20px">Seri formatını seç, kulübünü oluştur.</div>

            <div class="label" style="margin-bottom:9px">Seri Formatı</div>
            <div class="g2" style="margin-bottom:20px">
              <div class="fmt-opt ${L.format === 3 ? 'sel' : ''}" data-fmt="3"><div class="big">Bo3</div><div style="font-size:11.5px;color:#3a4250;font-weight:600">3 maç · 2 galibiyet</div></div>
              <div class="fmt-opt ${L.format === 5 ? 'sel' : ''}" data-fmt="5"><div class="big">Bo5</div><div style="font-size:11.5px;font-weight:600">5 maç · 3 galibiyet</div></div>
            </div>

            <div class="label" style="margin-bottom:9px">Kulüp Adı</div>
            <input id="club-name" class="field-input" maxlength="22" value="${L.name}" placeholder="örn. Vadi Spor" style="margin-bottom:20px" />

            <div class="label" style="margin-bottom:9px">Kulüp Rengi</div>
            <div class="swatches" id="my-swatches">${sw(L.color, L.oppColor)}</div>

            <button class="btn btn-green" id="create-room" style="width:100%;margin-top:24px">Drafte Başla →</button>
          </div>

          <div class="lobby-or"><div class="bar"></div><div style="font:700 11px 'Hanken Grotesk';color:var(--faint);letter-spacing:.08em">VS</div><div class="bar"></div></div>

          <div class="lobby-card">
            <div class="flexc" style="gap:9px;margin-bottom:4px"><div style="width:26px;height:26px;border-radius:7px;background:#fbf0e6;display:flex;align-items:center;justify-content:center;color:#cf6f24;font-weight:800;font-family:var(--arch)">YZ</div><div style="font-family:var(--arch);font-weight:800;font-size:17px">Rakip · Yapay Zekâ</div></div>
            <div class="muted" style="font-size:12.5px;margin-bottom:20px">Rakibin draft, çalma/koruma ve taktik kararlarını otomatik verir.</div>

            <div class="label" style="margin-bottom:9px">Rakip Kulüp</div>
            <input id="opp-name" class="field-input" maxlength="22" value="${L.oppName}" style="margin-bottom:20px" />

            <div class="label" style="margin-bottom:9px">Rakip Rengi</div>
            <div class="swatches" id="opp-swatches">${sw(L.oppColor, L.color)}</div>

            <div style="margin-top:24px;border:1px dashed var(--line);border-radius:12px;padding:14px;background:#fbfcfd">
              <div style="font:700 11px 'Hanken Grotesk';color:#3a4250;margin-bottom:5px">Nasıl oynanır</div>
              <div class="muted" style="font-size:11.5px;line-height:1.5">Sıra sende → diziliş ve mevki seç, aday topla. Maç öncesi gizli çalma/koruma düellosu. Yaşlı oyuncular maçtan sonra düşebilir.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
  function bindLobby() {
    document.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => { G.lobby.format = +b.dataset.fmt; render(); });
    document.querySelectorAll('#my-swatches [data-color]').forEach(b => b.onclick = () => { const c = +b.dataset.color; if (c === G.lobby.oppColor) return; G.lobby.color = c; render(); });
    document.querySelectorAll('#opp-swatches [data-color]').forEach(b => b.onclick = () => { const c = +b.dataset.color; if (c === G.lobby.color) return; G.lobby.oppColor = c; render(); });
    const nm = document.getElementById('club-name'); if (nm) nm.oninput = () => G.lobby.name = nm.value;
    const on = document.getElementById('opp-name'); if (on) on.oninput = () => G.lobby.oppName = on.value;
    document.getElementById('create-room').onclick = startSeries;
  }

  /* ============================================================
     Seri / Draft kurulumu
     ============================================================ */
  function startSeries() {
    const L = G.lobby;
    let cMe = CLUB_COLORS[L.color], cOpp = CLUB_COLORS[L.oppColor];
    if (cMe === cOpp) cOpp = CLUB_COLORS[(L.oppColor + 1) % CLUB_COLORS.length];
    G.me = newClub(L.name.trim() || 'Vadi Spor', cMe, 'a');
    G.opp = newClub(L.oppName.trim() || 'Liman FK', cOpp, 'b');
    G.opp.formation = G.me.formation;   // draft AYNI dizilişten yapılır (ilk oyuncu seçer); sonra taktikte değişebilir
    G.series = { format: L.format, winsNeeded: L.format === 3 ? 2 : 3, matchNo: 1, winsA: 0, winsB: 0, matches: [] };
    G.draftPool = buildDraftPool();
    // 16 tur · her turda bir taraf bir mevki açar: açan 6 adaydan ilk seçer,
    // diğeri kalan 5'ten seçmek zorunda (ortak havuz). Açan sıra dönüşümlü.
    G.draft = { round: 0, opener: 'me', phase: 'open', pos: null, cands: null, activeSlot: 0 };
    G.screen = 'draft';
    advanceDraft();
  }
  function removeFromPool(p) { const i = G.draftPool.indexOf(p); if (i >= 0) G.draftPool.splice(i, 1); }
  function draftFilled(club) { return club.lineup.every(Boolean) && club.bench.every(Boolean); }
  function firstEmptySlot(club) {
    const i = club.lineup.findIndex(x => !x); if (i >= 0) return i;
    const b = club.bench.findIndex(x => !x); return b >= 0 ? 'b' + b : null;
  }
  /* Açılan mevkinin n adayı (ortak havuzdan, uygunluk + güç sıralı) */
  function genCandidates(pos, n) {
    let pool = G.draftPool.slice();
    if (pos === 'ANY') {
      // yedek: dizilişe uygun, farklı hatlardan dengeli adaylar (sırf forvet değil)
      // STP'yi beklerden ayır → yedek adayları arasında her zaman bir stoper de çıksın
      const groups = [['KL'], ['STP'], ['SĞB', 'SLB'], ['DOS', 'MOS', 'OOS'], ['SĞK', 'SLK', 'SĞA', 'SLA', 'SF']];
      const res = [];
      groups.forEach(g => { const best = pool.filter(p => !res.includes(p) && p.positions.some(pp => g.includes(pp))).sort((a, b) => b.ovr - a.ovr)[0]; if (best) res.push(best); });
      pool.sort((a, b) => b.ovr - a.ovr).forEach(p => { if (res.length < n && !res.includes(p)) res.push(p); });
      return res.slice(0, n);
    }
    return pool.map(p => { const f = fitLevel(p, pos); return { p, s: p.ovr * FIT_MULT[f] + (f === 'high' ? 9 : f === 'mid' ? 2 : -12) }; })
      .sort((a, b) => b.s - a.s).slice(0, n).map(o => o.p);
  }
  function assignDraft(club, slot, pl) {
    if (typeof slot === 'number') { const sp = FORMATIONS[club.formation][slot][0]; club.lineup[slot] = pl; pl.task = defaultTask(sp); pl.role = (ROLES[sp] || [''])[0]; }
    else { club.bench[+String(slot).slice(1)] = pl; pl.role = (ROLES[pl.pos] || [''])[0]; }
  }
  /* En uygun boş slot — önce ilk 11 (en yüksek uyum), sonra yedek */
  function bestEmptySlot(club, pl) {
    let best = null, bv = -1e9;
    FORMATIONS[club.formation].forEach((s, i) => { if (club.lineup[i]) return; const v = effOvr(pl, s[0]); if (v > bv) { bv = v; best = i; } });
    if (best != null) return best;
    const bi = club.bench.indexOf(null); return bi >= 0 ? 'b' + bi : null;
  }
  function aiOpenSlot(club) {
    const i = club.lineup.findIndex(x => !x); if (i >= 0) return i;
    const b = club.bench.indexOf(null); return b >= 0 ? 'b' + b : null;
  }
  /* Sıradaki turu kur. Açan dönüşümlü: çift tur ben, tek tur rakip. */
  function advanceDraft() {
    const d = G.draft;
    if (d.round >= 16 || (draftFilled(G.me) && draftFilled(G.opp))) { goDuello(); return; }
    if (isOnline()) { advanceDraftOnline(); return; }
    d.opener = d.round % 2 === 0 ? 'me' : 'opp';
    if (d.opener === 'me') {
      // ben açıyorum: bir slot seç → 6 aday → 1 seç (sonra rakip kalan 5'ten alır)
      d.phase = 'open'; d.takenByOpener = null;
      d.activeSlot = firstEmptySlot(G.me);
      d.pos = slotPos(G.me, d.activeSlot);
      d.cands = genCandidates(d.pos, 6);
    } else {
      // rakip açıyor: AI mevki seçer, 6 adaydan ilk seçimi yapar; bana kalan 5 düşer
      const slot = aiOpenSlot(G.opp);
      const pos = slotPos(G.opp, slot);
      const cands = genCandidates(pos, 6);
      const aiPick = AI.pickForSlot(cands, pos === 'ANY' ? 'SF' : pos);
      removeFromPool(aiPick); assignDraft(G.opp, slot, aiPick);
      d.openedBy = 'opp'; d.pos = pos; d.phase = 'take';
      d.takenByOpener = aiPick;                     // rakibin kapalı/seçili kartı
      d.cands = cands.filter(c => c !== aiPick);   // kalan 5
      d.activeSlot = null;
    }
    render();
  }
  /* Online: açan sıra mutlak tarafa göre (çift tur = host 'a', tek tur = guest 'b') */
  function advanceDraftOnline() {
    const d = G.draft;
    const openerSide = d.round % 2 === 0 ? 'a' : 'b';
    d.opener = (openerSide === NET.side) ? 'me' : 'opp';
    if (d.opener === 'me') {
      d.phase = 'open'; d.waiting = false; d.takenByOpener = null;
      d.activeSlot = firstEmptySlot(G.me);
      d.pos = slotPos(G.me, d.activeSlot);
      d.cands = genCandidates(d.pos, 6);
    } else {
      d.phase = 'take'; d.waiting = true; d.takenByOpener = null; d.cands = null; d.activeSlot = null;
    }
    render();
  }
  /* Ben açanken seçtiğim slot değişince adayları yenile */
  function openMySlot(slot) {
    const d = G.draft;
    d.activeSlot = slot; d.pos = slotPos(G.me, slot); d.cands = genCandidates(d.pos, 6); render();
  }
  /* Bir seçim yapıldıktan sonra rakibin (açan olmayan) zorunlu seçimi */
  function oppTakeFrom(cands) {
    const pos = aiOpenSlot(G.opp) != null ? slotPos(G.opp, aiOpenSlot(G.opp)) : 'ANY';
    let best = cands[0], bv = -1e9;
    cands.forEach(c => { const v = effOvr(c, pos === 'ANY' ? c.pos : pos); if (v > bv) { bv = v; best = c; } });
    removeFromPool(best); assignDraft(G.opp, bestEmptySlot(G.opp, best), best);
  }

  /* ============================================================
     2 · DRAFT
     ============================================================ */
  function slotPos(club, slot) {
    if (typeof slot === 'number') return FORMATIONS[club.formation][slot][0];
    return 'ANY';
  }
  function draftHTML() {
    const me = G.me; const d = G.draft;
    const slots = FORMATIONS[me.formation];
    const opening = d.opener === 'me';          // ben mi açıyorum
    const active = opening ? d.activeSlot : null;
    const pos = d.pos || 'ANY';
    const filledN = me.lineup.filter(Boolean).length + me.bench.filter(Boolean).length;
    const canOpen = opening;                     // sadece ben açanken slot seçilebilir
    // saha slotları
    const tokens = slots.map((s, i) => {
      const [sp, x, y] = s; const p = me.lineup[i]; const isActive = active === i;
      if (!p) return `<div class="tok empty ${isActive ? 'sel' : ''}" ${canOpen ? `data-slot="${i}"` : ''} style="left:${x}%;top:${y}%">
        <div class="dot">+</div><div class="nm">${sp}${isActive ? ' · AÇIK' : ''}</div></div>`;
      return `<div class="tok" style="left:${x}%;top:${y}%">
        <div class="dot" style="background:${sp === 'KL' ? '#d9a017' : me.color}">${shortOf(p)}<span class="ovr">${p.ovr}</span></div>
        <div class="nm">${p.name}</div></div>`;
    }).join('');
    // yedek slotları
    const bench = me.bench.map((p, i) => {
      const isActive = active === 'b' + i;
      if (!p) return `<div class="btok empty ${isActive ? 'sel' : ''}" ${canOpen ? `data-slot="b${i}"` : ''}><div class="dot">+</div><div class="pos">YDK</div></div>`;
      return `<div class="btok" data-slot="b${i}"><div class="dot" style="border-color:${me.color};color:${me.color}">${shortOf(p)}<span class="ovr">${p.ovr}</span></div><div class="pos">${p.pos}</div></div>`;
    }).join('');
    // adaylar — ortak havuzdan; take fazında rakibin aldığı kart kilitli görünür
    const lockedCard = (!opening && d.takenByOpener) ? candCardHTML(d.takenByOpener, pos, true) : '';
    const cands = lockedCard + (d.cands || []).map(c => candCardHTML(c, pos)).join('');
    const oppN = G.opp.lineup.filter(Boolean).length + G.opp.bench.filter(Boolean).length;
    const posName = pos === 'ANY' ? 'Yedek' : POS[pos].name;
    const waiting = isOnline() && d.waiting;
    const bannerTxt = waiting
      ? (d.opener === 'me' ? 'Rakip kalan adaylardan seçimini yapıyor…' : 'Rakip mevki açıp ilk seçimini yapıyor…')
      : opening
        ? `<b>${posName}</b> mevkisini açtın — 6 adaydan ilk seçimi sen yaparsın`
        : `Rakip <b>${posName}</b> açtı ve ilk seçimini yaptı — kalan 5 adaydan birini al`;

    return `<div class="screen">
      ${head('02', 'Draft', 'Açan taraf 6 adaydan ilk seçer; diğeri kalan 5 adaydan seçmek zorunda. Açma sırası dönüşümlü.')}
      <div class="turn-banner">
        <div class="flexc" style="gap:13px">
          <div class="turn-pill" style="${(waiting || !opening) ? 'background:#fdf0e6;color:#cf6f24' : ''}"><span class="dot"></span>${waiting ? 'Rakip seçiyor…' : opening ? 'Sen açıyorsun' : 'Rakip açtı'}</div>
          <div style="font:700 14px 'Hanken Grotesk'">${bannerTxt}</div>
        </div>
        <div class="flexc" style="gap:14px">
          <div class="muted" style="font-size:12px">Tur <b style="color:var(--ink)">${Math.min(d.round + 1, 16)}/16</b> · Kadro <b style="color:var(--ink)">${filledN}/16</b></div>
        </div>
      </div>
      <div class="draft-grid">
        <div class="draft-col bd">
          <div class="between" style="margin-bottom:8px"><div class="label">İlk 11'i Kur</div><div class="mono" style="color:var(--blue);background:#eef3fd;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">${me.lineup.filter(Boolean).length}/11</div></div>
          <div class="g3" style="grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:8px">${FORMATION_NAMES.map(n => `<div class="fmt-mini ${me.formation === n ? 'sel' : ''}" data-dformation="${n}" style="font-size:11px;padding:7px 3px">${n}</div>`).join('')}</div>
          <div class="muted" style="font-size:11.5px;margin-bottom:12px">${!opening ? 'Rakip mevki açtı — sağdaki kalan adaylardan seç (en uygun slotuna yerleşir).' : me.lineup.some(Boolean) ? 'Açmak istediğin boş slota dokun → 6 aday açılır. Yeşil slot şu an açık.' : 'Önce dizilişini seç, sonra açmak istediğin slota dokun.'}</div>
          <div class="pitch" style="height:430px">${PITCH_LINES}${tokens}</div>
          <div class="flexc" style="margin-top:14px;gap:9px;border:1px solid #f1ddc6;background:#fdf7f0;border-radius:10px;padding:9px 12px">
            <div style="width:11px;height:11px;border-radius:3px;background:${G.opp.color}"></div>
            <span style="font:700 12px 'Hanken Grotesk'">${G.opp.name}</span>
            <div style="flex:1;height:6px;background:#f3e2d0;border-radius:3px;overflow:hidden"><div style="height:100%;width:${oppN / 16 * 100}%;background:${G.opp.color};border-radius:3px"></div></div>
            <span class="mono" style="font-size:11px;color:#cf6f24;font-weight:700">${oppN}/16</span>
          </div>
        </div>
        <div class="rail">
          <div style="text-align:center"><div class="label" style="font-size:10px">Yedekler</div><div class="mono" style="color:#13a76a;font-size:9px;margin-top:3px;font-weight:700">${me.bench.filter(Boolean).length}/5</div></div>
          ${bench}
        </div>
        <div class="draft-col">
          <div class="between" style="margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <div style="font-family:var(--arch);font-weight:800;font-size:15px">${posName} adayları <span class="muted" style="font-weight:600;font-size:12.5px">· ${opening ? 'ilk seçim senin' : 'rakip birini aldı, kalan ' + (d.cands || []).length}</span></div>
            <div class="flexc muted" style="gap:9px;font:600 10.5px 'Hanken Grotesk'">
              <span class="flexc" style="gap:4px"><span class="lg" style="background:#19c37d"></span>iyi</span>
              <span class="flexc" style="gap:4px"><span class="lg" style="background:#d9a017"></span>orta</span>
              <span class="flexc" style="gap:4px"><span class="lg" style="background:#e5484d"></span>kötü</span>
              <span class="flexc" style="gap:4px"><span class="lg" style="border:1.5px solid #c2c7ce;background:transparent"></span>oynamaz</span>
            </div>
          </div>
          <div class="cand-grid">${waiting ? `<div class="cand-wait"><div class="cw-spin"></div><div class="cw-title">🔒 Rakip seçiyor…</div><div class="cw-sub">${d.opener === 'me' ? 'Açtığın mevkide kalan adaylardan birini alıyor — birazdan sıra sana dönecek.' : 'Bir mevki açıp ilk seçimini yapıyor. Ardından kalan adaylardan sen seçeceksin.'}</div></div>` : cands}</div>
        </div>
      </div>
    </div>`;
  }
  function avatarHTML(p, size) {
    if (!window.KD_AVATAR || !p) return '';
    const s = size || 40;
    return `<div class="avatar" style="width:${s}px;height:${s}px;border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#f3f6f9,#e7ecf1);flex:0 0 auto">${KD_AVATAR.faceSVG(p.id, s)}</div>`;
  }
  function candCardHTML(c, pos, locked) {
    const f = pos === 'ANY' ? 'high' : fitLevel(c, pos);
    const fm = FIT_META[f];
    const flexLabel = c.positions.length === 1 ? 'Tek mevki' : c.positions.length >= 3 ? 'Çok yönlü' : 'Esnek';
    const flexCol = c.positions.length === 1 ? '#cf6f24' : c.positions.length >= 3 ? '#7c5cd6' : '#13a76a';
    const flexBg = c.positions.length === 1 ? '#fbf0e6' : c.positions.length >= 3 ? '#f3eefe' : '#e7f8f0';
    return `<div class="cand ${locked ? 'locked' : ''}" ${locked ? '' : `data-pick="${c.id}"`}>
      ${locked ? `<div class="cand-lock"><span>🔒 Rakip aldı</span></div>` : ''}
      <div class="top" style="background:${locked ? '#9aa1ac' : fm.col}"></div>
      <div class="body">
        <div class="between" style="align-items:flex-start;margin-bottom:8px">
          <div class="flexc" style="gap:9px;min-width:0;align-items:flex-start">
            ${avatarHTML(c, 42)}
            <div style="min-width:0">
            <div class="nm">${c.name}</div>
            <div style="font:700 10.5px 'Hanken Grotesk';color:${flexCol};margin-top:3px">${c.type || c.pos}</div>
            <div class="flexc" style="gap:5px;margin-top:6px;flex-wrap:wrap">
              <span class="flexbadge" style="color:${flexCol};background:${flexBg}">${flexLabel}</span>
              <span class="chip">${c.age} yaş</span>
            </div>
            </div>
          </div>
          <div class="ovrbox"><div class="l">GÜÇ</div><div class="v">${c.ovr}</div><div class="pot">POT ${c.pot}</div></div>
        </div>
        <div class="cand-visuals">
          <div class="minipitch" title="Oynayabildiği mevkiler">${miniPitchSVG(c)}</div>
          <div class="radar">${radarSVG(c.stats, statKeysFor(c))}</div>
        </div>
        <div class="pick">${locked ? 'Rakipte' : 'Seç'}</div>
      </div>
    </div>`;
  }
  function bindDraft() {
    const d = G.draft;
    const meHasPicked = G.me.lineup.some(Boolean) || G.me.bench.some(Boolean);
    document.querySelectorAll('[data-dformation]').forEach(b => b.onclick = () => {
      if (meHasPicked) { toast('Diziliş yalnızca ilk seçimden önce değiştirilebilir'); return; }
      if (isOnline()) {
        // sadece kendi dizilişimi değiştir, rakibe bildir
        G.me.formation = b.dataset.dformation;
        netSend({ t: 'd-formation', f: G.me.formation });
        if (d.opener === 'me' && !d.waiting) openMySlot(firstEmptySlot(G.me)); else render();
        return;
      }
      G.me.formation = b.dataset.dformation; G.opp.formation = b.dataset.dformation;   // iki takım da aynı dizilişle draft eder
      openMySlot(firstEmptySlot(G.me));
    });
    document.querySelectorAll('[data-slot]').forEach(s => s.onclick = () => {
      if (d.opener !== 'me' || d.waiting) return;
      const v = s.dataset.slot;
      const slot = v[0] === 'b' ? v : +v;
      if (typeof slot === 'number') { if (G.me.lineup[slot]) return; }
      else { if (G.me.bench[+slot.slice(1)]) return; }
      openMySlot(slot);
    });
    document.querySelectorAll('[data-pick]').forEach(c => c.onclick = () => {
      const id = +c.dataset.pick; const pl = (d.cands || []).find(p => p.id === id); if (!pl) return;
      if (isOnline()) {
        if (d.waiting) return;   // sıra bende değil
        if (d.opener === 'me') {
          const slot = d.activeSlot; if (slot == null) return;
          removeFromPool(pl); assignDraft(G.me, slot, pl);
          netSend({ t: 'd-open-pick', id: pl.id, slot, pos: d.pos, cands: (d.cands || []).map(x => x.id) });
          d.phase = 'take'; d.waiting = true; render();   // rakibin kalan 5'ten almasını bekle
        } else {
          const slot = bestEmptySlot(G.me, pl);
          removeFromPool(pl); assignDraft(G.me, slot, pl);
          netSend({ t: 'd-take', id: pl.id, slot });
          d.round++; advanceDraft();
        }
        return;
      }
      if (d.opener === 'me') {
        // ben açtım: seçtiğim slota yerleşir → rakip kalan 5'ten alır
        const slot = d.activeSlot; if (slot == null) return;
        removeFromPool(pl); assignDraft(G.me, slot, pl);
        oppTakeFrom((d.cands || []).filter(x => x !== pl));
      } else {
        // rakip açtı: ben kalan 5'ten alıyorum → en uygun slotuma yerleşir
        removeFromPool(pl); assignDraft(G.me, bestEmptySlot(G.me, pl), pl);
      }
      d.round++;
      advanceDraft();
    });
  }

  /* ============================================================
     3 · ÇALMA / KORUMA DÜELLOSU
     ============================================================ */
  function syncSquads() {
    // squad = lineup + bench (filtrelenmiş)
    G.me.squad = [...G.me.lineup.filter(Boolean), ...G.me.bench.filter(Boolean)];
    G.opp.squad = [...G.opp.lineup.filter(Boolean), ...G.opp.bench.filter(Boolean)];
  }
  function goDuello() {
    syncSquads();
    G.duello = { mySteal: null, myProtect: null, revealed: false, locked: false, myLock: null, oppLock: null };
    G.screen = 'duello';
    render();
  }
  /* Çalınan oyuncunun mevkisini oynayabilen en zayıf (ovr) oyuncu otomatik takasa verilir */
  function weakestForPos(club, pos, excludeId) {
    const able = club.squad.filter(p => p.id !== excludeId && D.posAffinity(p, pos) !== 'none');
    const pool = able.length ? able : club.squad.filter(p => p.id !== excludeId);
    return pool.slice().sort((a, b) => a.ovr - b.ovr)[0] || null;
  }
  /* marks: [{id, col}] — birden çok seçimi farklı renkle halkalar */
  function duelloPitch(club, side, marks) {
    const slots = FORMATIONS[club.formation];
    const markOf = (id) => marks.find(m => m.id === id);
    const ring = (m) => m ? `box-shadow:0 0 0 3px ${m.col},0 4px 10px -3px rgba(0,0,0,.5)` : '';
    const tokens = club.lineup.map((p, i) => {
      if (!p) return '';
      const [sp, x, y] = slots[i]; const m = markOf(p.id);
      const dotBg = sp === 'KL' ? '#d9a017' : club.color;
      return `<div class="tok ${m ? 'sel' : ''}" data-${side}="${p.id}" style="left:${x}%;top:${y}%">
        <div class="dot" style="background:${dotBg};${ring(m)}">${shortOf(p)}<span class="ovr">${p.ovr}</span></div>
        <div class="nm">${p.name}</div></div>`;
    }).join('');
    const bench = benchList(club).map(p => {
      const m = markOf(p.id);
      return `<div class="btok ${m ? 'sel' : ''}" data-${side}="${p.id}"><div class="dot" style="background:${club.color};color:#fff;border-color:${m ? m.col : '#fff'}">${shortOf(p)}<span class="ovr">${p.ovr}</span></div><div class="pos">${p.pos}</div></div>`;
    }).join('');
    return { tokens, bench };
  }
  function duelloHTML() {
    const tur = G.series.matchNo;
    if (G.duello.revealed) return duelloRevealHTML();
    if (isOnline() && G.duello.locked) return duelloWaitHTML();
    const du = G.duello;
    const opp = duelloPitch(G.opp, 'steal', [{ id: du.mySteal, col: '#e5484d' }]);
    const mine = duelloPitch(G.me, 'mine', [{ id: du.myProtect, col: '#19c37d' }]);
    const stealP = G.opp.squad.find(p => p.id === du.mySteal);
    const protP = G.me.squad.find(p => p.id === du.myProtect);
    const giveP = stealP ? weakestForPos(G.me, stealP.pos, null) : null;   // otomatik verilecek (en zayıf, aynı mevki)
    const ready = stealP && protP;
    return `<div class="screen">
      ${head('03', 'Çalma / Koruma Düellosu · Tur ' + tur, 'Gizli düello: aynı anda BİR rakip oyuncu çal + kendi BİR oyuncunu koru. İkiniz de kilitleyince sonuç açılır.')}
      <div class="duello-howto">
        <span class="hw"><span class="hwn" style="background:#e5484d">1</span> Solda rakipten almak istediğin oyuncuya dokun</span>
        <span class="hw"><span class="hwn" style="background:#13a76a">2</span> Sağda kendi korumak istediğin yıldıza dokun</span>
        <span class="hw"><span class="hwn" style="background:#14181f">3</span> Aşağıdan "Seçimi Kilitle"ye bas</span>
      </div>
      <div class="duello-grid">
        <div class="duello-side bd">
          <div class="flexc" style="gap:9px;margin-bottom:5px"><div style="width:26px;height:26px;border-radius:7px;background:#fdeced;display:flex;align-items:center;justify-content:center;color:#e5484d;font-weight:900;font-family:var(--arch)">↯</div><div style="font-family:var(--arch);font-weight:800;font-size:16px;color:#e5484d">1 · ÇAL — ${G.opp.name}</div></div>
          <div class="duello-hint red">👆 Almak istediğin rakip oyuncuya dokun. ${du.mySteal ? '<b>Seçildi ✓</b>' : 'Henüz seçmedin.'}</div>
          <div class="pitch" style="height:360px">${PITCH_LINES}${opp.tokens}</div>
          <div class="flexc" style="margin-top:14px;gap:12px"><div class="label" style="font-size:9.5px">Yedekler</div><div style="flex:1;display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap">${opp.bench}</div></div>
        </div>
        <div class="duello-side">
          <div class="flexc" style="gap:9px;margin-bottom:5px"><div style="width:26px;height:26px;border-radius:7px;background:#e7f8f0;display:flex;align-items:center;justify-content:center;color:#13a76a;font-weight:900;font-family:var(--arch)">🛡</div><div style="font-family:var(--arch);font-weight:800;font-size:16px;color:#13a76a">2 · KORU — ${G.me.name}</div></div>
          <div class="duello-hint green">🛡 Korumak istediğin kendi yıldızına dokun — rakip onu çalamaz. ${du.myProtect ? '<b>Seçildi ✓</b>' : 'Henüz seçmedin.'}</div>
          <div class="pitch" style="height:360px">${PITCH_LINES}${mine.tokens}</div>
          <div class="flexc" style="margin-top:14px;gap:12px"><div class="label" style="font-size:9.5px">Yedekler</div><div style="flex:1;display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap">${mine.bench}</div></div>
        </div>
      </div>
      <div class="lockbar">
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <div><div class="label" style="font-size:10px">Çalma hedefin</div><div style="font:800 13.5px 'Hanken Grotesk';color:#e5484d">${stealP ? `${stealP.name} · ${stealP.ovr}` : '—'}</div></div>
          <div style="width:1px;background:var(--line2)"></div>
          <div><div class="label" style="font-size:10px">Otomatik verilecek</div><div style="font:800 13.5px 'Hanken Grotesk';color:#cf6f24">${stealP ? (giveP ? `${giveP.name} · ${giveP.ovr}` : '—') : '(önce hedef seç)'}</div></div>
          <div style="width:1px;background:var(--line2)"></div>
          <div><div class="label" style="font-size:10px">Koruduğun</div><div style="font:800 13.5px 'Hanken Grotesk';color:#13a76a">${protP ? `${protP.name} · ${protP.ovr}` : '—'}</div></div>
        </div>
        <div class="flexc" style="gap:10px">
          <div class="muted" style="font-size:12px">Kilitleyince geri alınamaz</div>
          <button class="btn btn-dark" id="lock-duello" ${ready ? '' : 'disabled'}>Seçimi Kilitle 🔒</button>
        </div>
      </div>
    </div>`;
  }
  function bindDuello() {
    if (G.duello.revealed) { document.getElementById('to-tactics').onclick = goTactics; return; }
    document.querySelectorAll('[data-steal]').forEach(t => t.onclick = () => { G.duello.mySteal = +t.dataset.steal; render(); });
    document.querySelectorAll('[data-mine]').forEach(t => t.onclick = () => { G.duello.myProtect = +t.dataset.mine; render(); });
    const lock = document.getElementById('lock-duello'); if (lock) lock.onclick = resolveDuello;
  }
  function transfer(player, from, to) {
    if (!from.squad.includes(player)) return false;   // sahibi değişmişse iptal
    from.squad = from.squad.filter(p => p !== player);
    const li = from.lineup.indexOf(player); if (li >= 0) from.lineup[li] = null;
    const bi = from.bench.indexOf(player); if (bi >= 0) from.bench[bi] = null;
    const empty = to.bench.indexOf(null);
    if (empty >= 0) to.bench[empty] = player; else to.bench.push(player);
    to.squad.push(player);
    player.fatigue = player.fatigue || 0;
    return true;
  }
  function resolveDuello() {
    if (isOnline()) return resolveDuelloOnline();
    const ai = AI.duelloChoice(G.opp, G.me); // {stealId (benden), protectId (kendi)}
    const mySteal = G.opp.squad.find(p => p.id === G.duello.mySteal);
    const oppSteal = G.me.squad.find(p => p.id === ai.stealId);
    const log = [];
    // benim çalmam — karşılığında o mevkiyi oynayabilen en zayıf oyuncum otomatik gider
    if (mySteal) {
      if (ai.protectId === mySteal.id) log.push({ ok: false, side: 'me', txt: `${mySteal.name} korunuyordu — çalman engellendi`, player: mySteal });
      else {
        const give = weakestForPos(G.me, mySteal.pos, mySteal.id);
        transfer(mySteal, G.opp, G.me);
        if (give) transfer(give, G.me, G.opp);
        log.push({ ok: true, side: 'me', txt: `${mySteal.name} kadrona katıldı · karşılığında ${give ? give.name : '—'} rakibe gitti`, player: mySteal, give });
      }
    }
    // rakibin çalması — AI de o mevkinin en zayıfını verir
    if (oppSteal && G.me.squad.includes(oppSteal)) {
      if (G.duello.myProtect === oppSteal.id) log.push({ ok: true, side: 'opp', txt: `${oppSteal.name}'ı korudun — rakibin çalması engellendi`, player: oppSteal, protectedOk: true });
      else {
        const give = weakestForPos(G.opp, oppSteal.pos, oppSteal.id);
        transfer(oppSteal, G.me, G.opp);
        if (give && G.opp.squad.includes(give)) transfer(give, G.opp, G.me);
        log.push({ ok: false, side: 'opp', txt: `${oppSteal.name} rakibe gitti · karşılığında ${give ? give.name : '—'} sana geldi`, player: oppSteal, give });
      }
    }
    G.duello.log = log; G.duello.revealed = true;
    syncSquads();
    render();
  }
  function resolveDuelloOnline() {
    const du = G.duello;
    if (du.locked) return;
    du.myLock = { steal: du.mySteal, protect: du.myProtect };
    netSend({ t: 'du-lock', steal: du.mySteal, protect: du.myProtect });
    du.locked = true;
    if (du.oppLock) finishDuelloOnline(); else render();
  }
  function finishDuelloOnline() {
    const du = G.duello;
    if (du.revealed) return;
    const myL = du.myLock, opL = du.oppLock; const log = [];
    const myStealStep = () => {
      const target = G.opp.squad.find(p => p.id === myL.steal); if (!target) return;
      if (opL.protect === target.id) { log.push({ side: 'me', ok: false, player: Object.assign({}, target), txt: `${target.name} korunuyordu — çalman engellendi` }); return; }
      const give = weakestForPos(G.me, target.pos, target.id);
      transfer(target, G.opp, G.me); if (give) transfer(give, G.me, G.opp);
      log.push({ side: 'me', ok: true, player: Object.assign({}, target), give: give ? Object.assign({}, give) : null, txt: `${target.name} kadrona katıldı · karşılığında ${give ? give.name : '—'} rakibe gitti` });
    };
    const oppStealStep = () => {
      const target = G.me.squad.find(p => p.id === opL.steal); if (!target) return;
      if (myL.protect === target.id) { log.push({ side: 'opp', protectedOk: true, player: Object.assign({}, target), txt: `${target.name}'ı korudun — rakibin çalması engellendi` }); return; }
      const give = weakestForPos(G.opp, target.pos, target.id);
      transfer(target, G.me, G.opp); if (give) transfer(give, G.opp, G.me);
      log.push({ side: 'opp', ok: false, player: Object.assign({}, target), give: give ? Object.assign({}, give) : null, txt: `${target.name} rakibe gitti · karşılığında ${give ? give.name : '—'} sana geldi` });
    };
    // deterministik: önce host (a) çalması, sonra guest (b) — iki istemcide aynı sonuç
    if (NET.side === 'a') { myStealStep(); oppStealStep(); } else { oppStealStep(); myStealStep(); }
    du.log = log; du.revealed = true; syncSquads(); render();
  }
  function duelloWaitHTML() {
    return `<div class="screen">
      ${head('03', 'Çalma / Koruma Düellosu · Tur ' + G.series.matchNo, 'Seçimini kilitledin. Rakip de kilitleyince sonuç aynı anda açılır.')}
      <div class="wrap-frame" style="padding:64px 30px;text-align:center;background:radial-gradient(120% 120% at 50% 0%,#f6fbf8,#fff)">
        <div style="font-family:var(--arch);font-weight:900;font-size:26px;margin-bottom:12px">Seçimin kilitlendi 🔒</div>
        <div class="flexc" style="gap:10px;justify-content:center;color:#cf6f24"><span style="width:11px;height:11px;border-radius:50%;background:#d9a017;animation:livepulse 1.4s ease-in-out infinite"></span><span style="font:700 14px 'Hanken Grotesk'">Rakibin seçimini kilitlemesi bekleniyor…</span></div>
      </div></div>`;
  }
  function duelloRevealHTML() {
    const log = G.duello.log || [];
    const mine = log.find(l => l.side === 'me');
    const opp = log.find(l => l.side === 'opp');
    const card = (l, isSteal) => {
      if (!l) return '';
      const good = isSteal ? l.ok : l.protectedOk;
      const title = isSteal ? (l.ok ? 'Çalman BAŞARILI' : 'Çalman ENGELLENDİ') : (l.protectedOk ? 'Koruman İŞE YARADI' : 'Oyuncunu KAYBETTİN');
      const col = good ? '#13a76a' : '#e5484d';
      const bg = good ? 'linear-gradient(160deg,#eafaf2,#fff)' : 'linear-gradient(160deg,#fdeced,#fff)';
      const bd = good ? '#c5edd9' : '#f3c6c8';
      const icon = isSteal ? '↯' : '🛡';
      const p = l.player;
      return `<div style="border:1px solid ${bd};background:${bg};border-radius:16px;padding:22px">
        <div class="flexc" style="gap:8px;margin-bottom:16px"><div style="width:24px;height:24px;border-radius:7px;background:${col};display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--arch);font-weight:900">${icon}</div><div style="font:800 14px 'Hanken Grotesk';color:${col}">${title}</div></div>
        <div class="flexc" style="gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px">
          <div style="width:46px;height:46px;border-radius:11px;background:${isSteal ? G.opp.color : G.me.color};display:flex;align-items:center;justify-content:center;font:700 11px var(--mono);color:#fff">${p.pos}</div>
          <div style="flex:1"><div style="font-family:var(--arch);font-weight:800;font-size:17px">${p.name}</div><div style="font:600 11.5px var(--mono);color:#9aa1ac">${p.positions.join(' · ')}</div></div>
          <div style="text-align:center"><div style="font:600 8px 'Hanken Grotesk';color:#9aa1ac;letter-spacing:.06em">GÜÇ</div><div style="font-family:var(--arch);font-weight:900;font-size:24px;line-height:1">${p.ovr}</div></div>
        </div>
        <div style="margin-top:12px;font:500 12px 'Hanken Grotesk';color:#6a7280">${l.txt}</div>
      </div>`;
    };
    return `<div class="screen">
      ${head('03', 'Düello Sonucu · Tur ' + G.series.matchNo, 'İki seçim aynı anda açıldı.')}
      <div class="wrap-frame" style="padding:40px 30px;background:radial-gradient(120% 120% at 50% 0%,#f6fbf8,#fff)">
        <div style="text-align:center;margin-bottom:30px">
          <div style="font:700 11px 'Hanken Grotesk';letter-spacing:.16em;color:#9aa1ac;text-transform:uppercase">Düello Sonucu</div>
          <div style="font-family:var(--arch);font-weight:900;font-size:30px;letter-spacing:-.02em;margin-top:6px">Transferler Açıklandı</div>
        </div>
        <div class="g2" style="max-width:880px;margin:0 auto;gap:18px">
          ${card(mine, true) || '<div style="border:1px dashed var(--line);border-radius:16px;padding:22px;color:#9aa1ac;text-align:center">Çalma yapmadın</div>'}
          ${card(opp, false) || '<div style="border:1px dashed var(--line);border-radius:16px;padding:22px;color:#9aa1ac;text-align:center">Rakip çalmadı</div>'}
        </div>
        <div style="text-align:center;margin-top:28px"><button class="btn btn-green" id="to-tactics">Taktiğe Geç →</button></div>
      </div>
    </div>`;
  }

  /* ============================================================
     4 · KADRO & TAKTİK
     ============================================================ */
  function goTactics() {
    benchInjured(G.me);   // sakat oyuncuları ilk 11'den yedeğe al (oynayamazlar)
    // çalma sonrası boş kalan ilk 11 slotlarını yedekten doldurmaya çalışma (kullanıcı düzenleyebilir)
    fillHolesFromBench(G.me);
    if (!isOnline()) aiSetupLineup(G.opp);   // online'da rakip insandır; dizilişi "Hazır"da gelir
    G.tactics = { sel: null, ready: false, oppReady: false };
    G._oppClubSerialized = null;
    G.screen = 'tactics';
    render();
  }
  /* Sakat oyuncuları (injuredMatches>0) ilk 11'den yedeğe taşı — bu maçı kaçırırlar */
  function benchInjured(club) {
    club.lineup.forEach((p, i) => {
      if (!p || !isInjured(p)) return;
      club.lineup[i] = null;
      const e = club.bench.indexOf(null); if (e >= 0) club.bench[e] = p; else club.bench.push(p);
    });
  }
  function fillHolesFromBench(club) {
    const slots = FORMATIONS[club.formation];
    club.lineup.forEach((p, i) => {
      if (p) return;
      const pos = slots[i][0];
      const bench = benchList(club);
      if (!bench.length) return;
      // önce SAĞLAM yedeklerden en uygunu; hiç sağlam yoksa son çare sakat oyuncu (11 tamamlansın)
      const healthy = bench.filter(b => !isInjured(b));
      const pool = healthy.length ? healthy : bench;
      let best = pool[0], bv = -1;
      pool.forEach(b => { const v = effOvr(b, pos); if (v > bv) { bv = v; best = b; } });
      const bi = club.bench.indexOf(best); if (bi >= 0) club.bench[bi] = null;
      club.lineup[i] = best; best.task = defaultTask(pos); best.role = (ROLES[pos] || [''])[0];
    });
  }
  function aiSetupLineup(club) {
    AI.chooseTactics(club);
    const slots = FORMATIONS[club.formation];
    const pool = club.squad.slice();
    const healthy = pool.filter(p => !isInjured(p));
    const lineup = Array(11).fill(null);
    // her slota en uygun (sağlam) oyuncuyu greedy ata; yetmezse sakatlara düş
    slots.forEach((s, i) => {
      const pos = s[0];
      const avail = (healthy.filter(p => !lineup.includes(p)).length ? healthy : pool);
      let best = null, bv = -1;
      avail.forEach(p => { if (lineup.includes(p)) return; const v = effOvr(p, pos); if (v > bv) { bv = v; best = p; } });
      if (best) { lineup[i] = best; best.task = defaultTask(pos); }
    });
    club.lineup = lineup;
    const rest = pool.filter(p => !lineup.includes(p));
    club.bench = rest.slice(0, Math.max(5, rest.length));
  }
  function tacticsHTML() {
    const me = G.me, slots = FORMATIONS[me.formation];
    const sel = G.tactics.sel;
    const selPlayer = sel != null ? (typeof sel === 'number' ? me.lineup[sel] : benchList(me)[sel.idx]) : null;
    const tokens = slots.map((s, i) => {
      const [sp, x, y] = s; const p = me.lineup[i]; const isSel = typeof sel === 'number' && sel === i;
      if (!p) return `<div class="tok empty ${isSel ? 'sel' : ''}" data-tslot="${i}" style="left:${x}%;top:${y}%"><div class="dot">+</div><div class="nm">${sp}</div></div>`;
      const task = p.task || defaultTask(sp); const tc = TASK_COL[task];
      const dotBg = sp === 'KL' ? '#d9a017' : me.color;
      const fl = fitLevel(p, sp);
      const fitRing = fl === 'high' ? '' : fl === 'mid' ? 'outline:2px solid #d9a017;outline-offset:2px;' : 'outline:2px solid #e5484d;outline-offset:2px;';
      return `<div class="tok ${isSel ? 'sel' : ''}" data-tslot="${i}" style="left:${x}%;top:${y}%" title="${p.name} · ${p.type || p.pos} · ${p.age} yaş · ${p.height || '–'}cm · Güç ${p.ovr} · ${POS[sp].name}">
        <div class="dot" style="background:${dotBg};${fitRing}">${shortOf(p)}<span class="ovr">${p.ovr}</span><span class="task" style="background:${tc}"></span></div>
        <div class="nm">${p.name}</div><span class="tasklbl" style="background:${tc}">${task}</span></div>`;
    }).join('');
    const bench = benchList(me).map((p, i) => {
      const isSel = sel && sel.bench && sel.idx === i; const inj = isInjured(p);
      return `<div class="btok ${isSel ? 'sel' : ''} ${inj ? 'inj' : ''}" data-tbench="${i}" title="${p.name} · ${p.age} yaş · Güç ${p.ovr}${inj ? ' · SAKAT (oynayamaz)' : ''}"><div class="dot">${shortOf(p)}<span class="ovr">${p.ovr}</span></div><div class="pos">${inj ? '➕ sakat' : p.pos}</div></div>`;
    }).join('');
    const fmts = FORMATION_NAMES.map(n => `<div class="fmt-mini ${me.formation === n ? 'sel' : ''}" data-formation="${n}">${n}</div>`).join('');
    const phils = PHILOSOPHIES.map(n => `<div class="opt-pill ${me.philosophy === n ? 'sel' : ''}" data-phil="${n}">${n}</div>`).join('');
    const mentIdx = MENTALITIES.indexOf(me.mentality);
    const mentLbls = MENTALITIES.map((n, i) => `<span class="${i === mentIdx ? 'sel' : ''}" data-ment="${i}">${n}</span>`).join('');
    const fUsed = focusUsed(me), fLeft = FOCUS_BUDGET - fUsed;
    const focusRows = FOCUS_KEYS.map(k => {
      const v = me.focus[k] || 0;
      return `<div><div class="between" style="margin-bottom:5px"><span style="font:600 11.5px 'Hanken Grotesk';color:#3a4250">${k}</span><span class="mono" style="font-size:10px;color:#9aa1ac">${v}</span></div>
        <div class="focus-seg">${[1, 2, 3].map(n => `<div class="s ${v >= n ? 'on' : ''}" data-focus="${k}" data-val="${n}"></div>`).join('')}</div></div>`;
    }).join('');
    const filled = me.lineup.filter(Boolean).length;

    return `<div class="screen">
      ${head('04', 'Kadro & Taktik', 'Dizilişi seç · oyuncuları yerleştir · rol & görev ata · takım odağını ayarla. Yeşil = en iyi mevki, sarı = orta, kırmızı = zorlanır.')}
      <div class="tactics-grid">
        <div class="tactics-col bd">
          <div class="label" style="margin-bottom:10px">Diziliş</div>
          <div class="g3" style="grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:22px">${fmts}</div>
          <div class="label" style="margin-bottom:9px">Oyun Felsefesi</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">${phils}</div>
          <div class="label" style="margin-bottom:11px">Mentalite <span class="mono" style="color:var(--green-d);font-weight:700;font-size:10px">${me.mentality}</span></div>
          <div class="ment-track"><div class="ment-rail"><div class="bar"></div><div class="knob" style="left:${mentIdx / 4 * 100}%"></div></div><div class="labels">${mentLbls}</div></div>
          <div class="between" style="margin-bottom:5px"><div class="label">Takım Odağı</div><div class="mono" style="font-size:10px;color:${fLeft > 0 ? 'var(--green-d)' : '#9aa1ac'};font-weight:700">Kalan puan: ${fLeft} / ${FOCUS_BUDGET}</div></div>
          <div class="muted" style="font-size:10.5px;margin-bottom:11px;line-height:1.4">Tüm puanlar sende — alanlara dağıt. Dolu bir kademeye tekrar dokun → düşür (0'a kadar inebilir).</div>
          <div style="display:grid;gap:11px">${focusRows}</div>
        </div>

        <div class="tactics-col" style="display:flex;flex-direction:column;align-items:center">
          <div class="flexc" style="gap:16px;margin-bottom:12px;font:700 11px 'Hanken Grotesk';color:#5a626e">
            <span class="muted" style="font-weight:600">Görev:</span>
            <span class="flexc" style="gap:5px"><span style="width:10px;height:10px;border-radius:50%;background:#e5484d"></span>Hücum</span>
            <span class="flexc" style="gap:5px"><span style="width:10px;height:10px;border-radius:50%;background:#d9a017"></span>Denge</span>
            <span class="flexc" style="gap:5px"><span style="width:10px;height:10px;border-radius:50%;background:#3b6fe0"></span>Savunma</span>
          </div>
          <div class="pitch" style="width:100%;max-width:430px;aspect-ratio:68/100">${PITCH_LINES}${tokens}</div>
          <div class="flexc" style="gap:14px;margin-top:14px;font:600 11.5px 'Hanken Grotesk';color:#6a7280">
            <span>Diziliş <b style="color:#14181f">${me.formation}</b></span><span style="color:#d4d8de">·</span>
            <span>Tıkla-seç-yer değiştir</span><span style="color:#d4d8de">·</span>
            <span style="color:${filled === 11 ? '#13a76a' : '#e5484d'}">${filled}/11 dolu</span>
          </div>
        </div>

        <div class="rail left">
          <div style="text-align:center"><div class="label" style="font-size:10px">Yedekler</div><div class="mono" style="color:#9aa1ac;font-size:9px;margin-top:3px">${benchList(me).length} oyuncu</div></div>
          ${bench}
          <div style="margin-top:6px;font:600 8.5px 'Hanken Grotesk';color:#aeb4be;text-align:center;line-height:1.3">seç →<br>sahaya at</div>
        </div>

        <div class="tactics-col bl">${tacticsRightPanel(selPlayer, sel)}</div>
      </div>
      <div class="flexc" style="justify-content:flex-end;margin-top:16px;gap:12px">
        ${isOnline() ? `<div class="muted flexc" style="gap:7px;font-size:12px"><span style="width:9px;height:9px;border-radius:50%;background:${G.tactics && G.tactics.oppReady ? '#19c37d' : '#cbd1d8'}"></span>Rakip ${G.tactics && G.tactics.oppReady ? 'hazır ✓' : 'taktik yapıyor…'}</div>` : ''}
        <button class="btn btn-green" id="ready-match" ${isOnline() && G.tactics && G.tactics.ready ? 'disabled' : ''}>${isOnline() && G.tactics && G.tactics.ready ? T('Rakip bekleniyor…') : T('Maça Hazırım →')}</button>
      </div>
    </div>`;
  }
  function tacticsRightPanel(p, sel) {
    if (!p) return `<div style="border:1px dashed var(--line);border-radius:12px;padding:18px;background:#fbfcfd">
      <div style="font:700 12px 'Hanken Grotesk';color:#3a4250;margin-bottom:6px">Bir oyuncu seç</div>
      <div class="muted" style="font-size:11.5px;line-height:1.5">Sahadaki ya da yedekteki bir oyuncuya dokun → rolü, görevi ve oynayabildiği mevkiler burada açılır. İki oyuncuya sırayla dokunarak yerlerini değiştir.</div></div>`;
    const onPitch = typeof sel === 'number';
    const curPos = onPitch ? FORMATIONS[G.me.formation][sel][0] : p.pos;
    const posChips = p.positions.map(pos => {
      const f = onPitch ? fitLevel({ positions: [pos] }, curPos) : 'high';
      const cls = f === 'high' ? 'high' : f === 'mid' ? 'mid' : '';
      return `<span class="chip ${cls}">${pos}</span>`;
    }).join('');
    const curFit = onPitch ? fitLevel(p, curPos) : 'high';
    const fm = FIT_META[curFit];
    const roles = (ROLES[curPos] || ROLES[p.pos] || []).map(r =>
      `<div class="role-opt ${p.role === r ? 'sel' : ''}" data-role="${r}">${r}${p.role === r ? ' <span class="mono">✓</span>' : ''}</div>`).join('');
    const tasks = TASKS.map(t => {
      const col = TASK_COL[t]; const on = (p.task || defaultTask(curPos)) === t;
      return `<div class="t ${on ? 'sel' : ''}" data-task="${t}" style="${on ? `border:1.5px solid ${col};background:${col}1a;color:${col}` : ''}">${t}</div>`;
    }).join('');
    return `<div class="card" style="overflow:hidden;margin-bottom:16px">
      <div class="flexc" style="gap:11px;padding:13px;background:#f4f8fe;border-bottom:1px solid var(--line2)">
        <div style="width:36px;height:36px;border-radius:9px;background:${G.me.color};display:flex;align-items:center;justify-content:center;font:800 12px var(--mono);color:#fff">${shortOf(p)}</div>
        <div><div style="font-family:var(--arch);font-weight:800;font-size:15px">${p.name}</div><div class="mono" style="font-size:10.5px;color:#9aa1ac">${onPitch ? POS[curPos].name : p.pos} · Güç ${p.ovr} · ${p.age} yaş · ${p.height || '–'}cm</div></div>
      </div>
      <div style="padding:13px">
        <div class="flexc" style="gap:6px;flex-wrap:wrap;margin-bottom:11px"><span class="flexbadge" style="color:#7c5cd6;background:#f3eefe">${p.type || p.pos}</span><span class="chip">${p.height || '–'} cm</span><span class="chip">${p.age} yaş</span></div>
        <div class="label" style="font-size:10px;margin-bottom:8px">Oynayabildiği Mevkiler</div>
        <div class="flexc" style="gap:5px;flex-wrap:wrap;margin-bottom:6px">${posChips}</div>
        ${onPitch ? `<div style="font:600 11px 'Hanken Grotesk';color:${fm.col};margin-bottom:13px">Bu mevkide uyum: <b>${fm.label}</b>${curFit === 'low' ? ' — kötü oynar' : curFit === 'none' ? ' — bu mevkide oynayamaz' : ''}</div>` : '<div style="margin-bottom:13px"></div>'}
        <div class="label" style="font-size:10px;margin-bottom:8px">Rol</div>
        <div style="display:grid;gap:6px;margin-bottom:14px">${roles}</div>
        <div class="label" style="font-size:10px;margin-bottom:8px">Sahadaki Görevi</div>
        <div class="task-seg">${tasks}</div>
      </div>
    </div>
    <div class="muted" style="font-size:11px;line-height:1.5">Yer değiştirmek için: bu oyuncu seçiliyken başka bir oyuncuya / boş slota dokun.</div>`;
  }
  function bindTactics() {
    const me = G.me;
    document.querySelectorAll('[data-formation]').forEach(b => b.onclick = () => {
      const nf = b.dataset.formation; const old = me.lineup.slice();
      me.formation = nf; me.lineup = Array(11).fill(null);
      old.forEach((p, i) => { if (p && i < 11) me.lineup[i] = p; });
      const slots = FORMATIONS[nf]; me.lineup.forEach((p, i) => { if (p) p.task = p.task || defaultTask(slots[i][0]); });
      G.tactics.sel = null; render();
    });
    document.querySelectorAll('[data-phil]').forEach(b => b.onclick = () => { me.philosophy = b.dataset.phil; render(); });
    document.querySelectorAll('[data-focus]').forEach(b => b.onclick = () => { if (setFocus(me, b.dataset.focus, +b.dataset.val)) render(); });
    bindMentSlider(document.querySelector('#screen-root .ment-track'), idx => { me.mentality = MENTALITIES[idx]; });
    document.querySelectorAll('[data-tslot]').forEach(s => s.onclick = () => handleTacticsClick({ type: 'slot', i: +s.dataset.tslot }));
    document.querySelectorAll('[data-tbench]').forEach(s => s.onclick = () => handleTacticsClick({ type: 'bench', i: +s.dataset.tbench }));
    enableDnd('#screen-root [data-tslot],#screen-root [data-tbench]', (src, dst) => { clearFits(); applySwap(src, dst); G.tactics.sel = null; render(); },
      { onStart: (spec) => highlightFits(specPlayer(spec), '#screen-root'), onStop: clearFits });
    document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { const p = curSelPlayer(); if (p) { p.role = b.dataset.role; render(); } });
    document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => { const p = curSelPlayer(); if (p) { p.task = b.dataset.task; render(); } });
    document.getElementById('ready-match').onclick = () => {
      if (me.lineup.filter(Boolean).length < 11) { toast('İlk 11 eksik — tüm slotları doldur'); return; }
      if (isOnline()) { onlineReady(); return; }
      goMatch();
    };
  }
  function curSelPlayer() {
    const sel = G.tactics.sel; if (sel == null) return null;
    return typeof sel === 'number' ? G.me.lineup[sel] : benchList(G.me)[sel.idx];
  }
  function selToSpec(sel) { return typeof sel === 'number' ? { type: 'slot', i: sel } : { type: 'bench', i: sel.idx }; }
  function fixTask(i) { const me = G.me, p = me.lineup[i]; if (p) { const sp = FORMATIONS[me.formation][i][0]; p.task = p.task || defaultTask(sp); } }
  function applySwap(a, b) {
    if (a.type === b.type && a.i === b.i) return;
    const me = G.me, benchArr = benchList(me);
    const getP = sp => sp.type === 'slot' ? me.lineup[sp.i] : benchArr[sp.i];
    const A = getP(a), B = getP(b);
    // sakat oyuncu ilk 11 slotuna konamaz
    if ((a.type === 'slot' && isInjured(B)) || (b.type === 'slot' && isInjured(A))) { toast('Sakat oyuncu ilk 11\'e alınamaz'); return; }
    if (a.type === 'slot' && b.type === 'slot') {
      me.lineup[a.i] = B || null; me.lineup[b.i] = A || null; fixTask(a.i); fixTask(b.i);
    } else if (a.type === 'bench' && b.type === 'bench') {
      const ia = me.bench.indexOf(A), ib = me.bench.indexOf(B); if (ia >= 0 && ib >= 0) { me.bench[ia] = B; me.bench[ib] = A; }
    } else {
      const slotSpec = a.type === 'slot' ? a : b;
      const benchP = a.type === 'bench' ? A : B;
      const slotP = me.lineup[slotSpec.i];
      const rb = me.bench.indexOf(benchP);
      me.lineup[slotSpec.i] = benchP || null;
      if (rb >= 0) me.bench[rb] = slotP || null; else if (slotP) { const e = me.bench.indexOf(null); if (e >= 0) me.bench[e] = slotP; else me.bench.push(slotP); }
      fixTask(slotSpec.i);
    }
  }
  /* Tıklama yalnızca SEÇER (rol/görev panelini açar). Yer değiştirme yalnızca sürükle-bırakla. */
  function handleTacticsClick(target) {
    const me = G.me, sel = G.tactics.sel;
    if (target.type === 'slot') {
      if (!me.lineup[target.i]) { G.tactics.sel = null; render(); return; }
      G.tactics.sel = (typeof sel === 'number' && sel === target.i) ? null : target.i;
    } else {
      const same = sel && sel.bench && sel.idx === target.i;
      G.tactics.sel = same ? null : { bench: true, idx: target.i };
    }
    render();
  }
  /* Mentalite slider — sürüklenebilir; render etmeden yerinde günceller */
  function bindMentSlider(track, onIdx) {
    if (!track) return;
    const rail = track.querySelector('.ment-rail') || track;
    const knob = track.querySelector('.knob');
    const labels = [...track.querySelectorAll('.labels span')];
    const set = (clientX) => {
      const r = rail.getBoundingClientRect(); let ratio = r.width ? (clientX - r.left) / r.width : 0;
      ratio = Math.max(0, Math.min(1, ratio)); const idx = Math.round(ratio * 4);
      if (knob) knob.style.left = (idx / 4 * 100) + '%';
      labels.forEach((l, i) => l.classList.toggle('sel', i === idx));
      onIdx(idx);
    };
    let dn = false;
    track.style.cursor = 'pointer';
    track.addEventListener('pointerdown', e => { dn = true; try { track.setPointerCapture(e.pointerId); } catch (_) {} set(e.clientX); });
    track.addEventListener('pointermove', e => { if (dn) set(e.clientX); });
    const up = () => { dn = false; }; track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
  }
  /* Sürükle-bırak ile yer değiştirme (saha + yedek) */
  function specPlayer(spec) { return spec.type === 'slot' ? G.me.lineup[spec.i] : benchList(G.me)[spec.i]; }
  function highlightFits(player, scopeSel) {
    if (!player) return;
    const slots = FORMATIONS[G.me.formation];
    document.querySelectorAll((scopeSel || '') + ' [data-tslot], ' + (scopeSel || '') + ' [data-pslot]').forEach(el => {
      const i = +(el.dataset.tslot != null ? el.dataset.tslot : el.dataset.pslot);
      const f = fitLevel(player, slots[i][0]); el.classList.add('fit-' + f);
    });
  }
  function clearFits() { document.querySelectorAll('.fit-high,.fit-mid,.fit-low,.fit-none').forEach(el => el.classList.remove('fit-high', 'fit-mid', 'fit-low', 'fit-none')); }
  function enableDnd(selector, onDrop, opts) {
    const specStr = el => el.dataset.tslot != null ? ('s' + el.dataset.tslot) : ('b' + el.dataset.tbench);
    const parse = s => s[0] === 's' ? { type: 'slot', i: +s.slice(1) } : { type: 'bench', i: +s.slice(1) };
    document.querySelectorAll(selector).forEach(el => {
      // güncel closure'ları düğümde sakla
      el._onDrop = onDrop; el._dndOpts = opts;
      // ÖNEMLİ: morph her render'da new HTML'de olmayan `draggable` attribute'unu siler → HER render'da yeniden uygula
      // (yalnızca ilk sürükleme çalışıp sonra bozulmasının kök nedeni buydu).
      el.setAttribute('draggable', 'true');
      // listener'lar yalnızca bir kez (morph node'u yeniden kullandığı için birikmesinler)
      if (el._dndBound) return;
      el._dndBound = true;
      el.addEventListener('dragstart', e => {
        if (el.classList.contains('empty')) { e.preventDefault(); return; }   // boş slot sürüklenemez (doluyken çalışır)
        e.dataTransfer.setData('text/plain', specStr(el)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging');
        if (el._dndOpts && el._dndOpts.onStart) el._dndOpts.onStart(parse(specStr(el)));
      });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); if (el._dndOpts && el._dndOpts.onStop) el._dndOpts.onStop(); });
      el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop-target'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('drop-target');
        const src = e.dataTransfer.getData('text/plain'); if (!src) return;
        const dst = specStr(el); if (src === dst) return;
        el._onDrop(parse(src), parse(dst));
      });
    });
  }

  /* ============================================================
     5 · MAÇ (canlı)
     ============================================================ */
  function goMatch() {
    if (!isOnline()) aiSetupLineup(G.opp);   // online'da rakip dizilişi "Hazır"da geldi
    syncSquads();
    G.match = { panelOpen: false, panelMode: 'subs', subsLeft: 2, subOut: null, subIn: null, sel: null, aiSubbed: false, ended: false, halftime: false, stats: { possA: 50, possB: 50, shotsA: 0, shotsB: 0, sotA: 0, sotB: 0 }, evHTML: '' };
    G.screen = 'match';
    render();
  }
  function matchHTML() {
    const s = G.series;
    const pipsTotal = s.format;
    const pips = [];
    for (let i = 0; i < pipsTotal; i++) {
      const m = s.matches[i];
      let bg = '#3b6fe0;opacity:.3;border:1px dashed #3b6fe0';
      if (m) bg = m.winner === 'a' ? G.me.color : G.opp.color;
      pips.push(`<span class="pip" style="background:${m ? (m.winner === 'a' ? G.me.color : G.opp.color) : 'transparent'};${m ? '' : 'opacity:.4;border:1px dashed #2a3f63'}"></span>`);
    }
    return `<div class="screen">
      ${head('05', 'Maç ' + s.matchNo + ' — Canlı Simülasyon', '2D canlı maç · oyuncular ve top gerçek zamanlı hareket eder · maç içi taktik ve oyuncu değişikliği.')}
      <div class="match-frame" id="match-frame">
        <div class="scoreboard">
          <div class="flexc" style="gap:13px;flex:1;justify-content:flex-end">
            <div style="text-align:right"><div class="nm">${G.me.name}</div><div class="sub">${G.me.formation} · ${G.me.philosophy}</div></div>
            <div class="sw" style="background:${G.me.color}"></div>
          </div>
          <div class="flexc" style="gap:16px;margin:0 26px">
            <div class="score" id="sb-a">0</div>
            <div style="text-align:center"><div class="live-badge"><span class="dot"></span>CANLI</div><div class="mono" id="sb-clock" style="font-weight:800;font-size:17px;color:#14181f;margin-top:6px">0'</div></div>
            <div class="score" id="sb-b">0</div>
          </div>
          <div class="flexc" style="gap:13px;flex:1">
            <div class="sw" style="background:${G.opp.color}"></div>
            <div><div class="nm">${G.opp.name}</div><div class="sub">${G.opp.formation} · <span style="color:#9aa1ac">taktik gizli</span></div></div>
          </div>
        </div>
        <div class="series-pips">
          <span style="font:600 10px 'Hanken Grotesk';color:#6a7280;letter-spacing:.08em">SERİ Bo${s.format} · MAÇ ${s.matchNo}</span>
          ${pips.join('')}
          <span class="mono" style="font-weight:700;font-size:11px;color:#3a4250">${s.winsA} — ${s.winsB}</span>
        </div>
        <div class="match-body">
          <div class="match-left">
            <div class="match-canvas"><canvas id="match-canvas"></canvas></div>
            <div class="match-under">
              <div class="pressure">
                <span class="pr-name" style="color:${G.me.color}">${G.me.name}</span>
                <div class="pr-bar"><div id="pr-fill" style="background:${G.me.color}"></div><div class="pr-rest" style="background:${G.opp.color}"></div><div id="pr-knob"></div></div>
                <span class="pr-name" style="text-align:right;color:${G.opp.color}">${G.opp.name}</span>
              </div>
              <div class="pr-label"><span>◀ baskı</span><span>BASKIMETRE</span><span>baskı ▶</span></div>
              <div class="commentary" id="commentary"><div class="cm-line cm-info">📣 Maç başlamak üzere…</div></div>
            </div>
          </div>
          <div class="match-side">
            <div class="between" style="margin-bottom:9px"><span class="lbl">${T('Maç Hızı')}</span><span class="mono" id="spd-lbl" style="font-size:10px;color:#19c37d">1× ${T('hız')}</span></div>
            <div style="display:flex;gap:6px;margin-bottom:12px" id="spd-row">
              ${[0.5, 1, 2, 4].map(v => `<div class="spd ${v === 1 ? 'sel' : ''}" data-spd="${v}">${v}×</div>`).join('')}
            </div>
            <div class="match-btn" id="toggle-view" style="margin-bottom:18px">${T('🎥 Görünüm: ')}<span id="view-lbl">3D</span></div>
            <div class="lbl" style="margin-bottom:11px">${T('Maç İstatistiği')}</div>
            <div id="st-box" style="display:grid;gap:11px;margin-bottom:18px">${statBars(G.match.stats)}</div>
            <div class="events-box">
              <div class="events-head"><span class="lbl" style="color:#3a4250">${T('⚡ Olaylar')}</span></div>
              <div id="ev-box" class="ev-list">${G.match.evHTML || `<div class="muted" style="font-size:11px;padding:8px">${T('Henüz olay yok…')}</div>`}</div>
            </div>
            <div class="lbl" style="margin:14px 0 9px">${T('Maç İçi')}</div>
            <div class="match-btn" id="open-tactics" style="margin-bottom:8px">${T('⚙ Taktik & Diziliş')}</div>
            <div class="match-btn green" id="open-subs" style="margin-bottom:8px">${T('⇄ Oyuncu Değiştir')} <span style="background:rgba(255,255,255,.22);padding:1px 7px;border-radius:6px;font:700 11px var(--mono)" id="subs-left">${G.match.subsLeft} ${T('hak')}</span></div>
            <div class="match-btn" id="open-oppview">${T('👁 Rakip Dizilişi')}</div>
          </div>
        </div>
        <div id="match-overlay"></div>
      </div>
      <div style="margin-top:10px;font:600 12px 'Hanken Grotesk';color:#9aa1ac" class="flexc"><span style="width:8px;height:8px;border-radius:50%;background:#19c37d;margin-right:7px"></span>Canlı: oyuncular ve top gerçek zamanlı hareket ediyor; skor ve süre ilerliyor.</div>
    </div>`;
  }
  function statBars(st) {
    const bar = (a, b, label, colA, colB) => {
      const tot = a + b || 1; const wa = Math.round(a / tot * 100);
      return `<div class="stat-bar"><div class="top"><span>${a}</span><span class="mid">${label}</span><span>${b}</span></div>
        <div class="track" style="background:${colB}"><div style="height:100%;width:${wa}%;background:${colA}"></div></div></div>`;
    };
    const poss = `<div class="stat-bar"><div class="top"><span>${st.possA}%</span><span class="mid">${T('Topa Sahip Olma')}</span><span>${st.possB}%</span></div>
      <div class="track" style="background:${G.opp.color}"><div style="height:100%;width:${st.possA}%;background:${G.me.color}"></div></div></div>`;
    const xgA = st.xgA || 0, xgB = st.xgB || 0; const xgTot = xgA + xgB || 1; const xgW = Math.round(xgA / xgTot * 100);
    const xg = `<div class="stat-bar"><div class="top"><span>${xgA.toFixed(2)}</span><span class="mid">${T('xG (Beklenen Gol)')}</span><span>${xgB.toFixed(2)}</span></div>
      <div class="track" style="background:${G.opp.color}"><div style="height:100%;width:${xgW}%;background:${G.me.color}"></div></div></div>`;
    return poss + bar(st.shotsA, st.shotsB, T('Şut'), G.me.color, G.opp.color) + bar(st.sotA, st.sotB, T('İsabetli Şut'), G.me.color, G.opp.color)
      + xg + bar(st.cornersA || 0, st.cornersB || 0, T('Korner'), G.me.color, G.opp.color) + bar(st.foulsA || 0, st.foulsB || 0, T('Faul'), G.me.color, G.opp.color);
  }
  function pushCommentary(text, type) {
    const box = document.getElementById('commentary'); if (!box) return;
    const cls = { goal: 'cm-goal', shot: 'cm-shot', save: 'cm-save', foul: 'cm-foul', card: 'cm-card', attack: 'cm-attack', turn: 'cm-turn', half: 'cm-half', set: 'cm-set', end: 'cm-end', inj: 'cm-foul' }[type] || 'cm-info';
    const icon = { goal: '🥅', shot: '🎯', save: '🧤', foul: '⚠️', card: '🟨', attack: '⚡', turn: '🔄', half: '⏸', set: '🚩', end: '🏁', inj: '➕' }[type] || '📣';
    box.insertAdjacentHTML('afterbegin', `<div class="cm-line ${cls}">${icon} ${text}</div>`);
    while (box.children.length > 6) box.removeChild(box.lastChild);
  }
  function setPressure(m) {
    const fill = document.getElementById('pr-fill'), knob = document.getElementById('pr-knob');
    const pct = Math.round((m + 1) / 2 * 100);
    if (fill) fill.style.width = pct + '%';
    if (knob) knob.style.left = pct + '%';
  }
  function evRowHTML(ev) {
    const k = ev.type === 'goal' ? '#19c37d' : ev.type === 'sub' ? '#3b6fe0' : ev.type === 'inj' ? '#ff5d7d' : '#eab308';
    const icon = ev.type === 'goal' ? '⚽ ' : ev.type === 'sub' ? '⇄ ' : ev.type === 'inj' ? '➕ ' : '';
    return `<div class="ev"><span class="t">${ev.t}</span><span class="k" style="background:${k}"></span><span class="x">${icon}${ev.txt}</span></div>`;
  }
  function bindMatch() {
    const cv = document.getElementById('match-canvas');
    if (isOnline() && !amHost()) { bindGuestMatch(cv); return; }   // guest: yalnızca render
    const online = isOnline();
    const live = new LiveMatch(cv, G.me, G.opp, {
      mustWin: true,   // eleme maçı: beraberlikte uzatma + penaltı atışları
      onUpdate: (u) => {
        G.match.stats = u.stats; G.match.curClock = u.clock;
        const a = document.getElementById('sb-a'), b = document.getElementById('sb-b'), c = document.getElementById('sb-clock');
        if (a) a.textContent = u.a; if (b) b.textContent = u.b; if (c) c.textContent = u.clockStr || (u.clock + "'");
        const st = document.getElementById('st-box'); if (st) st.innerHTML = statBars(u.stats);
        if (u.momentum != null) setPressure(u.momentum);
        if (online) netSend({ t: 'm-update', a: u.a, b: u.b, clock: u.clock, clockStr: u.clockStr, stats: u.stats, momentum: u.momentum });
        // YZ değişikliği ~ 58-72' (yalnızca AI modunda)
        if (!online && !G.match.aiSubbed && u.clock >= 58 + randi(0, 14)) { G.match.aiSubbed = true; aiInMatchSub(); }
        // YZ sakatlanan oyuncusunu hemen değiştirmeye çalışır
        if (!online && G.opp.lineup.some(p => p && p._inMatchInjured)) aiInMatchSub();
      },
      onEvent: (ev) => {
        const box = document.getElementById('ev-box');
        if (box) { if (box.querySelector('.muted')) box.innerHTML = ''; box.insertAdjacentHTML('afterbegin', evRowHTML(ev)); while (box.children.length > 14) box.removeChild(box.lastChild); G.match.evHTML = box.innerHTML; }
        if (online) netSend({ t: 'm-event', ev });
      },
      onCommentary: (txt, type) => { pushCommentary(txt, type); if (online) netSend({ t: 'm-comm', txt, type }); },
      onHalftime: (kind) => { if (online) onlineHalftimeHost(kind); else openHalftime(kind); },
      onSound: (t) => { if (window.KD_SFX) KD_SFX.play(t); },
      onEnd: (res) => onMatchEnd(res),
    });
    G.match.live = live;
    window.scrollTo(0, 0);   // maç ekranına gelince yukarı sabitle
    live.start();
    if (online) startHostStream(live);
    document.querySelectorAll('[data-spd]').forEach(b => b.onclick = () => {
      const v = +b.dataset.spd; live.setSpeed(v);
      document.querySelectorAll('.spd').forEach(x => x.classList.toggle('sel', +x.dataset.spd === v));
      document.getElementById('spd-lbl').textContent = v + '× hız';
    });
    document.getElementById('open-tactics').onclick = () => openPanel('tactics');
    document.getElementById('open-subs').onclick = () => openPanel('subs');
    document.getElementById('open-oppview').onclick = () => openOppView();
    setupView3D(live);
  }
  /* 2D ⇄ 3D görünüm toggle'ı. WebGL/THREE yoksa butonu gizler, 2D'de kalır. */
  function setupView3D(live) {
    const btn = document.getElementById('toggle-view'), lbl = document.getElementById('view-lbl');
    if (!btn) return;
    if (window._kdR3d) { try { window._kdR3d.dispose(); } catch (_) {} window._kdR3d = null; }   // önceki maçın WebGL context'ini bırak
    const r3d = (window.KD_RENDER3D) ? KD_RENDER3D.create(live) : null;
    window._kdR3d = r3d;
    if (!r3d) { btn.style.display = 'none'; return; }   // 3D kurulamadı → 2D fallback
    live.r3d = r3d;
    let on = localStorage.getItem('kd_view3d') !== '0';   // varsayılan 3D açık
    const apply = () => { r3d.setActive(on); if (lbl) lbl.textContent = on ? '3D' : '2D'; btn.classList.toggle('green', on); live.draw(); };
    btn.onclick = () => { on = !on; localStorage.setItem('kd_view3d', on ? '1' : '0'); apply(); };
    apply();
  }
  function aiInMatchSub() {
    const dec = AI.subDecision(G.opp);
    if (!dec) return;
    const out = G.opp.lineup[dec.outIndex], inP = dec.inPlayer;
    const bi = G.opp.bench.indexOf(inP);
    G.opp.lineup[dec.outIndex] = inP; if (bi >= 0) G.opp.bench[bi] = out; else { const e = G.opp.bench.indexOf(null); if (e >= 0) G.opp.bench[e] = out; else G.opp.bench.push(out); }
    if (G.match.live) G.match.live.refreshStrength && G.match.live.refreshStrength();
    logSub(inP, out, G.opp);
  }

  /* ----- maç içi panel ----- */
  function openPanel(mode) {
    G.match.panelOpen = true; G.match.panelMode = mode;
    if (G.match.live && !isOnline()) G.match.live.stop();   // online: rakip beklemesin, maç akmaya devam etsin
    renderPanel();
  }
  /* Rakip dizilişini görüntüle — gerçek formasyon + oyuncular, taktikler GİZLİ */
  function openOppView() {
    if (G.match.live && !isOnline()) G.match.live.stop();
    const opp = G.opp, slots = FORMATIONS[opp.formation];
    const cards = opp.lineup ? opp.lineup.map((p, i) => {
      if (!p) return '';
      const [sp, x, y] = slots[i];
      return `<div class="tok" style="left:${x}%;top:${y}%"><div class="dot" style="background:${sp === 'KL' ? '#d9a017' : opp.color}">${shortOf(p)}<span class="ovr">${p.ovr}</span></div><div class="nm">${p.name}</div></div>`;
    }).join('') : '';
    const o = document.getElementById('match-overlay'); if (!o) return;
    o.innerHTML = `<div class="overlay"><div class="panel" style="max-width:540px">
      <div class="panel-head"><div class="flexc" style="gap:11px"><div style="width:30px;height:30px;border-radius:8px;background:${opp.color};display:flex;align-items:center;justify-content:center;font-size:15px">👁</div>
        <div><div style="font-family:var(--arch);font-weight:800;font-size:15px">${opp.name} · Diziliş</div><div style="font:600 11px 'Hanken Grotesk';color:#8b929d">${opp.formation} · felsefe/mentalite/odak gizli</div></div></div>
        <div class="panel-close" id="oppview-close">×</div></div>
      <div style="padding:16px;display:flex;flex-direction:column;align-items:center;background:#fbfcfd">
        <div class="pitch" style="width:100%;max-width:330px;aspect-ratio:68/100">${PITCH_LINES}${cards}</div>
        <div class="muted" style="font-size:11.5px;margin-top:12px;text-align:center">Rakibin gerçek formasyonu ve oyuncuları. Taktik ayrıntıları (felsefe, mentalite, odak) gizli.</div>
      </div>
      <div class="panel-foot"><div class="muted" style="font-size:11px">Casus raporu 🔍</div><button class="btn btn-green" id="oppview-ok" style="padding:10px 22px">Kapat</button></div>
    </div></div>`;
    const close = () => { const ov = document.getElementById('match-overlay'); if (ov) ov.innerHTML = ''; if (G.match.live && !G.match.live.ended && !isOnline()) G.match.live.start(); };
    document.getElementById('oppview-close').onclick = close;
    document.getElementById('oppview-ok').onclick = close;
  }
  /* Devre arası: motor 'paused' fazında (oyuncular tünelde), loop dönmeye devam eder.
     Paneli aç ama loop'u durdurma — kullanıcı taktik yapar, sonra 2. yarıyı başlatır. */
  function openHalftime(kind) {
    G.match.halftime = true; G.match.htKind = kind || 'normal'; G.match.panelOpen = true; G.match.panelMode = 'tactics';
    renderPanel();
  }
  function resumeHalftime() {
    if (isOnline()) { onlineResumeClick(); return; }
    G.match.halftime = false; G.match.panelOpen = false;
    const o = document.getElementById('match-overlay'); if (o) o.innerHTML = '';
    if (G.match.live) G.match.live.resumeSecondHalf();
  }
  function closePanel() {
    G.match.panelOpen = false;
    const o = document.getElementById('match-overlay'); if (o) o.innerHTML = '';
    if (G.match.live && !G.match.live.ended && !isOnline()) G.match.live.start();   // online'da motor zaten durmadı
  }
  function renderPanel() {
    const o = document.getElementById('match-overlay'); if (!o) return;
    const me = G.me, mode = G.match.panelMode;
    const slots = FORMATIONS[me.formation];
    const tokens = slots.map((s, i) => {
      const [sp, x, y] = s; const p = me.lineup[i]; if (!p) return '';
      const task = p.task || defaultTask(sp); const tc = TASK_COL[task];
      const off = mode === 'subs' && G.match.subOut === i;
      const isSel = mode === 'tactics' && G.match.sel === i;
      const carded = G.match.live && G.match.live.cards && G.match.live.cards[p.id];
      const stam = G.match.live && G.match.live.players ? Math.round(G.match.live.players[i].stam) : 100;
      const stCol = stam >= 70 ? '#19c37d' : stam >= 45 ? '#eab308' : '#e5484d';
      return `<div class="tok ${isSel ? 'sel' : ''}" data-pslot="${i}" style="left:${x}%;top:${y}%">
        <div class="dot" style="background:${sp === 'KL' ? '#d9a017' : me.color};${off ? 'box-shadow:0 0 0 3px #e5484d' : ''}">${shortOf(p)}<span class="ovr">${p.ovr}</span><span class="task" style="background:${tc}"></span>${carded ? '<span class="card-mark"></span>' : ''}</div>
        <div class="stam-bar" title="Enerji ${stam}%"><div style="width:${stam}%;background:${stCol}"></div></div>
        <div class="nm" style="${carded ? 'color:#b8870a;font-weight:800' : ''}">${p.name}${carded ? ' 🟨' : ''}</div>${off ? '<span class="tasklbl" style="background:#e5484d">↓ Çıkıyor</span>' : ''}</div>`;
    }).join('');
    const fmts = FORMATION_NAMES.map(n => `<div class="fmt-mini ${me.formation === n ? 'sel' : ''}" data-pformation="${n}">${n}</div>`).join('');
    const mentIdx = MENTALITIES.indexOf(me.mentality);
    const pLeft = FOCUS_BUDGET - focusUsed(me);
    const focusRows = FOCUS_KEYS.map(k => { const v = me.focus[k] || 0;
      return `<div><div class="between" style="margin-bottom:4px"><span style="font:600 10.5px 'Hanken Grotesk';color:#3a4250">${k}</span><span class="mono" style="font-size:9px;color:#9aa1ac">${v}</span></div><div class="focus-seg">${[1, 2, 3].map(n => `<div class="s ${v >= n ? 'on' : ''}" data-pfocus="${k}" data-val="${n}"></div>`).join('')}</div></div>`; }).join('');

    let rightPanel;
    if (mode === 'subs') {
      const out = G.match.subOut != null ? me.lineup[G.match.subOut] : null;
      const benchRows = benchList(me).map((b, i) => {
        const pos = out != null ? FORMATIONS[me.formation][G.match.subOut][0] : b.pos;
        const f = fitLevel(b, pos); const fm = FIT_META[f];
        const on = G.match.subIn === b.id;
        const inj = isInjured(b);
        // top (jeton) şeklinde yedek oyuncu
        return `<div class="sub-tok ${on ? 'on' : ''} ${inj ? 'inj' : ''}" data-pin="${b.id}" title="${b.name} · ${b.age} yaş · ${inj ? 'SAKAT (oynayamaz)' : fm.label + ' uyum'}">
          <div class="dot" style="background:${b.pos === 'KL' ? '#d9a017' : me.color};${on ? 'box-shadow:0 0 0 3px #19c37d,0 4px 10px -3px rgba(0,0,0,.45)' : ''}">${shortOf(b)}<span class="ovr">${b.ovr}</span></div>
          <div class="bn">${b.name.split('. ')[1] || b.name}</div>
          <div class="bf" style="background:${inj ? '#fde2e8' : fm.bg};color:${inj ? '#e5484d' : fm.col}">${inj ? '➕ Sakat' : fm.label}</div></div>`;
      }).join('');
      rightPanel = `<div class="between" style="margin-bottom:11px"><div class="label" style="font-size:10px">Oyuncu Değişikliği</div><div class="mono" style="color:#13a76a;background:#e7f8f0;padding:3px 8px;border-radius:6px;font-size:10px">${G.match.subsLeft} hak</div></div>
        ${out ? `<div style="border:1.5px solid #f3c6c8;background:#fdeced;border-radius:11px;padding:10px 11px;display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:32px;height:32px;border-radius:9px;background:#e5484d;display:flex;align-items:center;justify-content:center;font:800 10px var(--mono);color:#fff">${shortOf(out)}</div><div style="flex:1"><div style="font-family:var(--arch);font-weight:800;font-size:13px">${out.name}</div><div class="mono" style="font-size:9px;color:#cf8589">${out.pos} · Güç ${out.ovr}</div></div><div style="font:800 8.5px 'Hanken Grotesk';color:#e5484d;background:#fff;border:1px solid #f3c6c8;padding:4px 7px;border-radius:6px">↓ ÇIKIYOR</div></div>` : '<div class="muted" style="font-size:11.5px;margin-bottom:10px">Sahadan çıkacak oyuncuya dokun.</div>'}
        <div style="text-align:center;font-size:15px;color:#9aa1ac;margin:1px 0 8px">⇅</div>
        <div class="label" style="font-size:10px;margin-bottom:8px">Yedekten Gelecek ${out ? '<span class="muted" style="font-weight:600;text-transform:none">· dokun, anında değişir</span>' : ''}</div>
        <div class="sub-tok-grid">${benchRows}</div>
        <div class="muted" style="font-size:10.5px;margin-top:8px;text-align:center">İpucu: çıkanı seç → geleni seç (anında) · yedeği sahaya sürükle · sahadaki ikiyi birbirine sürükle = yer değiştir</div>
        <button class="btn btn-green" id="apply-sub" style="width:100%;margin-top:10px;font-size:12.5px;padding:10px" ${G.match.subOut != null && G.match.subIn != null && G.match.subsLeft > 0 ? '' : 'disabled'}>Değişikliği Uygula</button>`;
    } else {
      const sel = G.match.sel != null ? me.lineup[G.match.sel] : null;
      if (sel) {
        const curPos = FORMATIONS[me.formation][G.match.sel][0];
        const roles = (ROLES[curPos] || []).map(r => `<div class="role-opt ${sel.role === r ? 'sel' : ''}" data-prole="${r}">${r}${sel.role === r ? ' <span class="mono">✓</span>' : ''}</div>`).join('');
        const tasks = TASKS.map(t => { const col = TASK_COL[t]; const on = (sel.task || defaultTask(curPos)) === t; return `<div class="t ${on ? 'sel' : ''}" data-ptask="${t}" style="${on ? `border:1.5px solid ${col};background:${col}1a;color:${col}` : ''}">${t}</div>`; }).join('');
        rightPanel = `<div class="label" style="font-size:10px;margin-bottom:9px">Seçili Oyuncu · Rol</div>
          <div class="flexc" style="gap:10px;background:#f4f8fe;border:1px solid var(--line);border-radius:10px;padding:9px 10px;margin-bottom:13px"><div style="width:32px;height:32px;border-radius:9px;background:${me.color};display:flex;align-items:center;justify-content:center;font:800 10px var(--mono);color:#fff">${shortOf(sel)}</div><div><div style="font-family:var(--arch);font-weight:800;font-size:13px">${sel.name}</div><div class="mono" style="font-size:9px;color:#9aa1ac">${curPos} · Güç ${sel.ovr} · ${sel.age}y · ${sel.height || '–'}cm</div><div style="font:700 9px 'Hanken Grotesk';color:#7c5cd6;margin-top:1px">${sel.type || ''}</div></div></div>
          <div style="display:grid;gap:6px;margin-bottom:14px">${roles}</div>
          <div class="label" style="font-size:10px;margin-bottom:8px">Sahadaki Görevi</div><div class="task-seg">${tasks}</div>`;
      } else {
        rightPanel = `<div class="muted" style="font-size:11.5px;line-height:1.5;padding-top:8px">Sahadaki bir oyuncuya dokun → rolü ve görevini buradan değiştir. Diziliş, mentalite ve takım odağı soldan ayarlanır.</div>`;
      }
    }
    const ht = G.match.halftime;
    const hint = ht ? 'Devre arası — taktiğini ayarla, hazır olunca ikinci yarıyı başlat' : mode === 'subs' ? 'Bir oyuncu çıkar, yedekten birini al — değişiklik anında sahaya yansır' : 'Diziliş, mentalite ve takım odağı değişiklikleri sahaya anında uygulanır';
    const panelHTML = `<div class="overlay"><div class="panel">
      <div class="panel-head">
        <div class="flexc" style="gap:11px"><div style="width:30px;height:30px;border-radius:8px;background:${ht ? '#cf6f24' : '#14181f'};display:flex;align-items:center;justify-content:center"><div style="width:10px;height:10px;border-radius:2px;background:${ht ? '#ffe27a' : '#19c37d'}"></div></div>
          <div><div style="font-family:var(--arch);font-weight:800;font-size:15px">${ht ? (G.match.htKind === 'et-start' ? '⏸ Uzatma Molası' : G.match.htKind === 'et-half' ? '⏸ Uzatma Arası' : '⏸ Devre Arası') : 'Maç İçi Panel'}</div><div style="font:600 11px 'Hanken Grotesk';color:#8b929d">${me.name} · ${ht ? 'skor ' + (G.match.live ? G.match.live.a + '-' + G.match.live.b : '') + ' · taktik yap' : Math.floor(G.match.live ? G.match.live.clock : 0) + "' · duraklatıldı"}</div></div></div>
        <div class="panel-tabs"><div class="tb ${mode === 'tactics' ? 'sel' : ''}" data-pmode="tactics">Diziliş & Taktik</div><div class="tb ${mode === 'subs' ? 'sel' : ''}" data-pmode="subs">Oyuncu Değiştir</div></div>
        <div class="panel-close" id="panel-close">×</div>
      </div>
      <div class="panel-body">
        <div style="border-right:1px solid var(--line2);padding:15px 16px;background:#fff">
          <div class="label" style="font-size:10px;margin-bottom:9px">Diziliş</div>
          <div class="g3" style="gap:6px;margin-bottom:16px">${fmts}</div>
          <div class="label" style="font-size:10px;margin-bottom:10px">Mentalite <span class="mono" style="color:var(--green-d);font-weight:700">${me.mentality}</span></div>
          <div class="ment-track"><div class="ment-rail"><div class="bar"></div><div class="knob" style="left:${mentIdx / 4 * 100}%"></div></div><div class="labels">${MENTALITIES.map((n, i) => `<span class="${i === mentIdx ? 'sel' : ''}" data-pment="${i}" style="font-size:8px">${n}</span>`).join('')}</div></div>
          <div class="between" style="margin-bottom:11px"><div class="label" style="font-size:10px">Takım Odağı</div><div class="mono" style="font-size:9px;color:${pLeft > 0 ? 'var(--green-d)' : '#9aa1ac'};font-weight:700">Kalan: ${pLeft}</div></div>
          <div style="display:grid;gap:9px">${focusRows}</div>
        </div>
        <div style="padding:15px;display:flex;flex-direction:column;align-items:center;background:#fbfcfd">
          <div class="label" style="font-size:10px;margin-bottom:10px;align-self:flex-start">Saha · ${me.formation}</div>
          <div class="pitch" style="width:100%;max-width:244px;aspect-ratio:68/100">${PITCH_LINES}${tokens}</div>
          <div class="flexc" style="gap:14px;margin-top:12px;font:600 10px 'Hanken Grotesk';color:#6a7280"><span class="flexc" style="gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:#e5484d"></span>Hücum</span><span class="flexc" style="gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:#d9a017"></span>Denge</span><span class="flexc" style="gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:#3b6fe0"></span>Savunma</span></div>
        </div>
        <div style="border-left:1px solid var(--line2);padding:15px 16px;background:#fff">${rightPanel}</div>
      </div>
      <div class="panel-foot"><div class="muted" style="font-size:11px">${hint}</div>
        <div style="display:flex;gap:9px">${ht ? '' : '<button class="btn btn-ghost" id="panel-cancel" style="padding:10px 18px;font-size:12.5px">Kapat</button>'}<button class="btn btn-green" id="panel-apply" style="padding:10px 22px;font-size:12.5px">${ht ? (G.match.htKind === 'et-start' ? 'Uzatmayı Başlat →' : G.match.htKind === 'et-half' ? 'Devam Et →' : 'İkinci Yarıyı Başlat →') : 'Devam Et →'}</button></div></div>
    </div></div>`;
    if (o.firstChild) morph(o, panelHTML); else o.innerHTML = panelHTML;
    bindPanel();
  }
  function bindPanel() {
    const done = G.match.halftime ? resumeHalftime : closePanel;
    document.querySelectorAll('[data-pmode]').forEach(b => b.onclick = () => { G.match.panelMode = b.dataset.pmode; G.match.sel = null; renderPanel(); });
    document.getElementById('panel-close').onclick = done;
    const cancelBtn = document.getElementById('panel-cancel'); if (cancelBtn) cancelBtn.onclick = done;
    document.getElementById('panel-apply').onclick = done;
    const me = G.me;
    document.querySelectorAll('[data-pformation]').forEach(b => b.onclick = () => { const nf = b.dataset.pformation; const old = me.lineup.slice(); me.formation = nf; me.lineup = Array(11).fill(null); old.forEach((p, i) => me.lineup[i] = p); if (G.match.live) refresh(); renderPanel(); });
    bindMentSlider(document.querySelector('#match-overlay .ment-track'), idx => { me.mentality = MENTALITIES[idx]; refresh(); });
    document.querySelectorAll('[data-pfocus]').forEach(seg => seg.onclick = () => { if (setFocus(me, seg.dataset.pfocus, +seg.dataset.val)) { refresh(); renderPanel(); } });
    document.querySelectorAll('[data-pslot]').forEach(s => s.onclick = () => {
      const i = +s.dataset.pslot;
      if (G.match.panelMode === 'subs') { G.match.subOut = i; if (G.match.subIn != null && G.match.subsLeft > 0) return applySub(); }
      else { G.match.sel = i; }
      renderPanel();
    });
    // bir kez: çıkacak seçiliyse yedeğe dokununca değişiklik anında yapılır (tek akış)
    document.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => {
      const inP = benchList(G.me).find(x => x.id === +b.dataset.pin);
      if (inP && isInjured(inP)) { toast(inP.name + ' sakat — sahaya alınamaz'); return; }
      G.match.subIn = +b.dataset.pin;
      if (G.match.subOut != null && G.match.subsLeft > 0) return applySub();
      renderPanel();
    });
    // panel: yedek satırını sahadaki oyuncunun üstüne sürükle → değişiklik (listener'lar bir kez; morph birikmesin)
    document.querySelectorAll('#match-overlay [data-pin]').forEach(row => {
      row.setAttribute('draggable', 'true');   // morph siler → her render'da yeniden
      if (row._dndBound) return; row._dndBound = true;
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'in:' + row.dataset.pin); row.classList.add('dragging'); const p = benchList(G.me).find(x => x.id === +row.dataset.pin); if (p) highlightFits(p, '#match-overlay'); });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); clearFits(); });
    });
    document.querySelectorAll('#match-overlay [data-pslot]').forEach(el => {
      el.setAttribute('draggable', 'true');   // saha oyuncusu da sürüklenebilir (kendi aralarında yer değiştir)
      if (el._dndBound) return; el._dndBound = true;
      el.addEventListener('dragstart', e => { if (el.classList.contains('empty')) { e.preventDefault(); return; } e.dataTransfer.setData('text/plain', 'slot:' + el.dataset.pslot); el.classList.add('dragging'); const p = G.me.lineup[+el.dataset.pslot]; if (p) highlightFits(p, '#match-overlay'); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); clearFits(); });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('drop-target'); clearFits();
        const src = e.dataTransfer.getData('text/plain'); if (!src) return;
        const dstI = +el.dataset.pslot;
        if (src.indexOf('slot:') === 0) {   // saha içi yer değiştirme (forvet↔kanat vb.) — değişiklik hakkı harcamaz
          const srcI = +src.slice(5); if (srcI === dstI) return;
          if (!G.me.lineup[srcI] || !G.me.lineup[dstI]) { applySwap({ type: 'slot', i: srcI }, { type: 'slot', i: dstI }); }
          else { if (G.match.live && G.match.live.swapSlots) G.match.live.swapSlots(0, srcI, dstI); applySwap({ type: 'slot', i: srcI }, { type: 'slot', i: dstI }); }
          refresh(); renderPanel(); return;
        }
        const inId = +src.replace('in:', ''); if (!inId) return;   // yedekten gelen → değişiklik
        if (G.match.subsLeft <= 0) { toast('Değişiklik hakkın kalmadı'); return; }
        const inP = benchList(G.me).find(x => x.id === inId);
        if (inP && isInjured(inP)) { toast(inP.name + ' sakat — sahaya alınamaz'); return; }
        G.match.subOut = dstI; G.match.subIn = inId; applySub();
      });
    });
    document.querySelectorAll('[data-prole]').forEach(b => b.onclick = () => { const p = me.lineup[G.match.sel]; if (p) { p.role = b.dataset.prole; renderPanel(); } });
    document.querySelectorAll('[data-ptask]').forEach(b => b.onclick = () => { const p = me.lineup[G.match.sel]; if (p) { p.task = b.dataset.ptask; refresh(); renderPanel(); } });
    const ap = document.getElementById('apply-sub'); if (ap) ap.onclick = applySub;
  }
  function refresh() {
    if (G.match.live && G.match.live.refreshStrength) G.match.live.refreshStrength();
    if (isOnline() && !amHost()) netSend({ t: 'm-tactic', club: serializeClub(G.me) });   // guest taktik/değişikliklerini host'a ilet
  }
  function applySub() {
    const me = G.me; const outI = G.match.subOut; const inId = G.match.subIn;
    if (outI == null || inId == null || G.match.subsLeft <= 0) return;
    const inP = benchList(me).find(p => p.id === inId); const outP = me.lineup[outI];
    const realBenchIdx = me.bench.indexOf(inP);
    me.lineup[outI] = inP; if (realBenchIdx >= 0) me.bench[realBenchIdx] = outP; else { const e = me.bench.indexOf(null); if (e >= 0) me.bench[e] = outP; else me.bench.push(outP); }
    const slots = FORMATIONS[me.formation]; inP.task = inP.task || defaultTask(slots[outI][0]);
    G.match.subsLeft--; G.match.subOut = null; G.match.subIn = null;
    refresh();
    logSub(inP, outP, me);
    const sl = document.getElementById('subs-left'); if (sl) sl.textContent = G.match.subsLeft + ' hak';
    toast('Değişiklik yapıldı: ' + inP.name + ' oyunda');
    renderPanel();
  }
  function matchClock() {
    if (isOnline() && !amHost()) return Math.floor((G.match && G.match.curClock) || 0);   // guest: host'tan gelen saat
    return Math.floor(G.match && G.match.live ? G.match.live.clock : 0);
  }
  function logSub(inP, outP, club) {
    const ev = { t: matchClock() + "'", type: 'sub', txt: `${inP.name} ↦ ${outP.name} · ${club.name}` };
    const box = document.getElementById('ev-box');
    if (box) { if (box.querySelector('.muted')) box.innerHTML = ''; box.insertAdjacentHTML('afterbegin', evRowHTML(ev)); while (box.children.length > 14) box.removeChild(box.lastChild); G.match.evHTML = box.innerHTML; }
    const comm = `Değişiklik — ${inP.name} oyuna girdi, ${outP.name} çıktı (${club.name}).`;
    pushCommentary(comm, 'turn');
    if (isOnline()) { netSend({ t: 'm-event', ev }); netSend({ t: 'm-comm', txt: comm, type: 'turn' }); }   // rakip de değişikliği görsün
  }

  /* ============================================================
     ONLINE MAÇ — host-otoriter yayın / guest render
     ============================================================ */
  function onlineReady() {
    if (G.tactics.ready) return;
    G.tactics.ready = true;
    netSend({ t: 'ready', club: serializeClub(G.me) });
    toast('Hazırsın — rakip bekleniyor…');
    maybeStartOnlineMatch();
    if (G.screen === 'tactics') render();
  }
  function maybeStartOnlineMatch() {
    if (!isOnline() || !G.tactics) return;
    if (!G.tactics.ready || !G.tactics.oppReady) return;
    if (G._oppClubSerialized) G.opp = deserializeClub(G._oppClubSerialized);
    goMatch();
  }
  function startHostStream(live) { stopHostStream(); G.match.streamIv = setInterval(() => streamFrame(live), 45); }
  function stopHostStream() { if (G.match && G.match.streamIv) { clearInterval(G.match.streamIv); G.match.streamIv = null; } }
  function streamFrame(live) {
    if (!live) return;
    const P = []; const cd = [], so = [], st = [], ij = [];
    for (let i = 0; i < live.players.length; i++) {
      const p = live.players[i];
      if (p && p.ref) { P.push(Math.round(p.x), Math.round(p.y)); if (p.carded) cd.push(i); if (p.sentOff) so.push(i); if (p.stam < 40) st.push(i); if (p.injured) ij.push(i); }
      else P.push(-9999, -9999);
    }
    netSend({ t: 'm-frame', n: live.t, P, cd, so, st, ij,
      B: [Math.round(live.ball.x), Math.round(live.ball.y)],
      O: (live.owner != null ? live.owner : -1),
      R: live.ref ? [Math.round(live.ref.x), Math.round(live.ref.y)] : [0, 0],
      sc: [live.a, live.b],
      gf: live.goalFlash ? { team: live.goalFlash.team, name: live.goalFlash.name } : null,
      fl: (live.flash && live.t < (live._flashUntil || 0)) ? { txt: live.flash.txt, col: live.flash.col } : null,
      ph: live.phase });
  }
  /* guest: motoru çalıştırmaz; gelen kareleri çizer */
  function bindGuestMatch(cv) {
    const live = new LiveMatch(cv, G.me, G.opp, {});   // A = ben(guest), B = rakip(host)
    try { live.stop(); } catch (_) {}
    live.running = false; live.start = function () {};   // guest motoru asla başlatmaz
    G.match.live = live; G.match.guest = true;
    window.scrollTo(0, 0);
    document.querySelectorAll('[data-spd]').forEach(b => { b.style.opacity = '.4'; b.style.pointerEvents = 'none'; });
    const sl = document.getElementById('spd-lbl'); if (sl) sl.textContent = 'host kontrolünde';
    const ot = document.getElementById('open-tactics'); if (ot) ot.onclick = () => openPanel('tactics');
    const os = document.getElementById('open-subs'); if (os) os.onclick = () => openPanel('subs');
    const ov = document.getElementById('open-oppview'); if (ov) ov.onclick = () => openOppView();
    setupView3D(live);
    live.draw();
  }
  function flipStats(s) {
    s = s || {};
    return { possA: s.possB, possB: s.possA, shotsA: s.shotsB, shotsB: s.shotsA, sotA: s.sotB, sotB: s.sotA,
      cornersA: s.cornersB, cornersB: s.cornersA, foulsA: s.foulsB, foulsB: s.foulsA,
      offsidesA: s.offsidesB, offsidesB: s.offsidesA, xgA: s.xgB, xgB: s.xgA };
  }
  function applyGuestFrame(f) {
    const live = G.match && G.match.live; if (!live || !G.match.guest) return;
    const W = live.W, N = live.players.length, half = N / 2;
    for (let i = 0; i < N; i++) { const p = live.players[i]; if (p) { p.carded = false; p.sentOff = false; p.stam = 100; p.injured = false; } }
    for (let hi = 0; hi < N; hi++) {
      const p = live.players[(hi + half) % N]; if (!p) continue;
      const x = f.P[hi * 2], y = f.P[hi * 2 + 1]; if (x <= -9000) continue;
      p.x = W - x; p.y = y;
    }
    (f.cd || []).forEach(hi => { const p = live.players[(hi + half) % N]; if (p) p.carded = true; });
    (f.so || []).forEach(hi => { const p = live.players[(hi + half) % N]; if (p) p.sentOff = true; });
    (f.st || []).forEach(hi => { const p = live.players[(hi + half) % N]; if (p) p.stam = 30; });
    (f.ij || []).forEach(hi => { const p = live.players[(hi + half) % N]; if (p) p.injured = true; });
    live.ball.x = W - f.B[0]; live.ball.y = f.B[1];
    live.owner = (f.O != null && f.O >= 0) ? (f.O + half) % N : null;
    if (live.ref) { live.ref.x = W - f.R[0]; live.ref.y = f.R[1]; }
    live.a = f.sc[1]; live.b = f.sc[0];   // guest perspektifi: A = ben = host'un B'si
    live.goalFlash = f.gf ? { team: 1 - f.gf.team, name: f.gf.name } : null;
    live.flash = f.fl || null; live._flashUntil = f.fl ? (f.n + 99999) : 0;
    live.t = f.n; live.phase = 'play';
    live.draw();
    if (f.ph === 'replay') drawGuestBadge(live, 'TEKRAR · GOL');
    const a = document.getElementById('sb-a'), b = document.getElementById('sb-b'); if (a) a.textContent = live.a; if (b) b.textContent = live.b;
  }
  function drawGuestBadge(live, txt) {
    const ctx = live.ctx; ctx.fillStyle = 'rgba(8,12,18,.62)'; ctx.fillRect(0, 0, live.W, 40);
    ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(28, 20, 6, 0, 7); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = '800 16px Archivo, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(txt, 44, 21); ctx.textAlign = 'center';
  }
  function applyGuestUpdate(m) {
    const stats = flipStats(m.stats);
    G.match.stats = stats; G.match.curClock = m.clock;
    const a = document.getElementById('sb-a'), b = document.getElementById('sb-b'), c = document.getElementById('sb-clock');
    if (a) a.textContent = m.b; if (b) b.textContent = m.a; if (c) c.textContent = m.clockStr || (m.clock + "'");
    const st = document.getElementById('st-box'); if (st) st.innerHTML = statBars(stats);
    if (m.momentum != null) setPressure(-m.momentum);
  }
  function guestEvent(ev) {
    const box = document.getElementById('ev-box');
    if (box) { if (box.querySelector('.muted')) box.innerHTML = ''; box.insertAdjacentHTML('afterbegin', evRowHTML(ev)); while (box.children.length > 14) box.removeChild(box.lastChild); G.match.evHTML = box.innerHTML; }
  }
  /* ---- online devre arası: ikisi de "Hazır" demeden 2. yarı başlamaz ---- */
  function onlineHalftimeHost(kind) {
    G.match.htKind = kind || 'normal'; G.match.htReadyMe = false; G.match.htReadyOpp = false;
    netSend({ t: 'm-halftime', kind: kind || 'normal' });
    openHalftime(kind);
  }
  function guestHalftime(kind) { G.match.htReadyMe = false; openHalftime(kind); }
  function onlineResumeClick() {
    if (G.match.htReadyMe) return;
    G.match.htReadyMe = true;
    if (!amHost()) netSend({ t: 'm-tactic', club: serializeClub(G.me) });
    netSend({ t: 'ht-ready' });
    // İki yarı yalnızca host tarafından ve İKİ taraf da hazırken başlar (guest sadece ht-resume bekler)
    if (amHost()) tryHostResume(); else showHalftimeWaiting();
  }
  function hostHalftimeReady() { if (!amHost()) return; G.match.htReadyOpp = true; tryHostResume(); }   // yalnızca host rakip hazırını işler
  function tryHostResume() {
    if (!amHost()) return;
    if (!G.match.htReadyMe || !G.match.htReadyOpp) {
      if (G.match.htReadyMe) showHalftimeWaiting();   // host hazır, rakip bekleniyor; host hazır değilse panel açık kalsın
      return;
    }
    G.match.halftime = false; G.match.panelOpen = false;
    const o = document.getElementById('match-overlay'); if (o) o.innerHTML = '';
    if (G.match.live) G.match.live.resumeSecondHalf();
    netSend({ t: 'ht-resume' });
  }
  function guestResume() {
    G.match.halftime = false; G.match.panelOpen = false;
    const o = document.getElementById('match-overlay'); if (o) o.innerHTML = '';
  }
  function showHalftimeWaiting() {
    const o = document.getElementById('match-overlay'); if (!o) return;
    o.innerHTML = `<div class="overlay"><div class="panel" style="max-width:420px"><div style="padding:40px;text-align:center"><div style="font-family:var(--arch);font-weight:800;font-size:18px;margin-bottom:10px">Hazırsın ✓</div><div class="flexc" style="gap:9px;justify-content:center;color:#cf6f24"><span style="width:10px;height:10px;border-radius:50%;background:#d9a017;animation:livepulse 1.4s ease-in-out infinite"></span><span style="font:700 13px 'Hanken Grotesk'">Rakibin 2. yarı için hazır olması bekleniyor…</span></div></div></div></div>`;
  }
  function applyGuestResult(m) {
    if (G.match) { G.match.ended = true; if (G.match.live) { try { G.match.live.stop(); } catch (_) {} } }
    const r = m.res; const flip = w => w === 'a' ? 'b' : (w === 'b' ? 'a' : w);
    if (r.stats) r.stats = flipStats(r.stats);   // guest perspektifi
    G.lastResult = r;
    G.series.matches.push({ a: r.b, b: r.a, winner: flip(r.winner), pen: !!r.penalties, sh: r.shootout ? { a: r.shootout.b, b: r.shootout.a } : null });
    if (flip(r.winner) === 'a') G.series.winsA++; else G.series.winsB++;
    G.me = deserializeClub(m.guestClub);
    G.opp = deserializeClub(m.hostClub);
    G.dev = m.devGuest;
    setTimeout(() => { if (m.decided) goResult(); else goBetween(); }, 700);
  }
  function onlineBetweenReady() {
    G.between = G.between || { ready: false, oppReady: false };
    if (G.between.ready) return;
    G.between.ready = true;
    netSend({ t: 'between-ready' });
    const btn = document.getElementById('to-duello'); if (btn) { btn.disabled = true; btn.textContent = 'Rakip bekleniyor…'; }
    maybeAdvanceBetween();
  }
  function maybeAdvanceBetween() {
    if (!isOnline() || !G.between) return;
    if (!G.between.ready || !G.between.oppReady) return;
    G.series.matchNo++; goDuello();
  }

  function onMatchEnd(res) {
    if (G.match.ended) return; G.match.ended = true;
    // beraberlik artık motorda uzatma + penaltı atışlarıyla çözülüyor; yine de güvenlik için:
    if (res.winner === 'draw') {
      const sa = teamStrength(G.me).overall, sb = teamStrength(G.opp).overall;
      res.winner = Math.random() < (sa / (sa + sb)) ? 'a' : 'b'; res.penalties = true;
    }
    G.lastResult = res;
    G.series.matches.push({ a: res.a, b: res.b, winner: res.winner, pen: !!res.penalties, sh: res.shootout || null });
    if (res.winner === 'a') G.series.winsA++; else G.series.winsB++;
    // gelişim (seri uzunluğuna göre hız) — host hem kendi hem rakip için hesaplar, sonucu paylaşır
    G.dev = developSquad(G.me, res, 'a', G.series.format);
    const devOpp = developSquad(G.opp, res, 'b', G.series.format);
    const decided = G.series.winsA >= G.series.winsNeeded || G.series.winsB >= G.series.winsNeeded;
    if (isOnline()) {
      stopHostStream();
      netSend({ t: 'm-result', res: { a: res.a, b: res.b, winner: res.winner, penalties: !!res.penalties, shootout: res.shootout || null, stats: res.stats || null },
        hostClub: serializeClub(G.me), guestClub: serializeClub(G.opp), devGuest: devOpp, decided });
    }
    setTimeout(() => { if (decided) goResult(); else goBetween(); }, 700);
  }

  /* ============================================================
     6 · MAÇ ARASI
     ============================================================ */
  function goBetween() {
    if (G.match.live) { try { G.match.live.stop(); } catch (_) {} }
    stopHostStream();
    if (isOnline()) G.between = { ready: false, oppReady: (G._betweenReadyFor === G.series.matchNo) };   // sadece BU maç için gelen onayı say (eski tur taşınmaz)
    G.screen = 'between'; render();
  }
  function betweenHTML() {
    const dev = G.dev; const s = G.series;
    const rows = dev.changes.map(d => {
      const dl = d.delta;
      const dCol = dl > 0 ? '#13a76a' : dl < 0 ? '#e5484d' : '#9aa1ac';
      const dBg = dl > 0 ? '#e7f8f0' : dl < 0 ? '#fdeced' : '#f2f3f5';
      const arrow = dl > 0 ? '▲' : dl < 0 ? '▼' : '·';
      const toCol = dl > 0 ? '#13a76a' : dl < 0 ? '#e5484d' : '#14181f';
      const rt = d.rating; const rtCol = rt == null ? '#cbd1d8' : rt >= 7.5 ? '#13a76a' : rt >= 6.5 ? '#3a4250' : rt >= 5.5 ? '#b9870f' : '#e5484d';
      return `<div class="dev-row"><span class="rt" style="background:${rtCol}">${rt != null ? rt.toFixed(1) : '—'}</span><div class="posb">${d.pos}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12.5px">${d.name}</div><div style="font:500 9.5px 'Hanken Grotesk';color:#9aa1ac;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.reason}</div></div>
        <div class="flexc mono" style="gap:4px;flex-shrink:0"><span style="font-weight:700;font-size:12px;color:#c2c7ce">${d.from}</span><span style="color:#cbd1d8;font-size:10px">→</span><span style="font-weight:900;font-size:14px;color:${toCol}">${d.to}</span></div>
        <div class="dev-delta" style="color:${dCol};background:${dBg}">${arrow} ${dl > 0 ? '+' + dl : dl}</div></div>`;
    }).join('');
    const last = s.matches[s.matches.length - 1];
    const decided = false;
    const seriesPips = [];
    for (let i = 0; i < s.format; i++) { const m = s.matches[i]; seriesPips.push(`<span style="width:22px;height:8px;border-radius:4px;background:${m ? (m.winner === 'a' ? G.me.color : G.opp.color) : '#cbd1d8'}"></span>`); }
    const tr = dev.topRise, td = dev.topDrop;
    return `<div class="screen">
      ${head('06', 'Maç Arası', 'Oyuncuların maç sonrası gelişimini gör — ardından yeni çalma turuna ve taktiğe geç.')}
      <div class="wrap-frame">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 24px;background:linear-gradient(90deg,#eef3fd,#f6fafe);border-bottom:1px solid var(--line2);flex-wrap:wrap">
          <div class="flexc" style="gap:14px"><div class="flexc" style="gap:8px"><span class="mono" style="font-size:11px;color:#6a7280;letter-spacing:.06em">Bo${s.format}</span>${seriesPips.join('')}<span class="mono" style="font-size:15px;color:#14181f;font-weight:800">${s.winsA} — ${s.winsB}</span></div>
            <div style="width:1px;height:30px;background:#d6deea"></div>
            <div style="font:700 14px 'Hanken Grotesk'">Maç ${s.matchNo} bitti — ${last.a} : ${last.b}${last.pen ? (last.sh ? ` (pen ${last.sh.a}-${last.sh.b})` : ' (pen)') : ''} · ${last.winner === 'a' ? G.me.name : G.opp.name} kazandı</div></div>
          <div class="flexc" style="gap:11px"><div class="muted" style="font-size:12px">Sıradaki: Maç ${s.matchNo + 1}</div><div class="flexc" style="gap:7px;background:#14181f;color:#fff;border-radius:10px;padding:8px 14px;font-family:var(--arch);font-weight:800;font-size:13px"><span style="width:7px;height:7px;border-radius:50%;background:#e5484d;animation:livepulse 1.4s ease-in-out infinite"></span>MAÇ ${s.matchNo + 1}</div></div>
        </div>
        <div style="padding:22px 24px;background:#fbfcfd">
          <div style="display:grid;grid-template-columns:1.55fr 1fr;gap:18px;margin-bottom:20px">
            <div class="card" style="overflow:hidden">
              <div class="between" style="padding:13px 16px;border-bottom:1px solid var(--line2)"><div style="font-family:var(--arch);font-weight:800;font-size:15px">Maç ${s.matchNo}: Reyting & Gelişim</div><div class="muted" style="font:600 11px 'Hanken Grotesk'"><span style="color:#9aa1ac">reyting</span> · <span style="color:#13a76a">▲</span> <span style="color:#e5484d">▼</span> güç</div></div>
              <div class="dev-grid">${rows}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="hl-card up"><div class="label" style="font-size:10px;color:#13a76a;margin-bottom:9px">En Çok Gelişen</div><div class="flexc" style="gap:11px"><div style="width:38px;height:38px;border-radius:10px;background:${G.me.color};display:flex;align-items:center;justify-content:center;font:800 11px var(--mono);color:#fff">${tr ? shortOf({ name: tr.name }) : ''}</div><div style="flex:1"><div style="font-family:var(--arch);font-weight:800;font-size:15px">${tr ? tr.name : '—'}</div><div class="mono" style="font-size:10.5px;color:#9aa1ac">${tr ? `${tr.pos} · ${tr.from} → ${tr.to}` : ''}</div></div><div class="mono" style="font-weight:900;font-size:16px;color:#13a76a">${tr ? '+' + tr.delta : ''}</div></div></div>
              <div class="hl-card down"><div class="label" style="font-size:10px;color:#e5484d;margin-bottom:9px">En Çok Düşen</div><div class="flexc" style="gap:11px"><div style="width:38px;height:38px;border-radius:10px;background:${G.me.color};display:flex;align-items:center;justify-content:center;font:800 11px var(--mono);color:#fff">${td ? shortOf({ name: td.name }) : ''}</div><div style="flex:1"><div style="font-family:var(--arch);font-weight:800;font-size:15px">${td ? td.name : '—'}</div><div class="mono" style="font-size:10.5px;color:#9aa1ac">${td ? `${td.pos} · ${td.from} → ${td.to}` : ''}</div></div><div class="mono" style="font-weight:900;font-size:16px;color:#e5484d">${td ? td.delta : ''}</div></div></div>
              <div class="hl-card flexc" style="gap:11px"><div style="width:30px;height:30px;border-radius:8px;background:#fbf6e6;display:flex;align-items:center;justify-content:center;font-size:15px">🏅</div><div style="flex:1"><div class="label" style="font-size:10px">Maçın Oyuncusu</div><div style="font-family:var(--arch);font-weight:800;font-size:14px">${dev.motm ? dev.motm.name : '—'}</div></div></div>
              ${injuredNoteHTML()}
              <div style="border:1px dashed #cfe0fb;background:#f4f8fe;border-radius:14px;padding:13px 15px"><div style="font:700 11px 'Hanken Grotesk';color:#2f63d0;margin-bottom:4px">Not</div><div style="font:500 11.5px 'Hanken Grotesk';color:#5a7099;line-height:1.4">Maçlar peş peşe oynanır — oyuncular tam dinlenmez ama maç sonrası sağlam toparlanır. Oynayanlar daha yorgun, kenardakiler daha taze başlar. Sakat oyuncular iyileşene kadar oynayamaz.</div></div>
            </div>
          </div>
          ${matchStatsCardHTML()}
          <div class="between" style="flex-wrap:wrap;gap:14px"><div class="muted" style="font-size:12.5px">Gelişimi gördün — sıradaki maç için yeni çalma turuna geç.</div><button class="btn btn-green" id="to-duello">Düello'ya Geç →</button></div>
        </div>
      </div>
    </div>`;
  }
  function matchStatsCardHTML() {
    const st = G.lastResult && G.lastResult.stats; if (!st) return '';
    const cA = G.me.color, cB = G.opp.color;
    const row = (label, va, vb, na, nb) => {
      const tot = (na + nb) || 1; const wa = Math.round(na / tot * 100);
      return `<div style="margin-bottom:10px"><div class="between" style="font:700 11.5px 'Hanken Grotesk';margin-bottom:4px"><span>${va}</span><span class="muted" style="font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em">${label}</span><span>${vb}</span></div>
        <div style="height:7px;border-radius:4px;overflow:hidden;background:${cB}"><div style="height:100%;width:${wa}%;background:${cA}"></div></div></div>`;
    };
    return `<div class="card" style="overflow:hidden;margin-bottom:20px">
      <div class="between" style="padding:12px 16px;border-bottom:1px solid var(--line2)">
        <div style="font-family:var(--arch);font-weight:800;font-size:15px">Maç İstatistikleri</div>
        <div class="flexc" style="gap:14px;font:700 11px 'Hanken Grotesk'"><span class="flexc" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:${cA}"></span>${G.me.name}</span><span class="flexc" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:${cB}"></span>${G.opp.name}</span></div>
      </div>
      <div style="padding:14px 16px">
        ${row('Topa Sahip Olma', (st.possA || 0) + '%', (st.possB || 0) + '%', st.possA || 0, st.possB || 0)}
        ${row('Şut', st.shotsA || 0, st.shotsB || 0, st.shotsA || 0, st.shotsB || 0)}
        ${row('İsabetli Şut', st.sotA || 0, st.sotB || 0, st.sotA || 0, st.sotB || 0)}
        ${row('xG (Beklenen Gol)', (st.xgA || 0).toFixed(2), (st.xgB || 0).toFixed(2), st.xgA || 0, st.xgB || 0)}
        ${row('Korner', st.cornersA || 0, st.cornersB || 0, st.cornersA || 0, st.cornersB || 0)}
        ${row('Ofsayt', st.offsidesA || 0, st.offsidesB || 0, st.offsidesA || 0, st.offsidesB || 0)}
        ${row('Faul', st.foulsA || 0, st.foulsB || 0, st.foulsA || 0, st.foulsB || 0)}
      </div>
    </div>`;
  }
  function injuredNoteHTML() {
    const inj = (G.me.squad || []).filter(p => p.injuredMatches > 0);
    if (!inj.length) return '';
    const list = inj.map(p => `${p.name} <span style="color:#b86">(${p.injuredMatches} maç)</span>`).join(' · ');
    return `<div style="border:1px solid #f3c6c8;background:#fdeced;border-radius:14px;padding:13px 15px"><div style="font:700 11px 'Hanken Grotesk';color:#e5484d;margin-bottom:4px">➕ Sakatlar — sıradaki maçta yok</div><div style="font:500 11.5px 'Hanken Grotesk';color:#a05055;line-height:1.5">${list}</div></div>`;
  }
  function bindBetween() {
    document.getElementById('to-duello').onclick = () => {
      if (isOnline()) { onlineBetweenReady(); return; }
      G.series.matchNo++; goDuello();
    };
  }

  /* ============================================================
     7 · SERİ SONUCU
     ============================================================ */
  function goResult() {
    if (G.match.live) G.match.live.stop();
    if (window.KD_ANALYTICS && G.series) KD_ANALYTICS.event('series_end', { mode: G.mode, won: G.series.winsA > G.series.winsB ? 1 : 0, format: G.series.format });
    G.screen = 'result'; render();
  }
  function resultHTML() {
    const s = G.series;
    const winner = s.winsA > s.winsB ? G.me : G.opp;
    const wA = s.winsA > s.winsB;
    const matches = s.matches.map((m, i) => `<div class="flexc" style="gap:14px;border:1px solid var(--line);border-radius:12px;padding:13px 16px;background:#fff">
      <div class="mono" style="font-size:11px;color:#9aa1ac;min-width:48px">MAÇ ${i + 1}</div>
      <div style="flex:1;display:flex;align-items:center;gap:11px">
        <span style="font:700 13px 'Hanken Grotesk';color:${m.winner === 'a' ? '#14181f' : '#9aa1ac'}">${G.me.name}</span>
        <span style="font-family:var(--arch);font-weight:900;font-size:20px;color:${m.winner === 'a' ? G.me.color : '#c2c7ce'}">${m.a}</span>
        <span class="mono" style="color:#d4d8de;font-size:12px;font-weight:700">:</span>
        <span style="font-family:var(--arch);font-weight:900;font-size:20px;color:${m.winner === 'b' ? G.opp.color : '#c2c7ce'}">${m.b}</span>
        <span style="font:700 13px 'Hanken Grotesk';color:${m.winner === 'b' ? '#14181f' : '#9aa1ac'}">${G.opp.name}</span>
        ${m.pen ? `<span class="mono" style="font-size:9px;color:#9aa1ac">${m.sh ? 'pen ' + m.sh.a + '-' + m.sh.b : 'pen'}</span>` : ''}
      </div>
      <div style="font:700 10px 'Hanken Grotesk';letter-spacing:.06em;text-transform:uppercase;color:${m.winner === 'a' ? '#13a76a' : '#cf6f24'};background:${m.winner === 'a' ? '#e7f8f0' : '#fbf0e6'};padding:5px 10px;border-radius:7px">${(m.winner === 'a' ? G.me.name : G.opp.name).split(' ')[0]} ✓</div>
    </div>`).join('');
    const risers = (G.dev ? G.dev.changes.filter(c => c.delta > 0).slice(0, 3) : []);
    const developed = risers.map(p => `<div class="flexc" style="gap:12px;border:1px solid var(--line);border-radius:12px;padding:11px 14px;background:#fff">
      <div style="width:32px;height:32px;border-radius:8px;background:#eef3fe;display:flex;align-items:center;justify-content:center;font:700 9px var(--mono);color:#3b6fe0">${p.pos}</div>
      <div style="flex:1;font-weight:700;font-size:13.5px">${p.name}</div>
      <div class="flexc" style="gap:8px"><span style="font-family:var(--arch);font-weight:900;font-size:16px;color:#c2c7ce">${p.from}</span><span style="color:#19c37d">→</span><span style="font-family:var(--arch);font-weight:900;font-size:18px;color:#13a76a">${p.to}</span><span style="font:700 9.5px 'Hanken Grotesk';color:#13a76a;background:#e7f8f0;padding:3px 7px;border-radius:5px">+${p.delta}</span></div></div>`).join('') || '<div class="muted" style="font-size:12px">Bu seride gelişen oyuncu kaydı yok.</div>';
    const totalGoals = s.matches.reduce((t, m) => t + m.a, 0);
    return `<div class="screen">
      ${head('07', 'Seri Sonucu', 'Best-of serisinin galibi · maç maç skorlar · gelişen oyuncular.')}
      <div class="wrap-frame">
        <div class="winner-hero">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(25,195,125,.04) 0 12px,transparent 12px 24px)"></div>
          <div style="position:relative">
            <div style="display:inline-flex;align-items:center;gap:7px;font:700 11px 'Hanken Grotesk';letter-spacing:.14em;color:#13a76a;text-transform:uppercase;background:#e7f8f0;border:1px solid #c5edd9;padding:6px 14px;border-radius:999px;margin-bottom:16px">🏆 Seri Galibi · Bo${s.format}</div>
            <div class="flexc" style="justify-content:center;gap:22px;margin-bottom:8px"><div style="width:60px;height:60px;border-radius:15px;background:${winner.color};box-shadow:0 12px 28px -10px ${winner.color}99"></div><div style="font-family:var(--arch);font-weight:900;font-size:38px;letter-spacing:-.03em">${winner.name}</div></div>
            <div style="display:inline-flex;align-items:center;gap:18px;background:#14181f;color:#fff;border-radius:14px;padding:14px 28px;margin-top:8px">
              <div style="text-align:center"><div style="font:600 9px 'Hanken Grotesk';opacity:.55;letter-spacing:.08em">${G.me.name.toUpperCase().slice(0, 6)}</div><div style="font-family:var(--arch);font-weight:900;font-size:30px;line-height:1;${wA ? '' : 'opacity:.6'}">${s.winsA}</div></div>
              <div class="mono" style="font-size:13px;opacity:.5">SERİ</div>
              <div style="text-align:center"><div style="font:600 9px 'Hanken Grotesk';opacity:.55;letter-spacing:.08em">${G.opp.name.toUpperCase().slice(0, 6)}</div><div style="font-family:var(--arch);font-weight:900;font-size:30px;line-height:1;${wA ? 'opacity:.6' : ''}">${s.winsB}</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1.15fr 1fr;border-top:1px solid var(--line2)">
          <div style="padding:24px 26px;border-right:1px solid var(--line2)">
            <div class="label" style="margin-bottom:14px">Maç Maç</div>
            <div style="display:grid;gap:9px">${matches}</div>
            <div class="g3" style="margin-top:18px">
              <div style="background:#fbfcfd;border:1px solid var(--line2);border-radius:11px;padding:14px;text-align:center"><div style="font-family:var(--arch);font-weight:900;font-size:24px;color:${G.me.color}">${totalGoals}</div><div class="muted" style="font:600 10.5px 'Hanken Grotesk'">Attığın gol</div></div>
              <div style="background:#fbfcfd;border:1px solid var(--line2);border-radius:11px;padding:14px;text-align:center"><div style="font-family:var(--arch);font-weight:900;font-size:18px;color:#14181f">${G.dev && G.dev.motm ? G.dev.motm.name.split(' ')[1] || G.dev.motm.name : '—'}</div><div class="muted" style="font:600 10.5px 'Hanken Grotesk'">Serinin oyuncusu</div></div>
              <div style="background:#fbfcfd;border:1px solid var(--line2);border-radius:11px;padding:14px;text-align:center"><div style="font-family:var(--arch);font-weight:900;font-size:24px;color:#19c37d">${benchList(G.me).length + G.me.lineup.filter(Boolean).length}</div><div class="muted" style="font:600 10.5px 'Hanken Grotesk'">Kadro mevcudu</div></div>
            </div>
          </div>
          <div style="padding:24px 26px">
            <div class="label" style="margin-bottom:14px">Son Maçta Gelişenler</div>
            <div style="display:grid;gap:9px;margin-bottom:22px">${developed}</div>
            <div style="display:grid;gap:10px">
              <button class="btn btn-green" id="rematch" style="width:100%">Rövanş — Yeni Seri 🔁</button>
              <button class="btn btn-ghost" id="to-lobby" style="width:100%">Lobiye Dön</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
  function bindResult() {
    if (isOnline()) {
      // online: rövanş/çıkış için odadan ayrılıp ana ekrana dön
      const leave = () => { if (G.match && G.match.live) { try { G.match.live.stop(); } catch (_) {} } stopHostStream(); if (NET) NET.leave(); G.mode = 'ai'; G.me = null; G.opp = null; G.series = null; G.screen = 'home'; render(); };
      document.getElementById('rematch').onclick = leave;
      document.getElementById('to-lobby').onclick = leave;
      return;
    }
    document.getElementById('rematch').onclick = () => { G.lobby.name = G.me.name; G.lobby.oppName = G.opp.name; resetToLobby(); startSeries(); };
    document.getElementById('to-lobby').onclick = resetToLobby;
  }

  /* ---------- başlat ---------- */
  function resetToLobby() {
    if (G && G.match && G.match.live) G.match.live.stop();
    G.me = null; G.opp = null; G.series = null; G.draftPool = null; G.dev = null; G.lastResult = null;
    G.screen = isOnline() ? 'home' : 'lobby';
    render();
  }
  function init() {
    G = { screen: 'home', mode: 'ai',
      lobby: { format: 3, name: 'Vadi Spor', color: 0, oppName: 'Liman FK', oppColor: 1 },
      online: { format: 3, name: 'Vadi Spor', color: 0, code: '', tab: 'create', status: 'idle', msg: '', oppName: '', oppColor: 1 },
      me: null, opp: null };
    if (NET) NET.on(onNetMessage);
    render();
  }
  init();
})();
