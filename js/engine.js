/* ============================================================
   DraftVersus — Oyun Motoru
   Güç · man-marking maç sim (taç/korner/devre/stamina) · gelişim · YZ
   ============================================================ */
(function () {
  const D = window.KD_DATA;
  const { POS, FORMATIONS, MENTALITIES, fitLevel, FIT_MULT, defaultTask, rand, randi, pick, shuffle } = D;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const lerpf = (a, b, t) => a + (b - a) * t;
  const surOf = (p) => p ? (p.name.split('. ')[1] || p.name) : '';
  /* Motorun ihtiyaç duyduğu jenerik statlar — kaleci ayrı stat setinden (REF/KON/ELK/AYK) eşlenir. */
  function engStats(pl) {
    if (!pl) return { sh: 55, pa: 55, df: 55, sp: 55, fiz: 55 };
    const s = pl.stats;
    if (pl.pos === 'KL') return { sh: 25, pa: s.AYK, df: Math.round(s.REF * 0.5 + s.KON * 0.3 + s.ELK * 0.2), sp: s.HIZ, fiz: s['FİZ'] };
    return { sh: s['ŞUT'], pa: s.PAS, df: s.DEF, sp: s.HIZ, fiz: s['FİZ'] };
  }
  const SPEED_BASE = 0.42;   // 1× hızı sakinleştirir; tüm hareket/saat/aksiyon birlikte ölçeklenir

  /* ---- Mentalite / felsefe / odak çarpanları ---- */
  const MENT_ATT = { 'Çok Temkinli': 0.84, 'Temkinli': 0.92, 'Dengeli': 1.0, 'Cesur': 1.08, 'Çok Cesur': 1.16 };
  const MENT_DEF = { 'Çok Temkinli': 1.16, 'Temkinli': 1.08, 'Dengeli': 1.0, 'Cesur': 0.93, 'Çok Cesur': 0.86 };
  const PHIL_MOD = {
    'Topa Sahip Olma': { att: 1.05, def: 1.0 }, 'Kontra': { att: 1.08, def: 1.04 },
    'Yüksek Pres': { att: 1.06, def: 1.05 }, 'Defansif Blok': { att: 0.92, def: 1.16 },
    'Direkt': { att: 1.07, def: 0.97 }, 'Kanat': { att: 1.06, def: 0.99 },
  };

  function effOvr(player, slotPos) {
    const fit = fitLevel(player, slotPos);
    return player.ovr * FIT_MULT[fit];
  }
  function teamStrength(club) {
    const slots = FORMATIONS[club.formation] || FORMATIONS['4-3-3'];
    let att = 0, def = 0, mid = 0, n = 0, sumFit = 0;
    club.lineup.forEach((p, i) => {
      if (!p) return;
      const slotPos = slots[i][0]; const line = POS[slotPos].line;
      const e = effOvr(p, slotPos); sumFit += FIT_MULT[fitLevel(p, slotPos)]; n++;
      if (line <= 1) def += e;
      if (line >= 2 && line <= 4) mid += e;
      if (line >= 4) att += e;
      if (slotPos === 'KL') def += e * 0.6;
    });
    const ment = club.mentality || 'Dengeli';
    const phil = PHIL_MOD[club.philosophy] || PHIL_MOD['Yüksek Pres'];
    const f = club.focus || {};
    // odak 0..3, hepsi oyuncunun dağıttığı puanlardan gelir; 0 = o alana hiç yatırım yok
    const focusAtt = 1 + ((f['Tempo'] || 0) + (f['Yaratıcılık'] || 0)) * 0.022;
    const focusDef = 1 + ((f['Pres'] || 0) + (f['Defans Hattı'] || 0)) * 0.022;
    const attack = (att + mid * 0.55) * MENT_ATT[ment] * phil.att * focusAtt;
    const defense = (def + mid * 0.45) * MENT_DEF[ment] * phil.def * focusDef;
    return { attack, defense, overall: (attack + defense) / 2, avgFit: n ? sumFit / n : 1,
      teamOvr: Math.round(club.lineup.filter(Boolean).reduce((s, p, i) => s + effOvr(p, slots[i][0]), 0) / Math.max(1, n)) };
  }

  /* ============================================================
     Canlı maç — man-marking + set-piece + stamina + spiker
     ============================================================ */
  class LiveMatch {
    constructor(canvas, clubA, clubB, opts = {}) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.W = 1180; this.H = 560; canvas.width = this.W; canvas.height = this.H;
      this.clubA = clubA; this.clubB = clubB;
      this.sA = teamStrength(clubA); this.sB = teamStrength(clubB);
      this.speed = opts.speed || 1;
      this.mustWin = !!opts.mustWin;   // beraberlikte uzatma + penaltı (eleme maçı)
      this.onUpdate = opts.onUpdate || (() => {});
      this.onEvent = opts.onEvent || (() => {});
      this.onEnd = opts.onEnd || (() => {});
      this.onCommentary = opts.onCommentary || (() => {});
      this.onHalftime = opts.onHalftime || (() => {});
      this.colA = clubA.color || '#3b6fe0'; this.colB = clubB.color || '#e8893b';
      this.reset();
    }
    reset() {
      this.buildPlayers();
      this.ball = { x: this.W / 2, y: this.H / 2, tx: this.W / 2, ty: this.H / 2 };
      this.clock = 0; this.a = 0; this.b = 0; this.t = 0;
      this.stats = { shotsA: 0, shotsB: 0, sotA: 0, sotB: 0, cornersA: 0, cornersB: 0, foulsA: 0, foulsB: 0, xgA: 0, xgB: 0 };
      this.events = []; this.running = false; this.ended = false;
      this._possAcc = 0; this._possN = 0;
      this.ballMode = 'held'; this.actCD = 16; this.deadCD = 0; this.nextKickTeam = 0;
      this._passTarget = null; this._intercept = null; this._lastPass = null;
      this.goalFlash = null; this.flash = null; this.momentum = 0; this.halftimeDone = false;
      this._lastThird = -1;
      this.phase = 'play'; this._htFired = false; this.subWalkers = []; this.pen = null; this.restart = null;
      this.cards = {}; this._stoppage = false; this._endFired = false; this.ref = { x: this.W / 2, y: this.H / 2 + 60 };
      this.frameBuffer = []; this.replay = null; this.pendingReplay = null;
      this._inET = false; this._etStoppage = false; this._etHalfDone = false; this._htKind = 'normal'; this.penWinner = null; this.shootout = null; this.kickoffFreeze = 0;
      this.computeTac();
      this.kickoff(0, true);
    }
    buildPlayers() {
      const make = (club, team) => {
        const slots = FORMATIONS[club.formation] || FORMATIONS['4-3-3'];
        return club.lineup.map((pl, i) => {
          const [pos, hx, hy] = slots[i]; const fwd = (90 - hy) / 72;
          const ax = 56 + fwd * (this.W * 0.45), ay = 44 + (hx / 100) * (this.H - 88);
          const x = team === 0 ? ax : this.W - ax;
          const es = engStats(pl);
          const startStam = (pl && pl.condition != null) ? Math.max(45, pl.condition) : 100;   // maçlar arası taşınan yorgunluk
          const p = { ref: pl, team, pos, line: POS[pos] ? POS[pos].line : 3, fwd, hx: x, hy: ay, x, y: ay, vx: 0, vy: 0,
            sh: es.sh, pa: es.pa, df: es.df, sp: es.sp, fiz: es.fiz,
            isGK: pos === 'KL', sur: surOf(pl), stam: startStam };
          if (pl && pl.injuredMatches > 0) this.applyInjuryDebuff(p, true);   // sakat oyuncu zorla oynatıldıysa düşük perf
          return p;
        });
      };
      this.players = [...make(this.clubA, 0), ...make(this.clubB, 1)];
    }
    reconcilePlayers() {
      [this.clubA, this.clubB].forEach((club, team) => {
        const slots = FORMATIONS[club.formation] || FORMATIONS['4-3-3'];
        for (let i = 0; i < 11; i++) {
          const p = this.players[team * 11 + i]; if (!p) continue;
          const [pos, hx, hy] = slots[i]; const fwd = (90 - hy) / 72;
          const ax = 56 + fwd * (this.W * 0.45), ay = 44 + (hx / 100) * (this.H - 88);
          p.hx = team === 0 ? ax : this.W - ax; p.hy = ay; p.fwd = fwd; p.pos = pos; p.line = POS[pos] ? POS[pos].line : 3; p.isGK = pos === 'KL';
          const nr = club.lineup[i];
          if (nr && p.ref !== nr) {
            // çıkan oyuncu kenara doğru yürüsün (hayalet), giren kenardan sahaya yürüsün
            if (p.ref) this.subWalkers.push({ x: p.x, y: p.y, tx: p.hx + (team === 0 ? -40 : 40), ty: this.H - 4, col: team ? this.colB : this.colA, sur: p.sur, life: 80 });
            p.ref = nr; const es = engStats(nr); p.sh = es.sh; p.pa = es.pa; p.df = es.df; p.sp = es.sp; p.fiz = es.fiz; p.sur = surOf(nr);
            p.stam = (nr.condition != null) ? Math.max(55, nr.condition) : 100; p.injured = false; p.injSev = 0;
            if (nr.injuredMatches > 0) this.applyInjuryDebuff(p, true);
            p.carded = !!this.cards[nr.id]; p.sentOff = false;   // giren oyuncu taze (kartlıysa işaretli)
            p.x = p.hx; p.y = this.H - 4;
          }
        }
      });
    }
    computeTac() {
      const tacFor = (club) => {
        const mi = Math.max(0, MENTALITIES.indexOf(club.mentality)); const f = club.focus || {};
        const phil = club.philosophy;
        return {
          mi,
          line: 0.40 + mi * 0.085 + (f['Defans Hattı'] || 0) * 0.05,        // savunma hattı yüksekliği
          pressR: 58 + (f.Pres || 0) * 26 + (phil === 'Yüksek Pres' ? 40 : 0), // baskı menzili
          pressN: Math.min(2, 1 + (((f.Pres || 0) >= 2) ? 1 : 0) + (phil === 'Yüksek Pres' ? 1 : 0)), // kaç kişi baskı (max 2)
          tempo: 0.80 + (f.Tempo || 0) * 0.13,                              // aksiyon temposu
          width: 0.92 + (f['Genişlik'] || 0) * 0.12 + (phil === 'Kanat' ? 0.18 : 0), // saha genişliği
          // hücumda kaç oyuncuyla ileri çıkılır (mentalite + felsefe). Defansif blok düşük.
          commit: 0.66 + mi * 0.12 + (phil === 'Defansif Blok' ? -0.30 : (phil === 'Yüksek Pres' || phil === 'Direkt' || phil === 'Kontra' || phil === 'Kanat') ? 0.12 : 0) + (f.Tempo || 0) * 0.03,
          wing: phil === 'Kanat' ? 1 : 0.45,
          directness: phil === 'Direkt' ? 1 : phil === 'Topa Sahip Olma' ? -1 : phil === 'Kontra' ? 0.6 : phil === 'Kanat' ? 0.2 : 0,
          shoot: phil === 'Direkt' ? 1.3 : phil === 'Topa Sahip Olma' ? 0.78 : phil === 'Kontra' ? 1.12 : 1,
        };
      };
      this.tac = [tacFor(this.clubA), tacFor(this.clubB)];
    }
    goalFor(team) { return team === 0 ? { x: this.W - 22, y: this.H / 2 } : { x: 22, y: this.H / 2 }; }
    ownGoal(team) { return team === 0 ? { x: 22, y: this.H / 2 } : { x: this.W - 22, y: this.H / 2 }; }
    clubName(team) { return team === 0 ? this.clubA.name : this.clubB.name; }
    say(txt, type) { this.onCommentary(txt, type || 'info'); }
    kickoff(team, silent) {
      this.goalFlash = null; this.flash = null; this.poss = team; const base = team === 0 ? 0 : 11;
      // vuran takım kendi yarısında; SAVUNAN takım santra dairesinin gerisinde → ortada tek topçu kalır
      this.players.forEach(p => {
        if (!p.ref) return; p.x = p.hx; p.y = p.hy;
        if (p.team === team) { if (team === 0) p.x = Math.min(p.x, this.W / 2 - 14); else p.x = Math.max(p.x, this.W / 2 + 14); }
        else { if (p.team === 0) p.x = Math.min(p.x, this.W / 2 - 66); else p.x = Math.max(p.x, this.W / 2 + 66); }
      });
      let best = base + 6;
      for (let i = 1; i < 11; i++) { const p = this.players[base + i]; if (p && p.ref && p.line >= 2 && p.line <= 3) { best = base + i; break; } }
      this.owner = best; this.ballMode = 'held'; this.actCD = 999; this._lastPass = null;
      const o = this.players[best];
      o.x = this.W / 2; o.y = this.H / 2;   // YALNIZCA topu kullanan oyuncu santrada; diğerleri kendi düzeninde kalır
      this.ball.x = o.x; this.ball.y = o.y; this.kickoffFreeze = 26;   // topun başında kısa bekleme
      this._kickoffBackPass = true;   // freeze bitince geriye paslayıp oyun başlar
      if (!silent) this.say('Oyun yeniden başladı — ' + this.clubName(team) + ' topla.', 'info');
    }
    start() {
      if (this.running) return; this.running = true;
      const loop = () => { if (!this.running) return; if (!this._bgActive()) { this.step(); this.draw(); } this._raf = requestAnimationFrame(loop); };
      loop();
      this._iv = setInterval(() => { this.onUpdate({ clock: Math.floor(this.clock), clockStr: this.clockStr(), a: this.a, b: this.b, stats: this.computeStats(), momentum: this.momentum }); }, 220);
      // sekme arka plandayken (alt-tab) tarayıcı rAF'ı durdurur → maç donmasın diye zamanlayıcıyla ilerlet
      this._lastBg = Date.now();
      this._bg = setInterval(() => {
        if (!this.running || !this._bgActive()) { this._lastBg = Date.now(); return; }
        const now = Date.now(); let n = Math.min(90, Math.round((now - this._lastBg) / 16)); this._lastBg = now;
        while (n-- > 0) this.step();
      }, 40);
    }
    _bgActive() { return typeof document !== 'undefined' && document.hidden; }
    stop() { this.running = false; if (this._raf) cancelAnimationFrame(this._raf); if (this._iv) clearInterval(this._iv); if (this._bg) clearInterval(this._bg); }
    setSpeed(v) { this.speed = v; }
    refreshStrength() { this.sA = teamStrength(this.clubA); this.sB = teamStrength(this.clubB); this.computeTac(); this.reconcilePlayers(); }
    computeStats() {
      const poss = this._possN ? Math.round(this._possAcc / this._possN) : 50;
      return { possA: poss, possB: 100 - poss, shotsA: this.stats.shotsA, shotsB: this.stats.shotsB, sotA: this.stats.sotA, sotB: this.stats.sotB,
        cornersA: this.stats.cornersA, cornersB: this.stats.cornersB, foulsA: this.stats.foulsA, foulsB: this.stats.foulsB,
        xgA: Math.round(this.stats.xgA * 100) / 100, xgB: Math.round(this.stats.xgB * 100) / 100 };
    }

    /* ---- her kare ---- */
    step() {
      const sp = this.speed * SPEED_BASE; this.t++;
      if (this.phase === 'walkoff') return this.stepWalk('off', sp);
      if (this.phase === 'walkon') return this.stepWalk('on', sp);
      if (this.phase === 'endwalk') return this.stepEndWalk(sp);
      if (this.phase === 'replay') return this.stepReplay(sp);
      if (this.phase === 'shootout') return this.stepShootout(sp);
      if (this.phase === 'paused') return;
      if (this.ballMode === 'penalty') { this.stepPenalty(sp); return; }
      // başlama vuruşu donması: oyuncular dizilişte beklesin (santrada tek topçu görünsün)
      if (this.kickoffFreeze > 0) {
        this.kickoffFreeze -= sp; const ow = this.owner != null ? this.players[this.owner] : null;
        if (ow) { this.ball.x = ow.x; this.ball.y = ow.y; }   // top santrada, topçunun ayağında
        return;
      }
      // santra geri pası: topçu freeze bitince kendi yarısındaki en yakın arkadaşına geriye paslar → oyun başlar
      if (this._kickoffBackPass && this.ballMode === 'held' && this.owner != null) {
        this._kickoffBackPass = false;
        const o = this.players[this.owner]; const dir = o.team === 0 ? 1 : -1;
        const behind = [];
        for (let k = 0; k < 22; k++) { const m = this.players[k]; if (!m || !m.ref || m.team !== o.team || m === o || m.isGK || m.sentOff) continue; if ((m.x - o.x) * dir < -10) behind.push(m); }
        let best = null;
        if (behind.length) {
          const deep = behind.filter(m => m.line <= 2);   // savunmacı / ön libero → net geriye pas
          const pool = deep.length ? deep : behind;
          pool.sort((a, b) => Math.abs(a.y - this.H / 2) - Math.abs(b.y - this.H / 2));   // en merkezdeki
          best = pool[0];
        }
        if (best) { this.passTo(o, best, 0); this.say('Santra yapıldı — top geriye verildi, oyun başlıyor.', 'info'); }
        else { this.actCD = 8; }   // geride kimse yoksa normal oyuna dön
      }
      this.updateSubWalkers(sp);
      const owner = this.owner != null ? this.players[this.owner] : null;
      const poss = this.poss;
      const frozen = this.deadCD > 0 && (!!this.goalFlash || this.ballMode === 'dead');

      // savunan takım: baskı (pressN kişi) + bölgesel markaj; hücum: 2 koşucu
      const markBy = {}; const presserSet = new Set(); const runnerSet = new Set();
      if (owner && !frozen) {
        const defTeam = 1 - poss;
        const defs = [], atts = [];
        for (let i = 0; i < 22; i++) { const p = this.players[i]; if (!p || !p.ref || p.isGK || p.sentOff || i === this.owner) continue; if (p.team === defTeam) defs.push(i); else atts.push(i); }
        const dtac = this.tac[defTeam];
        // baskıcılar: topa en yakın pressN savunmacı (menzil içinde, en az 1)
        const byDist = defs.slice().sort((a, b) => dist(this.players[a], owner) - dist(this.players[b], owner));
        for (const di of byDist) { if (presserSet.size >= dtac.pressN) break; if (presserSet.size === 0 || dist(this.players[di], owner) < dtac.pressR) presserSet.add(di); }
        // markaj: kalan savunmacılar tehdit sırasına göre en yakın hücumcuyu tutar
        const og = this.ownGoal(defTeam);
        atts.sort((x, y) => dist(this.players[x], og) - dist(this.players[y], og));
        const used = new Set(presserSet);
        atts.forEach(ai => { let bd = 1e9, bi = -1; defs.forEach(di => { if (used.has(di)) return; const d = dist(this.players[di], this.players[ai]); if (d < bd) { bd = d; bi = di; } }); if (bi >= 0) { used.add(bi); markBy[bi] = ai; } });
        // koşucular: agresif taktikte daha çok oyuncu derine koşar
        const dr = poss === 0 ? 1 : -1; const g = this.goalFor(poss);
        const runnerN = Math.min(4, 1 + Math.round(this.tac[poss].commit * 1.7));
        const fwd = atts.filter(ai => (this.players[ai].x - owner.x) * dr > -40).sort((x, y) => dist(this.players[x], g) - dist(this.players[y], g));
        for (let k = 0; k < Math.min(runnerN, fwd.length); k++) runnerSet.add(fwd[k]);
      }

      this.players.forEach((p, i) => {
        if (!p.ref || p.sentOff) return;
        const dir = p.team === 0 ? 1 : -1; const myTac = this.tac[p.team];
        const attacking = poss === p.team;
        const task = (p.ref && p.ref.task) || 'Denge';
        const taskOff = task === 'Hücum' ? 1 : task === 'Savunma' ? -1 : 0;
        // BLOK topun boylamına göre yukarı/aşağı kayar — formasyon hat aralıkları (hx) korunur,
        // böylece "ip gibi ortada toplanma" olmaz; takım sahada ileri/geri hareket eder.
        const W = this.W, commit = myTac.commit;
        // topun, bu oyuncunun HÜCUM yönündeki ilerlemişliği (0 = kendi kalesi, 1 = rakip kale)
        const adv = p.team === 0 ? this.ball.x / W : 1 - this.ball.x / W;
        const wide = Math.abs(p.hy - this.H / 2) > this.H * 0.16;   // kanat oyuncusu mu
        let tx, ty = this.H / 2 + (p.hy - this.H / 2) * (myTac.width * (attacking ? 1.04 : 0.88));
        if (attacking) {
          // TÜM TAKIM topyekûn yukarı çıkar ama KOMPAKT: derin oyuncular (defans/orta saha) daha çok adım atar,
          // forvetler zaten yukarıda olduğu için az → blok öne taşınır, forvetler ofsayt çizgisini aşmaz.
          const lineLift = 1.25 - p.fwd * 0.62;   // fwd 0 (defans) ~1.25 · fwd 1 (forvet) ~0.63
          tx = p.hx + dir * commit * (90 + adv * 300) * lineLift + dir * taskOff * 24;
          if (wide) ty += (p.hy < this.H / 2 ? -1 : 1) * (16 + myTac.wing * 22 + commit * 12);   // kanatları çizgiye yapıştır (overlap)
        } else {
          // savunmada blok geri çekilir; rakip ne kadar ilerlediyse (threat) o kadar, dizilişi koruyarak.
          const threat = 1 - adv;
          tx = p.hx - dir * (22 + threat * 170) * (0.5 + (1 - p.fwd) * 0.55) + dir * taskOff * 8;
        }
        if (owner) ty += (owner.y - this.H / 2) * (attacking ? 0.06 : 0.12);

        const isTaker = this.ballMode === 'restart' && this.restart && i === this.restart.idx;
        const cornerOn = this.ballMode === 'restart' && this.restart && this.restart.cross;
        // kornerde GK + 2 stoper hariç herkes ceza sahasına doluşur (arkada sadece 1-2 kişi kalır)
        const cornerCrowd = cornerOn && attacking && !p.isGK && !isTaker && (p.line >= 2 || (p.line === 1 && POS[p.pos] && POS[p.pos].side !== 'C'));
        // savunan takım da kendi ceza sahasını doldurur (markaj) — sadece 1 forvet ileride kalır
        const defendCorner = cornerOn && !attacking && !p.isGK && p.line < 6;
        if (isTaker) { tx = this.ball.x; ty = this.ball.y; }   // taç/korneri kullanacak oyuncu topa yürür
        else if (cornerCrowd) { const gg = this.goalFor(p.team); tx = gg.x - dir * (24 + (i % 4) * 18); ty = this.H / 2 + (((i * 53) % 170) - 85); }   // kornerde ceza sahasına doluş
        else if (defendCorner) { const og = this.ownGoal(p.team); tx = og.x + dir * (16 + (i % 4) * 15); ty = this.H / 2 + (((i * 71) % 200) - 100); }   // savunmada kendi sahasına markaja düş
        else if (i === this.owner) {
          // top taşıyıcı: en yakın rakipten yana kaçar; kanattaysa çizgi boyunca byline'a, merkezde kaleye
          const gg = this.goalFor(p.team); let nd = null, ndd = 1e9;
          for (let k = 0; k < 22; k++) { const o = this.players[k]; if (!o || !o.ref || o.team === p.team || o.isGK) continue; const dd = dist(o, p); if (dd < ndd) { ndd = dd; nd = o; } }
          const sy = (nd && ndd < 70) ? ((p.y - nd.y) >= 0 ? 1 : -1) : 0;
          const ownerWide = Math.abs(p.y - this.H / 2) > this.H * 0.17 && (p.x - this.W / 2) * dir > -60;
          tx = p.x + dir * (2.5 + p.sp * 0.02);
          ty = p.y + sy * 1.7 + (ownerWide ? (p.y < this.H / 2 ? -1 : 1) * 1.3 : (gg.y - p.y) * 0.02);
        }
        else if (attacking && !p.isGK && runnerSet.has(i)) {
          // boş alana koşu: kaleye doğru derine + en yakın savunmacıdan uzağa açıl (adam adama ayrılma)
          let nd = null, ndd = 1e9; for (let k = 0; k < 22; k++) { const o = this.players[k]; if (!o || !o.ref || o.team === p.team || o.isGK) continue; const dd = dist(o, p); if (dd < ndd) { ndd = dd; nd = o; } }
          const away = (nd && ndd < 85) ? ((p.y - nd.y) >= 0 ? 1 : -1) : (p.hy < this.H / 2 ? -1 : 1);
          tx += dir * 46; ty += away * 12 + Math.sin((this.t + i * 23) / 24) * 9;
        }
        else if (presserSet.has(i) && owner) { tx = owner.x; ty = owner.y; }
        else if (markBy[i] != null) { const mk = this.players[markBy[i]]; const og = this.ownGoal(p.team); tx = mk.x + (og.x - mk.x) * 0.14; ty = mk.y; }
        if (p.isGK) { const og = this.ownGoal(p.team); tx = og.x + dir * (22 + (attacking ? 12 : 0)); ty = lerpf(this.H / 2, this.ball.y, 0.30); }
        if (!isTaker) { tx += Math.sin((this.t + i * 17) / 26) * 2.8; ty += Math.cos((this.t + i * 11) / 24) * 2.8; }
        tx = clamp(tx, 24, this.W - 24); ty = clamp(ty, 30, this.H - 30);
        const stamFac = 0.62 + 0.38 * (p.stam / 100);
        // hücum eden oyuncular daha hızlı yer alır (topla beraber yukarı çıkabilsinler), savunanlar da çabuk toparlanır
        const baseStep = (i === this.owner || isTaker) ? 2.6 : (cornerCrowd || defendCorner || presserSet.has(i) || runnerSet.has(i)) ? 2.5 : attacking ? 2.1 : 1.75;
        const maxStep = (frozen ? 0.5 : baseStep) * sp * stamFac;
        const ox = p.x, oy = p.y;
        p.x += clamp(tx - p.x, -maxStep, maxStep); p.y += clamp(ty - p.y, -maxStep, maxStep);
        // stamina: hareket + baskı + tempoya göre düşer (FİZ yavaşlatır). ~60'da belirgin yorgunluk.
        if (!frozen) { const moved = Math.hypot(p.x - ox, p.y - oy); p.stam = Math.max(12, p.stam - (0.004 + moved * 0.0016 + (presserSet.has(i) || i === this.owner ? 0.006 : 0)) * (1.25 - p.fiz / 130) * this.tac[p.team].tempo * sp * 2.7); }
      });

      // taç/korner: oyuncu topa ulaşınca oyun başlar
      if (this.ballMode === 'restart' && this.restart) {
        const tk = this.players[this.restart.idx];
        if (tk && dist(tk, this.ball) < 15) {
          if (this.restart.cross) {
            // topun başında bekle, oyuncular ceza sahasına dolsun → sonra ortala
            let inbox = 0; const team = this.restart.team;
            for (let k = 0; k < 22; k++) { const p = this.players[k]; if (p && p.ref && p.team === team && !p.isGK && this.inPenaltyBox(p, 1 - team)) inbox++; }
            this.restart.wait = (this.restart.wait || 0) + sp;
            if (inbox >= 5 || this.restart.wait > 170) this.beginPossession(this.restart.idx, this.restart.team, true);
          } else {
            // frikik/taç/kale vuruşu: oyuncu topun başında bekler, takımlar dizilir (bazen hızlı=kontra, bazen yavaş)
            this.restart.wait = (this.restart.wait || 0) + sp;
            if (this.restart.wait > (this.restart.org || 10)) this.beginPossession(this.restart.idx, this.restart.team, false, this.restart.shoot);
          }
        }
      }

      // top — tutulan top oyuncuya YUVARLANIR (sahip değişince ışınlanmaz)
      if (this.ballMode === 'held' && owner) {
        const tx = owner.x + (owner.team === 0 ? 12 : -12), ty = owner.y;
        const jump = Math.hypot(tx - this.ball.x, ty - this.ball.y);
        if (jump > 40) { this.ball.x = lerpf(this.ball.x, tx, 0.5); this.ball.y = lerpf(this.ball.y, ty, 0.5); }
        else { this.ball.x = tx; this.ball.y = ty; }
      }
      else if (this.ballMode === 'pass' || this.ballMode === 'shot') {
        // pas hedefi alıcıyı takip eder → top oyuncuya ulaşır, ışınlanmaz (taça giden pas hariç)
        if (this.ballMode === 'pass' && !this._passWayward) {
          const ti = this._intercept != null ? this._intercept : this._passTarget;
          const rp = ti != null ? this.players[ti] : null;
          if (rp && rp.ref) { this.ball.tx = rp.x + (rp.team === 0 ? 11 : -11); this.ball.ty = rp.y; }
        }
        const f = Math.min(0.17 * sp, 0.7);
        this.ball.x = lerpf(this.ball.x, this.ball.tx, f); this.ball.y = lerpf(this.ball.y, this.ball.ty, f);
        if (this.ballMode === 'pass' && (this.ball.y < 22 || this.ball.y > this.H - 22)) this.setThrow(1 - this.poss);
        else if (Math.hypot(this.ball.x - this.ball.tx, this.ball.y - this.ball.ty) < 13) this.onBallArrive();
      } else if (this.ballMode === 'dead' && !this.goalFlash) {
        // duran top yerine yuvarlanır (ışınlanma yok) — taç/korner/aut noktasına gider
        this.ball.x = lerpf(this.ball.x, this.ball.tx, 0.14 * sp + 0.035); this.ball.y = lerpf(this.ball.y, this.ball.ty, 0.14 * sp + 0.035);
      } else if (this.ballMode === 'restart') {
        this.ball.x = lerpf(this.ball.x, this.ball.tx, 0.12 * sp + 0.03); this.ball.y = lerpf(this.ball.y, this.ball.ty, 0.12 * sp + 0.03);
      }
      this._possAcc += poss === 0 ? 100 : 0; this._possN++;

      // hakem oyunu UZAKTAN takip eder; yavaş hareket eder, topa çok yaklaşmaz, duran toplarda ceza sahasına bakar
      if (this.ref) {
        let rtx, rty;
        const setPiece = this.ballMode === 'penalty' || (this.ballMode === 'restart' && this.restart && this.restart.cross);
        if (setPiece) {
          const atk = this.ballMode === 'penalty' ? (this.pen ? this.pen.team : 0) : this.restart.team;
          const gx = this.goalFor(atk).x, d = atk === 0 ? 1 : -1;
          rtx = gx - d * 135; rty = this.H / 2 + (this.ball.y < this.H / 2 ? 70 : -70);
        } else { rtx = clamp(this.ball.x - 70, 80, this.W - 80); rty = clamp(this.ball.y + 64, 60, this.H - 60); }
        // ölü bölge: yalnızca hedef yeterince uzaklaşınca ve yavaşça yürür (sürekli oynamaz)
        const d2 = (this.ref.x - rtx) ** 2 + (this.ref.y - rty) ** 2;
        if (d2 > 34 * 34) { this.ref.x = lerpf(this.ref.x, rtx, 0.011 * sp + 0.003); this.ref.y = lerpf(this.ref.y, rty, 0.011 * sp + 0.003); }
      }

      // gol tekrarı için canlı oyunun son anlarını kaydet
      if (!frozen) this.recordFrame();
      // seyrek kendiliğinden (kas) sakatlığı — yorgun oyuncu daha riskli
      if (!frozen && Math.random() < 0.00006) { const vi = randi(0, 21); const vp = this.players[vi]; this.maybeInjure(vp, vp && vp.stam < 45 ? 1 : 0.55); }

      // momentum (baskı) — sahiplik + topun ilerlemişliği
      if (!frozen) {
        const adv0 = this.ball.x / this.W, adv = poss === 0 ? adv0 : (1 - adv0);
        const target = (poss === 0 ? 1 : -1) * (0.35 + 0.65 * adv);
        this.momentum = lerpf(this.momentum, target, 0.04);
      }

      // top kapma / faul — en yakın baskıcı
      if (this.ballMode === 'held' && owner && !owner.isGK && this.deadCD <= 0 && presserSet.size) {
        let presserIdx = -1, pd = 1e9; presserSet.forEach(di => { const d = dist(this.players[di], owner); if (d < pd) { pd = d; presserIdx = di; } });
        const pr = this.players[presserIdx];
        if (pr && dist(pr, owner) < 18) {
          // hücumcu rakip ceza sahasındaysa faul → penaltı. Faul oranı düşük (oyun takılmasın).
          const inBox = this.inPenaltyBox(owner, 1 - owner.team);
          if (Math.random() < (inBox ? 0.004 : 0.0045)) { this.foul(presserIdx); }
          else if (Math.random() < 0.03 * (pr.df / (owner.sp + 12)) * (owner.stam < 45 ? 1.4 : 1)) { this.turnover(presserIdx); }
        }
      }

      // sahip aksiyonu + spiker (atak)
      this.actCD -= sp;
      if (this.ballMode === 'held' && owner && this.actCD <= 0) { this.actCD = (8 + Math.random() * 9) / this.tac[poss].tempo; this.ownerAction(owner); }
      this.attackCommentary(owner);

      // devre arası — atak/duran top sürüyorsa bekle (45+X uzatma)
      if (!this.halftimeDone && this.clock >= 45 && !this._inET) {
        if (this.clock >= 48 || this._ballSafe()) { this.halftimeDone = true; this.halftime(); return; }
      }
      // uzatma devre arası (105') — atak güvendeyse
      if (this._inET && !this._etHalfDone && this.clock >= 105) {
        if (this.clock >= 107 || this._ballSafe()) { this._etHalfDone = true; this.halftime('et-half'); return; }
      }
      if (this.deadCD > 0) { this.deadCD -= sp; if (this.deadCD <= 0) this.afterDead(); }

      this.clock += 0.024 * sp;   // ~ 62 sn / maç (1x)
      // 90. dk: atak sürüyorsa bitmez. Beraberlik + eleme maçı ise uzatmaya → penaltıya.
      if (!this.ended && !this._inET && this.clock >= 90) {
        if (!this._stoppage) { this._stoppage = true; this.say('90 dakika doldu — uzatma anları oynanıyor.', 'info'); }
        if ((this.clock >= 95 || this._ballSafe())) {
          if (this.a === this.b && this.mustWin) this.startExtraTime();
          else this.finish();
        }
      } else if (!this.ended && this._inET && this.clock >= 120) {
        if (!this._etStoppage) { this._etStoppage = true; }
        if ((this.clock >= 125 || this._ballSafe())) {
          if (this.a === this.b) this.startShootout();
          else this.finish();
        }
      }
    }
    clockStr() {
      const c = Math.floor(this.clock);
      if (!this.halftimeDone && c >= 45) return '45+' + (c - 45) + "'";
      if (this._inET) { if (!this._etHalfDone && c >= 105) return "105+" + (c - 105) + "'"; if (c >= 120) return "120+" + (c - 120) + "'"; return c + "'"; }
      if (c >= 90) return "90+" + (c - 90) + "'";
      return c + "'";
    }
    _ballSafe() {
      // duran top / restart / penaltı / şut / pas sürüyorsa GÜVENLİ DEĞİL (kornerde/frikikte düdük çalmaz)
      if (this.ballMode === 'dead' || this.ballMode === 'restart' || this.ballMode === 'penalty' || this.ballMode === 'shot' || this.ballMode === 'pass') return false;
      const o = this.owner != null ? this.players[this.owner] : null;
      const inAtt = o && Math.abs(o.x - this.goalFor(this.poss).x) < this.W * 0.42;
      return !(this.ballMode === 'held' && inAtt);   // hücumda da bekle
    }
    startExtraTime() {
      this._inET = true; this.clock = 90; this.halftimeDone = true;
      this.halftime('et-start');   // uzatma öncesi taktik molası → devamında uzatma başlar
    }
    /* ---- Penaltı atışları (seri) ---- */
    startShootout() {
      this.phase = 'shootout'; this.owner = null; this.ballMode = 'dead';
      this.shootout = { a: 0, b: 0, kicksA: 0, kicksB: 0, kickTeam: Math.random() < 0.5 ? 0 : 1, history: [], pen: null, done: false, gap: 0 };
      this.say('Uzatmalar da yetmedi — PENALTI ATIŞLARI!', 'info'); this.flash = null;
      // kaleciler kendi kalelerinde, diğerleri orta yuvarlak yakınında düzenli dizilir
      this.players.forEach((p, i) => {
        if (!p.ref) return;
        if (p.isGK) { const og = this.ownGoal(p.team); p.x = og.x + (p.team === 0 ? 28 : -28); p.y = this.H / 2; }
        else { const r = i % 11; p.x = this.W / 2 + (p.team === 0 ? -1 : 1) * 58; p.y = 95 + (r - 1) * ((this.H - 190) / 9); }
      });
      this._setupShootKick();
    }
    _setupShootKick() {
      const s = this.shootout, team = s.kickTeam, base = team === 0 ? 0 : 11;
      const takers = []; for (let i = 1; i < 11; i++) { const p = this.players[base + i]; if (p && p.ref && !p.isGK && !p.sentOff) takers.push(base + i); }
      takers.sort((x, y) => this.players[y].sh - this.players[x].sh);
      const taken = team === 0 ? s.kicksA : s.kicksB;
      const idx = takers.length ? takers[taken % takers.length] : base + 9;
      const spotX = team === 0 ? this.W - 24 - 132 : 24 + 132;
      s.pen = { team, takerIdx: idx, spotX, phase: 'setup', t: 0, dive: 0 };
      const tk = this.players[idx]; tk.x = spotX - (team === 0 ? 1 : -1) * 26; tk.y = this.H / 2;
      this.ball.x = spotX; this.ball.y = this.H / 2;
    }
    stepShootout(sp) {
      const s = this.shootout; if (!s) { this.finish(); return; }
      if (s.done) return;
      if (!s.pen) { s.gap = (s.gap || 0) + sp; if (s.gap > 14) { s.gap = 0; this._setupShootKick(); } return; }
      const pen = s.pen; pen.t += sp; const team = pen.team, dir = team === 0 ? 1 : -1, g = this.goalFor(team);
      const defGK = team === 0 ? this.players[11] : this.players[0];
      // sahnele: şutçu noktada, savunan kaleci çizgide (dalış), diğerleri yerinde
      this.players.forEach((p, i) => {
        if (!p.ref) return; let tx = p.x, ty = p.y;
        if (i === pen.takerIdx) { tx = pen.spotX - dir * ((pen.phase === 'run' || pen.phase === 'flying') ? 6 : 26); ty = this.H / 2; }
        else if (p.isGK && p.team !== team) { tx = g.x - dir * 5; ty = this.H / 2 + (pen.phase === 'flying' ? pen.dive : 0); }
        else if (p.isGK) { tx = this.ownGoal(team).x + dir * 26; ty = this.H / 2; }
        p.x += clamp(tx - p.x, -2.6 * sp, 2.6 * sp); p.y += clamp(ty - p.y, -2.6 * sp, 2.6 * sp);
      });
      if (pen.phase === 'setup') { this.ball.x = pen.spotX; this.ball.y = this.H / 2; if (pen.t > 20) { pen.phase = 'run'; pen.t = 0; } }
      else if (pen.phase === 'run') {
        this.ball.x = pen.spotX; this.ball.y = this.H / 2;
        if (pen.t > 12) {
          pen.phase = 'flying'; pen.t = 0;
          const gkSave = defGK && defGK.df ? defGK.df : 60;
          pen.scored = Math.random() < 0.74 - gkSave / 640;
          const corner = Math.random() < 0.5 ? -1 : 1;
          if (pen.scored) { this.ball.tx = g.x; this.ball.ty = this.H / 2 + corner * 24; pen.dive = -corner * 40; }   // kale içi, kaleci ters köşe
          else { this.ball.tx = g.x - dir * 6; this.ball.ty = this.H / 2 + corner * 22; pen.dive = corner * 22; }     // kaleci kurtarır
          if (team === 0) { this.stats.shotsA++; this.stats.sotA++; } else { this.stats.shotsB++; this.stats.sotB++; }
        }
      } else if (pen.phase === 'flying') {
        this.ball.x = lerpf(this.ball.x, this.ball.tx, 0.18 + 0.12 * sp); this.ball.y = lerpf(this.ball.y, this.ball.ty, 0.18 + 0.12 * sp);
        if (Math.hypot(this.ball.x - this.ball.tx, this.ball.y - this.ball.ty) < 12) {
          if (team === 0) { s.kicksA++; if (pen.scored) s.a++; } else { s.kicksB++; if (pen.scored) s.b++; }
          s.history.push({ team, scored: !!pen.scored });
          this.say((team === 0 ? this.clubA.name : this.clubB.name) + (pen.scored ? ' GOL!' : ' KAÇIRDI!') + ' (' + s.a + '-' + s.b + ')', pen.scored ? 'goal' : 'save');
          s.pen = null;
          if (this._shootDecided()) {
            s.done = true; this.penWinner = s.a > s.b ? 'a' : 'b';
            this.say('Penaltılarda ' + (s.a > s.b ? this.clubA.name : this.clubB.name) + ' kazandı! ' + s.a + '-' + s.b, 'end');
            this.finish();
          } else { s.kickTeam = 1 - team; }
        }
      }
    }
    _shootDecided() {
      const s = this.shootout; const ka = s.kicksA, kb = s.kicksB;
      const remA = Math.max(0, 5 - ka), remB = Math.max(0, 5 - kb);
      if (ka < 5 || kb < 5) { if (s.a > s.b + remB) return true; if (s.b > s.a + remA) return true; return false; }
      if (ka === kb && s.a !== s.b) return true;   // ilk 5 + ani ölüm: eşit sayıda atış, fark varsa biter
      return false;
    }

    attackCommentary(owner) {
      if (!owner || this.ballMode !== 'held') return;
      const g = this.goalFor(owner.team); const distGoal = Math.abs(owner.x - g.x);
      const third = distGoal < this.W * 0.30 ? owner.team : -1;
      if (third !== -1 && third !== this._lastThird && Math.random() < 0.5) {
        this._lastThird = third;
        const ph = ['atağa çıkıyor', 'tehlikeli bölgede', 'baskıyı artırıyor', 'ileri çıkıyor'];
        this.say(this.clubName(third) + ' ' + pick(ph) + '…', 'attack');
      }
      if (distGoal > this.W * 0.4) this._lastThird = -1;
    }
    /* Savunan takımın ofsayt çizgisi (son saha oyuncusunun x'i) */
    offsideLine(defTeam) {
      const adir = (1 - defTeam) === 0 ? 1 : -1;   // hücum yönü
      let best = null, bv = -1e9;
      for (let i = 0; i < 22; i++) { const p = this.players[i]; if (!p || !p.ref || p.team !== defTeam || p.isGK) continue; const v = p.x * adir; if (v > bv) { bv = v; best = p; } }
      return best ? best.x : this.W / 2;
    }
    setOffside(team, atPlayer) {   // team = serbest vuruşu kullanacak savunan takım
      this.ball.tx = atPlayer ? atPlayer.x : this.W / 2; this.ball.ty = atPlayer ? atPlayer.y : this.H / 2;
      this.owner = null; this.ballMode = 'dead'; this.deadCD = 16; this.nextKickTeam = team; this._dead = 'offside';
      this.flash = { txt: 'OFSAYT', col: '#eaf0f6' }; this._flashUntil = this.t + 40;
      this.say('Ofsayt! ' + this.clubName(1 - team) + ' pozisyonda yakalandı.', 'set');
    }
    nearestOppDist(p) {
      let d = 1e9; for (let i = 0; i < 22; i++) { const o = this.players[i]; if (!o || !o.ref || o.team === p.team || o.isGK || o.sentOff) continue; const dd = dist(o, p); if (dd < d) d = dd; } return d;
    }
    passTo(owner, target, interceptBase) {
      let ty = target.y; this._passWayward = false;
      if (Math.random() < 0.035) { ty = (target.y < this.H / 2 ? 6 : this.H - 6); this._passWayward = true; }   // ara sıra taç (alıcıyı takip etme)
      this.ballMode = 'pass'; this.ball.tx = target.x; this.ball.ty = ty; this._passTarget = this.players.indexOf(target);
      this._passerId = owner.ref.id; this._intercept = null;
      const ib = interceptBase == null ? 0.08 : interceptBase;
      for (const o of this.players) { if (o.team === owner.team || !o.ref || o.isGK) continue; if (segDist(owner, { x: target.x, y: ty }, o) < 13 && Math.random() < ib) { this._intercept = this.players.indexOf(o); break; } }
    }
    cross(owner) {   // kanattan ceza sahasına orta
      const team = owner.team, dir = team === 0 ? 1 : -1;
      const box = [];
      for (let i = 0; i < 22; i++) { const p = this.players[i]; if (p && p.ref && p.team === team && !p.isGK && !p.sentOff && p !== owner && this.inPenaltyBox(p, 1 - team)) box.push(p); }
      let target = box.length ? box[Math.floor(Math.random() * box.length)] : this.players.filter(p => p.team === team && p.ref && !p.isGK && p !== owner).sort((a, b) => (b.x - a.x) * dir)[0];
      if (!target) return this.shoot(owner);
      this.passTo(owner, target, 0.17);
    }
    ownerAction(owner) {
      const team = owner.team, dir = team === 0 ? 1 : -1, g = this.goalFor(team); const tac = this.tac[team]; const W = this.W;
      const distGoal = Math.abs(owner.x - g.x); const sb = tac.shoot;
      const wide = Math.abs(owner.y - this.H / 2) > this.H * 0.20;
      const press = this.nearestOppDist(owner); const pressed = press < 22;
      const attThird = distGoal < W * 0.33;
      const mates = this.players.filter(p => p.team === team && p !== owner && p.ref && !p.isGK && !p.sentOff);
      const opt = mates.map(m => ({ m, gain: (m.x - owner.x) * dir, d: dist(m, owner), open: this.nearestOppDist(m) }));

      // ŞUT — sadece ceza sahası ve hafif gerisinden. Orta sahadan şut YOK.
      if (!wide && distGoal < W * 0.13) { if (Math.random() < 0.95 * sb) return this.shoot(owner); }       // ceza sahası içi
      else if (!wide && distGoal < W * 0.19) { if (Math.random() < 0.74 * sb) return this.shoot(owner); }   // sahanın hemen önü
      else if (!wide && distGoal < W * 0.23) { if (Math.random() < 0.22 * sb) return this.shoot(owner); }   // ceza sahası hafif gerisi — nadir uzaktan şut
      else if (wide && distGoal < W * 0.16) { if (Math.random() < 0.40 * sb) return this.shoot(owner); }     // dar açı

      // ===== SON BÖLGE: penetrasyon (geri çevirme yok) =====
      if (attThird) {
        if (wide) {
          // byline'a yakınsa ORTA kes; değilse kanattan derine sür
          if (distGoal < W * 0.20 || Math.random() < 0.5) return this.cross(owner);
          if (!pressed) return;
        }
        // merkez: kutudaki boş koşucuya ÖLDÜRÜCÜ ara pas (akan oyundan gol kaynağı)
        const thru = opt.filter(o => o.gain > 4 && o.open > 10 && o.d < W * 0.36).sort((a, b) => (b.gain * 0.6 + b.open) - (a.gain * 0.6 + a.open))[0];
        if (thru && Math.random() < 0.62) {
          if (thru.gain > 50) { const offLine = this.offsideLine(1 - team); if ((thru.m.x - offLine) * dir > 18 && Math.random() < 0.3) return this.setOffside(1 - team, thru.m); }
          return this.passTo(owner, thru.m, 0.07);
        }
        // boştaki kanat oyuncusuna çıkar (orta hazırlığı)
        const woA = opt.filter(o => Math.abs(o.m.y - this.H / 2) > this.H * 0.24 && o.open > 15 && o.d < W * 0.3).sort((a, b) => b.open - a.open)[0];
        if (woA && Math.random() < 0.4) return this.passTo(owner, woA.m, 0.06);
        if (distGoal > W * 0.17 && Math.random() < 0.62) return;   // kutuya girmek için topu sür (uzaktan şutlama)
        const side = opt.filter(o => o.d < W * 0.26 && o.open > 16).sort((a, b) => b.open - a.open)[0];
        if (side) return this.passTo(owner, side.m, 0.05);
        if (distGoal < W * 0.22) return this.shoot(owner);   // sadece yakınsa şut
        return;
      }

      // ===== KURULUŞ (kendi / orta saha) =====
      // 1) KANADA AÇ (öncelik) — geniş, ileri, boştaki oyuncuya
      if (Math.random() < 0.46 + tac.wing * 0.3) {
        const wo = opt.filter(o => Math.abs(o.m.y - this.H / 2) > this.H * 0.20 && o.gain > -18 && o.open > 14 && o.d < W * 0.5).sort((a, b) => (b.gain + b.open * 0.5) - (a.gain + a.open * 0.5))[0];
        if (wo) return this.passTo(owner, wo.m, 0.06);
      }
      // 2) İLERİ-BOŞ progresif pas
      const fwdOpts = opt.filter(o => o.gain > 22 && o.d < W * 0.5 && o.open > 12);
      if (fwdOpts.length && Math.random() < 0.6) {
        const best = fwdOpts.sort((a, b) => (b.gain * 0.05 + b.open * 0.07) - (a.gain * 0.05 + a.open * 0.07))[0];
        if (best.gain > 65) { const offLine = this.offsideLine(1 - team); if ((best.m.x - offLine) * dir > 18 && Math.random() < 0.3) return this.setOffside(1 - team, best.m); }
        return this.passTo(owner, best.m, 0.07);
      }
      // 3) Sür
      if (!pressed && Math.random() < 0.45) return;
      // 4) Baskı altında verkaç / topu çevir
      if (pressed) { const safe = opt.filter(o => o.d < W * 0.28 && o.open > 18).sort((a, b) => b.open - a.open)[0]; if (safe) return this.passTo(owner, safe.m, 0.05); }
      const keep = opt.filter(o => o.d < W * 0.32).sort((a, b) => (b.open + b.gain * 0.03) - (a.open + a.gain * 0.03))[0];
      if (keep) return this.passTo(owner, keep.m, 0.05);
      return this.shoot(owner);
    }
    onBallArrive() {
      if (this.ballMode === 'pass') {
        const ni = this._intercept != null ? this._intercept : this._passTarget;
        const recv = this.players[ni];
        if (this._intercept == null && this._passerId != null) this._lastPass = { id: this._passerId, team: recv.team };
        else this._lastPass = null;
        this.owner = ni; this.poss = recv.team; this.ballMode = 'held'; this._intercept = null; this.actCD = (8 + Math.random() * 10) / this.tac[this.poss].tempo;
      } else if (this.ballMode === 'shot') this.resolveShot();
    }
    shoot(owner) {
      const team = owner.team; const g = this.goalFor(team);
      if (team === 0) this.stats.shotsA++; else this.stats.shotsB++;
      const tired = owner.stam < 45 ? 0.85 : 1;
      this._shotDist = Math.abs(owner.x - g.x);
      // xG: pozisyon kalitesi (mesafe + açı)
      const central = Math.abs(owner.y - this.H / 2) < this.H * 0.17;
      let xg = clamp(0.72 * Math.exp(-(this._shotDist / this.W) * 8.5), 0.02, 0.6); if (!central) xg *= 0.55;
      if (team === 0) this.stats.xgA += xg; else this.stats.xgB += xg;
      const distPen = clamp(1 - (this._shotDist / (this.W * 0.30)) * 0.55, 0.4, 1);  // uzaktan isabet zor
      const onTarget = Math.random() < (0.42 + owner.sh / 320) * tired * distPen;
      this._shotOnTarget = onTarget; this._shotTeam = team; this._shotOwner = owner;
      this.ballMode = 'shot';
      // isabetli şut KALE İÇİNE gider (±26, kale direkleri ±34); isabetsiz direklerin AÇIKÇA dışına
      this.ball.tx = g.x;
      this.ball.ty = this.H / 2 + (onTarget ? (Math.random() * 52 - 26) : (Math.random() < 0.5 ? -1 : 1) * (46 + Math.random() * 55));
      this.say(this.clubName(team) + ' şutu çekiyor' + (onTarget ? '!' : '…'), 'shot');
    }
    resolveShot() {
      const team = this._shotTeam, owner = this._shotOwner, g = this.goalFor(team);
      if (this._shotOnTarget) {
        if (team === 0) this.stats.sotA++; else this.stats.sotB++;
        const def = team === 0 ? this.sB.defense : this.sA.defense, att = team === 0 ? this.sA.attack : this.sB.attack;
        const gk = team === 0 ? this.players[11] : this.players[0]; const gkSave = gk && gk.df ? gk.df : 60;
        const tired = owner.stam < 45 ? 0.88 : 1;
        // uzaklık cezası: kale dışından gelen şutlar neredeyse hiç gol olmaz
        const distFac = clamp(1 - ((this._shotDist || 0) / (this.W * 0.30)) * 0.5, 0.22, 1);
        const goalP = Math.min(0.85, 2.0 * (owner.sh / 78) * (att / (att + def)) * 2 * (1 - gkSave / 230) * tired * distFac);
        if (Math.random() < goalP) {
          if (team === 0) this.a++; else this.b++; this.fireGoal(team, owner.ref);
          const gy = clamp(this.ball.ty, this.H / 2 - 30, this.H / 2 + 30);   // top kale içinde kalsın
          this.ball.x = g.x; this.ball.y = gy; this.ball.tx = g.x; this.ball.ty = gy;
          this.goalFlash = { team, name: surOf(owner.ref) };
          this.owner = null; this.ballMode = 'dead'; this.deadCD = 64; this.nextKickTeam = 1 - team; this._dead = 'goal';
          return;
        }
        // kurtarış → korner ihtimali
        this.say('Müthiş kurtarış! Kaleci çıkardı.', 'save'); this.flash = { txt: 'KURTARIŞ', col: '#eaf0f6' }; this._flashUntil = this.t + 32;
        if (Math.random() < 0.62) return this.setCorner(team);
        return this.setGoalKick(1 - team);
      }
      // isabetsiz → korner ya da aut
      this.say('Şut auta gitti.', 'miss');
      if (Math.random() < 0.45) return this.setCorner(team);
      return this.setGoalKick(1 - team);
    }
    setCorner(team) {
      if (team === 0) this.stats.cornersA++; else this.stats.cornersB++;
      const g = this.goalFor(team); const cy = Math.random() < 0.5 ? 28 : this.H - 28;
      this.ball.tx = g.x; this.ball.ty = cy;   // top köşeye yuvarlanır (snap yok)
      this.owner = null; this.ballMode = 'dead'; this.deadCD = 22; this.nextKickTeam = team; this._dead = 'corner';
      this.say('Korner — ' + this.clubName(team) + '.', 'set');
    }
    setGoalKick(team) {
      const og = this.ownGoal(team); this.ball.tx = og.x + (team === 0 ? 30 : -30); this.ball.ty = this.H / 2;
      this.owner = null; this.ballMode = 'dead'; this.deadCD = 16; this.nextKickTeam = team; this._dead = 'goalkick';
    }
    setThrow(team) {
      const sideY = this.ball.y < this.H / 2 ? 26 : this.H - 26;
      this.ball.tx = clamp(this.ball.x, 70, this.W - 70); this.ball.ty = sideY;   // top çizgiye yuvarlanır (snap yok)
      this.owner = null; this.ballMode = 'dead'; this.deadCD = 14; this.nextKickTeam = team; this._dead = 'throw';
      this.say('Taç — ' + this.clubName(team) + '.', 'set');
    }
    afterDead() {
      // taç / korner / ofsayt / frikik / kale vuruşu: oyuncu topa IŞINLANMAZ — en yakın oyuncu topa yürür (merkeze sıfırlama yok)
      if (this._dead === 'corner' || this._dead === 'throw' || this._dead === 'offside' || this._dead === 'free' || this._dead === 'goalkick') {
        let cross = this._dead === 'corner', shoot = false;
        if (this._dead === 'free') {
          const gx = this.goalFor(this.nextKickTeam).x; const dg = Math.abs(this.ball.x - gx);
          const central = Math.abs(this.ball.y - this.H / 2) < this.H * 0.22;
          if (dg < this.W * 0.22 && central && Math.random() < 0.55) shoot = true;   // yakın+merkez frikik → direkt şut
          else if (dg < this.W * 0.34) cross = true;                                  // uzak/yan frikik → ceza sahasına orta
        }
        this.setupRestart(this.nextKickTeam, cross, shoot); this._dead = null;
      } else if (this._dead === 'goal' && this.pendingReplay && this.pendingReplay.frames.length > 8) {
        this.startReplay(); this._dead = null;   // gol kutlamasından sonra tekrar
      } else { const wasHalf = this._dead === 'half'; this.kickoff(this.nextKickTeam, true); this._dead = null; if (wasHalf) this.say('İkinci yarı başladı!', 'info'); }
    }
    setupRestart(team, cross, shoot) {
      const base = team === 0 ? 0 : 11; let bi = -1, bd = 1e9;
      // direkt şutta: en iyi şutçu kullansın; aksi halde topa en yakın
      if (shoot) { let bsh = -1; for (let i = 1; i < 11; i++) { const p = this.players[base + i]; if (!p || !p.ref || p.isGK || p.sentOff) continue; if (p.sh > bsh) { bsh = p.sh; bi = base + i; } } }
      else { for (let i = 1; i < 11; i++) { const p = this.players[base + i]; if (!p || !p.ref || p.isGK || p.sentOff) continue; const d = dist(p, this.ball); if (d < bd) { bd = d; bi = base + i; } } }
      if (bi < 0) bi = base + 6;
      // organize beklemesi (sp-birimi): direkt şut kısa; frikik/taç bazen hızlı (kontra) bazen yavaş (dizilme)
      let org = 12; if (!cross && !shoot) org = Math.random() < 0.4 ? (5 + Math.random() * 9) : (30 + Math.random() * 42);
      this.owner = null; this.poss = team; this.ballMode = 'restart'; this.restart = { idx: bi, team, cross: !!cross, shoot: !!shoot, org, wait: 0 };
    }
    beginPossession(idx, team, cross, shoot) {
      this.owner = idx; this.poss = team; this.restart = null; this._lastPass = null;
      if (shoot) { this.say('Frikikten direkt vuruyor!', 'shot'); this.players[idx].x = this.ball.x - (team === 0 ? 12 : -12); return this.shoot(this.players[idx]); }
      if (cross) return this.crossFromCorner(idx);
      this.ballMode = 'held'; this.actCD = 10;
    }
    crossFromCorner(idx) {
      const owner = this.players[idx], team = owner.team, dir = team === 0 ? 1 : -1;
      // ceza sahasındaki bir hücumcuya ortala
      const box = [];
      for (let i = 0; i < 22; i++) { const p = this.players[i]; if (p && p.ref && p.team === team && !p.isGK && i !== idx && this.inPenaltyBox(p, 1 - team)) box.push(p); }
      let target = box.length ? box[Math.floor(Math.random() * box.length)] : null;
      if (!target) { const mates = this.players.filter(p => p.team === team && p.ref && !p.isGK && p !== owner).sort((a, b) => (b.x - a.x) * dir); target = mates[0]; }
      if (!target) { this.ballMode = 'held'; this.actCD = 8; return; }
      this.ballMode = 'pass'; this._passWayward = false; this.ball.tx = target.x; this.ball.ty = target.y; this._passTarget = this.players.indexOf(target);
      this._passerId = owner.ref.id; this._intercept = null;
      for (const o of this.players) { if (o.team === team || !o.ref || o.isGK) continue; if (segDist(owner, target, o) < 16 && Math.random() < 0.18) { this._intercept = this.players.indexOf(o); break; } }
      this.say('Korner ortası ceza sahasına geliyor…', 'set');
    }
    halftime(kind) {
      // oyuncular tünele yürür → durur → kullanıcı taktik yapar → devam. kind: normal/et-start/et-half
      this._htFired = false; this._htKind = kind || 'normal';
      this.phase = 'walkoff'; this.owner = null; this.ballMode = 'dead'; this._dead = null;
      this.ball.x = this.W / 2; this.ball.y = this.H / 2; this.goalFlash = null;
      this.flash = null; this.nextKickTeam = kind === 'et-start' ? (Math.random() < 0.5 ? 0 : 1) : 1;
      const tunX = this.W / 2, tunY = this.H - 6;
      this.players.forEach(p => { if (p.ref) { p.tunx = tunX + (Math.random() * 150 - 75); p.tuny = tunY; } });
      const msg = kind === 'et-start' ? 'Beraberlik! Uzatma öncesi taktik molası — skor ' + this.a + '-' + this.b + '.'
        : kind === 'et-half' ? 'Uzatma arası. Skor ' + this.a + '-' + this.b + '.'
          : 'Devre arası. Skor ' + this.a + '-' + this.b + '.';
      this.say(msg, 'half');
    }
    stepWalk(mode, sp) {
      const step = 2.4 * Math.max(0.6, sp); let allThere = true;
      this.players.forEach(p => {
        if (!p.ref) return;
        const tx = mode === 'off' ? p.tunx : p.hx, ty = mode === 'off' ? p.tuny : p.hy;
        const dx = tx - p.x, dy = ty - p.y;
        if (Math.hypot(dx, dy) > 3) { allThere = false; p.x += clamp(dx, -step, step); p.y += clamp(dy, -step, step); }
      });
      if (this.ref) { const rx = mode === 'off' ? this.W / 2 + 40 : this.W / 2 + 30, ry = mode === 'off' ? this.H - 6 : this.H / 2 + 60; this.ref.x = lerpf(this.ref.x, rx, 0.06); this.ref.y = lerpf(this.ref.y, ry, 0.06); }
      if (mode === 'on') this.ball.x = lerpf(this.ball.x, this.W / 2, 0.1), this.ball.y = lerpf(this.ball.y, this.H / 2, 0.1);
      if (allThere) {
        if (mode === 'off') {
          this.phase = 'paused';
          if (!this._htFired) { this._htFired = true; const ft = this._htKind === 'et-start' ? 'UZATMA' : this._htKind === 'et-half' ? 'UZATMA ARASI' : 'DEVRE ARASI'; this.flash = { txt: ft, col: '#ffe27a' }; this._flashUntil = this.t + 999999; this.onHalftime(this._htKind); }
        } else {
          this.phase = 'play'; this.flash = null; this.kickoff(this.nextKickTeam, true);
          const m = this._htKind === 'et-start' ? 'Uzatmalar başladı!' : this._htKind === 'et-half' ? 'Uzatmanın ikinci yarısı!' : 'İkinci yarı başladı!';
          this.say(m, 'info');
        }
      }
    }
    resumeSecondHalf() {
      if (this.phase !== 'paused') return;
      this.phase = 'walkon'; this.flash = null;
      this.players.forEach(p => { if (p.ref) { p.x = this.W / 2 + (Math.random() * 150 - 75); p.y = this.H - 6; } });
    }
    updateSubWalkers(sp) {
      if (!this.subWalkers || !this.subWalkers.length) return;
      const step = 2.2 * Math.max(0.6, sp);
      this.subWalkers.forEach(w => { const dx = w.tx - w.x, dy = w.ty - w.y; w.x += clamp(dx, -step, step); w.y += clamp(dy, -step, step); w.life -= sp; });
      this.subWalkers = this.subWalkers.filter(w => w.life > 0);
    }
    /* gol tekrarı: canlı oyunun konumlarını kaydeder (yalnızca pozisyonlar, hafif) */
    recordFrame() {
      const snap = { bx: this.ball.x, by: this.ball.y, owner: this.owner, rx: this.ref ? this.ref.x : 0, ry: this.ref ? this.ref.y : 0,
        pos: this.players.map(p => (p && p.ref) ? ((Math.round(p.x) << 12) | Math.round(p.y)) : -1) };
      this.frameBuffer.push(snap);
      if (this.frameBuffer.length > 95) this.frameBuffer.shift();
    }
    startReplay() {
      this.replay = { frames: this.pendingReplay.frames, i: 0, name: this.pendingReplay.name, team: this.pendingReplay.team };
      this.pendingReplay = null; this.phase = 'replay'; this.goalFlash = null;
      this.say('Gol tekrarı izleniyor…', 'info');
    }
    stepReplay(sp) {
      if (!this.replay || !this.replay.frames.length) { this.replay = null; this.phase = 'play'; this.kickoff(this.nextKickTeam, true); return; }
      this.replay.i += sp * 0.85;
      if (this.replay.i >= this.replay.frames.length - 1) { this.replay = null; this.phase = 'play'; this.kickoff(this.nextKickTeam, true); }
    }
    turnover(idx) { this.owner = idx; this.poss = this.players[idx].team; this.ballMode = 'held'; this.actCD = 20; this._lastPass = null; }
    inPenaltyBox(p, defTeam) {
      const my = (this.H - 220) / 2, by = my + 220;
      if (p.y < my || p.y > by) return false;
      return defTeam === 0 ? p.x <= 24 + 140 : p.x >= this.W - 24 - 140;
    }
    setPenalty(team) {   // team = penaltıyı kullanacak (hücum) takım
      const base = team === 0 ? 0 : 11; let takerIdx = base + 9, bsh = -1;
      for (let i = 1; i < 11; i++) { const p = this.players[base + i]; if (p && p.ref && !p.isGK && p.sh > bsh) { bsh = p.sh; takerIdx = base + i; } }
      const spotX = team === 0 ? this.W - 24 - 132 : 24 + 132;
      this.ball.x = spotX; this.ball.y = this.H / 2; this.ball.tx = spotX; this.ball.ty = this.H / 2;
      this.owner = null; this.ballMode = 'penalty'; this._dead = null;
      this.pen = { team, takerIdx, spotX, phase: 'setup', t: 0, dive: 0 };
      this.flash = { txt: 'PENALTI', col: '#ffd24a' }; this._flashUntil = this.t + 999999;
      this.say('PENALTI! ' + this.clubName(team) + ' lehine faul. Topun başında ' + surOf(this.players[takerIdx].ref) + '.', 'set');
    }
    /* Görünür penaltı: oyuncular dizilir → koşu → şut → kaleci dalışı → sonuç */
    stepPenalty(sp) {
      const pen = this.pen; if (!pen) { this.ballMode = 'held'; return; }
      pen.t += sp; const team = pen.team, dir = team === 0 ? 1 : -1, g = this.goalFor(team);
      const defGK = team === 0 ? this.players[11] : this.players[0];
      const taker = this.players[pen.takerIdx];
      // oyuncuları penaltı düzenine yerleştir
      this.players.forEach((p, i) => {
        if (!p.ref) return; let tx, ty;
        if (i === pen.takerIdx) { tx = pen.spotX - dir * (pen.phase === 'run' ? 8 : 24); ty = this.H / 2; }
        else if (p.isGK && p.team !== team) { tx = g.x - dir * 4; ty = this.H / 2 + (pen.phase === 'flying' ? pen.dive : 0); }
        else if (p.isGK) { tx = this.ownGoal(team).x + dir * 22; ty = this.H / 2; }
        else { tx = pen.spotX - dir * (78 + (i % 5) * 12); ty = 70 + ((i * 67) % (this.H - 140)); }
        p.x += clamp(tx - p.x, -2.6 * sp, 2.6 * sp); p.y += clamp(ty - p.y, -2.6 * sp, 2.6 * sp);
      });
      if (pen.phase === 'setup') {
        if (pen.t > 30) { pen.phase = 'run'; pen.t = 0; }
      } else if (pen.phase === 'run') {
        this.ball.x = pen.spotX; this.ball.y = this.H / 2;
        if (pen.t > 16) {
          pen.phase = 'flying'; pen.t = 0;
          const gkSave = defGK && defGK.df ? defGK.df : 60;
          pen.scored = Math.random() < 0.80 - gkSave / 650;
          const corner = Math.random() < 0.5 ? -1 : 1;
          this.ball.tx = g.x; this.ball.ty = this.H / 2 + corner * 52;
          pen.dive = corner * 46 * (pen.scored ? -0.35 : 1);   // gol olunca kaleci ters köşeye gider
          if (team === 0) { this.stats.shotsA++; this.stats.sotA++; this.stats.xgA += 0.76; } else { this.stats.shotsB++; this.stats.sotB++; this.stats.xgB += 0.76; }
          this.say(surOf(taker.ref) + ' koşusunu yaptı, vuruyor!', 'shot');
        }
      } else if (pen.phase === 'flying') {
        this.ball.x = lerpf(this.ball.x, this.ball.tx, 0.14 + 0.12 * sp);
        this.ball.y = lerpf(this.ball.y, this.ball.ty, 0.14 + 0.12 * sp);
        if (Math.hypot(this.ball.x - this.ball.tx, this.ball.y - this.ball.ty) < 12) {
          if (pen.scored) {
            if (team === 0) this.a++; else this.b++; this.fireGoal(team, taker.ref);   // penaltı da tekrar oynatılır
            this.ball.x = g.x; this.ball.y = this.ball.ty; this.goalFlash = { team, name: surOf(taker.ref) };
            this.owner = null; this.ballMode = 'dead'; this.deadCD = 64; this.nextKickTeam = 1 - team; this._dead = 'goal';
          } else {
            this.say('PENALTI KURTARILDI! Müthiş kaleci.', 'save'); this.flash = { txt: 'KURTARIŞ', col: '#eaf0f6' }; this._flashUntil = this.t + 48;
            this.setGoalKick(1 - team);
          }
          this.pen = null;
        }
      }
      this.recordFrame();   // penaltı da tekrar için kaydedilsin
      this.clock += 0.012 * sp;   // penaltı sırasında saat yavaş
      if (this.clock >= 90 && !this.ended && this.ballMode !== 'penalty') this.finish();
    }
    applyInjuryDebuff(p, carried) {
      // sakat oyuncu sahada: belirgin düşük performans (menajeri değişikliğe iter)
      p.injured = true; const f = carried ? 0.72 : 0.6;
      p.sh *= f; p.pa *= f; p.df *= f; p.sp *= f * 0.85; p.fiz *= f;
      if (!carried) p.stam = Math.min(p.stam, 42);
    }
    maybeInjure(p, base) {
      if (!p || !p.ref || p.injured || p.sentOff) return;
      if (p.isGK && Math.random() < 0.6) return;   // kaleci nadir sakatlanır
      if (Math.random() > (base == null ? 0.06 : base)) return;
      const r = Math.random();
      const sev = r < 0.6 ? 1 : r < 0.88 ? 2 : 3;   // 1 hafif (maç kaçırmaz), 2 orta (1 maç), 3 ağır (2 maç)
      this.applyInjuryDebuff(p, false); p.injSev = sev;
      p.ref.injuredMatches = sev >= 3 ? 2 : sev >= 2 ? 1 : 0;   // bu maçtan SONRA kaçırılacak maç sayısı
      p.ref.justInjured = true; p.ref._inMatchInjured = true;   // YZ/menajer değişiklik için işaret
      const t = Math.floor(this.clock) + "'";
      const sevTxt = sev >= 3 ? 'AĞIR sakatlık' : sev >= 2 ? 'sakatlık' : 'hafif sakatlık';
      const ev = { t, type: 'inj', txt: `➕ ${p.ref.name} — ${sevTxt} · ${this.clubName(p.team)}` };
      this.events.unshift(ev); this.onEvent(ev, { a: this.a, b: this.b });
      this.say(p.ref.name + ' sakatlandı! ' + (sev >= 2 ? 'Durumu ciddi — menajer değişiklik yapmalı, yoksa düşük performansla devam.' : 'Etkilendi, düşük performansla oynuyor.'), 'inj');
      this.flash = { txt: 'SAKATLIK', col: '#ff8da1' }; this._flashUntil = this.t + 46;
    }
    foul(byIdx) {
      const fouler = this.players[byIdx]; const team = fouler.team;
      if (team === 0) this.stats.foulsA++; else this.stats.foulsB++;
      // faul savunan takımın ceza sahasında mı? → penaltı
      const victim = this.owner != null ? this.players[this.owner] : null;
      if (victim) this.maybeInjure(victim, 0.10);   // sert faulde sakatlık riski
      if (victim && this.inPenaltyBox(victim, team)) return this.setPenalty(1 - team);
      const t = Math.floor(this.clock) + "'";
      const already = (this.cards[fouler.ref.id] || 0) >= 1;
      // kart nadir: kartlı oyuncu çok daha dikkatli (2. sarı seyrek), direkt kırmızı çok nadir
      const card = already ? (Math.random() < 0.06) : (Math.random() < 0.13);
      const directRed = !already && Math.random() < 0.012;
      let txt, sayTxt, flashTxt, flashCol;
      if (card || directRed) {
        fouler.carded = true;
        const n = this.cards[fouler.ref.id] = (this.cards[fouler.ref.id] || 0) + 1;
        const red = (already && card) || directRed;   // ikinci sarı veya direkt kırmızı
        if (red) {
          fouler.sentOff = true;
          this.subWalkers.push({ x: fouler.x, y: fouler.y, tx: fouler.hx + (team === 0 ? -55 : 55), ty: this.H - 4, col: team ? this.colB : this.colA, sur: fouler.sur, life: 130, red: true });
          const lbl = n >= 2 ? 'İkinci sarı → KIRMIZI' : 'KIRMIZI KART';
          txt = `🟥 ${lbl} — ${fouler.ref.name} · ${this.clubName(team)}`;
          sayTxt = 'KIRMIZI KART! ' + fouler.ref.name + ' oyundan atıldı — ' + this.clubName(team) + ' 10 kişi kaldı!';
          flashTxt = 'KIRMIZI KART'; flashCol = '#e5484d';
        } else {
          txt = `🟨 Sarı kart — ${fouler.ref.name} · ${this.clubName(team)}`;
          sayTxt = 'Sarı kart! ' + fouler.ref.name + ' müdahale etti.';
          flashTxt = 'SARI KART'; flashCol = '#eab308';
        }
      } else {
        txt = `Faul — ${fouler.ref.name} · ${this.clubName(team)}`;
        sayTxt = 'Faul. ' + fouler.ref.name + ' müdahale etti.'; flashTxt = 'FAUL'; flashCol = '#eaf0f6';
      }
      const isCard = card || directRed;
      const ev = { t, type: isCard ? 'card' : 'foul', txt };
      this.events.unshift(ev); this.onEvent(ev, { a: this.a, b: this.b });
      this.say(sayTxt, isCard ? 'card' : 'foul');
      this.flash = { txt: flashTxt, col: flashCol }; this._flashUntil = this.t + (fouler.sentOff ? 70 : isCard ? 56 : 32);
      this.deadCD = isCard ? 22 : 14; this.nextKickTeam = this.poss; this.owner = null; this.ballMode = 'dead'; this._dead = 'free';
      this.ball.tx = this.ball.x; this.ball.ty = this.ball.y;
    }
    fireGoal(team, scorerRef) {
      const club = team === 0 ? this.clubA : this.clubB; let scorer = scorerRef;
      if (!scorer) { const slots = FORMATIONS[club.formation] || FORMATIONS['4-3-3']; const c = club.lineup.map((p, i) => ({ p, line: p ? POS[slots[i][0]].line : 0 })).filter(o => o.p && o.line >= 4); scorer = c.length ? pick(c).p : pick(club.lineup.filter(Boolean)); }
      const assist = (this._lastPass && this._lastPass.team === team && this._lastPass.id !== scorer.id) ? this._lastPass.id : null;
      const ev = { t: Math.floor(this.clock) + "'", type: 'goal', team, txt: `⚽ ${scorer.name}${assist ? '' : ''} · ${club.name}`, scorer: scorer.id, assist };
      this.events.unshift(ev); this.onEvent(ev, { a: this.a, b: this.b });
      this.say('GOOOL! ' + scorer.name + ' ağları sarstı! ' + this.clubName(team) + ' sevinçte!', 'goal');
      // tekrar için son anların kopyası
      this.pendingReplay = { frames: this.frameBuffer.slice(-80), name: surOf(scorer), team };
    }
    finish() {
      if (this.ended) return; this.ended = true;
      // sahadaki oyuncuların kalan kondisyonunu kaydet (maçlar arası taşınır)
      this.players.forEach(p => { if (p.ref) p.ref.condition = Math.round(p.stam); });
      this.onUpdate({ clock: 90, a: this.a, b: this.b, stats: this.computeStats(), momentum: this.momentum });
      this.say('Maç bitti! ' + this.clubA.name + ' ' + this.a + '-' + this.b + ' ' + this.clubB.name + '.', 'end');
      this._endResult = this.result();
      // oyuncular tünele yürür → sonra sonuç ekranı
      this.phase = 'endwalk'; this.owner = null; this.ballMode = 'dead'; this.goalFlash = null;
      this.flash = { txt: 'MAÇ BİTTİ', col: '#ffe27a' }; this._flashUntil = this.t + 999999;
      const tunX = this.W / 2, tunY = this.H - 6;
      this.players.forEach(p => { if (p.ref) { p.tunx = tunX + (Math.random() * 220 - 110); p.tuny = tunY; } });
    }
    stepEndWalk(sp) {
      const step = 2.4 * Math.max(0.6, sp); let allThere = true;
      this.players.forEach(p => { if (!p.ref) return; const dx = p.tunx - p.x, dy = p.tuny - p.y; if (Math.hypot(dx, dy) > 3) { allThere = false; p.x += clamp(dx, -step, step); p.y += clamp(dy, -step, step); } });
      if (this.ref) { this.ref.x = lerpf(this.ref.x, this.W / 2 + 30, 0.05); this.ref.y = lerpf(this.ref.y, this.H - 6, 0.05); }
      this.ball.x = lerpf(this.ball.x, this.W / 2, 0.05); this.ball.y = lerpf(this.ball.y, this.H / 2, 0.05);
      if (allThere && !this._endFired) {
        this._endFired = true; this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf); if (this._iv) clearInterval(this._iv);
        this.onEnd(this._endResult);
      }
    }
    computeRatings() {
      const goals = this.events.filter(e => e.type === 'goal');
      const r = {};
      [this.clubA, this.clubB].forEach((club, team) => {
        const conceded = team === 0 ? this.b : this.a, scored = team === 0 ? this.a : this.b;
        club.lineup.filter(Boolean).forEach(p => {
          let v = 6.0;
          const g = goals.filter(x => x.scorer === p.id).length, as = goals.filter(x => x.assist === p.id).length;
          v += g * 1.2 + as * 0.8;
          const line = POS[p.pos] ? POS[p.pos].line : 3;
          if (line <= 1 || p.pos === 'KL') { if (conceded === 0) v += 0.8; else v -= conceded * 0.25; }
          if ((team === 0 && this.a > this.b) || (team === 1 && this.b > this.a)) v += 0.3;
          v += (Math.random() * 0.8 - 0.4);
          r[p.id] = Math.max(4.2, Math.min(9.9, Math.round(v * 10) / 10));
        });
      });
      return r;
    }
    result() {
      const goals = this.events.filter(e => e.type === 'goal');
      const ratings = this.computeRatings();
      const winnerClub = this.a >= this.b ? this.clubA : this.clubB;
      // maçın oyuncusu = en yüksek reytingli (kazanan ağırlıklı)
      let motm = null, best = -1;
      winnerClub.lineup.filter(Boolean).forEach(p => { const rt = (ratings[p.id] || 0) + 0.3; if (rt > best) { best = rt; motm = p; } });
      [this.clubA, this.clubB].forEach(c => c.lineup.filter(Boolean).forEach(p => { if ((ratings[p.id] || 0) > best) { best = ratings[p.id]; motm = p; } }));
      const winner = this.penWinner ? this.penWinner : (this.a === this.b ? 'draw' : (this.a > this.b ? 'a' : 'b'));
      const sh = this.shootout;
      return { a: this.a, b: this.b, winner,
        penalties: !!this.penWinner, shootout: sh ? { a: sh.a, b: sh.b } : null, extraTime: this._inET,
        stats: this.computeStats(), events: this.events.slice(), goals, ratings, motm };
    }

    drawField() {
      const ctx = this.ctx, W = this.W, H = this.H;
      const bands = 10, bw = W / bands;
      for (let i = 0; i < bands; i++) { ctx.fillStyle = i % 2 ? '#33945c' : '#2f8d57'; ctx.fillRect(i * bw, 0, bw + 1, H); }
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, W - 48, H - 48);
      ctx.beginPath(); ctx.moveTo(W / 2, 24); ctx.lineTo(W / 2, H - 24); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, 7); ctx.stroke();
      const boxH = 220, boxW = 140, sixH = 110, sixW = 52, my = (H - boxH) / 2, sy = (H - sixH) / 2;
      ctx.strokeRect(24, my, boxW, boxH); ctx.strokeRect(W - 24 - boxW, my, boxW, boxH);
      ctx.strokeRect(24, sy, sixW, sixH); ctx.strokeRect(W - 24 - sixW, sy, sixW, sixH);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(16, H / 2 - 34, 9, 68); ctx.fillRect(W - 25, H / 2 - 34, 9, 68);
    }
    drawShootout() {
      const ctx = this.ctx, W = this.W, H = this.H; const s = this.shootout;
      this.drawField();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // sadece şutçu + iki kaleci görünür (sahnedeki oyuncular)
      this.players.forEach((p, i) => {
        if (!p.ref) return;
        const active = s.pen && (i === s.pen.takerIdx || p.isGK);
        ctx.globalAlpha = active ? 1 : 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10.5, 0, 7); ctx.fillStyle = p.isGK ? '#d9a017' : (p.team ? this.colB : this.colA); ctx.fill();
        ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, 6.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#14181f'; ctx.stroke();
      // skor tablosu üstte
      ctx.fillStyle = 'rgba(8,12,18,.72)'; ctx.fillRect(0, 0, W, 54);
      ctx.textAlign = 'left'; ctx.font = '800 16px Archivo, sans-serif'; ctx.fillStyle = '#ffd24a'; ctx.fillText('PENALTI ATIŞLARI', 20, 18);
      const dots = (hist, team, y) => {
        ctx.fillStyle = '#fff'; ctx.font = "700 12px 'Hanken Grotesk'";
        ctx.fillText(team === 0 ? this.clubA.name : this.clubB.name, 20, y);
        let cx = 150; hist.filter(h => h.team === team).forEach(h => { ctx.beginPath(); ctx.arc(cx, y, 6, 0, 7); ctx.fillStyle = h.scored ? '#19c37d' : '#e5484d'; ctx.fill(); cx += 18; });
        ctx.fillStyle = '#fff'; ctx.font = '800 15px Archivo'; ctx.fillText('' + (team === 0 ? s.a : s.b), 122, y);
      };
      dots(s.history, 0, 30); dots(s.history, 1, 46);
      ctx.textAlign = 'center';
    }
    drawReplay() {
      const ctx = this.ctx, W = this.W, H = this.H;
      this.drawField();
      const fr = this.replay.frames[Math.min(this.replay.frames.length - 1, Math.floor(this.replay.i))];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // top gölgesi + oyuncular
      this.players.forEach((p, i) => {
        if (!p.ref) return; const v = fr.pos[i]; if (v < 0) return; const x = v >> 12, y = v & 0xFFF;
        ctx.beginPath(); ctx.arc(x, y, 10.5, 0, 7);
        ctx.fillStyle = p.isGK ? '#d9a017' : (p.team ? this.colB : this.colA); ctx.fill();
        ctx.lineWidth = i === fr.owner ? 3 : 2.4; ctx.strokeStyle = i === fr.owner ? '#fff' : 'rgba(255,255,255,.92)'; ctx.stroke();
        ctx.font = '700 11px Geist Mono, monospace'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,16,22,.85)'; ctx.strokeText(p.sur, x, y + 21);
        ctx.fillStyle = '#fff'; ctx.fillText(p.sur, x, y + 21);
      });
      ctx.beginPath(); ctx.arc(fr.bx, fr.by, 6.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#14181f'; ctx.stroke();
      // TEKRAR rozeti
      ctx.fillStyle = 'rgba(8,12,18,.62)'; ctx.fillRect(0, 0, W, 40);
      ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(28, 20, 6, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = '800 16px Archivo, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('TEKRAR · GOL — ' + this.replay.name, 44, 21);
      ctx.textAlign = 'center';
    }
    draw() {
      const ctx = this.ctx, W = this.W, H = this.H;
      if (this.phase === 'replay' && this.replay) return this.drawReplay();
      if (this.phase === 'shootout' && this.shootout) return this.drawShootout();
      this.drawField();
      ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y + 3, 7, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      this.players.forEach((p, i) => {
        if (!p.ref || p.sentOff) return; const isOwner = i === this.owner;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10.5, 0, 7);
        ctx.fillStyle = p.isGK ? '#d9a017' : (p.team ? this.colB : this.colA); ctx.fill();
        ctx.lineWidth = isOwner ? 3 : 2.4; ctx.strokeStyle = isOwner ? '#fff' : 'rgba(255,255,255,.92)'; ctx.stroke();
        if (isOwner) { ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = '#ffe27a'; ctx.stroke(); }
        if (p.stam < 40) { ctx.beginPath(); ctx.arc(p.x + 9, p.y - 9, 2.4, 0, 7); ctx.fillStyle = '#e5484d'; ctx.fill(); }
        // sakatlık: pembe artı işareti
        if (p.injured) { ctx.fillStyle = '#ff5d7d'; ctx.fillRect(p.x + 6.5, p.y - 11.5, 2.2, 6.5); ctx.fillRect(p.x + 4.4, p.y - 9.4, 6.5, 2.2); }
        // sarı kart: küçük kart işareti
        if (p.carded) { ctx.fillStyle = '#facc15'; ctx.fillRect(p.x - 12.5, p.y - 13, 4.5, 6.5); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 0.8; ctx.strokeRect(p.x - 12.5, p.y - 13, 4.5, 6.5); }
        ctx.font = '700 11px Geist Mono, monospace';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,16,22,.85)'; ctx.strokeText(p.sur, p.x, p.y + 21);
        ctx.fillStyle = p.carded ? '#facc15' : '#fff'; ctx.fillText(p.sur, p.x, p.y + 21);   // sarı kartlı = sarı isim
      });
      // hakem — oyuncularla aynı boyut, siyah, isimsiz
      if (this.ref) {
        ctx.beginPath(); ctx.arc(this.ref.x, this.ref.y, 10.5, 0, 7); ctx.fillStyle = '#161616'; ctx.fill();
        ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
      }
      // değişiklikte kenara yürüyen oyuncular (hayalet)
      if (this.subWalkers) this.subWalkers.forEach(w => {
        const al = Math.max(0, Math.min(1, w.life / 80)) * 0.6; ctx.globalAlpha = al;
        ctx.beginPath(); ctx.arc(w.x, w.y, 9.5, 0, 7); ctx.fillStyle = w.col; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
        ctx.globalAlpha = Math.min(1, al + 0.25); ctx.font = '700 10px Geist Mono, monospace'; ctx.fillStyle = '#fff'; ctx.fillText(w.sur, w.x, w.y + 19);
        ctx.globalAlpha = 1;
      });
      ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, 6.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#14181f'; ctx.stroke();
      if (this.goalFlash) {
        const tcol = this.goalFlash.team === 0 ? this.colA : this.colB;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(8,12,18,.5)'; ctx.fillRect(0, 0, W, H);
        // yayılan halkalar
        for (let k = 0; k < 3; k++) { const ph = ((this.t / 42) + k / 3) % 1; ctx.globalAlpha = (1 - ph) * 0.5; ctx.beginPath(); ctx.arc(W / 2, H / 2, 30 + ph * 320, 0, 7); ctx.lineWidth = 9; ctx.strokeStyle = tcol; ctx.stroke(); }
        // konfeti
        for (let k = 0; k < 54; k++) { const ang = (k * 2.39996); const d2 = ((this.t * 3.2 + k * 47) % 360); const px = W / 2 + Math.cos(ang) * d2, py = H / 2 + Math.sin(ang) * d2 * 0.66; ctx.globalAlpha = Math.max(0, 1 - d2 / 360) * 0.95; ctx.fillStyle = k % 3 ? tcol : (k % 2 ? '#fff' : '#ffd24a'); ctx.fillRect(px - 3, py - 3, 6, 6); }
        ctx.globalAlpha = 1;
        // GOL! — nabız
        const sc = 1 + Math.sin(this.t / 3.5) * 0.07;
        ctx.save(); ctx.translate(W / 2, H / 2 - 18); ctx.scale(sc, sc);
        ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(8,12,18,.9)'; ctx.font = '900 98px Archivo, sans-serif'; ctx.strokeText('GOOOL!', 0, 0);
        ctx.fillStyle = tcol; ctx.fillText('GOOOL!', 0, 0); ctx.restore();
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,12,18,.8)'; ctx.font = '800 29px "Hanken Grotesk", sans-serif';
        ctx.strokeText(this.goalFlash.name + ' — ' + this.clubName(this.goalFlash.team), W / 2, H / 2 + 54);
        ctx.fillStyle = '#fff'; ctx.fillText(this.goalFlash.name + ' — ' + this.clubName(this.goalFlash.team), W / 2, H / 2 + 54);
      } else if (this.flash && this.t < (this._flashUntil || 0)) {
        const bx = clamp(this.ball.x, 90, W - 90), by = clamp(this.ball.y - 26, 28, H - 26);
        ctx.font = '800 22px Archivo, sans-serif'; ctx.fillStyle = 'rgba(8,12,18,.7)'; ctx.fillText(this.flash.txt, bx + 1, by + 1);
        ctx.fillStyle = this.flash.col; ctx.fillText(this.flash.txt, bx, by);
      }
    }
  }
  function segDist(a, b, p) { const dx = b.x - a.x, dy = b.y - a.y; const L2 = dx * dx + dy * dy || 1; let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2; t = clamp(t, 0, 1); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }

  /* ---- Hızlı sim ---- */
  function quickSim(clubA, clubB) {
    const sA = teamStrength(clubA), sB = teamStrength(clubB);
    const expA = 1.3 * (sA.attack / Math.max(1, sB.defense)), expB = 1.3 * (sB.attack / Math.max(1, sA.defense));
    const poisson = (l) => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
    const a = Math.min(6, poisson(expA)), b = Math.min(6, poisson(expB));
    return { a, b, winner: a === b ? 'draw' : (a > b ? 'a' : 'b') };
  }

  /* ============================================================
     Maç sonrası gelişim — yaş + potansiyel + seri uzunluğu temelli
     ============================================================ */
  function developSquad(club, result, side, fmt) {
    const k = fmt === 5 ? 0.20 : 0.34;   // Bo3 hızlı, Bo5 yavaş (seri sonunda benzer ~%70)
    const changes = [];
    const myTeam = side === 'a' ? 0 : 1;
    const goals = (result.goals || []);
    const scorers = {}; goals.filter(g => g.team === myTeam).forEach(g => scorers[g.scorer] = (scorers[g.scorer] || 0) + 1);
    const assists = {}; goals.filter(g => g.team === myTeam && g.assist).forEach(g => assists[g.assist] = (assists[g.assist] || 0) + 1);
    const ratings = result.ratings || {};
    const won = (side === 'a' && result.winner === 'a') || (side === 'b' && result.winner === 'b');
    const starterIds = new Set(club.lineup.filter(Boolean).map(p => p.id));
    const motmId = result.motm ? result.motm.id : null;

    club.squad.forEach(p => {
      const played = starterIds.has(p.id);
      // ---- maçlar arası kondisyon: oynayan yorulur ama sağlam recover; kenardakiler tam dinlenir ----
      const cond = p.condition != null ? p.condition : 100;
      p.condition = Math.min(100, Math.round(cond + (played ? 34 : 60)));
      // ---- sakatlık sayacı: bu maç sakatlananı düşürme; oturan/sağlamların sayacı azalır ----
      if (p.injuredMatches > 0) { if (p.justInjured) p.justInjured = false; else p.injuredMatches = Math.max(0, p.injuredMatches - 1); }
      p._inMatchInjured = false;
      const gap = p.pot - p.ovr;
      let delta = 0; const reasons = [];
      const youthMod = p.age <= 18 ? 1.25 : p.age <= 21 ? 1.05 : p.age <= 24 ? 0.7 : p.age <= 27 ? 0.4 : p.age <= 29 ? 0.2 : 0;
      if (gap > 0 && youthMod > 0) {
        let perf = played ? 0.85 : 0.45;
        if (played) {
          const rt = ratings[p.id]; if (rt != null) perf = 0.45 + (rt - 5) / 5 * 0.7;
          if (scorers[p.id]) perf += 0.2 * scorers[p.id];
          if (assists[p.id]) perf += 0.12 * assists[p.id];
          if (p.id === motmId) perf += 0.25;
          if (won) perf += 0.1;
        }
        perf = Math.max(0.3, Math.min(1.55, perf));
        const rnd = 0.7 + Math.random() * 0.5;
        const gain = gap * k * youthMod * perf * rnd;
        delta = Math.round(gain);
        if (delta < 1 && gain > 0.35 && played) delta = 1;
        if (scorers[p.id]) reasons.push(scorers[p.id] + ' gol');
        else if (assists[p.id]) reasons.push('asist');
        else if (p.id === motmId) reasons.push('maçın oyuncusu');
        else if (played) reasons.push('gelişim');
        else reasons.push('idman');
      }
      if (p.age >= 30) {
        const base = p.age >= 33 ? 0.55 : p.age >= 31 ? 0.38 : 0.25;
        if (Math.random() < base) { delta -= 1; reasons.unshift('yaş'); }
        if (p.age >= 34 && Math.random() < 0.4) delta -= 1;
      }
      delta = Math.max(-3, Math.min(6, delta));
      const before = p.ovr;
      let after = p.ovr + delta;
      const cap = Math.min(99, p.pot + (Math.random() < 0.12 ? 2 : 0));   // en iyi ihtimalde hafif üstü
      if (after > cap) after = cap;
      after = Math.max(40, after);
      p.ovr = after;
      if (!reasons.length) reasons.push(played ? 'istikrarlı' : 'kenarda');
      changes.push({ id: p.id, name: p.name, pos: p.pos, played, from: before, to: after, delta: after - before, reason: reasons[0], rating: ratings[p.id] });
    });
    const sorted = changes.slice().sort((x, y) => y.delta - x.delta);
    const motm = result.motm;
    return { changes: changes.sort((x, y) => (y.played - x.played) || (y.delta - x.delta)),
      topRise: sorted[0], topDrop: sorted[sorted.length - 1],
      motm: motm ? { name: motm.name, pos: motm.pos } : null, ratings };
  }

  /* ============================================================ YZ ============================================================ */
  const AI = {
    pickForSlot(pool, slotPos) {
      const scored = pool.map(p => { const fit = fitLevel(p, slotPos); const bonus = fit === 'high' ? 8 : fit === 'mid' ? 1 : fit === 'low' ? -14 : -40; return { p, score: p.ovr * FIT_MULT[fit] + bonus + Math.random() * 4 }; }).sort((x, y) => y.score - x.score);
      return scored[0].p;
    },
    pickBench(pool) { return pick(pool.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8)); },
    chooseFormation() { return pick(['4-3-3', '4-4-2', '4-2-3-1']); },
    chooseTactics(club) { club.philosophy = pick(D.PHILOSOPHIES); club.mentality = pick(['Temkinli', 'Dengeli', 'Cesur']); const f = {}; let budget = 9; const keys = shuffle(D.FOCUS_KEYS.slice()); keys.forEach(kk => { const v = Math.min(3, Math.max(0, randi(0, Math.min(3, budget)))); f[kk] = v; budget -= v; }); D.FOCUS_KEYS.forEach(kk => { if (f[kk] == null) f[kk] = 0; }); club.focus = f; },
    duelloChoice(ownClub, enemyClub) {
      const steal = enemyClub.squad.slice().sort((a, b) => b.ovr - a.ovr)[randi(0, 2)];
      const protect = pick(ownClub.squad.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 4));
      // takasta verilecek: kendi en zayıf oyuncularından biri (çaldığından düşük)
      const weak = ownClub.squad.slice().filter(p => p.id !== protect.id).sort((a, b) => a.ovr - b.ovr);
      const give = weak[randi(0, Math.min(2, weak.length - 1))];
      return { stealId: steal.id, protectId: protect.id, giveId: give ? give.id : null };
    },
    subDecision(club) {
      const slots = FORMATIONS[club.formation] || FORMATIONS['4-3-3'];
      const healthyBench = b => b && !b.injuredMatches && !b._inMatchInjured;
      // önce sahadaki sakat oyuncuyu değiştir
      const injI = club.lineup.findIndex(p => p && p._inMatchInjured);
      if (injI >= 0) {
        const pos = slots[injI][0]; let best = null, bv = -1;
        club.bench.forEach(b => { if (!healthyBench(b)) return; const v = effOvr(b, pos); if (v > bv) { bv = v; best = b; } });
        if (best) return { outIndex: injI, inPlayer: best };
      }
      let worstI = -1, worstVal = 1e9;
      club.lineup.forEach((p, i) => { if (!p) return; const v = effOvr(p, slots[i][0]); if (v < worstVal) { worstVal = v; worstI = i; } });
      if (worstI < 0) return null;
      const pos = slots[worstI][0]; let best = null, bv = -1;
      club.bench.forEach(b => { if (!healthyBench(b)) return; const v = effOvr(b, pos); if (v > bv) { bv = v; best = b; } });
      if (best && bv > effOvr(club.lineup[worstI], pos) + 2) return { outIndex: worstI, inPlayer: best };
      return null;
    },
  };

  window.KD_ENGINE = { teamStrength, effOvr, LiveMatch, quickSim, developSquad, AI };
})();
