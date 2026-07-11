/* ============================================================
   Kadro Düellosu — 3D maç görselleştirici (Three.js)
   Motora DOKUNMAZ: LiveMatch'in ürettiği x/y'yi (saha 1180×560)
   3D dünyaya yansıtır. draw() bunu `live.r3d.active` ise çağırır,
   değilse 2D fallback çizer. WebGL yoksa create() null döner.
   ============================================================ */
(function () {
  if (typeof THREE === 'undefined') { window.KD_RENDER3D = null; return; }

  const W = 1180, H = 560, SC = 0.1;
  const FW = W * SC, FH = H * SC;
  const SX = (x) => (x - W / 2) * SC;
  const SZ = (y) => (y - H / 2) * SC;
  const PI = Math.PI, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const AV = window.KD_AVATAR;

  // kamera için tek global klavye dinleyici (sızıntı yok) — aktif render'a yönlenir
  let ACTIVE = null; const CK = {};
  if (!window._kd3dCam) {
    window._kd3dCam = true;
    addEventListener('keydown', (e) => {
      if (!ACTIVE) return; const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const k = e.key.toLowerCase(); if ('wasdr'.indexOf(k) >= 0 && k.length === 1) { CK[k] = true; if (k === 'r') ACTIVE.resetCam(); e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k in CK) CK[k] = false; });
  }

  function makeFieldTexture() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const bands = 18, bw = W / bands;
    for (let i = 0; i < bands; i++) { ctx.fillStyle = i % 2 ? '#369a60' : '#2f8d57'; ctx.fillRect(i * bw, 0, bw + 1, H); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.beginPath(); ctx.moveTo(W / 2, 24); ctx.lineTo(W / 2, H - 24); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    const boxH = 220, boxW = 140, sixH = 110, sixW = 52, my = (H - boxH) / 2, sy = (H - sixH) / 2;
    ctx.strokeRect(24, my, boxW, boxH); ctx.strokeRect(W - 24 - boxW, my, boxW, boxH);
    ctx.strokeRect(24, sy, sixW, sixH); ctx.strokeRect(W - 24 - sixW, sy, sixW, sixH);
    [24 + 92, W - 24 - 92].forEach((px, i) => {
      ctx.beginPath(); ctx.arc(px, H / 2, 3, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ctx.beginPath(); ctx.arc(px, H / 2, 60, i ? 2.5 : -0.65, i ? 3.78 : 0.65); ctx.stroke();
    });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; return tex;
  }
  function makeSeatTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#10131a'; ctx.fillRect(0, 0, 128, 128);
    const pal = ['#e5484d', '#3b6fe0', '#19c37d', '#eab308', '#ffffff', '#e8893b', '#cfd6e2'];
    for (let row = 4; row < 128; row += 11) for (let col = 4; col < 128; col += 8) {
      ctx.fillStyle = pal[(Math.random() * pal.length) | 0]; ctx.globalAlpha = 0.55 + Math.random() * 0.45;
      ctx.fillRect(col, row, 5, 6);
    }
    ctx.globalAlpha = 1; const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
  }
  function makeNetTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i <= 64; i += 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(7, 5); return tex;
  }
  function makeBallTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 128, 128);
    const spot = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = -PI / 2 + k * 2 * PI / 5; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); };
    spot(64, 40, 16, '#16181d'); spot(26, 80, 13, '#16181d'); spot(102, 80, 13, '#16181d'); spot(64, 112, 12, '#16181d'); spot(16, 24, 10, '#ff5a1f'); spot(112, 24, 10, '#ff5a1f');
    return new THREE.CanvasTexture(c);
  }
  function makeLabel(scaleX, baseY) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(scaleX || 8.5, (scaleX || 8.5) * 0.25, 1); spr.position.y = baseY || 6.3; spr.renderOrder = 20;
    let cur = '';
    function draw(text, color) {
      const key = text + '|' + color; if (key === cur) return; cur = key;
      ctx.clearRect(0, 0, 256, 64);
      ctx.font = '700 32px Geist Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(12,16,22,.92)'; ctx.strokeText(text, 128, 34);
      ctx.fillStyle = color; ctx.fillText(text, 128, 34); tex.needsUpdate = true;
    }
    return { spr, draw };
  }

  function create(live, opts) {
    opts = opts || {};
    const wrap = (live.cv && live.cv.parentElement) || opts.container;
    if (!wrap) return null;
    let renderer;
    try {
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:inherit;touch-action:none;cursor:grab';
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
      if (!renderer.getContext()) return null;
    } catch (_) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas3d = renderer.domElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    wrap.appendChild(canvas3d);

    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0e15);
    const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 1000);
    const cam = { r: 74, theta: 0, phi: 0.96, tx: 0, ty: 2.5, tz: 0 };   // alçak, geniş yayın açısı → saha büyük
    const DEF = Object.assign({}, cam);
    let lastW = 2, lastH = 1;
    function updateCam() {
      cam.phi = clamp(cam.phi, 0.12, 1.4); cam.r = clamp(cam.r, 26, 240);
      cam.tx = clamp(cam.tx, -FW, FW); cam.tz = clamp(cam.tz, -FH, FH);
      const sp = Math.sin(cam.phi);
      camera.position.set(cam.tx + cam.r * sp * Math.sin(cam.theta), cam.ty + cam.r * Math.cos(cam.phi), cam.tz + cam.r * sp * Math.cos(cam.theta));
      camera.lookAt(cam.tx, cam.ty, cam.tz); camera.updateMatrixWorld();
    }
    const _v = new THREE.Vector3();
    function project(x, y, z) { _v.set(x, y, z).project(camera); return { x: (_v.x * .5 + .5) * lastW, y: (-_v.y * .5 + .5) * lastH }; }

    scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x21381f, 0.8));
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(-30, 70, 24); scene.add(sun);

    const field = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshStandardMaterial({ map: makeFieldTexture(), roughness: .95 }));
    field.rotation.x = -PI / 2; scene.add(field);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(FW + 16, FH + 16), new THREE.MeshStandardMaterial({ color: 0x2a6b41, roughness: 1 }));
    skirt.rotation.x = -PI / 2; skirt.position.y = -0.05; scene.add(skirt);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(FW + 34, FH + 34), new THREE.MeshStandardMaterial({ color: 0x6f3a33, roughness: 1 }));
    track.rotation.x = -PI / 2; track.position.y = -0.1; scene.add(track);

    const colAcol = new THREE.Color(live.colA), colBcol = new THREE.Color(live.colB);
    // tribünler
    function tieredStand(side) {
      const rows = 9, stepUp = 1.8, stepBack = 2.7, base = 13;
      for (let i = 0; i < rows; i++) {
        const t = makeSeatTexture(); let geo, x = 0, z = 0;
        if (side === 'N' || side === 'S') { const len = FW + 22; t.repeat.set(len / 3.2, 1); geo = new THREE.BoxGeometry(len, 1.4, stepBack + 0.4); z = (side === 'N' ? 1 : -1) * (FH / 2 + base + i * stepBack); }
        else { const len = FH + 22; t.repeat.set(1, len / 3.2); geo = new THREE.BoxGeometry(stepBack + 0.4, 1.4, len); x = (side === 'E' ? 1 : -1) * (FW / 2 + base + i * stepBack); }
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 1 })); m.position.set(x, 0.7 + i * stepUp, z); scene.add(m);
      }
      let wallGeo, wx = 0, wz = 0;
      if (side === 'N' || side === 'S') { wallGeo = new THREE.BoxGeometry(FW + 24, rows * stepUp + 5, 1.2); wz = (side === 'N' ? 1 : -1) * (FH / 2 + base + rows * stepBack); }
      else { wallGeo = new THREE.BoxGeometry(1.2, rows * stepUp + 5, FH + 24); wx = (side === 'E' ? 1 : -1) * (FW / 2 + base + rows * stepBack); }
      const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x0d1016, roughness: .9 })); wall.position.set(wx, rows * stepUp / 2, wz); scene.add(wall);
    }
    ['N', 'S', 'E', 'W'].forEach(tieredStand);
    const adMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: .7 });
    [FH / 2 + 2, -(FH / 2 + 2)].forEach(z => { const a = new THREE.Mesh(new THREE.BoxGeometry(FW, 1.4, 0.4), adMat); a.position.set(0, 0.7, z); scene.add(a); });

    // ---- KALELER (büyük + ağ) ----
    const netTex = makeNetTexture();
    function makeGoal(sign) {
      const g = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
      const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false });
      const gx = SX(sign > 0 ? W - 22 : 22), half = 4.6, hgt = 4.4, depth = 5.4, pr = 0.22;
      const post = new THREE.CylinderGeometry(pr, pr, hgt, 12);
      [-half, half].forEach(z => { const m = new THREE.Mesh(post, frameMat); m.position.set(gx, hgt / 2, z); g.add(m); });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, half * 2 + pr * 2, 12), frameMat); bar.rotation.x = PI / 2; bar.position.set(gx, hgt, 0); g.add(bar);
      const bx = gx + sign * depth;
      [-half, half].forEach(z => { const m = new THREE.Mesh(new THREE.CylinderGeometry(pr * .7, pr * .7, hgt * 0.7, 8), frameMat); m.position.set(bx, hgt * 0.35, z); g.add(m); });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, hgt), netMat); back.position.set(bx, hgt / 2, 0); back.rotation.y = PI / 2; g.add(back);
      [-half, half].forEach(z => { const s = new THREE.Mesh(new THREE.PlaneGeometry(depth, hgt), netMat.clone()); s.position.set((gx + bx) / 2, hgt / 2, z); g.add(s); });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(depth, half * 2), netMat.clone()); top.geometry.rotateX(-PI / 2); top.position.set((gx + bx) / 2, hgt - 0.02, 0); top.rotation.z = sign > 0 ? 0.16 : -0.16; g.add(top);
      scene.add(g);
    }
    makeGoal(1); makeGoal(-1);

    // ---- insan geometri/materyal ----
    const legGeo = new THREE.CylinderGeometry(0.34, 0.3, 1.8, 8), armGeo = new THREE.CylinderGeometry(0.24, 0.2, 1.5, 8);
    const torsoGeo = new THREE.CapsuleGeometry(0.62, 1.15, 4, 10), headGeo = new THREE.SphereGeometry(0.7, 14, 12);
    const hairGeo = new THREE.SphereGeometry(0.76, 12, 10), afroGeo = new THREE.SphereGeometry(0.95, 12, 10);
    const shadGeo = new THREE.CircleGeometry(1.45, 18), ringGeo = new THREE.TorusGeometry(1.85, 0.2, 8, 24);
    const shadMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
    const shortsA = new THREE.MeshStandardMaterial({ color: 0x141821, roughness: .7 });
    const shortsB = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: .7 });
    const shirtA = new THREE.MeshStandardMaterial({ color: colAcol, roughness: .55 });
    const shirtB = new THREE.MeshStandardMaterial({ color: colBcol, roughness: .55 });
    const shirtGK = new THREE.MeshStandardMaterial({ color: 0xd9a017, roughness: .55 });

    function makeHuman(o) {
      o = o || {};
      const g = new THREE.Group();
      const shad = new THREE.Mesh(shadGeo, shadMat); shad.rotation.x = -PI / 2; shad.position.y = 0.02; g.add(shad);
      let ring = null;
      if (o.withRing) { ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -PI / 2; ring.position.y = 0.06; ring.visible = false; g.add(ring); }
      const body = new THREE.Group(); g.add(body);
      const shirt = o.shirt, shorts = o.shorts || shortsA;
      const mk = (geo, mat, len, x, y, rz) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); if (rz) piv.rotation.z = rz; const m = new THREE.Mesh(geo, mat); m.position.y = -len / 2; piv.add(m); return piv; };
      const legL = mk(legGeo, shorts, 1.8, -0.32, 1.8), legR = mk(legGeo, shorts, 1.8, 0.32, 1.8);
      const armL = mk(armGeo, shirt, 1.5, -0.82, 3.45, 0.14), armR = mk(armGeo, shirt, 1.5, 0.82, 3.45, -0.14);
      const torso = new THREE.Mesh(torsoGeo, shirt); torso.position.y = 2.7;
      const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(o.skin || '#e6c2a0'), roughness: .85 })); head.position.y = 4.25;
      body.add(legL, legR, torso, armL, armR, head);
      if (!o.bald) {
        const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.hair || '#1b1b1b'), roughness: .8 });
        const hair = new THREE.Mesh(o.style === 2 ? afroGeo : hairGeo, hairMat);
        if (o.style === 2) hair.position.y = 4.55; else { hair.scale.set(1, o.style === 3 ? 0.5 : 0.72, 1.05); hair.position.y = 4.42; }
        body.add(hair);
      }
      return { g, body, legL, legR, armL, armR, ring, rightHand: armR, px: 0, pz: 0, phase: Math.random() * 6, ang: 0, idle: Math.random() * 6 };
    }

    // ---- oyuncular (ten/saç çeşitli) ----
    const HS = 0.58;
    const units = live.players.map((p) => {
      const av = (AV && p && p.ref) ? AV.of(p.ref.id) : { skin: '#e6c2a0', hair: '#1b1b1b', style: 0, bald: false };
      const shirt = p && p.isGK ? shirtGK : (p && p.team ? shirtB : shirtA);
      const h = makeHuman({ shirt, shorts: p && p.team ? shortsB : shortsA, withRing: true, skin: av.skin, hair: av.hair, style: av.style, bald: av.bald });
      h.g.scale.setScalar(HS); scene.add(h.g);
      h.label = makeLabel(13); h.g.add(h.label.spr);
      return h;
    });

    // ---- yedek kulübeleri (kafa taşmaz) ----
    function makeDugout(cx, shirtMat) {
      const g = new THREE.Group();
      const struct = new THREE.MeshStandardMaterial({ color: 0x1a1e27, roughness: .8 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.4, 5), new THREE.MeshStandardMaterial({ color: 0x0e1117, roughness: .7 }));
      roof.position.set(0, 5.4, 1.6); roof.rotation.x = -0.1; g.add(roof);
      const backW = new THREE.Mesh(new THREE.BoxGeometry(15, 4.6, 0.3), struct); backW.position.set(0, 2.4, 2.9); g.add(backW);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 1.4), struct); bench.position.set(0, 1.0, 1.4); g.add(bench);
      for (let i = 0; i < 5; i++) {
        const sub = makeHuman({ shirt: shirtMat, shorts: shirtMat, skin: AV ? AV.SKIN[(i * 3) % AV.SKIN.length] : '#e6c2a0', hair: AV ? AV.HAIR[(i * 2) % AV.HAIR.length] : '#222', style: i % 3 });
        sub.legL.rotation.x = -1.5; sub.legR.rotation.x = -1.5;
        sub.g.scale.setScalar(0.5); sub.g.position.set(-5 + i * 2.5, 0.95, 1.4); sub.g.rotation.y = PI; g.add(sub.g);
      }
      g.position.set(cx, 0, FH / 2 + 7); scene.add(g);
    }
    makeDugout(SX(W * 0.32), shirtA); makeDugout(SX(W * 0.68), shirtB);

    // ---- TEKNİK DİREKTÖRLER (belirgin) ----
    function makeManager(labelText, labelCol, cx, vest) {
      const suit = new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: .6 });
      const h = makeHuman({ shirt: new THREE.MeshStandardMaterial({ color: new THREE.Color(vest), roughness: .5 }), shorts: suit, skin: '#e6c2a0', hair: '#2a2a2a', style: 0 });
      h.g.scale.setScalar(0.92);
      // başının üstünde zıplayan ok + zemin diski
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 4), new THREE.MeshStandardMaterial({ color: new THREE.Color(vest), emissive: new THREE.Color(vest), emissiveIntensity: .4 }));
      arrow.rotation.x = PI; arrow.position.y = 6.6; h.g.add(arrow); h.arrow = arrow;
      const disc = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.0, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(vest), transparent: true, opacity: .6, side: THREE.DoubleSide }));
      disc.rotation.x = -PI / 2; disc.position.y = 0.05; h.g.add(disc);
      h.label = makeLabel(16, 7.8); h.g.add(h.label.spr); h.label.draw(labelText, labelCol);
      h.g.position.set(cx, 0, FH / 2 + 4); h.g.rotation.y = PI; h.body.rotation.y = PI; h.ang = PI; h.gest = null;
      scene.add(h.g); return h;
    }
    const cName = (t) => (live.clubName ? live.clubName(t) : (t ? 'Rakip' : 'Sen'));
    const mgrMe = makeManager('★ ' + cName(0) + ' TD', '#ffe27a', SX(W * 0.32), '#19c37d');
    const mgrOpp = makeManager(cName(1) + ' TD', '#cfd6e2', SX(W * 0.68), '#e8893b');

    // ---- top (küçük + belirgin + parıltı) ----
    const ballR = 0.72;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(ballR, 18, 16), new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: .4, emissive: 0x222222, emissiveIntensity: .25 }));
    scene.add(ball);
    const ballShad = new THREE.Mesh(new THREE.CircleGeometry(ballR, 16), shadMat.clone()); ballShad.rotation.x = -PI / 2; ballShad.position.y = 0.02; scene.add(ballShad);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe27a, transparent: true, opacity: .4, depthWrite: false })); halo.scale.set(2.4, 2.4, 1); scene.add(halo);
    let bpx = SX(live.ball.x), bpz = SZ(live.ball.y), arc = null, pmode = null;

    const refUnit = makeHuman({ shirt: new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: .6 }), shorts: shortsA, skin: '#d2a679', hair: '#2b2b2b', style: 0 }); refUnit.g.scale.setScalar(HS); scene.add(refUnit.g);

    // ---- parçacık sistemi (konfeti + su) ----
    const parts = []; const partGeo = new THREE.PlaneGeometry(0.55, 0.55), dropGeo = new THREE.SphereGeometry(0.22, 6, 5);
    function spawnPart(geo, col, x, y, z, vx, vy, vz, grav, life) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); scene.add(m);
      parts.push({ m, vx, vy, vz, grav, life, max: life, spin: (Math.random() - .5) * 0.4 });
    }
    function confettiBurst(cx, cz, col) {
      const pal = [col, 0xffffff, 0xffd24a, 0x19c37d, 0xe5484d];
      for (let i = 0; i < 90; i++) { const a = Math.random() * 7, sp = 0.3 + Math.random() * 1.2; spawnPart(partGeo, pal[i % pal.length], cx + (Math.random() - .5) * 8, 4 + Math.random() * 4, cz + (Math.random() - .5) * 8, Math.cos(a) * sp, 1.2 + Math.random() * 2.2, Math.sin(a) * sp, -0.045, 70 + Math.random() * 40); }
    }
    function waterThrow(u) {
      const hx = u.g.position.x, hz = u.g.position.z, dir = -1;   // sahaya doğru (-Z)
      for (let i = 0; i < 16; i++) spawnPart(dropGeo, 0x6fc6ff, hx + (Math.random() - .5) * 1.5, 4.5, hz - 1, (Math.random() - .5) * 0.5, 0.6 + Math.random() * 0.8, dir * (0.8 + Math.random() * 0.9), -0.05, 38 + Math.random() * 20);
    }
    function stepParts() {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life--; p.m.position.x += p.vx; p.m.position.y += p.vy; p.m.position.z += p.vz; p.vy += p.grav; p.m.rotation.z += p.spin; p.m.rotation.x += p.spin * 0.7;
        if (p.m.position.y < 0.1 || p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
      }
    }

    // ---- overlay + TD jest paneli ----
    const ov = document.createElement('div');
    ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;font-family:Archivo,sans-serif;z-index:4';
    wrap.appendChild(ov);
    const GLIST = [['🎉', 'celebrate', 'çılgın sevinç'], ['👏', 'clap', 'alkış'], ['💪', 'power', 'hadi!'], ['🤬', 'rage', 'çıldır'], ['😱', 'shock', 'şok'], ['🤾', 'jump', 'zıpla'], ['💦', 'water', 'su fırlat'], ['👋', 'wave', 'el salla']];
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:8px;z-index:6;display:flex;gap:5px;background:rgba(8,12,18,.55);padding:5px 9px;border-radius:12px;backdrop-filter:blur(4px)';
    GLIST.forEach(([em, type, tip]) => {
      const b = document.createElement('button'); b.textContent = em; b.title = 'TD: ' + tip;
      b.style.cssText = 'border:0;background:transparent;font-size:19px;cursor:pointer;line-height:1;padding:3px;transition:transform .1s';
      b.onmouseenter = () => b.style.transform = 'scale(1.35)'; b.onmouseleave = () => b.style.transform = 'scale(1)';
      b.onclick = () => setGesture(type); panel.appendChild(b);
    });
    wrap.appendChild(panel);
    const hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;left:8px;bottom:8px;pointer-events:none;z-index:5;font:600 10px "Hanken Grotesk";color:rgba(255,255,255,.72);background:rgba(8,12,18,.42);padding:4px 8px;border-radius:6px;line-height:1.5';
    hint.innerHTML = '🖱 sürükle: döndür · tekerlek: zoom · <b>WASD</b>: kaydır · <b>R</b>: sıfırla<br>👔 alttaki butonlarla TD\'ye çılgın hareket yaptır (💦 su fırlat!)';
    wrap.appendChild(hint);

    const GSND = { clap: 'clap', water: 'splash', celebrate: 'cheer', jump: 'cheer', rage: 'pop', power: 'pop', shock: 'pop', wave: 'pop' };
    function setGesture(type) { mgrMe.gest = { type, t0: performance.now(), fired: false }; if (window.KD_SFX) KD_SFX.play(GSND[type] || 'pop'); }
    const GDUR = { wave: 1100, clap: 1800, celebrate: 2200, rage: 2000, power: 1500, shock: 1500, jump: 1600, water: 1400 };
    function animateManager(u, isMe) {
      let aLx = 0, aRx = 0, aLz = 0.14, aRz = -0.14, bz = 0, by = 0, brx = 0;
      const g = u.gest;
      if (g) {
        const e = (performance.now() - g.t0) / 1000, o = Math.sin(e * 16);
        if (e * 1000 < (GDUR[g.type] || 0)) {
          if (g.type === 'celebrate') { aLx = -2.7; aRx = -2.7; aLz = 0.6; aRz = -0.6; by = Math.abs(Math.sin(e * 11)) * 0.9; bz = Math.sin(e * 11) * 0.12; }
          else if (g.type === 'clap') { aLx = -1.5; aRx = -1.5; aLz = 0.55 + o * 0.22; aRz = -0.55 - o * 0.22; }
          else if (g.type === 'rage') { aLx = -2.2 - Math.abs(o) * 0.4; aRx = -2.2 - Math.abs(o) * 0.4; bz = Math.sin(e * 30) * 0.2; by = Math.abs(Math.sin(e * 13)) * 0.4; }
          else if (g.type === 'power') { aRx = -2.6 - Math.abs(o) * 0.3; aLx = -0.4; }
          else if (g.type === 'shock') { aLx = -2.5; aRx = -2.5; aLz = 1.0; aRz = -1.0; brx = -0.2; }
          else if (g.type === 'jump') { aLx = -2.6; aRx = -2.6; by = Math.abs(Math.sin(e * 8)) * 1.6; }
          else if (g.type === 'water') { aRx = e < 0.35 ? -2.4 : 0.6; aLx = -0.3; if (isMe && !g.fired && e > 0.33) { g.fired = true; waterThrow(u); } }
          else if (g.type === 'wave') { aRx = -2.5; aRz = -0.3 + Math.sin(e * 18) * 0.5; }
        } else u.gest = null;
      }
      u.armL.rotation.x = aLx; u.armR.rotation.x = aRx; u.armL.rotation.z = aLz; u.armR.rotation.z = aRz;
      u.body.rotation.z = bz; u.body.rotation.x = brx; u.body.position.y = by;
      if (u.arrow) { u.arrow.position.y = 6.6 + Math.sin(performance.now() / 260) * 0.35; u.arrow.rotation.y += 0.05; }
    }

    // ---- kamera kontrol + TD hover ----
    let drag = null, lastHover = 0;
    canvas3d.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas3d.setPointerCapture(e.pointerId); canvas3d.style.cursor = 'grabbing'; });
    canvas3d.addEventListener('pointermove', (e) => {
      if (drag && e.pointerId === drag.id) { cam.theta -= (e.clientX - drag.x) * 0.006; cam.phi -= (e.clientY - drag.y) * 0.006; drag.x = e.clientX; drag.y = e.clientY; updateCam(); return; }
      const r = canvas3d.getBoundingClientRect(), p = project(mgrMe.g.position.x, 4, mgrMe.g.position.z);
      if (Math.hypot(e.clientX - r.left - p.x, e.clientY - r.top - p.y) < 46) { canvas3d.style.cursor = 'pointer'; const now = performance.now(); if (now - lastHover > 1400) { lastHover = now; setGesture('wave'); } }
      else canvas3d.style.cursor = 'grab';
    });
    const endDrag = () => { drag = null; canvas3d.style.cursor = 'grab'; };
    canvas3d.addEventListener('pointerup', endDrag); canvas3d.addEventListener('pointercancel', endDrag);
    canvas3d.addEventListener('wheel', (e) => { cam.r *= 1 + Math.sign(e.deltaY) * 0.08; updateCam(); e.preventDefault(); }, { passive: false });
    canvas3d.addEventListener('dblclick', () => { Object.assign(cam, DEF); updateCam(); });
    let pinch = 0;
    canvas3d.addEventListener('touchmove', (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) { cam.r *= pinch / d; updateCam(); } pinch = d; e.preventDefault(); } }, { passive: false });
    canvas3d.addEventListener('touchend', () => { pinch = 0; });
    function panCam() {
      if (!(CK.w || CK.a || CK.s || CK.d)) return;
      const fx = -Math.sin(cam.theta), fz = -Math.cos(cam.theta), rx = fz, rz = -fx, st = 0.9;
      if (CK.w) { cam.tx += fx * st; cam.tz += fz * st; } if (CK.s) { cam.tx -= fx * st; cam.tz -= fz * st; }
      if (CK.d) { cam.tx += rx * st; cam.tz += rz * st; } if (CK.a) { cam.tx -= rx * st; cam.tz -= rz * st; }
      updateCam();
    }

    function resize() {
      const w = wrap.clientWidth || 800, h = wrap.clientHeight || 380;
      if (w === lastW && h === lastH) return; lastW = w; lastH = h;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }

    // ---- oyuncu animasyonu ----
    function animate(u, x, z, owner, kick, ktype) {
      const dx = x - u.px, dz = z - u.pz, sp = Math.hypot(dx, dz);
      if (sp > 0.02) { const tg = Math.atan2(dx, dz); let d = tg - u.ang; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; u.ang += d * 0.4; }
      u.body.rotation.y = u.ang; u.armL.rotation.z = 0.14; u.armR.rotation.z = -0.14; u.body.rotation.z = 0;
      if (kick >= 0) {
        const s = Math.sin(kick * PI);
        if (ktype === 'bicycle') {   // RÖVAŞATA: geriye takla, bacaklar havada
          u.g.rotation.x = -kick * 2.6; u.g.position.y = s * 2.6; u.body.rotation.set(0, u.ang, 0);
          u.legL.rotation.x = -2.2 + kick * 1.2; u.legR.rotation.x = -0.4 - kick * 2.0; u.armL.rotation.x = 1.4; u.armR.rotation.x = 1.4;
        } else if (ktype === 'header') {   // KAFA: öne atılır, bacak salınımı yok
          u.body.rotation.x = 0.1 + s * 0.5; u.body.position.y = s * 0.6; u.legL.rotation.x = 0.2; u.legR.rotation.x = -0.3; u.armL.rotation.x = -0.9 * s; u.armR.rotation.x = -0.9 * s; u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.5;
        } else if (ktype === 'volley') {   // VOLE: yana savrulan bacak
          u.legR.rotation.x = -0.6; u.legR.rotation.z = -0.4 - s * 0.9; u.body.rotation.z = -s * 0.4; u.body.position.y = s * 0.5; u.armL.rotation.x = -1.2 * s; u.armR.rotation.x = 1.0 * s;
        } else {   // normal / plase
          const sw = ktype === 'placed' ? 2.2 : 3.1;
          u.legR.rotation.x = -1.5 + kick * sw; u.legL.rotation.x = 0.22; u.armL.rotation.x = -1.1 * s; u.armR.rotation.x = 0.85 * s; u.body.rotation.x = 0.16 - kick * 0.06; u.body.position.y = 0;
        }
        u.px = x; u.pz = z; return;
      }
      u.legR.rotation.z = 0;   // vole sonrası bacak z sıfırla
      const drib = owner ? 1.9 : 1;
      if (sp > 0.012) u.phase += (0.42 + sp * 2.5) * drib; else { u.idle += 0.05; }
      const amp = clamp(sp * 3.3 * drib, 0, owner ? 1.6 : 1.4), s = Math.sin(u.phase) * amp;
      u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8;
      u.body.rotation.x = amp * 0.18 + (owner ? 0.12 : 0);
      u.body.rotation.z = owner ? Math.sin(u.phase * 0.5) * 0.2 : Math.sin(u.idle) * 0.03;   // çalım yalpası / durağan nefes
      u.body.position.y = Math.abs(Math.sin(u.phase)) * amp * 0.28;
      u.px = x; u.pz = z;
    }
    function diveGK(u, prog, side) {
      const a = Math.sin(prog * PI);
      u.g.rotation.x = side * a * 1.4; u.g.position.y = a * 2.0; u.body.rotation.set(0, 0, 0);
      u.armL.rotation.x = -2.3; u.armR.rotation.x = -2.3; u.armL.rotation.z = 0.7; u.armR.rotation.z = -0.7; u.legL.rotation.x = 0.4; u.legR.rotation.x = -0.2;
    }
    function fallDown(u, prog) {
      const t = prog < 0.22 ? prog / 0.22 : prog < 0.8 ? 1 : 1 - (prog - 0.8) / 0.2;
      u.g.rotation.x = -t * 1.45; u.g.position.y = t * 0.3; u.body.rotation.set(0, 0, 0);
      u.armL.rotation.x = -0.6; u.armR.rotation.x = -0.6; u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.5; u.legL.rotation.x = -0.4; u.legR.rotation.x = -0.7;
    }
    function celebrate(u, i, mgr) {
      const tx = mgr.g.position.x + ((i % 5) - 2) * 2.6, tz = mgr.g.position.z - 6 - (i % 3);
      u.g.visible = true; u.g.rotation.x = 0;
      u.g.position.x = lerp(u.g.position.x, tx, 0.05); u.g.position.z = lerp(u.g.position.z, tz, 0.05);
      const dx = tx - u.g.position.x, dz = tz - u.g.position.z, far = Math.hypot(dx, dz);
      if (far > 0.5) { u.ang = Math.atan2(dx, dz); u.phase += 0.5; const s = Math.sin(u.phase); u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s; u.armR.rotation.x = s; u.body.position.y = Math.abs(s) * 0.3; }
      else { u.armL.rotation.x = -2.6; u.armR.rotation.x = -2.6; u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.5; u.body.position.y = Math.abs(Math.sin(live.t * 0.5 + i)) * 0.8; }
      u.body.rotation.y = u.ang; u.body.rotation.x = 0; u.body.rotation.z = 0;
    }

    function place(u, p, owner, simx, simy, idx) {
      const x = SX(simx), z = SZ(simy);
      u.g.visible = true; u.g.position.set(x, 0, z); u.g.rotation.x = 0;
      if (u.ring) u.ring.visible = owner;
      u.label.draw(p.sur || '', p.carded ? '#facc15' : '#ffffff');
      const sa = live._saveAnim, fa = live._fallAnim, ka = live._kickAnim;
      if (sa && sa.idx === idx && live.t - sa.t >= 0 && live.t - sa.t < 22) { u.body.rotation.y = u.ang; diveGK(u, (live.t - sa.t) / 22, sa.side); u.px = x; u.pz = z; return; }
      if (fa && fa.idx === idx && live.t - fa.t >= 0 && live.t - fa.t < 42) { fallDown(u, (live.t - fa.t) / 42); u.px = x; u.pz = z; return; }
      const kw = (ka && (ka.type === 'bicycle' || ka.type === 'header')) ? 16 : 12;
      const kp = (ka && ka.idx === idx) ? (live.t - ka.t) : -1;
      animate(u, x, z, owner, (kp >= 0 && kp < kw) ? kp / kw : -1, ka && ka.type);
    }

    const overlayHTML = (kind, txt, sub, col) => {
      if (kind === 'goal') ov.innerHTML = `<div style="text-align:center;animation:kd3dpop .4s ease-out"><div style="font:900 9vw/0.9 Archivo;color:${col};-webkit-text-stroke:3px rgba(8,12,18,.85)">GOOOL!</div><div style="font:800 1.9vw 'Hanken Grotesk';color:#fff;margin-top:8px;text-shadow:0 2px 8px #000">${sub || ''}</div></div>`;
      else if (kind === 'replay') ov.innerHTML = `<div style="position:absolute;top:0;left:0;right:0;background:rgba(8,12,18,.6);padding:8px 16px;display:flex;align-items:center;gap:10px"><span style="width:11px;height:11px;border-radius:50%;background:#e5484d"></span><span style="font:800 15px Archivo;color:#fff">${txt}</span></div>`;
      else if (kind === 'flash') ov.innerHTML = `<div style="position:absolute;top:12%;font:800 1.9vw Archivo;color:${col};text-shadow:0 2px 6px rgba(8,12,18,.9)">${txt}</div>`;
      else ov.innerHTML = '';
    };

    let goalKey = null;
    updateCam();
    function render() {
      resize(); panCam(); stepParts();
      let bx = live.ball.x, by = live.ball.y;

      if (live.phase === 'replay' && live.replay) {
        const fr = live.replay.frames[Math.min(live.replay.frames.length - 1, Math.floor(live.replay.i))];
        units.forEach((u, i) => { const p = live.players[i]; const v = fr.pos[i]; if (!p || v < 0) { u.g.visible = false; return; } place(u, p, i === fr.owner, v >> 12, v & 0xFFF, i); });
        bx = fr.bx; by = fr.by; refUnit.g.visible = false;
        overlayHTML('replay', 'TEKRAR · GOL — ' + live.replay.name);
        goalKey = null;
      } else if (live.goalFlash) {
        const st = live.goalFlash.team, mgr = st === 0 ? mgrMe : mgrOpp;
        const key = st + '|' + (live.goalFlash.name || '') + '|' + live.a + '-' + live.b;
        if (key !== goalKey) { goalKey = key; confettiBurst(SX(W / 2), SZ(H / 2), st === 0 ? colAcol.getHex() : colBcol.getHex()); mgr.gest = { type: 'celebrate', t0: performance.now(), fired: false }; }
        units.forEach((u, i) => { const p = live.players[i]; if (!p || !p.ref || p.sentOff) { u.g.visible = false; return; } if ((i < 11 ? 0 : 1) === st) celebrate(u, i, mgr); else place(u, p, false, p.x, p.y, i); });
        if (live.ref) { refUnit.g.visible = true; refUnit.g.position.set(SX(live.ref.x), 0, SZ(live.ref.y)); }
        const col = '#' + (st === 0 ? colAcol : colBcol).getHexString();
        overlayHTML('goal', null, live.goalFlash.name + (live.clubName ? ' — ' + live.clubName(st) : ''), col);
      } else {
        goalKey = null;
        const owner = live.owner;
        units.forEach((u, i) => { const p = live.players[i]; if (!p || !p.ref || p.sentOff || p.x <= -9000) { u.g.visible = false; return; } place(u, p, i === owner, p.x, p.y, i); });
        if (live.ref) { refUnit.g.visible = true; animate(refUnit, SX(live.ref.x), SZ(live.ref.y)); refUnit.g.position.set(SX(live.ref.x), 0, SZ(live.ref.y)); }
        else refUnit.g.visible = false;
        if (live.flash && live.t < (live._flashUntil || 0)) overlayHTML('flash', live.flash.txt, null, live.flash.col || '#fff');
        else if (ov.innerHTML) overlayHTML('none');
      }

      // ---- top: konum + dikey parabol + yuvarlanma ----
      if (live.ballMode !== pmode) { pmode = live.ballMode; const tx = live.ball.tx, ty = live.ball.ty; const total = Math.hypot(tx - bx, ty - by); arc = { sx: bx, sy: by, total, max: pmode === 'shot' ? 1.8 : (pmode === 'pass' ? (total < 38 ? 0 : clamp((total - 30) * 0.085, 0, 8)) : 0) }; }   // kısa pas YERDEN, uzun pas/orta HAVADAN
      const wx = SX(bx), wz = SZ(by);
      let bh = ballR;
      if ((live.ballMode === 'pass' || live.ballMode === 'shot') && arc && arc.total > 2) { const trav = Math.hypot(bx - arc.sx, by - arc.sy); const prog = clamp(trav / arc.total, 0, 1); bh = ballR + Math.sin(prog * PI) * arc.max; }
      const dx = wx - bpx, dz = wz - bpz, d = Math.hypot(dx, dz);
      ball.position.set(wx, bh, wz); ballShad.position.set(wx, 0.02, wz); ballShad.material.opacity = clamp(0.28 - (bh - ballR) * 0.03, 0.05, 0.28); halo.position.set(wx, bh, wz);
      if (d > 0.001) ball.rotateOnWorldAxis(new THREE.Vector3(dz / d, 0, -dx / d), d / ballR);
      bpx = wx; bpz = wz;

      animateManager(mgrMe, true); animateManager(mgrOpp, false);
      renderer.render(scene, camera);
    }

    const ctrl = {
      active: false, render,
      resetCam() { Object.assign(cam, DEF); updateCam(); },
      setActive(on) {
        ctrl.active = !!on; ACTIVE = on ? ctrl : (ACTIVE === ctrl ? null : ACTIVE);
        canvas3d.style.display = on ? 'block' : 'none';
        [ov, panel, hint].forEach(el => el.style.display = on ? '' : 'none');
        if (live.cv) live.cv.style.visibility = on ? 'hidden' : 'visible';
        if (on) { resize(); updateCam(); render(); }
      },
      dispose() { if (ACTIVE === ctrl) ACTIVE = null; try { renderer.dispose(); } catch (_) {} [canvas3d, ov, panel, hint].forEach(el => el.remove()); if (live.cv) live.cv.style.visibility = 'visible'; },
    };
    return ctrl;
  }

  if (!document.getElementById('kd3d-style')) {
    const st = document.createElement('style'); st.id = 'kd3d-style';
    st.textContent = '@keyframes kd3dpop{0%{transform:scale(.6);opacity:0}55%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}';
    document.head.appendChild(st);
  }
  window.KD_RENDER3D = { create };
})();
