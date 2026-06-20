/* ============================================================
   DraftVersus — Ağ katmanı (WebSocket istemcisi)
   Oda kur / katıl + oyun mesajı relay. Oyun mantığı game.js'te;
   bu katman yalnızca taşımayı yönetir.

   Sunucu mesajları (gelen):
     created   {code, side:'a'}
     joined    {code, side:'b', config, peer, guestProfile}
     peer-joined {profile}
     peer-left {voluntary}
     error     {code, msg}
   Relay (oyun seviyesi) mesajları d olarak sarılır: {t:'relay', d:{...}}
   ============================================================ */
(function () {
  const NET = {
    ws: null,
    connected: false,
    side: null,        // 'a' (host) | 'b' (guest)
    code: null,
    peerPresent: false,
    _handlers: [],
    _pending: [],      // socket açılmadan önce kuyruğa alınan mesajlar
  };

  function wsURL() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // file:// ile açıldıysa host boş olur → online çalışmaz (kullanıcı uyarılır)
    return proto + '//' + location.host + '/ws';
  }

  NET.available = function () { return !!location.host; };

  NET.on = function (fn) { NET._handlers.push(fn); };
  function emit(msg) { NET._handlers.forEach(h => { try { h(msg); } catch (e) { console.error(e); } }); }

  NET.connect = function (onReady, onFail) {
    if (NET.connected && NET.ws && NET.ws.readyState === 1) { onReady && onReady(); return; }
    if (!NET.available()) { onFail && onFail('file'); return; }
    try {
      const ws = new WebSocket(wsURL());
      NET.ws = ws;
      ws.onopen = () => {
        NET.connected = true;
        NET._pending.splice(0).forEach(p => ws.send(JSON.stringify(p)));
        onReady && onReady();
      };
      ws.onclose = () => {
        const wasConnected = NET.connected;
        NET.connected = false;
        if (wasConnected) emit({ t: 'net-down' });
      };
      ws.onerror = () => { onFail && onFail('error'); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (_) { return; }
        switch (m.t) {
          case 'created': NET.side = 'a'; NET.code = m.code; emit(m); break;
          case 'joined': NET.side = 'b'; NET.code = m.code; NET.peerPresent = true; emit(m); break;
          case 'peer-joined': NET.peerPresent = true; emit(m); break;
          case 'peer-left': NET.peerPresent = false; emit(m); break;
          case 'relay': emit(Object.assign({ _relay: true }, m.d)); break;
          default: emit(m); break;
        }
      };
    } catch (e) { onFail && onFail('error'); }
  };

  function raw(obj) {
    if (NET.connected && NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(obj));
    else NET._pending.push(obj);
  }

  NET.create = function (config) { raw({ t: 'create', config: config || {} }); };
  NET.join = function (code, profile) { raw({ t: 'join', code: String(code || '').toUpperCase().trim(), profile: profile || null }); };

  /* Oyun seviyesi mesaj gönder (rakibe relay edilir). d = {t:'draft-pick', ...} gibi */
  NET.send = function (d) { raw({ t: 'relay', d: d }); };

  NET.leave = function () {
    raw({ t: 'leave' });
    NET.side = null; NET.code = null; NET.peerPresent = false;
    try { NET.ws && NET.ws.close(); } catch (_) {}
    NET.ws = null; NET.connected = false;
  };

  NET.isHost = function () { return NET.side === 'a'; };

  window.KD_NET = NET;
})();
