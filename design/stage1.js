if (role === 'guest') {
  function assert(condition, message="Assertion failed") {
    if (!condition) throw new Error(message);
  }

  (async function stage1guest() {
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
        var done = () => dc.send(JSON.stringify({ stage: current, type: 'done' }));
        // A bit hacky, but, yeah, need to wait for it to load
        // since `script.onload` only captures, uh, downloading? parsing? idk.
        if (!globalThis.Ve) {
          globalThis.Ve = {onload:done};
          return;
        }
        return done();
      }
      assert(request.type === 'element');
      if (request.tag === 'script') {
        assert(request.attrs.src);
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
  })();
} else if (role === 'host') {
  stage1 = async function stage1host(dc) {
    function isEphemeral(el) {
      return !!new Set(el.classList).intersection(isEphemeral.classes).size;
    }
    isEphemeral.classes = new Set(["ephemeral", "stage0", "stage1", "host-only"]);
    const current = 'stage1';
    onmsg = dc.onmessage;
    dc.onmessage = () => {};
    dc.send(`document.head.appendChild(Object.assign(document.createElement('script'), {src:'stage1.js'}));`);
    var ev = await Ve.once.message(dc);
    // console.log('ready', ev);
    for (let child of document.head.children) {
      if (isEphemeral(child)) continue;
      let tag = child.tagName.toLowerCase();
      let msg = { stage: current, type: 'element', tag };
      msg.attrs = Object.fromEntries(Array.from(child.attributes).map(attr=>[attr.name,attr.value]));
      msg.textContent = child.textContent;
      if (tag === 'script') {
        if (!msg.attrs.src && msg.textContent) {
          // We have access to `toDataURI` here, as the host
          msg.attrs.src = toDataURI(msg.textContent, 'application/javascript');
          msg.textContent = '';
        }
      }
      if (!Array.from(child.children).every(isEphemeral)) {
        console.warn('Ignoring children of element in head:', child);
      }
      dc.send(JSON.stringify(msg));
    }
    dc.send(JSON.stringify({ stage: current, type: 'done' }));
    var ev = await Ve.once.message(dc);
    var ev = await Ve.once.message(dc);
    // console.log('done', ev);
    // dc.onmessage = onmsg;
    stage2(dc);
  };
} else {
  console.error('Neither host nor guest:', role);
}
