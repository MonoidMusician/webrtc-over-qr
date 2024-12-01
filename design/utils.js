function toDataURI(content, mimetype="text/plain") {
  return `data:${mimetype};base64,${toB64(content)}`;
}
function toB64(content) {
  return btoa(Array.from((new TextEncoder()).encode(content), b=>String.fromCodePoint(b)).join(""));
}
function fromB64(content) {
  return (new TextDecoder()).decode(Uint8Array.from(atob(content), b=>b.codePointAt(0)));
}
function assert(condition, message="Assertion failed") {
  if (!condition) throw new Error(message);
}

function useAnimations() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
