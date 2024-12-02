function toDataURI(content, mimetype="text/plain") {
  return `data:${mimetype};base64,${toB64(content)}`;
}
function toB64(content) {
  return btoa(Array.from(content instanceof Uint8Array ? content : (new TextEncoder()).encode(content), b=>String.fromCodePoint(b)).join(""));
}
function fromB64(content) {
  return (new TextDecoder()).decode(Uint8Array.from(atob(content), b=>b.codePointAt(0)));
}
function assert(condition, message="Assertion failed") {
  if (!condition) throw new Error(message);
}
async function readFile(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onerror = reject;
    reader.onload = () => {resolve(reader.result)};
    reader.readAsDataURL(file);
  });
}

function useAnimations() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fragmentData(data, bytes=4_000) {
  const json = data;
  if (json.length < bytes) return [json];
  const segments = [];
  const total = json.length;
  let i = 0;
  while (i < total) {
    const len = Math.min(total - i, bytes - 1);
    // Unit Separator and End of Transmission Block
    const sep = i + len < total ? "\x1F" : "\x17";
    segments.push(json.substring(i, i + len) + sep);
    i += len;
  }
  console.log({ segments });
  return segments;
}
function defragmentData() {
  let buffer = [];
  return function next(input) {
    last = input[input.length-1];
    if (last === "\x1F") {
      buffer.push(input.substring(0,input.length-1));
      return undefined;
    } else if (last === "\x17") {
      buffer.push(input.substring(0,input.length-1));
      const result = buffer.join("");
      console.log(JSON.parse(result));
      buffer = [];
      return result;
    } else {
      assert(!buffer.length, "Dangling transmission (did not see \\x17 ETB segment)");
      return input;
    }
  };
}
function fragmentDC(dc, message) {
  for (const segment of fragmentData(message)) {
    dc.send(segment);
  }
}
function defragmentDC(dc, onmessage) {
  const defragmenter = defragmentData();
  dc.onmessage = (event) => {
    const value = defragmenter(event.data);
    if (value !== undefined) {
      onmessage(value, event);
    }
  };
}
