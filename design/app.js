function app() {
  var { HTML } = Ve;
  var { compose, chat_content, chat_spacer, file_upload } = Ve.ById;
  compose.placeholder = "Write a message to your bestie! or /commands";
  var cmdpre = '/'; // prefix for commands

  var scrollManager = makeScrollManagerFor(chat_content, chat_spacer);

  compose.on.keyup(function(ev) {
    if (ev.key === 'Enter' && compose.value) {
      var value = compose.value;
      if (value.startsWith(cmdpre+cmdpre)) {
        value = value.substring(1);
      } else if (value.trimStart().startsWith(cmdpre)) {
        value = value.trimStart();
        var command = undefined;
        var match = '';
        for (let key in commands) {
          for (let cmd of [key, ...(commands[key]?.aliases || [])]) {
            if (1+cmd.length > match.length && value.startsWith(cmdpre + cmd)) {
              match = cmdpre+cmd;
              command = commands[key];
            }
          }
        }
        if (!command) {
          console.error(`Unknown command (use ${cmdpre+cmdpre} or ${cmdpre}escape if you did not mean a command)`, value);
          return;
        }
        command(value.substring(match.length).trim(), value);
        compose.value = '';
        return;
      }
      sendMessage(value);
      compose.value = '';
    }
  });

  defragmentDC(dc, (str, ev) => {
    var data = JSON.parse(str);
    if (data.type in handlers) {
      handlers[data.type](data);
    } else {
      console.warn('Unknown message type', data?.type || data, typeof data);
    }
  });

  var pingModule = (function() {
    const flipping = frame => ({ ping: frame.pong, pong: frame.ping });
    const avgping = frames => {
      let ping = 0;
      let pong = 0;
      for (let frame of frames) {ping+=frame.ping;pong+=frame.pong}
      ping /= frames.length;
      pong /= frames.length;
      return ({ ping, pong });
    }
    function sendPing(type, data) {
      fragmentDC(dc, JSON.stringify({ ...data, type }));
    }
    function ping(count) {
      count = Number(count)||1;
      var timestamp = performance.now();
      sendPing('SYN', { count, ping: timestamp });
    }
    ping.help = 'Test ping latency (RTT)';
    function SYN(data) {
      var timestamp = performance.now();
      sendPing('SYNACK', { ...data, pong: timestamp });
    }
    function SYNACK(data) {
      var timestamp = performance.now();
      var delta = timestamp - data.ping;
      sendPing('ACK', { ...data, ping: delta });
    }
    function ACK(data) {
      var timestamp = performance.now();
      var delta = timestamp - data.pong;
      data.pong = delta;
      if (!data.measurements) {
        data.measurements = [];
      } else {
        data.measurements = data.measurements.map(flipping);
      }
      data.measurements.push({ ping: data.ping, pong: data.pong });
      if (data.measurements.length >= data.count) {
        sendPing('pong', { ...data });
        pong({ ...data, measurements: data.measurements.map(flipping) });
      } else {
        sendPing('SYN', { ...data, ping: timestamp, pong: undefined });
      }
    }
    function pong(data) {
      const measured = avgping(data.measurements);
      addStatus([
        `our ping: ${measured.ping.toFixed(1)}ms`, ", ",
        `their ping: ${measured.pong.toFixed(1)}ms`, " ",
        "(", HTML.a({href:"https://en.wikipedia.org/wiki/Round-trip_time"}, "RTT"), ")",
      ]);
    }
    return {
      handlers: { SYN, SYNACK, ACK, pong },
      commands: { ping },
    };
  })();

  var shared = {};
  var handlers = {
    message: receiveMessage,
    shared: updateShared,
    ...pingModule.handlers,
  };
  var messageTypes = {
    'text': ({ content }) => content,
    'code': ({ content }) => HTML.pre(HTML.code(content)),
    'italic': ({ content }) => HTML.i(content),
    'bold': ({ content }) => HTML.b(content),
    'bolditalic': ({ content }) => HTML.b(HTML.i(content)),
    'quote': ({ content }) => HTML.blockquote(content),
    'strikethrough': ({ content }) => HTML.s(content),
    'media/image': data => HTML.img({ src: data.src }),
    'media/video': data => HTML.video({ src: data.src, controls: true }),
    'media/audio': data => HTML.audio({ src: data.src, controls: true }),
    'download': ({ src, name, mime }) => [
      HTML.a({ href: src, download: name }, name),
      ' ', HTML.span.mime(['[', mime, ']']),
    ],
    'text/*': (data, props) => {
      let { text, mime, type, subtype } = Ve.fromDataURI(data.src);
      text = text.replaceAll('\r\n','\n').replaceAll('\r','\n').trim(); // idk
      props.data = { mime, type, subtype };
      return [
        HTML.p(messageTypes['download'](data)),
        HTML.pre(text),
      ];
    },
    'color': ({ color }) => {
      const size = "4em";
      return HTML.div({ style: { borderRadius: 'inherit', backgroundColor: color, width: size, height: size }});
    },
    'link': ({ href, content }) => {
      return HTML.a({ href }, String(content || href));
    },
    'media/font': ({ id, src, name }, props) => {
      props.classes = ['shared-message'];
      const style = {
        font: 'inherit',
        fontFamily: CSS.escape(name), // order matters!
      };
      return [
        HTML.style(Ve.dedent`
          @font-face {
            font-family: ${CSS.escape(name)};
            src: url(${src});
            font-weight: normal;
            font-style: normal;
          }
        `),
        ...sharedTextareas({ id, props: { style }, placeholders:
          [`Try out ${name}!`]
        }),
      ];
    },
    'shared': ({ id }, props) => {
      props.classes = ['shared-message'];
      return sharedTextareas({ id, props: { style: { font: 'inherit' }}});
    },
  };
  var shrug = String.raw`¯\_(ツ)_/¯`;
  var commands = {
    'commands': ['List commands', (substring, original) => {
      const substrings = substring.trim().split(/\s+/u);
      let listing = Object.keys(commands);
      if (substrings) {
        filtered = listing.filter(cmd =>
          substrings.some(s =>
            (cmdpre+cmd).includes(s)
              || commands[cmd]?.help?.includes(s)
              || commands[cmd]?.aliases?.some(alias => (cmdpre+alias).includes(s))
          )
        );
        if (filtered.length) listing = filtered;
        else if (!original.startsWith(cmdpre+' ')) {
          return console.error(`Unknown command (use ${cmdpre+cmdpre} or ${cmdpre}escape if you did not mean a command)`, original);
        }
      }
      let onclick = (key, cmd) => ({
        onclick() {
          compose.value = cmdpre + cmd + (commands[key||cmd].length && cmd !== cmdpre ? ' ' : '');
          compose.focus();
        },
        ondblclick() {
          commands[key]('', cmdpre+cmd);
          compose.value = '';
        },
      });
      let list = key => cmd =>
        HTML.dt({ style: Ve.styl.inline },
          HTML.a({ style: Ve.styl.pointer, ...onclick(key, cmd) },
            HTML.code(cmdpre + cmd, ' ')
          )
        );
      let listed = listing.map(cmd => {
        return [
          list(cmd)(cmd),
          ...(commands[cmd].aliases||[]).map(list(cmd)).reverse(),
          HTML.dd(commands[cmd].help),
        ];
      });
      addOutput(HTML.dl(listed));
    }, { aliases: [''] }],
    'prefix': ['Set prefix for commands (defaults to "/")', (prefix) => {
      if (!prefix) {
        return addStatus(`Current prefix: ${JSON.stringify(cmdpre)}`);
      }
      compose.placeholder = compose.placeholder.replace(cmdpre+'commands', prefix+'commands');
      addStatus(`Prefix changed from ${JSON.stringify(cmdpre)} to ${JSON.stringify(prefix)}`);
      cmdpre = prefix;
    }],
    'upload': ['Upload a file (image, video, audio, even a font!)', () => { Ve.ById.file_upload.click() }],
    'shrug': ['Just a shrug emoticon ' + shrug, (_,original) => sendMessage(original.replaceAll('/shrug', shrug))],
    'hue': [
      ['Set the chat hue (0–360, currently ', Ve.StringOnDemand(() => Ve.CSS.var.hue), ')'],
      hue => hue ? (Ve.CSS.var.hue = hue) : addOutput(['Current hue: ', Ve.CSS.var.hue])
    ],
    'color': ['Send a color! (CSS colors)', color => color && sendMessage.color({ color })],
    'code': ['Send code formatting', content => content && sendMessage.code(content)],
    'italic': ['Send italic formatting', content => content && sendMessage.italic(content), { aliases: ['i'] }],
    'bold': ['Send bold formatting', content => content && sendMessage.bold(content), { aliases: ['b'] }],
    'bolditalic': ['Send bold italic formatting', content => content && sendMessage.bolditalic(content), { aliases: ['bi'] }],
    'quote': ['Send quote formatting', content => content && sendMessage.bolditalic(content), { aliases: ['q', 'blockquote'] }],
    'strikethrough': ['Send strikethrough formatting', content => content && sendMessage.strikethrough(content), { aliases: ['s', 'strike'] }],
    'escape': [
      Ve.StringOnDemand(() => `Escape a message (which might start with ${JSON.stringify(cmdpre)})`),
      (_,original) => sendMessage(original.replace(cmdpre+'escape ','')),
      { get aliases() {return [cmdpre]} },
    ],
    'link': ['Send a link', href => href && sendMessage.link({ href }), { aliases: ['url', 'href'] }],
    'shared': ['Create a pair of shared scratchpads', () => sendMessage.shared({ id: newID() }), { aliases: ['scratch', 'textarea'] }],
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
    'canvas': ['canvas', liveCanvas],
    ...pingModule.commands,
  };
  Object.entries(commands).forEach(([k,v]) => {
    if (v instanceof Array) {
      let [help,fn,vs] = v;
      commands[k] = fn;
      fn.help = help;
      if (vs) Object.defineProperties(fn, Object.getOwnPropertyDescriptors(vs));
    }
  });

  function sendMessage(...messages) {
    messages = messages.filter(Boolean).map(data => {
      if (typeof data !== 'object')
        data = { messageType: 'text', id: newID(), content: data };
      return data;
    });
    scrollManager.adding(() => {
      return messages.map(data => addMessage(...renderMessage(data), 'echo'));
    });
    for (let data of messages) {
      fragmentDC(dc, JSON.stringify({ type: 'message', ...data }));
    }
  }
  sendMessage = new Proxy(sendMessage, {
    get: (sendMessage, messageType, thisArg) => data =>
      sendMessage.call(thisArg, {
        messageType, id: newID(),
        ...(typeof data === 'object' ? data : { content: data })
      }),
    apply: (sendMessage, thisArg, args) => sendMessage.call(thisArg, ...args),
  });
  function receiveMessage(data) {
    scrollManager.adding.see_top(() => {
      return addMessage(...renderMessage(data), 'peer');
    });
  }
  function renderMessage(data) {
    assert(typeof data.messageType === 'string');
    const classes = data.messageType.split('/').filter(cls=>cls!='*');
    const props = { dataset: { id: data.id } };
    if (!(data.messageType in messageTypes)) console.error(data);
    return [messageTypes[data.messageType](data, props), props, ...(props.classes||[]), ...classes];
  }
  function addMessage(content, props, ...classes) {
    return chat_content.appendChild(HTML.div({ ...props, classList: ['message', ...classes] }, content));
  }
  function addStatus(content, props, ...classes) {
    scrollManager.adding.see_top(() => {
      return addMessage(content, props, 'status');
    });
  }
  function addOutput(content, props, ...classes) {
    scrollManager.adding.see_top(() => {
      return addMessage(content, props, 'echo', 'command', ...classes);
    });
  }

  function updateShared(data) {
    return shared[data.id](data);
  }

  Ve.forQuery('#role_description', function(el) {
    el.textContent = "(p2p "+role+")";
  });
  Ve.ById.loading.removeSelf();
  addStatus('Peer connected');
  setTimeout(() => {
    sendMessage(role);
    setTimeout(() => {
      if (role === 'guest' && 'ping' in commands) commands['ping'](25);
    }, 500);
  }, 100);

  file_upload.on.change(async () => {
    const fileSrcs = await Promise.all(Array.from(file_upload.files).map(async f => [f, await readFile(f)]));
    file_upload.value = ''; // clear it
    const messages = fileSrcs.map(([file, src]) => {
      const mime = file.type;
      const category = mime.split('/')[0];
      let messageType = 'media/'+category;
      if (mime in messageTypes) {
        messageType = mime;
      } else if (category+'/*' in messageTypes) {
        messageType = category+'/*';
      } else if (!(messageType in messageTypes)) {
        messageType = 'download';
      } else if (kStandardTypes[category] && !kStandardTypes[category].includes(mime)) {
        messageType = 'download';
      }
      return { messageType, src, name: file.name, mime, id: newID() };
    });
    sendMessage(...messages);
  });

  function sharedTextareas({ id, props, placeholders }) {
    const theirs = HTML.textarea({
      ...props,
      class: 'shared-item theirs',
      readOnly: true,
      tabIndex: -1,
      onfocus: (ev) => {
        ev.preventDefault(); ours.focus();
      },
      placeholder: placeholders?.[1] ?? '(Peer)',
    });
    shared[id] = ({ value }) => { theirs.value = value };
    const ours = HTML.textarea({
      ...props,
      class: 'shared-item ours',
      placeholder: placeholders?.[0] ?? `Try it out!`,
      oninput: () => {
        // TODO: flow control
        fragmentDC(dc, JSON.stringify({ type: 'shared', id, value: ours.value }));
      },
    });
    return Object.assign([
      theirs,
      HTML.div({class:'shared-sep'}),
      ours,
    ], { ours, theirs });
  }

  function liveCanvas() {
    var id = newID();
    var canvas = HTML.canvas({width:500,height:500});
    function record(...args) {
      fragmentDC(dc, JSON.stringify({ type: 'shared', id, args }));
    }
    /** @type CanvasRenderingContext2D */
    var ctx = new Proxy(canvas.getContext('2d'), {
      get(tgt, name) {
        const value = Reflect.get(tgt, name);
        if (typeof value !== 'function' || name.startsWith('is') || name.startsWith('get')) return value;
        return (...args) => {
          record('call', name, ...args);
          return tgt[name](...args);
        };
      },
      set(tgt, name, value) {
        Reflect.set(tgt, name, value);
        record('set', name, value);
        return true;
      },
    });
    scrollManager.adding(() => {
      return addMessage(canvas, {}, 'echo');
    });
    fragmentDC(dc, JSON.stringify({ type: 'message', messageType: 'canvas', id, width: canvas.width, height: canvas.height }));
    window.ctx = ctx;
    function coords(/** @type MouseEvent */ ev) {
      var bb = canvas.getBoundingClientRect();
      var ret = [
        coord(ev.clientX, ctx.canvas.width, bb.left, bb.width),
        coord(ev.clientY, ctx.canvas.height, bb.top, bb.height),
      ];
      return ret;
    }
    function coord(current, range, min, diff) {
      return range*(current - min)/diff;
    }
    canvas.on.mousedown((ev) => {
      ctx.beginPath();
      ctx.moveTo(...coords(ev));
      ev.preventDefault();
    });
    canvas.on.mousemove((ev) => {
      console.log(ev.buttons);
      if (!ev.buttons) return;
      ctx.lineTo(...coords(ev));
      ctx.stroke();
    });
    return canvas;
  };
  liveCanvas.guest = function({ id, width, height }) {
    var canvas = HTML.canvas({width,height});
    var ctx = canvas.getContext('2d');
    shared[id] = ({ args }) => {
      if (args[0] === 'call') {
        ctx[args[1]](...args.slice(2));
      } else if (args[0] === 'set') {
        ctx[args[1]] = args[2];
      }
    };
    return canvas;
  };
  messageTypes.canvas = liveCanvas.guest;
}
