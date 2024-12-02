function app() {
  var { compose, chat_content, chat_spacer, file_upload } = Ve.ById;
  compose.placeholder = "Write a message to your bestie!";

  var scrollManager = makeScrollManagerFor(chat_content, chat_spacer);

  Ve.on.keyup(compose, function(ev) {
    if (ev.key === 'Enter') {
      sendMessage(compose.value);
      compose.value = '';
    }
  });
  defragmentDC(dc, (str, ev) => {
    if (ev.data !== str) console.log(ev);
    var data = JSON.parse(str);
    if (data.type === 'message') {
      receiveMessage(data);
    } else {
      console.warn('Unknown message type', data.type || data, typeof data);
    }
  });
  function sendMessage(content) {
    if (!content) return;
    fragmentDC(dc, JSON.stringify({ type: 'message', content }));
    scrollManager.adding(() => {
      return addMessage(content, 'echo');
    });
  }
  function receiveMessage(data) {
    scrollManager.adding.see_top(() => {
      if (data.image) {
        return addMessage(Ve.HTML.img({ src: data.image.src }), 'peer', 'image');
      } else {
        return addMessage(data.content, 'peer');
      }
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

  Ve.on.change(file_upload, async () => {
    const fileSrcs = await Promise.all(Array.from(file_upload.files).map(readFile));
    scrollManager.adding(() => fileSrcs.map(src =>
      addMessage(Ve.HTML.img({ src: src }), 'image', 'echo')
    ));
    for (const src of fileSrcs) {
      fragmentDC(dc, JSON.stringify({ type: 'message', image: { src } }));
    }
  });
}
