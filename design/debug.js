"use strict";
function printEvents(label, rtc, cb = () => {}) {
  function snapshot(o) {
    const r = {};
    for (const k of Object.keys(Object.getPrototypeOf(o)).concat(Object.keys(o))) {
      const v = o[k];
      if (typeof v !== 'function') r[k] = v;
      if (v instanceof RTCSessionDescription) r[k] = v.sdp;
    }
    return r;
  }
  function diff(last,o) {
    const r = {};
    for (const [k,v] of Object.entries(o)) {
      if (last[k] !== v) r[k] = v;
    }
    return r;
  }
  let last_rtc = {};
  function diff_rtc() {
    const next = snapshot(rtc);
    const delta = diff(last_rtc, next);
    last_rtc = next;
    return delta;
  }

  const listener = e => {
    const delta = diff_rtc();
    if (label) console.log(label, e.timeStamp, e.type, delta, e);
    const eventJSON = {};
    let p = e;
    while (p && p !== Event.prototype) {
      for (const k of Object.getOwnPropertyNames(p)) {
        try {
          eventJSON[k] = e[k];
        } catch(e){}
      }
      p = Object.getPrototypeOf(p);
    }
    delete eventJSON.isTrusted;
    if (cb) cb(e, delta, eventJSON);
  };

  const events = [];
  for (const k in rtc) if (k.startsWith("on")) events.push(k.substring(2));

  for (const k of events) rtc.addEventListener(k, listener);

  return () => {
    for (const k of events) rtc.removeEventListener(k, listener);
  };
}
