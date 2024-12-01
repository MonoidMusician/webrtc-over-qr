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

  for (let k in rtc) {
    if (!k.startsWith("on")) continue;
    rtc.addEventListener(k.substring(2), e => { console.log(label, e.timeStamp, e.type, diff_rtc(), e), cb(e) });
  }
}
