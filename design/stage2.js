if (role === 'guest') {
  (async function stage2guest() {
    const current = 'stage2';
    document.body.style = ''; // FIXME
    document.body.innerHTML = '';

    let pending = [];
    let insertion = document.body;
    dc.onmessage = ev => {
      pending.push(ev);
      if (pending.length === 1) {
        poke();
      }
    };
    dc.send(JSON.stringify({ stage: current, type: 'ready' }));

    function poke() {
      let ev = pending.shift();
      if (!ev) return;
      var request = JSON.parse(ev.data);
      assert(request.stage === current);
      if (request.type === 'done') {
        app();
        return dc.send(JSON.stringify({ stage: current, type: 'done' }));
      }
      if (request.type === 'pop') {
        insertion = insertion.parentElement;
        return poke();
      }
      if (request.type === '#text') {
        insertion.appendChild(document.createTextNode(request.textContent));
        return poke();
      }
      assert(request.type === 'element');
      if (request.tag === 'script') {
        if (!request.attrs.src && request.textContent) {
          request.attrs.src = toDataURI(request.textContent, "application/javascript");
        }
        assert(request.attrs.src);
        let element = document.createElement(request.tag);
        element.src = request.attrs.src;
        element.onload = poke;
        insertion.appendChild(element);
        insertion = element;
      } else {
        let element = document.createElement(request.tag);
        for (let [name, value] of Object.entries(request.attrs)) {
          element.setAttribute(name, value);
        }
        insertion.appendChild(element);
        insertion = element;
        poke();
      }
    }
  })();
} else if (role === 'host') {
  stage2 = async function stage2host(dc) {
    function isEphemeral(el) {
      return !!new Set(el.classList).intersection(isEphemeral.classes).size;
    }
    isEphemeral.classes = new Set(["ephemeral", "stage0", "stage1", "stage2", "host-only"]);
    const current = 'stage2';
    async function visit(el) {
      if (isEphemeral(el)) return;
      let tag = el.tagName.toLowerCase();
      let msg = { stage: current, type: 'element', tag };
      msg.attrs = Object.fromEntries(Array.from(el.attributes).map(attr=>[attr.name,attr.value]));
      dc.send(JSON.stringify(msg));
      visitChildrenOf(el);
      dc.send(JSON.stringify({ stage: current, type: 'pop' }));
    }
    async function visitChildrenOf(el) {
      for (let child of el.childNodes) {
        if (child.nodeName === '#text') {
          dc.send(JSON.stringify({ stage: current, type: '#text', textContent: child.textContent }));
        } else if (child instanceof Element) {
          visit(child);
        }
      }
    }
    await visitChildrenOf(document.body);
    dc.send(JSON.stringify({ stage: current, type: 'done' }));
    var ev = await Ve.once.message(dc);
    console.log('done', ev);
    app();
  };
} else {
  console.error('Neither host nor guest:', role);
}
