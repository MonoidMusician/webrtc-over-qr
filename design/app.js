function app() {
  var { compose, chat_content, chat_spacer } = Ve.ById;
  compose.placeholder = "Write a message to your bestie!";

  var scrollManager = makeScrollManagerFor(chat_content, chat_spacer);

  Ve.on.keyup(compose, function(ev) {
    if (ev.key === 'Enter') {
      sendMessage(compose.value);
      compose.value = '';
    }
  });
  dc.onmessage = (ev) => {
    var data = JSON.parse(ev.data);
    if (data.type === 'message') {
      receiveMessage(data);
    } else {
      console.warn('Unknown message type', data.type || data);
    }
  };
  function sendMessage(content) {
    if (!content) return;
    dc.send(JSON.stringify({ type: 'message', content }));
    scrollManager.adding(() => {
      return addMessage(content, 'echo');
    });
  }
  function receiveMessage(data) {
    scrollManager.adding.see_top(() => {
      return addMessage(data.content, 'peer');
    });
  }
  function addMessage(content, ...classes) {
    return chat_content.appendChild(Ve.HTML.div({classList: ['message', ...classes]}, content));
  }

  Ve.forQuery('#role_description', function(el) {
    el.textContent = "(p2p "+role+")";
  });
  Ve.ById.loading.removeSelf();
  addMessage('Peer connected', 'status');
  setTimeout(() => sendMessage(role), 100);
}
