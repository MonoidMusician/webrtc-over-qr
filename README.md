Attempting to see if browsers can be tempted into bootstrapping a WebRTC text chat app over a `data:` QR code.

The answer appears to be … Yes!!

(… If you ignore the fact that one does not simply open a `data:` URI from a QR code: QR scanners do not recognize it as a “link”, and browsers wouldn't even open it from external sources, it must be pasted into the URL bar manually.)

Note: this can only really produce a text chat app, as access to camera and microphone is prohibited outside of secure contexts (which a `data:` URI certainly is not).

## Website Demo

See more information and a demo including instructions at [https://webrtc-over-qr.veritates.love/](webrtc-over-qr.veritates.love).

## Haxx & caveats n questions

Our goal is to automatically establish a connection from scanning a QR code.
The major pain point is that the host accepting the connection requires knowing the 32-byte fingerprint generated by the guest: how do we get it back to the host?

We want to smuggle in data (most notably the certificate fingerprint) over the automatic connection, and construct an appropriate answer on the host side without seeing a real complete answer SDP.

The connection *can* show up as an ICE candidate before the fingerprint and DTLS security layer is negotiated, but this only seems to happen in Chromium not Firefox or Safari.

- port shows up, but NAT could very well get in the way if not over LAN
- timestamps also show up, but yeah, maybe not the best source of info either...
- `usernameFragment` is great, let's use that
  - but it is not implemented in Firefox or Safari: https://caniuse.com/mdn-api_rtcstatsreport_type_remote-candidate_usernamefragment/

okay so we need to stick to hosting on Chromium for multiple reasons, at least for now.

```js
rtc.oniceconnectionstatechange = async (e) => {
  if (rtc.iceConnectionState === "checking") {
    console.log(
      [...(await rtc.getStats()).values()]
        .find(s => s.type === 'remote-candidate')
        .usernameFragment
    );
  }
}
```

making a HTML file that connects and starts running `eval()` on data channel messages is actually doable within the 2,953 bytes limit for QR codes!

would be cool to figure out some scheme to reuse the QR code.
right now it would have to be generated for each connection.
(maybe we could you use the original offer to immediately negotiate a new connection with everyone who joins, and then sort of restart the original offer?)

## Design

- QR code that contains the SDP Offer from the host, basic connection establishment, and enough to `eval()` the first message
- Bootstrap script (<16KiB) that takes control and streams the rest of the code and resources necessary
  - [16KiB](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#understanding_message_size_limits) is the limit for a single frame, interopable datachannel message

The runtime will need to be designed to make this replication possible

- Fixed runtime JS dependencies
- (Dynamic scripts? idk)
- CSS styles are easy enough to replicate
- the HTML body is harder:
  - Need to distinguish static structure vs dynamic content
  - Including like inline styles and class attributes and so on
- also, uh, changes from extensions and user scripts and such might become viral, lol
- the JavaScript will need to be very disciplined:
  - I'm thinking of only allowing global stateless functions, a central serializable state store, and then runtime API stuff like the RTC connection itself (which needs to be handed off) and other stuff like, uh, idk (global timers, sound/notification APIs, etc.), listeners, ...
