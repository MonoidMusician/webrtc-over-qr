"use strict";
function listenForUploads(onFiles) {
  const { file_upload, compose } = Ve.ById;

  const PLACEHOLDER = 'Upload! (escape to cancel)';
  let last_placeholder;

  const cleanup = mkCleanup();

  async function obtainFiles(theFiles) {
    theFiles = Array.from(theFiles);
    if (!theFiles.length) return;
    return await Promise.all(theFiles.map(async f => [f, await readFile(f)]));
  }
  async function addFiles(theFiles) {
    onFiles(await obtainFiles(theFiles));
  }

  async function pasteData(items) {
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        files.push(item.getAsFile());
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        if (!["input","textarea"].includes(event.target.localName)) {
          item.getAsString(value => {
            // TODO: TextCursor
            compose.value = value;
            compose.focus();
          });
        }
      }
    }
    if (files.length) addFiles(files);
  }

  cleanup(
    // Global paste, which includes strings (which become composed messages) and files
    document.on.paste(event => {
      pasteData(event.clipboardData.items);
    }),
    // Global drag and drop (e.g. from OS)
    document.on.dragover(event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (compose.placeholder != PLACEHOLDER) last_placeholder = compose.placeholder;
      compose.placeholder = PLACEHOLDER;
    }),
    document.on.drop(event => {
      event.preventDefault();
      // Go through with the drop, adding all of the items
      compose.placeholder = last_placeholder ?? '';
      pasteData(event.dataTransfer.items);
    }),
    document.on.dragleave(function() {
      // Cancel the drag
      compose.placeholder = last_placeholder ?? '';
    }),

    file_upload.on.change(() => {
      addFiles(file_upload.files);
      file_upload.value = ''; // clear it
    }),
  );
  file_upload.disabled = false;

  return cleanup;
}
