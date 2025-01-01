"use strict";
function host_ui({ rtc, dc }) {
  host_ui.cleanup();
  const cleanup = host_ui.cleanup;

  if (Ve.ById.compose) {
    const compose = Ve.ById.compose;
    const localCleanup = mkCleanup();
    cleanup(localCleanup);
    localCleanup(
      compose.on.keyup(async ev => {
        if (rtc.signalingState === 'stable') return localCleanup();
        if (ev.key === 'Enter') {
          const value = compose.value.replaceAll('\u2588', '').trim();
          if (/\w+/.exec(value)[0] === 'upload') {
            compose.value = "";
            Ve.ById.file_upload.click();
          } else if (value) {
            await host.setUFrag(value);
            compose.value = "";
          }
        }
      }),
      compose.on.input(async ev => {
        if (rtc.signalingState === 'stable') return localCleanup();
        const value = compose.value.replaceAll('\u2588', '').trim();
        if (value.match(RE_FINGERPRINT)) {
          await host.setUFrag(value);
          compose.value = "";
        }
      }),
    );
  }

  window.ZXing && cleanup(listenForUploads(async files => {
    const reader = new window.ZXing.BrowserQRCodeReader();
    for (const [file, src] of files) {
      try {
        console.log(file);
        if (!file.type.startsWith('image/')) continue;
        const result = await reader.decodeFromImageUrl(src);
        if (!result) continue;
        console.log(result);
        assert(result.format === 11);
        assert(result.numBits === 272);
        assert(result.rawBytes[0] === 0x42);
        const fingerprint = Array.from(result.rawBytes, b=>b.toString(16).padStart(2,0)).join('').slice(3, -1);
        assert(RE_FINGERPRINT.test(fingerprint));
        host.setUFrag(fingerprint);
      } catch(err) {
        host_ui.logError(err);
      }
    }
  }));

  return cleanup;
}
Object.assign(host_ui, {
  cleanup: mkCleanup(),
  logMessage(classes, summary, content) {
    const { HTML } = Ve;

    summary = [summary, ' ', Ve.applyProps(showTime(), {style:{float:'right'}})];
    const element = HTML.div({ classList: classes }, [
      content ? HTML.details(HTML.summary(summary), content) : summary,
    ]);
    Ve.ById.chat_content.appendChild(element);
    host_ui.cleanup(() => element.removeSelf());
  },
  logStatus(summary, content) {
    host_ui.logMessage(['message', 'ephemeral', 'echo', 'full-width'], summary, content);
  },
  logEvent(summary, content) {
    host_ui.logMessage(['message', 'ephemeral', 'event'], summary, content);
  },
  logError(e) {
    const { HTML } = Ve;

    let summary = String(e);
    let content = renderJSON(e);
    if (e instanceof window.ZXing?.Exception) {
      summary = ['ZXing: ', e.getKind(), ': ', e.message];
    }
    if (e instanceof Error) {
      // summary = e.message;
      content = [content, HTML.pre(e.stack)];
    }
    host_ui.logMessage(['message', 'ephemeral', 'echo', 'full-width'], summary, content);
    console.error(e);
  },
  throwError(e) {
    host_ui.logError(e);
    throw e;
  },
  logRemoteError(e) {
    const { HTML } = Ve;

    let summary = String(e);
    let content = renderJSON(e);
    if (e instanceof Error) {
      // summary = e.message;
      content = [content, HTML.pre(e.stack)];
    }
    host_ui.logMessage(['message', 'ephemeral', 'peer', 'full-width'], summary, content);
    console.error(e);
  },


  async scanQR(cb) {
    if (!window.ZXing?.BrowserQRCodeReader) return;
    if (!window.isSecureContext) return;

    if (!cb) cb = fingerprint => host.setUFrag(fingerprint);

    // decode every second
    const codeReader = new window.ZXing.BrowserQRCodeReader(undefined, 1000);

    const div = Ve.ById.from_guest.appendChild(Ve.HTML.div());
    let video;
    function newVideo() {
      video = div.appendChild(
        Ve.HTML.video({ width: 300, height: 200, style: {...Ve.styl.marginAuto, display:'block'}})
      );
    }

    const videoInputDevices = await codeReader.getVideoInputDevices();
    const noDevice = '[Not Scanning]';
    let selectedDeviceId = noDevice;//videoInputDevices[0].deviceId;
    function restart() {
      codeReader.reset();
      if (selectedDeviceId === noDevice) {
        if (video) { video.removeSelf(); video = undefined; }
        return;
      }
      if (!video) newVideo();
      // console.log(video, video.parentElement, video.getRootNode(), [...videoParent.children]);
      // console.log(selectedDeviceId);
      // .getSettings().facingMode
      codeReader.decodeFromInputVideoDeviceContinuously(selectedDeviceId, video, (result, err) => {
        if (!video || !video.parentElement || video.getRootNode() !== document) {
          console.log("Video removed, stopping QR scanning", err?.constructor.kind);
          codeReader.reset();
          select.value = selectedDeviceId = noDevice;
          // console.log(video, video && { parentElement: video.parentElement, rootNode: video.getRootNode() });
        }
        if (!result) return;
        console.log(result);
        assert(result.format === 11);
        assert(result.numBits === 272);
        assert(result.rawBytes[0] === 0x42);
        const fingerprint = Array.from(result.rawBytes, b=>b.toString(16).padStart(2,0)).join('').slice(3, -1);
        assert(RE_FINGERPRINT.test(fingerprint));
        cb(fingerprint);
        codeReader.reset();
      });
      console.log("Starting QR scanning with device ID", selectedDeviceId);
    }
    const select = Ve.HTML.select(
      {
        style: { ...Ve.styl.marginAuto, display: 'block' },
        onchange: e => {
          if (e.target.value === noDevice) {
            selectedDeviceId = noDevice;
          } else {
            selectedDeviceId = videoInputDevices[e.target.value]
              ? videoInputDevices[e.target.value].deviceId : e.target.value;
          }
          restart();
        },
      },
      Ve.HTML.option({ text: '[Not Scanning]', value: noDevice }),
      videoInputDevices.map((dev, idx) =>
        Ve.HTML.option({ text: dev.label, value: dev.deviceId || idx })
      ),
    );
    div.appendChild(select);
    restart();
    host_ui.cleanup(div, () => {selectedDeviceId = noDevice; restart()});
    return div;
  },
});
