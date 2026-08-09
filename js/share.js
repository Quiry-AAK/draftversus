/* ============================================================
   DraftVersus — sonuç paylaşımı
   İki biçim:
     1) Metin/emoji özeti (Wordle etkisi) — her yere yapıştırılır
     2) Görsel kart (canvas → PNG) — Web Share API varsa dosya olarak
        paylaşılır, yoksa indirilir
   Kişisel veri paylaşılmaz; yalnızca skor ve kulüp adları.
   ============================================================ */
(function () {
  const SITE = 'draftversus.com';

  /* --- metin özeti: "DraftVersus · Bo3 2-1 ✅🟥✅" --- */
  function buildText(info) {
    const marks = (info.matches || []).map(m => m.winner === 'a' ? '🟩' : '🟥').join('');
    const head = info.daily
      ? 'DraftVersus · Günün Meydan Okuması ' + (info.dailyId || '')
      : 'DraftVersus · Bo' + (info.format || 3);
    const line = `${info.me} ${info.winsA}–${info.winsB} ${info.opp}`;
    const extra = info.won ? '🏆 Seri galibiyeti' : '';
    return [head, line, marks, extra, 'https://' + SITE].filter(Boolean).join('\n');
  }

  /* --- görsel kart (1200×630, OG oranı) --- */
  function buildCanvas(info) {
    const W = 1200, H = 630;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');

    // zemin
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f4f6f8'); g.addColorStop(1, '#e8ecef');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // üst yeşil şerit
    x.fillStyle = '#19c37d'; x.fillRect(0, 0, W, 8);

    x.textAlign = 'center';
    // başlık
    x.fillStyle = '#8b929d';
    x.font = "600 22px 'Hanken Grotesk', system-ui, sans-serif";
    x.fillText(info.daily ? ('GÜNÜN MEYDAN OKUMASI · ' + (info.dailyId || '')) : ('SERİ SONUCU · Bo' + (info.format || 3)), W / 2, 78);

    // skor
    x.fillStyle = '#14181f';
    x.font = "900 132px Archivo, system-ui, sans-serif";
    x.fillText(info.winsA + ' – ' + info.winsB, W / 2, 235);

    // kulüpler (renk kutusu + ad)
    const label = (txt, color, cx, cy) => {
      x.fillStyle = color; roundRect(x, cx - 150, cy - 26, 34, 34, 8); x.fill();
      x.fillStyle = '#14181f';
      x.font = "800 30px Archivo, system-ui, sans-serif";
      x.textAlign = 'left';
      x.fillText(String(txt).slice(0, 16), cx - 104, cy + 2);
      x.textAlign = 'center';
    };
    label(info.me, info.meColor || '#3b6fe0', W / 2 - 190, 300);
    label(info.opp, info.oppColor || '#e8893b', W / 2 + 210, 300);

    // maç maç kutular
    const ms = info.matches || [];
    const bw = 150, gap = 16, total = ms.length * bw + (ms.length - 1) * gap;
    let bx = (W - total) / 2;
    ms.forEach(m => {
      const win = m.winner === 'a';
      x.fillStyle = win ? '#e7f8f0' : '#fdeced';
      roundRect(x, bx, 360, bw, 92, 14); x.fill();
      x.strokeStyle = win ? '#c5edd9' : '#f3c6c8'; x.lineWidth = 2;
      roundRect(x, bx, 360, bw, 92, 14); x.stroke();
      x.fillStyle = win ? '#13a76a' : '#c43d42';
      x.font = "900 42px Archivo, system-ui, sans-serif";
      x.fillText(m.a + '-' + m.b, bx + bw / 2, 420);
      bx += bw + gap;
    });

    // alt satır: kazanan + site
    x.fillStyle = info.won ? '#13a76a' : '#6a7280';
    x.font = "800 30px Archivo, system-ui, sans-serif";
    x.fillText(info.won ? '🏆 ' + String(info.me).slice(0, 18) + ' kazandı' : String(info.opp).slice(0, 18) + ' kazandı', W / 2, 512);
    x.fillStyle = '#8b929d';
    x.font = "700 26px 'Hanken Grotesk', system-ui, sans-serif";
    x.fillText(SITE, W / 2, 566);
    return c;
  }
  function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  }

  function canvasBlob(c) { return new Promise(res => c.toBlob(res, 'image/png')); }

  /* --- ana paylaşım akışı --- */
  async function share(info) {
    const text = buildText(info);
    let canvas = null, blob = null, file = null;
    try { canvas = buildCanvas(info); blob = await canvasBlob(canvas); } catch (_) {}
    if (blob) { try { file = new File([blob], 'draftversus.png', { type: 'image/png' }); } catch (_) {} }

    // 1) görselle birlikte yerel paylaşım (mobil)
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file], text }); return 'shared-file'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    // 2) yalnız metin paylaşımı
    if (navigator.share) {
      try { await navigator.share({ text }); return 'shared-text'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    // 3) masaüstü: metni panoya kopyala + görseli indir
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch (_) {}
    if (blob) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'draftversus-sonuc.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return copied ? 'copied-downloaded' : 'downloaded';
      } catch (_) {}
    }
    return copied ? 'copied' : 'failed';
  }

  window.KD_SHARE = { share, buildText, buildCanvas };
})();
