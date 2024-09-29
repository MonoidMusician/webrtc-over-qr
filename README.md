Attempting to see if browsers can be tempted into bootstrapping a WebRTC chat app over a `data:` QR code.

## Run

- `npm install` (if you haven't before)
- start the server with `node signaling.js`
- `http://localhost:5167/guest.html` and then `http://localhost:5167/host.html` (order matters! since this is janky demo code)

## Haxx

- port shows up, but NAT could very well get in the way if not over LAN
- timestamps also show up, but yeah, maybe not the best either...
- usernameFragment is great
  - but not implemented in Firefox or Safari: https://caniuse.com/mdn-api_rtcstatsreport_type_remote-candidate_usernamefragment /

## Links/resources

- [WebRTC: ICE failed on small timeout for answer transmission (5s)](https://bugzilla.mozilla.org/show_bug.cgi?id=1647289)
  - `media.peerconnection.ice.trickle_grace_period` in `about:config` (default: 5000(ms))


