"use strict";
function host() {
  // attempt to be reentrant (pretty good so far)
  if (host.cleanup) host.cleanup();

  // cleanup we run both on finishing successfully and being cancelled from the outside
  const cleanup = mkCleanup();
  // only when we are cancelled from the outside (including restarting),
  // then do we close rtc and dc
  host.cleanup = () => {
    cleanup();
    rtc.close();
    dc.close();
  };

  const AGREED_UPON_PASSWORD = 'this-is-not-a-password+' + String(Math.random()).substring(2);

  let options;
  let stun = Ve.Params.all.search.stun;
  if (stun && stun.length) {
    options = {
      iceServers: [{ urls: stun }],
    };
  }

  // Start creating a peer connection
  var rtc = new RTCPeerConnection(options);

  // As the host, we create a data channel immediately, so it is in the offer
  var dc = rtc.createDataChannel('test', { reliable: true });
  dc.onopen = async ev => {
    Ve.ById.to_guest?.removeSelf();
    Ve.ById.from_guest?.removeSelf();
    cleanup();
    await Promise.resolve();
    stage1({ rtc, dc });
  };
  // Some debugging, gets removed when the connection is established
  cleanup(printEvents(null, rtc, (event, diff, eventJSON) => {
    host_ui.logEvent("rtc." + event.type, [renderJSON(eventJSON), renderJSON(diff)]);
  }));
  cleanup(printEvents(null, dc, (event, diff, eventJSON) => {
    if (!['open','close','error'].includes(event.type)) return;
    host_ui.logEvent("dc." + event.type, [renderJSON(eventJSON), renderJSON(diff)]);
  }));
  rtc.onerror = host_ui.logError;
  dc.onerror = host_ui.logError;

  // Create an offer
  var offer = undefined;
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
    (window.sendOffer || host_to_guest.sendOffer)(offer, AGREED_UPON_PASSWORD);
  }, (err) => {host_ui.logError(err)});

  // On Chromium we can see the remote connection that is trying our
  // Offer SDP before we have the right Answer SDP and, most importantly,
  // before we have the fingerprint for its certificate to trust it
  rtc.oniceconnectionstatechange = async (e) => {
    host_ui.logStatus("ICE connection state: " + rtc.iceConnectionState);
    if (rtc.iceConnectionState === "checking" && !rtc.remoteDescription) {
      const stats = [...(await rtc.getStats()).values()];
      const remote = stats.find(s => s.type === 'remote-candidate');
      await setUFrag(remote.usernameFragment);
    }
  };

  function setUFrag(ufrag) {
    return rtc.setRemoteDescription({ type: 'answer', sdp: host_from_guest.fromUFrag(ufrag, AGREED_UPON_PASSWORD) });
  }
  host.setUFrag = setUFrag;

  cleanup(host_ui({ rtc, dc }));
}

if (window.role === 'host') {
  Ve.ContentLoad(() => host());
}
