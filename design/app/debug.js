"use strict";
app.registerModule(function debugModule({ rtc, addOutput, addRemoteOutput, dc, addMessage, addStatus }) {
  const { HTML } = Ve;

  let debugging = false;

  return {
    commands: {
      'sdp': ['Show SDPs for the WebRTC connection', () => {
        let sdps = [
          [Ve.DOM`Local SDP (${role})`, rtc.localDescription],
          [Ve.DOM`Remote SDP`, rtc.remoteDescription],
        ];
        if (role !== 'host') sdps.reverse();
        function pretty(sdp) {
          return HTML.pre({
            style: {
              whiteSpace: "break-spaces",
              textIndent: "-2ch",
              paddingLeft: "2ch",
            },
          }, sdp.trim().split("\n").map(line=>HTML.p({style:{margin:0}}, line)));
        }
        sdps = sdps.map(([name, {sdp}]) => [
          HTML.details({ open: true },
            HTML.summary(HTML.dt({ style: Ve.styl.inline }, name)),
            HTML.dd(pretty(sdp))
          ),
        ]);
        addOutput(HTML.dl(sdps), {}, 'full-width');
      }],
      'safari': ['Fix scroll behavior on Safari', fixSafari],
      'debug': ['Turn debug mode on (allows remote /eval)', () => {
        addStatus('Debug mode on');
        window.rtcDebug = { rtc, dc };
        debugging = true;
      }],
      'nodebug': ['Turn debug mode off', () => {
        addStatus('Debug mode off');
        delete window.rtcDebug;
        debugging = false;
      }],
      'eval': ['Remote eval (JSON output)', (command) => {
        if (!command) return;
        addMessage(['Eval:', HTML.pre(command)]);
        fragmentDC(dc, JSON.stringify({ type: 'eval', command }));
      }],
    },
    handlers: {
      'eval': ({ command }) => {
        if (!command) return;
        addMessage(['Eval:', HTML.pre(command)]);
        let result;
        try {
          if (debugging) {
            result = (0, eval)(command);
          } else {
            result = new Error("Debugging is not enabled");
          }
        } catch(e) {
          result = e;
        }
        if (result instanceof Error) {
          host_ui.logError(result);
          fragmentDC(dc, JSON.stringify({ type: 'evaled', error: { ...result, message: result.message, stack: result.stack } }));
        } else {
          addOutput(renderJSON(result));
          fragmentDC(dc, JSON.stringify({ type: 'evaled', result }));
        }
      },
      'evaled': ({ result, error }) => {
        if (error) {
          host_ui.logRemoteError(Object.assign(new Error(error.message), error));
        } else {
          addRemoteOutput(renderJSON(result));
        }
      },
    },
  };
});
