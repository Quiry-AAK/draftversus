/* ============================================================
   Kadro Düellosu — oyuncu görünüm (avatar) kaynağı
   Hem 3D (ten/saç) hem kart yüzleri aynı deterministik haritadan.
   THREE'ye bağımlı DEĞİL.
   ============================================================ */
(function () {
  const SKIN = ['#f6d7bd', '#eecaa3', '#e0b083', '#cf9568', '#b3784e', '#915f3c', '#6e472c', '#523524'];
  const HAIR = ['#13100c', '#2a1a10', '#4a2f1b', '#6e4423', '#9a6a2e', '#c79a3d', '#e3c879', '#8a3a22', '#2b2b2b', '#5a5a5a', '#9aa0a8', '#d94f9a'];
  const JCOL = ['#2c6cd6', '#d63d3d', '#1f9d57', '#e0a020', '#7a3bd1', '#2a2f3a', '#d94f9a', '#e8893b', '#19b3a6', '#eef1f4'];

  function hash(s) { s = '' + (s == null ? '' : s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // tek deterministik üretici (LCG) → tüm özellikler bağımsız + bol çeşitlilik
  function gen(id) {
    let h = hash(id); const r = (m) => { h = (h * 1664525 + 1013904223) >>> 0; return h % m; };
    const skin = SKIN[r(SKIN.length)];
    const hair = HAIR[r(HAIR.length)];
    const style = r(10);                 // 0 kısa·1 yandan·2 afro·3 kazıma·4 mohawk·5 uzun·6 kel·7 tepe·8 topuz·9 dikenli
    const brow = r(3), eye = r(3), mouth = r(3), fh = r(6);   // fh: yüz kılı (0-1 yok, 2 sakal-tüyü, 3 bıyık, 4 keçi, 5 tam sakal)
    const acc = r(7), earring = r(8) === 0, tattoo = r(4) === 0, freck = r(5) === 0;
    const jersey = JCOL[r(JCOL.length)];
    return { skin, hair, style, bald: style === 6, beard: fh >= 4, brow, eye, mouth, fh, acc, earring, tattoo, freck, jersey };
  }
  function of(id) { return gen(id); }   // 3D bunu kullanır (skin/hair/style/bald)

  function faceSVG(id, size) {
    const a = gen(id), s = size || 46, hC = a.hair, sk = a.skin;
    const dark = (c) => c;   // (gölge için aynı renk; istenirse koyulaştırılır)
    const P = [];
    // omuz + forma (insan büstü hissi — "top" gibi durmasın)
    P.push(`<path d="M2 46 Q3 37 14 35 L18 32 L28 32 L32 35 Q43 37 44 46 Z" fill="${a.jersey}"/>`);
    P.push(`<path d="M18 32 L23 37 L28 32 Z" fill="rgba(255,255,255,.25)"/>`);   // yaka
    // boyun
    P.push(`<rect x="19.5" y="29" width="7" height="6" rx="2" fill="${sk}"/>`);
    if (a.tattoo) P.push(`<path d="M21 33 q1.5 1.5 0 3 M24.5 32.5 q-1.2 1.6 0.3 3.2 M25.5 34 q1.4 .6 2.2 -.4" stroke="#1d2740" stroke-width="0.9" fill="none" stroke-linecap="round" opacity=".8"/>`);
    // kulaklar + küpe
    P.push(`<ellipse cx="10.5" cy="22" rx="2.2" ry="3" fill="${sk}"/><ellipse cx="35.5" cy="22" rx="2.2" ry="3" fill="${sk}"/>`);
    if (a.earring) P.push(`<circle cx="35.6" cy="25" r="1.1" fill="#ffd24a" stroke="#caa11f" stroke-width=".4"/>`);
    // baş
    P.push(`<ellipse cx="23" cy="21.5" rx="12" ry="13" fill="${sk}"/>`);
    // tam sakal (saçtan önce, çeneyi sarar)
    if (a.fh === 5) P.push(`<path d="M11.5 20 Q12 35 23 37 Q34 35 34.5 20 Q31 29 23 29 Q15 29 11.5 20 Z" fill="${hC}"/>`);
    // saç stili
    P.push(hairSVG(a.style, hC, sk));
    // kaşlar
    const brows = [
      `<path d="M15 17 q3 -2 6 0 M25 17 q3 -2 6 0" stroke="${hC}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      `<rect x="15" y="16.5" width="6" height="1.6" rx=".8" fill="${hC}"/><rect x="25" y="16.5" width="6" height="1.6" rx=".8" fill="${hC}"/>`,
      `<path d="M15 17.5 q3 -1 6 -.3 M25 17.2 q3 -.7 6 .3" stroke="${hC}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
    ][a.brow];
    P.push(brows);
    // gözler
    const eyes = [
      `<circle cx="18" cy="21" r="1.9" fill="#23262d"/><circle cx="28" cy="21" r="1.9" fill="#23262d"/>`,
      `<ellipse cx="18" cy="21" rx="2" ry="1.1" fill="#23262d"/><ellipse cx="28" cy="21" rx="2" ry="1.1" fill="#23262d"/>`,
      `<circle cx="18" cy="21" r="1.6" fill="#23262d"/><circle cx="28" cy="21" r="1.6" fill="#23262d"/><circle cx="18.6" cy="20.5" r=".5" fill="#fff"/><circle cx="28.6" cy="20.5" r=".5" fill="#fff"/>`,
    ][a.eye];
    P.push(eyes);
    // burun
    P.push(`<path d="M23 22 l-1.2 3 q1.2 .8 2.4 0" stroke="${shade(sk)}" stroke-width="1" fill="none" stroke-linecap="round"/>`);
    // çiller
    if (a.freck) P.push(`<g fill="${shade(sk)}" opacity=".5"><circle cx="16" cy="24" r=".6"/><circle cx="18" cy="25.5" r=".6"/><circle cx="30" cy="24" r=".6"/><circle cx="28" cy="25.5" r=".6"/></g>`);
    // yüz kılı: tüy / bıyık / keçi
    if (a.fh === 2) P.push(`<path d="M14 25 Q23 31 32 25 Q31 30 23 31 Q15 30 14 25 Z" fill="${hC}" opacity=".28"/>`);
    if (a.fh === 3 || a.fh === 4) P.push(`<path d="M18 27.5 Q23 29.5 28 27.5" stroke="${hC}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
    if (a.fh === 4) P.push(`<path d="M21 30 Q23 33 25 30 Z" fill="${hC}"/>`);
    // ağız
    const mouths = [
      `<path d="M20 29.5 q3 1 6 0" stroke="#9c5a44" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
      `<path d="M19.5 29 q3.5 3 7 0" stroke="#9c5a44" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      `<path d="M20 30 q3 1.4 6 -.4" stroke="#9c5a44" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    ][a.mouth];
    if (a.fh < 4) P.push(mouths);
    // aksesuar: gözlük / bandana
    if (a.acc === 0) P.push(`<g stroke="#23262d" stroke-width="1" fill="none"><circle cx="18" cy="21" r="3"/><circle cx="28" cy="21" r="3"/><path d="M21 21 h4"/></g>`);
    else if (a.acc === 1) P.push(`<rect x="10" y="13" width="26" height="3.6" rx="1.8" fill="${a.jersey}"/>`);

    return `<svg viewBox="0 0 46 46" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">${P.join('')}</svg>`;
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, r - 55); g = Math.max(0, g - 45); b = Math.max(0, b - 40);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function hairSVG(style, hC, sk) {
    switch (style) {
      case 0: return `<path d="M10 21 Q12 8 23 8 Q34 8 36 21 Q34 12 23 11 Q12 12 10 21 Z" fill="${hC}"/>`;             // kısa
      case 1: return `<path d="M9 21 Q10 8 23 8 Q35 8 37 16 Q33 11 21 11 Q12 12 9 21 Z" fill="${hC}"/><path d="M21 11 Q28 9 34 13" stroke="${sk}" stroke-width="1.2" fill="none" opacity=".4"/>`; // yandan ayrık
      case 2: return `<circle cx="23" cy="14" r="13.5" fill="${hC}"/><ellipse cx="23" cy="22" rx="12" ry="13" fill="${sk}"/>`; // afro
      case 3: return `<path d="M11 19 Q23 9 35 19 L35 16 Q23 7 11 16 Z" fill="${hC}" opacity=".82"/>`;                 // kazıma
      case 4: return `<path d="M20 5 L26 5 L25.5 19 L20.5 19 Z" fill="${hC}"/>`;                                       // mohawk
      case 5: return `<path d="M8 18 Q8 35 12.5 35 L12.5 16 Q23 7 33.5 16 L33.5 35 Q38 35 38 18 Q38 6 23 6 Q8 6 8 18 Z" fill="${hC}"/>`; // uzun
      case 6: return '';                                                                                              // kel
      case 7: return `<path d="M10 21 Q11 9 23 9 Q35 9 36 21 Q31 14 23 17 Q15 14 10 21 Z" fill="${hC}"/>`;            // tepe (widow's peak)
      case 8: return `<path d="M11 20 Q13 10 23 10 Q33 10 35 20 Q31 13 23 13 Q15 13 11 20 Z" fill="${hC}"/><circle cx="23" cy="6.5" r="3.4" fill="${hC}"/>`; // topuz
      case 9: return `<path d="M10 21 L13 9 L16.5 18 L20 7 L23 18 L26 7 L29.5 18 L33 9 L36 21 Q31 13 23 13 Q15 13 10 21 Z" fill="${hC}"/>`; // dikenli
    }
    return '';
  }
  function faceURL(id, size) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(faceSVG(id, size)); }

  window.KD_AVATAR = { SKIN, HAIR, hash, of, gen, faceSVG, faceURL };
})();
