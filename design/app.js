function app() {
  var { compose, chat_content, chat_spacer, file_upload } = Ve.ById;
  compose.placeholder = "Write a message to your bestie! or /commands";

  var scrollManager = makeScrollManagerFor(chat_content, chat_spacer);

  Ve.on.keyup(compose, function(ev) {
    if (ev.key === 'Enter' && compose.value) {
      var value = compose.value;
      if (value.startsWith('//')) {
        value = value.substring(1);
      } else if (value.startsWith('/')) {
        var command = undefined;
        var match = '';
        for (let key in commands) {
          for (let cmd of [key, ...(commands[key]?.aliases || [])]) {
            if (1+cmd.length > match.length && value.startsWith('/' + cmd)) {
              match = '/'+cmd;
              command = commands[key];
            }
          }
        }
        if (!command) {
          console.error("Unknown command (use double slash or /escape if you did not mean a command)", value);
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
      addStatus(`ours: ${measured.ping.toFixed(1)}ms, theirs: ${measured.pong.toFixed(1)}ms`);
    }
    return {
      handlers: { SYN, SYNACK, ACK, pong },
      commands: { ping },
    };
  })();

  var handlers = {
    message: receiveMessage,
    ...pingModule.handlers,
  };
  var messageTypes = {
    'text': ({ content }) => content,
    'code': ({ content }) => Ve.HTML.pre(Ve.HTML.code(content)),
    'media/image': data => Ve.HTML.img({ src: data.src }),
    'media/video': data => Ve.HTML.video({ src: data.src, controls: true }),
    'media/audio': data => Ve.HTML.audio({ src: data.src, controls: true }),
    'download': ({ src, name, mime }) => [
      Ve.HTML.a({ href: src, download: name }, name),
      ' ', Ve.HTML.span({className: 'mime'}, '[', mime, ']'),
    ],
    'text/*': (data, props) => {
      let { text, mime, type, subtype } = fromDataURI(data.src);
      text = text.replaceAll('\r\n','\n').replaceAll('\r','\n').trim(); // idk
      props.data = { mime, type, subtype };
      return [
        Ve.HTML.p({}, messageTypes['download'](data)),
        Ve.HTML.pre(text),
      ];
    },
    'color': ({ color }) => {
      const size = "4em";
      return Ve.HTML.div({ style: { borderRadius: 'inherit', backgroundColor: color, width: size, height: size }});
    },
  };
  var shrug = String.raw`¯\_(ツ)_/¯`;
  var commands = {
    'commands': ['list commands', (substring) => {
      substring = substring.trim();
      let listing = Object.keys(commands);
      console.log({ substring, listing });
      if (substring) listing = listing.filter(cmd => cmd.includes(substring));
      let listed = listing.map(cmd => {
        let onclick = () => {
          compose.value = '/' + cmd + (commands[cmd].length ? ' ' : '');
          compose.focus();
        };
        return [
          Ve.HTML.dt(Ve.HTML.a({ style: { cursor: 'pointer' }, onclick }, Ve.HTML.code('/' + cmd))),
          Ve.HTML.dd(commands[cmd].help),
        ];
      });
      addMessage(Ve.HTML.dl({}, listed), {}, 'echo');
    }, { aliases: [''] }],
    'upload': ['upload a file', () => { Ve.ById.file_upload.click() }],
    'shrug': ['shrug emoticon', (_,original) => sendMessage(original.replaceAll('/shrug', shrug))],
    'hue': ['set the chat hue (0–360)', hue => cssVars({ hue })],
    'color': ['send a color! (CSS colors)', color => sendMessage.color({ color })],
    'code': ['send code formatting', content => sendMessage.code(content)],
    'escape': [
      'escape a message (which might start with a slash – or you can use a double slash to escape a command)',
      (_,original) => sendMessage(original.replace('/escape ','')),
    ],
    ...pingModule.commands,
  };
  Object.entries(commands).forEach(([k,v]) => {
    if (v instanceof Array) {
      let [help,fn,vs] = v;
      commands[k] = Object.assign(fn, { help }, vs||{});
    }
  });

  function sendMessage(...messages) {
    messages = messages.filter(Boolean).map(data => {
      if (typeof data === 'string') data = { messageType: 'text', content: data };
      return data;
    })
    scrollManager.adding(() => {
      return messages.map(data => addMessage(...renderMessage(data), 'echo'));
    });
    for (let data of messages) {
      fragmentDC(dc, JSON.stringify({ type: 'message', ...data }));
    }
  }
  sendMessage = new Proxy(sendMessage, {
    get: (sendMessage, messageType, thisArg) => data =>
      sendMessage.call(thisArg, { messageType, ...(typeof data==='string'?{content:data}:data) }),
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
    const props = {};
    return [messageTypes[data.messageType](data, props), props, ...classes];
  }
  function addMessage(content, props, ...classes) {
    return chat_content.appendChild(Ve.HTML.div({ ...props, classList: ['message', ...classes] }, content));
  }
  function addStatus(content, props) {
    return addMessage(content, props, 'status');
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

  Ve.on.change(file_upload, async () => {
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
      return { messageType, src, name: file.name, mime };
    });
    sendMessage(...messages);
  });
}
