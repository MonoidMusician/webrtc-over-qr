"use strict";
var host_to_guest = {
  trimOffer(offer) {
    offer = offer.replaceAll('\r\n','\n');
    offer = offer.replaceAll(/^a=candidate:\d+ \d+ TCP [^\n]+\n/gm, '');
    // Filter out link local IPv6, which is probably redundant from link local IPv4?
    // (And at least Firefox can generate a lot of these with media access permissions)
    // (https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
    offer = offer.replaceAll(/^a=candidate:\d+ \d+ UDP \d+ fe80:[^\n]+\n/gm, '');
    return offer;
  },
  getURIs(HTML) {
    return [
      toDataURI(HTML, 'text/html;charset=UTF-8'),
      'data:text/html;charset=UTF-8,'+encodeURI(HTML),
      'data:text/html;charset=UTF-8,'+encodeURIComponent(HTML),
    ];
  },
  chooseURI(URIs) {
    let URI = URIs[0];
    for (const u of URIs) if (u.length < URI.length) URI = u;
    return URI;
  },
  async offerToURI(offer, password, template) {
    offer = host_to_guest.trimOffer(offer);

    let options;
    let stun = Ve.Params.all.search.stun;
    if (stun && stun.length) {
      options = Ve.scripty`{iceServers:[{urls:${stun}}]}`;
    }

    if (!template) template = await window.getTemplate();
    const HTML = template
      .replace('$TEMPLATE_OPTIONS', options ? `(${options})` : ``)
      .replace('$TEMPLATE_OFFER', "`"+offer+"`")
      .replace('$TEMPLATE_PASSWORD', "`"+password+"`")
    const URIs = host_to_guest.getURIs(HTML);
    const URI = host_to_guest.chooseURI(URIs);

    console.log(
      { offer: offer.length, template: template.length, HTML: HTML.length },
      URIs.map(Ve._.length), { limit: 2953 }, URI.length < 2953
    );

    return { URIs, URI, HTML, offer, password };
  },

  URItoQR(URI) {
    if (window.ZXing) {
      const matrix = ZXing.QRCodeEncoder.encode(
        URI, ZXing.QRCodeDecoderErrorCorrectionLevel.L,
      ).getMatrix();
      const points = [];
      for (let i=0; i<matrix.getWidth(); i++) {
        for (let j=0; j<matrix.getHeight(); j++) {
          if (matrix.get(i,j)) points.push({x:i,y:j});
        }
      }
      return Ve.SVG.svg.qrcode({ attrs: { viewBox: `0 0 ${matrix.getWidth()} ${matrix.getHeight()}`} }, points.map(
        point => Ve.SVG.rect({ attrs: { ...point, width: 1, height: 1 } }),
      ));
    } else {
      return undefined;
    }
  },

  async sendOffer(offer, password, template) {
    const data = await host_to_guest.offerToURI(offer, password, template);
    const { URI, HTML } = data;

    host_ui.logStatus("Offer ready", Ve.HTML.pre(data.offer));

    if (Ve.Params.search['iframe'] === 'true')
      return host_to_guest.insertIFrame(HTML), data;
    if (Ve.Params.search['loopback'] === 'true')
      return host_to_guest.loopback(data), data;

    const label = o => `${Object.keys(o)[0]} (${new TextEncoder().encode(Object.values(o)[0]).length} bytes)`;

    Ve.ById.to_guest.appendChild(host_ui.cleanup(Ve.applyProps(tabgroup([
      { label: "QR", render: host_to_guest.URItoQR(URI), value: "QR" },
      { label: label({URI}), render: Ve.HTML.a({href:URI}, Ve.HTML.code(URI)), value: "URI" },
      { label: label({HTML}), render: Ve.HTML.pre(HTML), value: "HTML" },
      { label: "Side-by-side", render: [
        Ve.HTML.p("Embed the guest in an ", Ve.HTML.code('<iframe>'), " to view it side-by-side in the same window."),
        Ve.HTML.p(Ve.HTML.button({ onclick: (e) => {
          e.target.disabled = true;
          host_to_guest.insertIFrame(HTML);
        }}, "Open in iframe")),
        Ve.HTML.p("(The host will not automatically grab the fingerprint from the iframe, so you will have to manually copy it over.)"),
        Ve.HTML.p("Or, start it in echo/loopback mode, where each message is repeated back to itself."),
        Ve.HTML.p(Ve.HTML.button({ onclick: (e) => {
          e.target.disabled = true;
          host_to_guest.loopback(data);
        }}, "Start loopback mode")),
      ], value: "iframe" },
    ]), { classList: ['tabgroup', 'raised'] })));

    if (window.ZXing) {
      host_ui.scanQR();
    }

    Ve.ById.compose.placeholder = '00:00:01:10:…:0F:F0 or /upload';

    return data;
  },

  insertIFrame(HTML) {
    if (document.querySelector('iframe#hosted')) return;
    document.head.appendChild(Ve.HTML.style(Ve.dedent`

      html:not(:has(#hosted)) {
        &, body, #main {
          height: 100%;
          height: calc(min(100%, 100vh, 100svh));
          box-sizing: border-box;
        }
      }
      body:has(> #main + #hosted) {
        display: flex;
        > * {
          height: 100vh;
          height: calc(min(100vh, 100svh));
          flex: 50% 0 0;
          max-width: 50%; /* prevent overflow with non-breaking words */
          border: none;
          box-sizing: border-box;
        }
      }

    `));
    const styl = Ve.dedent`
      @media (prefers-color-scheme: dark) {
        :root {
          background: #111;
          color: #eee
        }
        body > pre {
          background: #eee;
          color: #111;
          padding-top: 5em !important;
          padding-bottom: 5em !important;
          width: fit-content;
        }
      }
    `.replaceAll(/\s+/g,'');
    const edited = HTML + '<style>'+styl+'</style>';
    const iframe = Ve.HTML.iframe({
      id: "hosted",
      class: "host-only",
      src: toDataURI(edited, "text/html;charset=UTF-8"),
      style: {background:'#eee'}
    });
    Ve.ById.main.parentElement.insertBefore(iframe, Ve.ById.main.nextElementSibling);
  },

  async loopback({ offer, password }) {
    const rtcL = new RTCPeerConnection();
    rtcL.setRemoteDescription({ type: 'offer', sdp: offer });
    let initialized = false;
    rtcL.ondatachannel = async ({ channel }) => {
      await Ve.once.message(channel);
      channel.send(JSON.stringify({ stage: 'stage1', type: 'ready' }));
      channel.onmessage = (e) => {
        if (initialized) {
          channel.send(e.data);
          return;
        }
        const data = JSON.parse(e.data);
        if (data.type === 'done') {
          channel.send(JSON.stringify({ ...data }));
          if (data.stage === 'stage1') {
            channel.send(JSON.stringify({ stage: 'stage2', type: 'ready' }));
          } else if (data.stage === 'stage2') {
            initialized = true;
          }
        }
      };
    };
    const { sdp } = await rtcL.createAnswer();
    const fingerprint = /fingerprint:sha-256 (.+)/.exec(sdp)[1];
    const answer = sdp
      .replace(/(a=ice-ufrag):.+/, '$1:'+fingerprint.replaceAll(':',''))
      .replace(/(a=ice-pwd):.+/, '$1:'+password);
    rtcL.setLocalDescription({ type: 'answer', sdp: answer });
    host.setUFrag(fingerprint);
  },
};
