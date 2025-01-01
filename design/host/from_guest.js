"use strict";
var host_from_guest = {
  normHex(hex) {
    const r = [];
    let acc = "";
    for (let c of hex) {
      if (/[a-fA-F0-9]/.test(c)) {
        acc += c;
        if (acc.length === 2) {
          r.push(acc.toUpperCase()); acc = "";
        }
      }
    }
    return r.join(":");
  },

  fromUFrag(usernameFragment, AGREED_UPON_PASSWORD) {
    var fingerprint =
      RE_FINGERPRINT.test(usernameFragment)
        ? usernameFragment
        : atob(usernameFragment);
    fingerprint = host_from_guest.normHex(fingerprint);
    assert(RE_FINGERPRINT.test(fingerprint));
    // Most of this Answer SDP is just formality
    // e.g. the `c=` line is literally ignored but must be present
    // I believe the ice-{ufrag,pwd} is enough to identify which remote
    // we are talking about, given that it has attempted to connect
    // already (that is how we got here after all)
    const sdp = Ve.dedent`
      v=0
      o=- 1 2 IN IP4 127.0.0.1
      s=-
      t=0 0
      a=group:BUNDLE 0
      a=extmap-allow-mixed
      a=msid-semantic: WMS
      m=application 9 UDP/DTLS/SCTP webrtc-datachannel
      c=IN IP4 0.0.0.0
      a=ice-ufrag:${fingerprint.replaceAll(':','')}
      a=ice-pwd:${AGREED_UPON_PASSWORD}
      a=ice-options:trickle
      a=fingerprint:sha-256 ${fingerprint}
      a=setup:active
      a=mid:0
      a=sctp-port:5000
      a=max-message-size:262144

    `;
    host_ui.logStatus('Trying fingerprint ' + fingerprint, Ve.HTML.pre(sdp));
    return sdp;
  },
};
