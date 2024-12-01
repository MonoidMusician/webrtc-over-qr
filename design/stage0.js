offer = $OFFER;
document.body.textContent = offer;
window.role = 'guest';

function HACK(sdp) {
  return sdp
    .replace(/(a=ice-ufrag):[^\n]+/u, '$1:'+btoa(/^a=fingerprint:sha-256 (.+)$/m.exec(sdp)[1]))
    .replace(/(a=ice-pwd):[^\n]+/u, '$1:'+$PASSWORD);
}

// Start creating a peer connection
window.rtc = new RTCPeerConnection();
window.dc = undefined;
// It will not create a data channel, but just listen for the peer to
// create one. (Obviously we are not expecting more than one.)
rtc.ondatachannel = function (e) {
  var datachannel = e.channel || e;
  dc = datachannel;
  dc.onopen = function (e) {};
  dc.onmessage = function (e) {
    try {
      eval(e.data);
    } catch(err) {
      document.body.innerHTML += "\n" + err.toString() + "\n" + e.data;
    }
  };
  dc.onerror = function (e) {
    document.body.innerHTML += "\n" + JSON.stringify(e);
  };
};

rtc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer }));

// Create an answer
rtc.createAnswer().then(async desc => {
  r = HACK(desc.sdp);
  rtc.setLocalDescription({type: 'answer', sdp: r});
  // Bypass trickle ICE
  await new Promise(resolve => {
    rtc.onicegatheringstatechange = _ =>
      rtc.iceGatheringState === 'complete' && resolve();
  });
}, (err) => {console.error(err);});
