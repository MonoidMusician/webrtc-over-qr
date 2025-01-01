// stage1 loads everything in the document's `<head>`, so that stage2 has access
// to all of the helper libraries and such when loading the body. it needs to
// be less than 16KB.
"use strict";
(function detectRole() {
  if (!window.role) {
    if ((window.rtc || window.R) instanceof RTCPeerConnection && (window.dc || window.D) instanceof RTCDataChannel) {
      window.role = 'guest';
    } else {
      window.role = 'host';
    }
  }
  if (!['host','guest'].includes(window.role)) {
    throw new Error('Could not determine role');
  }
})();
if (role === 'guest') {
  function assert(condition, message="Assertion failed") {
    if (!condition) throw new Error(message);
  }

  // Clean up the code golfed stage0, which ends up setting single-letter
  // global variables on `window`
  function cleanup() {
    const rtc = window.rtc || window.R;
    assert(rtc instanceof RTCPeerConnection);
    const dc = window.dc || window.D;
    assert(dc instanceof RTCDataChannel);
    for (const k in window) {
      if (k.length === 1 && isNaN(k)) {
        delete window[k];
      }
    }
    delete window.rtc;
    delete window.dc;
    delete window.cleanup;
    return { rtc, dc };
  };

  (async function stage1guest({ rtc, dc }) { try {
    const current = 'stage1';
    dc.send(JSON.stringify({ stage: current, type: 'ready' }));

    let pending = []; let idle = true;
    dc.onmessage = ev => {
      pending.push(ev);
      if (idle) {
        poke();
      }
    };

    function poke() {
      let ev = pending.shift();
      if (idle = !ev) return;
      let request = JSON.parse(ev.data);
      assert(request.stage === current);
      if (request.type === 'done') {
        dc.send(JSON.stringify({ stage: current, type: 'done' }));

        stage2({ rtc, dc });
        return;
      }
      assert(request.type === 'element');
      if (request.tag === 'script' && request.attrs.src) {
        let element = document.createElement(request.tag);
        element.src = request.attrs.src;
        element.onload = poke;
        document.head.appendChild(element);
      } else {
        let element = document.createElement(request.tag);
        for (let [name, value] of Object.entries(request.attrs)) {
          element.setAttribute(name, value);
        }
        element.textContent = request.textContent;
        document.head.appendChild(element);
        poke();
      }
    }
  } catch(e) {
    document.body.textContent = String(e);
    dc.send(JSON.stringify({ stage: current, type: 'error', message: e.message, stack: e.stack, e }));
    throw e;
  }})(cleanup());
} else if (role === 'host') {
  window.stage1 = async function stage1host({ rtc, dc }) { try {
    assert(dc instanceof RTCDataChannel);
    function isEphemeral(el) {
      return [...el.classList].some(cls => isEphemeral.classes.includes(cls));
    }
    isEphemeral.classes = ["ephemeral", "stage0", "stage1", "host-only"];
    const current = 'stage1';
    dc.onmessage = () => {};
    let initiated = false;
    async function initiate(stage1script) {
      // This is, ideally, our only use of the remote `eval()`, ... for whatever
      // it's worth
      dc.send(Ve.scripty`
        (async function() {
          try {
            for (let element of [...document.head.children]) {
              if (element.localName === 'style') document.head.removeChild(element);
            }
            document.head.appendChild(Object.assign(document.createElement('base'), {href:${document.baseURI}}));
            await new Promise((resolve,reject) => {
              const script = ${{
                src: stage1script.src || undefined,
                textContent: stage1script.textContent || undefined,
              }};
              document.head.appendChild(Object.assign(document.createElement('script'), {
                className: 'stage1',
                ...script,
                onerror: (ev) => reject(Object.assign(new Error("Failed to load stage1"), ev)),
                onload: resolve,
              }));
              if (!script.src) resolve();
            });
          } catch(e) {
            (window.dc || window.D).send(JSON.stringify({ stage: ${current}, type: 'error', message: e.message, stack: e.stack, e }));
            console.error(e);
            throw e;
          }
        })();
      `);
      var ev = JSON.parse((await Ve.once.message(dc)).data);
      assert(ev.stage === current);
      if (ev.type === 'error') {
        host_ui.throwError(Object.assign(new Error(ev.message), ev));
      }
    }
    for (let child of document.head.children) {
      if (!initiated) {
        if (child.tagName === 'SCRIPT' && child.classList.contains('stage1')) {
          await initiate(child);
          initiated = true;
        } else if (child.tagName === 'BASE') {
          if (!child.getAttribute('href')) child.setAttribute('href', document.baseURI);
        }
        continue;
      }
      if (isEphemeral(child)) continue;
      let tag = child.tagName.toLowerCase();
      let msg = { stage: current, type: 'element', tag };
      msg.attrs = Object.fromEntries(Array.from(child.attributes).map(attr=>[attr.name,attr.value]));
      msg.textContent = child.textContent;
      if (tag === 'script') {
        // if (!msg.attrs.src && msg.textContent) {
        //   // We have access to `toDataURI` here, as the host
        //   msg.attrs.src = toDataURI(msg.textContent, 'application/javascript');
        //   msg.textContent = '';
        // }
      }
      if (!Array.from(child.children).every(isEphemeral)) {
        console.warn('Ignoring children of element in head:', child);
      }
      dc.send(JSON.stringify(msg));
    }
    if (!initiated) throw new Error('Did not find stage1 script');
    dc.send(JSON.stringify({ stage: current, type: 'done' }));
    var ev = JSON.parse((await Ve.once.message(dc)).data);
    if (ev.type === 'error') {
      host_ui.throwError(Object.assign(new Error(ev.message), ev));
    }
    assert(ev.stage === current);
    assert(ev.type === 'done');
    var ev = JSON.parse((await Ve.once.message(dc)).data);
    if (ev.type === 'error') {
      host_ui.throwError(Object.assign(new Error(ev.message), ev));
    }
    assert(ev.stage === 'stage2');
    assert(ev.type === 'ready');
    stage2({ rtc, dc });
  } catch(e) {
    host_ui.throwError(e); throw e;
  }};
}
