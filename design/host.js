const AGREED_UPON_PASSWORD = 'this-is-not-a-password+' + String(Math.random()).substring(2);

role = 'host';

// Start creating a peer connection
rtc = new RTCPeerConnection();

// As the host, we create a data channel immediately, so it is in the offer
dc = rtc.createDataChannel('test', { reliable: true });
dc.onopen = ev => {
  stage1(dc);
};
dc.onmessage = ev => {
  console.log(ev);
};
// printEvents("host rtc", rtc);
// printEvents("host dc", dc);

// Create an offer
offer = undefined;
rtc.createOffer().then(async desc => {
  // We need to set it locally
  rtc.setLocalDescription(desc);
  // Bypass trickle ICE
  await new Promise(resolve => {
    rtc.onicegatheringstatechange = _ =>
      rtc.iceGatheringState === 'complete' && resolve();
  });
  // The SDP is now updated with ICE candidates
  offer = rtc.localDescription.sdp;
  sendOffer(offer, AGREED_UPON_PASSWORD);
}, (err) => {console.error(err)});

// On Chromium we can see the remote connection that is trying our
// Offer SDP before we have the right Answer SDP and, most importantly,
// before we have the fingerprint for its certificate to trust it
rtc.oniceconnectionstatechange = async (e) => {
  if (rtc.iceConnectionState === "checking" && !rtc.remoteDescription) {
    const stats = [...(await rtc.getStats()).values()];
    const remote = stats.find(s => s.type === 'remote-candidate');
    await setUFrag(remote.usernameFragment);
  }
};

if (document.getElementById("compose")) {
  const compose = document.getElementById("compose");
  const fn0 = async ev => {
    if (ev.key === 'Enter') {
      if (compose.value.trim()) {
        await setUFrag(compose.value);
        compose.value = "";
        compose.removeEventListener("keyup", fn0);
        compose.removeEventListener("input", fn1);
      }
    }
  };
  const fn1 = async ev => {
    if (compose.value.match(/[A-Za-z0-9+\/]{43}=/)) {
      await setUFrag(compose.value);
      compose.value = "";
      compose.removeEventListener("keyup", fn0);
      compose.removeEventListener("input", fn1);
    }
  };
  compose.addEventListener("keyup", fn0);
  compose.addEventListener("input", fn1);
}
function setUFrag(ufrag) {
  return rtc.setRemoteDescription({ type: 'answer', sdp: fromUFrag(ufrag) });
}
function fromUFrag(usernameFragment) {
  var fingerprint = Array.from(
    atob(usernameFragment),
    x => x.codePointAt(0).toString(16).padStart(2,"0")
  ).join(":").toUpperCase();
  // Most of this Answer SDP is just formality
  // e.g. the `c=` line is literally ignored but must be present
  // I believe the ice-{ufrag,pwd} is enough to identify which remote
  // we are talking about, given that it has attempted to connect
  // already (that is how we got here after all)
  return Ve.dedent`
    v=0
    o=- 1 2 IN IP4 127.0.0.1
    s=-
    t=0 0
    a=group:BUNDLE 0
    a=extmap-allow-mixed
    a=msid-semantic: WMS
    m=application 9 UDP/DTLS/SCTP webrtc-datachannel
    c=IN IP4 0.0.0.0
    a=ice-ufrag:${usernameFragment}
    a=ice-pwd:${AGREED_UPON_PASSWORD}
    a=ice-options:trickle
    a=fingerprint:sha-256 ${fingerprint}
    a=setup:active
    a=mid:0
    a=sctp-port:5000
    a=max-message-size:262144

  `
}
