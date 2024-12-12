function toDataURI(content, mimetype="text/plain") {
  return `data:${mimetype};base64,${toB64(content)}`;
}
// Named capturing groups are still recent (2024)...
let dataURI = /^data:(([a-zA-Z0-9][-a-zA-Z0-9!#$&^_+.]{0,127})\/([a-zA-Z0-9][-a-zA-Z0-9!#$&^_+.]{0,127}))((?:;[a-zA-Z0-9][-a-zA-Z0-9!#$&^_+.]{0,127}=(?:[-a-zA-Z0-9!#$&^_+.]+|"(?:[\t \x21\x23-\x5B\x5D-\x7E\x80-\xFF]|\\[\t \x21-\x7E\x80-\xFF])*"))*)(;base64)?,/;
function fromDataURI(uri) {
  `
    // https://datatracker.ietf.org/doc/html/rfc6838#section-4.2
    type-name = restricted-name
    subtype-name = restricted-name

    restricted-name = ${/[a-zA-Z0-9][-a-zA-Z0-9!#$&^_+.]{0,127}/}
    restricted-name = restricted-name-first *126restricted-name-chars
    restricted-name-first  = ALPHA / DIGIT
    restricted-name-chars  = ALPHA / DIGIT / "!" / "#" /
                             "$" / "&" / "-" / "^" / "_"
    restricted-name-chars =/ "." ; Characters before first dot always
                                 ; specify a facet name
    restricted-name-chars =/ "+" ; Characters after last plus always
                                 ; specify a structured syntax suffix

    // https://datatracker.ietf.org/doc/html/rfc6838#section-4.3
    // It is an error for a specific parameter to be specified more than once.
    parameter-name = restricted-name

    // https://datatracker.ietf.org/doc/html/rfc2045#section-5.1
    content := "Content-Type" ":" type "/" subtype
          *(";" parameter)
          ; Matching of media type and subtype
          ; is ALWAYS case-insensitive.

    parameter := attribute "=" value

    value := token / quoted-string

    token := ${/[-a-zA-Z0-9!#$&^_+.]+/} // '%| ???
    token := 1*<any (US-ASCII) CHAR except SPACE, CTLs,
                or tspecials>

    tspecials :=  "(" / ")" / "<" / ">" / "@" /
                  "," / ";" / ":" / "\" / <">
                  "/" / "[" / "]" / "?" / "="
                  ; Must be in quoted-string,
                  ; to use within parameter values

    // https://www.rfc-editor.org/rfc/rfc7230#section-3.2.6
    quoted-string := ${/"(?:[\t \x21\x23-\x5B\x5D-\x7E\x80-\xFF]|\\[\t \x21-\x7E\x80-\xFF])*"/}
    quoted-string  = DQUOTE *( qdtext / quoted-pair ) DQUOTE
    qdtext         = HTAB / SP /%x21 / %x23-5B / %x5D-7E / obs-text
    obs-text       = %x80-FF
    quoted-pair    = "\" ( HTAB / SP / VCHAR / obs-text )
  `;
  let match = dataURI.exec(uri);
  if (!match) throw new Error("Invalid data URI", uri);
  let parameters = match[4].substring(1).split(";");
  parameters = parameters.filter(Boolean).map(parameter => {
    let [attribute, value] = parameter.split("=", 2);
    attribute = attribute.toLowerCase();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length-1)
        .replaceAll(/\\([\t \x21-\x7E\x80-\xFF])/g, '$1');
    }
    return [attribute, value];
  });
  parameters = Object.fromEntries(parameters);
  const base64 = !!match[5];
  const encoded = uri.substring(match[0].length);
  let data = undefined;
  let text = undefined;
  const extra = Object.assign({}, [
    match[2] === 'text' && { charset: parameters['charset'] || 'UTF-8' },
  ].filter(o=>typeof o === 'object'));
  return {
    ...extra,
    mime: match[1].toLowerCase(),
    type: match[2].toLowerCase(),
    subtype: match[3].toLowerCase(),
    parameters: parameters,
    base64,
    encoded,
    get data() {
      if (data === undefined) {
        data = base64
          ? fromB64.bytes(encoded)
          // hmm, binary URI encoded??
          : (new TextEncoder()).encode(decodeURI(encoded));
      }
      return data;
    },
    get text() {
      if (text === undefined) {
        text =
          base64
            ? data !== undefined
              ? (new TextDecoder(extra.charset)).decode(data)
              : fromB64.text(encoded, extra.charset)
            : decodeURI(encoded);
      }
      return text;
    },
  }
}
function toB64(content) {
  return btoa(Array.from(content instanceof Uint8Array ? content : (new TextEncoder()).encode(content), b=>String.fromCodePoint(b)).join(""));
}
function fromB64(content) {
  return (new TextDecoder()).decode(Uint8Array.from(atob(content), b=>b.codePointAt(0)));
}
fromB64.text = function(content, encoding='UTF-8') {
  return (new TextDecoder(encoding)).decode(fromB64.bytes(content));
}
fromB64.bytes = function(content) {
  return Uint8Array.from(atob(content), b=>b.codePointAt(0));
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

function cssVar(name, value) {
  if (arguments.length === 1) return value => cssVar(name, value);
  const style = (typeof this === Element ? this : document.documentElement).style;
  if (value === null) {
    style.removeProperty(`--${name}`);
  } else {
    style.setProperty(`--${name}`, value);
  }
}
function cssVars(vars) {
  const style = (typeof this === Element ? this : document.documentElement).style;
  for (let [name, value] of Object.entries(vars)) {
    if (value === null) {
      style.removeProperty(`--${name}`);
    } else {
      style.setProperty(`--${name}`, value);
    }
  }
}

// 52 bits of randomness
function newID() {
  return String(Math.random()).substring(2);
}
