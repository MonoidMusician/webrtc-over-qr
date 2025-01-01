"use strict";
var cmdpre = '/'; // prefix for commands
function app({ rtc, dc }) {
  var { HTML } = Ve;
  var { compose, chat_content, chat_spacer } = Ve.ById;
  compose.placeholder = "Scribe your message! or /commands";

  var scrollManager = makeScrollManagerFor(chat_content, chat_spacer);

  compose.on.keyup(function(ev) {
    try {
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
            host_ui.logError(new Error(`Unknown command (use ${cmdpre+cmdpre} or ${cmdpre}escape if you did not mean a command)`, value));
            return;
          }
          command(value.substring(match.length).trim(), value);
          compose.value = '';
          return;
        }
        sendMessage(value);
        compose.value = '';
      }
    } catch(e) {
      e.event = ev;
      host_ui.logError(e);
    }
  });

  defragmentDC(dc, (str, ev) => {
    try {
      var data = JSON.parse(str);
      if (data.type in handlers) {
        handlers[data.type](data);
      } else {
        console.warn('Unknown message type', data?.type || data, typeof data);
      }
    } catch(e) {
      e.event = ev;
      host_ui.logError(e);
    }
  });

  var shared = {};
  var handlers = {
    message: receiveMessage,
    shared: updateShared,
  };
  var messageTypes = {
    'text': ({ content }) => content,
    'color': ({ color }) => {
      const size = "4em";
      return HTML.div({ style: { borderRadius: 'inherit', backgroundColor: color, width: size, height: size }});
    },
    'shared': ({ id }, props) => {
      props.classes = ['shared-message'];
      return sharedTextareas({ id, props: { style: { font: 'inherit' }}});
    },
  };

  var commands = {
    'commands': ['List commands', (substring, original) => {
      const substrings = substring.trim().split(/\s+/u);
      let listing = Object.keys(commands);
      if (substrings) {
        let filtered = listing.filter(cmd =>
          substrings.some(s =>
            (cmdpre+cmd).includes(s)
              || commands[cmd]?.help?.includes(s)
              || commands[cmd]?.aliases?.some(alias => (cmdpre+alias).includes(s))
          )
        );
        if (filtered.length) listing = filtered;
        else if (!original.startsWith(cmdpre+' ')) {
          return host_ui.logError(new Error(`Unknown command (use ${cmdpre+cmdpre} or ${cmdpre}escape if you did not mean a command)`, original));
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
    }, { aliases: ['', 'help'] }],
    'prefix': ['Set prefix for commands (defaults to "/")', (prefix) => {
      if (!prefix) {
        return addStatus(`Current prefix: ${JSON.stringify(cmdpre)}`);
      }
      compose.placeholder = compose.placeholder.replace(cmdpre+'commands', prefix+'commands');
      addStatus(`Prefix changed from ${JSON.stringify(cmdpre)} to ${JSON.stringify(prefix)}`);
      cmdpre = prefix;
    }],
    'color': ['Send a color! (CSS colors)', color => color && sendMessage.color({ color })],
    'hue': (role === 'guest' ? Ve.CSS.var.hue = 283 : null, [
      ['Set the chat hue (0–360, currently ', Ve.StringOnDemand(() => Ve.CSS.var.hue), ')'],
      hue => hue ? (Ve.CSS.var.hue = hue) : addOutput(['Current hue: ', Ve.CSS.var.hue])
    ]),
    'shared': ['Create a pair of shared scratchpads', () => sendMessage.shared({ id: newID() }), { aliases: ['scratch'] }],
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
  function addRemoteOutput(content, props, ...classes) {
    scrollManager.adding.see_top(() => {
      return addMessage(content, props, 'peer', 'command', ...classes);
    });
  }

  function updateShared(data) {
    return shared[data.id](data);
  }

  Ve.forQuery('#role_description', function(el) {
    el.textContent = "("+role+")";
  });
  Ve.ById.loading.style.display = 'none';
  addStatus('Peer connected');
  setTimeout(() => {
    sendMessage(role);
  }, 100);

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

  const methods = {
    rtc, dc, // TODO
    renderMessage,
    addMessage, addOutput, addRemoteOutput, addStatus,
    sendMessage, updateShared, shared,
    scrollManager, sharedTextareas,
    messageTypes, commands,
  };

  {
    let pendingModules = app.registerModule.pending;
    app.registerModule = function(mod) {
      const instance = mod(methods);
      Object.assign(handlers, instance.handlers||{});
      Object.entries(instance.commands).forEach(([k,v]) => {
        if (v instanceof Array) {
          let [help,fn,vs] = v;
          instance.commands[k] = fn;
          fn.help = help;
          if (vs) Object.defineProperties(fn, Object.getOwnPropertyDescriptors(vs));
        }
      });
      Object.assign(commands, instance.commands||{});
      Object.assign(messageTypes, instance.messageTypes||{});
    }
    for (let mod of pendingModules) {
      app.registerModule(mod);
    }
    pendingModules = null;
  }
}
app.registerModule = function(mod) {
  app.registerModule.pending.push(mod);
}
app.registerModule.pending = [];
