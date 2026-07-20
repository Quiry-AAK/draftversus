/* ============================================================
   DraftVersus — Ağ katmanı (WebSocket istemcisi)
   Oda kur / katıl + oyun mesajı relay + geçici kopmada otomatik yeniden bağlanma.
   Oyun mantığı game.js'te; bu katman yalnızca taşımayı yönetir.

   Sunucu mesajları (gelen):
     created   {code, side:'a', token}
     joined    {code, side:'b', config, peer, token}
     peer-joined {profile}
     peer-away          (rakip geçici koptu — grace başladı)
     peer-back          (rakip geri döndü)
     peer-left {voluntary}
     resumed   {side, config}      (kendi yeniden bağlanmamız başarılı)
     resume-failed {reason}        (grace doldu / oda yok → sonlandır)
     error     {code, msg}
   İstemci → sunucu: create / join / resume / relay / leave
   Relay (oyun seviyesi) mesajları d olarak sarılır: {t:'relay', d:{...}}
   ============================================================ */
(function () {
  const NET = {
    ws: null,
    connected: false,
    side: null,        // 'a' (host) | 'b' (guest)
    code: null,
    peerPresent: false,
    _token: null,
    _voluntary: false, // bilinçli ayrılış → yeniden bağlanma deneme
    _reconnecting: false,
    _reTimer: null,
    _reDeadline: 0,
    _handlers: [],
    _pending: [],      // socket açılmadan önce kuyruğa alınan KONTROL mesajları
  };
  const RECON_STEP_MS = 2000;   // deneme aralığı
  const RECON_WINDOW_MS = 44000; // sunucu grace'i (45s) içinde kal
  const PENDING_CAP = 200;

  function wsURL() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // file:// ile açıldıysa host boş olur → online çalışmaz (kullanıcı uyarılır)
    return proto + '//' + location.host + '/ws';
  }
  function isOpen() { return NET.ws && NET.ws.readyState === 1; }

  NET.available = function () { return !!location.host; };
  NET.on = function (fn) { NET._handlers.push(fn); };
  function emit(msg) { NET._handlers.forEach(h => { try { h(msg); } catch (e) { console.error(e); } }); }

  /* gelen mesaj işleyici — hem ilk bağlantı hem yeniden bağlanma soketinde kullanılır */
  function handleMessage(e) {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
    switch (m.t) {
      case 'created': NET.side = 'a'; NET.code = m.code; NET._token = m.token || null; emit(m); break;
      case 'joined': NET.side = 'b'; NET.code = m.code; NET._token = m.token || null; NET.peerPresent = true; emit(m); break;
      case 'peer-joined': NET.peerPresent = true; emit(m); break;
      case 'peer-away': emit(m); break;
      case 'peer-back': NET.peerPresent = true; emit(m); break;
      case 'peer-left': NET.peerPresent = false; emit(m); break;
      case 'resumed': {
        // yeniden bağlanma başarılı: normal akışa dön, bekleyen kontrol mesajlarını yolla
        NET.connected = true; NET._reconnecting = false;
        if (NET._reTimer) { clearTimeout(NET._reTimer); NET._reTimer = null; }
        flushPending();
        emit(m); break;
      }
      case 'resume-failed': NET._reconnecting = false; if (NET._reTimer) { clearTimeout(NET._reTimer); NET._reTimer = null; } emit(m); break;
      case 'relay': emit(Object.assign({ _relay: true }, m.d)); break;
      default: emit(m); break;
    }
  }
  function flushPending() { const q = NET._pending.splice(0); q.forEach(p => { if (isOpen()) NET.ws.send(JSON.stringify(p)); }); }

  NET.connect = function (onReady, onFail) {
    if (NET.connected && isOpen()) { onReady && onReady(); return; }
    if (!NET.available()) { onFail && onFail('file'); return; }
    NET._voluntary = false;
    try {
      const ws = new WebSocket(wsURL());
      NET.ws = ws;
      ws.onopen = () => { NET.connected = true; flushPending(); onReady && onReady(); };
      ws.onclose = () => { NET.connected = false; onDrop(); };
      ws.onerror = () => { if (!NET._reconnecting) onFail && onFail('error'); };
      ws.onmessage = handleMessage;
    } catch (e) { onFail && onFail('error'); }
  };

  /* bağlantı beklenmedik şekilde koptuğunda: bilinçli değilse yeniden bağlanmayı dene */
  function onDrop() {
    if (NET._voluntary) return;
    if (!NET.code || !NET.side || !NET._token) { emit({ t: 'net-down' }); return; }  // resume verisi yok → eski davranış
    if (NET._reconnecting) return;
    NET._reconnecting = true;
    NET._reDeadline = Date.now() + RECON_WINDOW_MS;
    emit({ t: 'reconnecting' });
    scheduleResume();
  }
  function scheduleResume() {
    if (NET._reTimer) clearTimeout(NET._reTimer);
    NET._reTimer = setTimeout(tryResume, RECON_STEP_MS);
  }
  function tryResume() {
    if (NET._voluntary || !NET._reconnecting) return;
    if (Date.now() > NET._reDeadline) { NET._reconnecting = false; emit({ t: 'reconnect-failed' }); return; }
    try {
      const ws = new WebSocket(wsURL());
      NET.ws = ws;
      ws.onopen = () => { try { ws.send(JSON.stringify({ t: 'resume', code: NET.code, side: NET.side, token: NET._token })); } catch (_) {} };
      ws.onmessage = handleMessage;   // 'resumed' burada yakalanır
      ws.onclose = () => { NET.connected = false; if (NET._reconnecting && !NET._voluntary) scheduleResume(); };
      ws.onerror = () => {};
    } catch (_) { scheduleResume(); }
  }

  function raw(obj) {
    if (isOpen() && NET.connected) NET.ws.send(JSON.stringify(obj));
    else { if (NET._pending.length >= PENDING_CAP) NET._pending.shift(); NET._pending.push(obj); }
  }

  NET.create = function (config) { raw({ t: 'create', config: config || {} }); };
  NET.join = function (code, profile) { raw({ t: 'join', code: String(code || '').toUpperCase().trim(), profile: profile || null }); };

  /* Oyun seviyesi mesaj gönder (rakibe relay edilir). d = {t:'draft-pick', ...} gibi.
     Bağlantı kopukken yayın karesi/ping bayatlar → biriktirme (en yeni kare yeterli). */
  NET.send = function (d) {
    if (!isOpen() && d && (d.t === 'm-frame' || d.t === 'png' || d.t === 'pong' || d.t === 'm-update')) return;
    raw({ t: 'relay', d: d });
  };

  NET.leave = function () {
    NET._voluntary = true; NET._reconnecting = false;
    if (NET._reTimer) { clearTimeout(NET._reTimer); NET._reTimer = null; }
    raw({ t: 'leave' });
    NET.side = null; NET.code = null; NET._token = null; NET.peerPresent = false; NET._pending.length = 0;
    try { NET.ws && NET.ws.close(); } catch (_) {}
    NET.ws = null; NET.connected = false;
  };

  NET.isHost = function () { return NET.side === 'a'; };

  window.KD_NET = NET;
})();
