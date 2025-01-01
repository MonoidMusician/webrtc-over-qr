"use strict";
function toDataURI(content, mimetype="text/plain") {
  return `data:${mimetype};base64,${toB64(content)}`;
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
    let last = input[input.length-1];
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

// 52 bits of randomness
function newID() {
  return String(Math.random()).substring(2);
}

const EXAMPLE_FINGERPRINT = "00:F0:01:E0:02:D0:03:C0:04:B0:05:A0:06:90:07:80:08:70:09:60:0A:50:0B:40:0C:30:0D:20:0E:10:0F:00";
const RE_FINGERPRINT = /^(:?[a-fA-F0-9]{2}){32}$/;

// items: { render: Ve.DOM, label: Ve.DOM, value? }[]
function tabgroup(items, onChange) {
  if (!onChange) onChange=()=>{};
  items = Array.from(items).filter(Boolean);
  const tablist = items.map((item, idx) =>
    Ve.HTML.button.tab({
      onclick: () => set(idx),
    }, item.label),
  );
  const tabs = items.map(({ render }) => Ve.HTML.div.tab({hidden:true}, render));
  let current = 0;
  function set(idx) {
    tabs[current].hidden = true;
    tablist[current].classList.remove("selected");
    current = idx;
    tabs[idx].hidden = false;
    tablist[current].classList.add("selected");
    onChange(items[idx].value);
  }
  set(0);
  return Ve.HTML.div.tabgroup([
    Ve.HTML.div.tablist(tablist),
    Ve.HTML.div.tabs(tabs),
  ]);
}

function showTime(when) {
  when = when ? new Date(when) : new Date();
  return Ve.HTML.time({ datetime: String(when) }, when.toLocaleTimeString());
}

function mkCleanup() {
  function cleanup(...args) {
    if (args.length === 0) {
      const todo = cleanup.cleanup;
      cleanup.cleanup = [];
      for (let act of todo) {
        if (act instanceof Node) act = act.removeSelf.bind(act);
        try{act()}catch{}
      }
      return;
    }
    cleanup.cleanup.push(...args);
    return args[0];
  }
  cleanup.cleanup = [];
  return cleanup;
}

function renderJSON(d) {
  return Ve.HTML.pre(JSON.stringify(d, undefined, 2));
}

function safari() {
  if (navigator?.vendor === "Apple Computer, Inc.") return true;
  // if (/iPad|iPhone|iPod/.test(navigator?.platform || "")) return true;
  // // iPad Pro claims it is MacIntel
  // if (navigator?.maxTouchPoints &&
  //     navigator?.maxTouchPoints > 2 &&
  //     /MacIntel/.test(navigator?.platform)) return true;
  return false;
}
function fixSafari() {
  document.head.appendChild(Object.assign(document.createElement('style'), {
    className: 'ephemeral',
    textContent: `
      /* weird fix to prevent Safari from thinking that the body should be scrollable */
      html, body { overflow-y: hidden }
      body { position: sticky }
    `,
  }));
}

if (safari()) {
  if (window.document.readyState === 'complete') {
    fixSafari();
  } else {
    window.addEventListener('DOMContentLoaded', fixSafari);
  }
}
