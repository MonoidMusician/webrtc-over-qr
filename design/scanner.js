Ve.ContentLoad(async () => {
  const { HTML } = Ve;

  Ve.ById.loading.style.display = 'none';
  Ve.ById.compose.placeholder = '/upload';

  compose.on.keyup(async ev => {
    if (ev.key === 'Enter') {
      const value = compose.value.replaceAll('\u2588', '').trim();
      if (/\w+/.exec(value)[0] === 'upload') {
        compose.value = "";
        Ve.ById.file_upload.click();
      }
    }
  });
  const onQR = async result => {
    console.log(result);
    if (result.text.startsWith("data:")) {
      const onclick = async event => {
        if (navigator?.clipboard?.writeText) {
          event.preventDefault();
          await navigator.clipboard.writeText(result.text);
          alert('Copied data URI! You must paste it into your browser URL manually');
        }
      };
      host_ui.logEvent(HTML.a({href:result.text,onclick}, result.text));
    } else if (result.text.startsWith("http://") || result.text.startsWith("https://")) {
      host_ui.logEvent(HTML.a({href:result.text}, result.text));
    } else {
      host_ui.logEvent(result.text);
    }
  };
  host_ui.uploadQR(onQR);
  const scanner = await host_ui.scanQR(onQR);
  Ve.ById.chat_content.appendChild(scanner);
});
