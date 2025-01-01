// Media and general file uploads, via:
// - Drag and drop into the document, e.g. from the OS filesystem
// - Paste into the document
// - `/upload` command
// - `+` button next to the compose
"use strict";
app.registerModule(function canvasModule({ sendMessage, messageTypes }) {
  const { HTML } = Ve;

  const cleanup = mkCleanup();
  cleanup(listenForUploads(onFiles));

  async function onFiles(fileSrcs) {
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
  }

  return {
    messageTypes: {
      'media/image': data => HTML.img({ src: data.src }),
      'media/video': data => HTML.video({ src: data.src, controls: true }),
      'media/audio': data => HTML.audio({ src: data.src, controls: true }),
      'text/*': (data, props) => {
        let { text, mime, type, subtype } = Ve.fromDataURI(data.src);
        text = text.replaceAll('\r\n','\n').replaceAll('\r','\n').trim(); // idk
        props.data = { mime, type, subtype };
        return [
          HTML.p(messageTypes['download'](data)),
          HTML.pre(text),
        ];
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
      'download': ({ src, name, mime }) => [
        HTML.a({ href: src, download: name }, 'Download ', HTML.code(name)),
        ' ', HTML.span.mime(['[', mime, ']']),
      ],
    },
    commands: {
      'upload': ['Upload a file (image, video, audio, even a font!)', () => { Ve.ById.file_upload.click() }],
    },
  };
});
