"use strict";
app.registerModule(function pingModule({ rtc, dc, addStatus }) {
  const flipping = frame => ({ ping: frame.pong, pong: frame.ping });
  const avgping = frames => {
    let ping = 0;
    let pong = 0;
    for (let frame of frames) {ping+=frame.ping;pong+=frame.pong}
    ping /= frames.length;
    pong /= frames.length;
    return ({ ping, pong });
  }
  function sendPing(type, data) {
    fragmentDC(dc, JSON.stringify({ ...data, type }));
  }
  function ping(count) {
    count = Number(count)||1;
    var timestamp = performance.now();
    sendPing('SYN', { count, ping: timestamp });
  }
  ping.help = 'Test ping latency (RTT)';
  function SYN(data) {
    var timestamp = performance.now();
    sendPing('SYNACK', { ...data, pong: timestamp });
  }
  function SYNACK(data) {
    var timestamp = performance.now();
    var delta = timestamp - data.ping;
    sendPing('ACK', { ...data, ping: delta });
  }
  function ACK(data) {
    var timestamp = performance.now();
    var delta = timestamp - data.pong;
    data.pong = delta;
    if (!data.measurements) {
      data.measurements = [];
    } else {
      data.measurements = data.measurements.map(flipping);
    }
    data.measurements.push({ ping: data.ping, pong: data.pong });
    if (data.measurements.length >= data.count) {
      sendPing('pong', { ...data });
      pong({ ...data, measurements: data.measurements.map(flipping) });
    } else {
      sendPing('SYN', { ...data, ping: timestamp, pong: undefined });
    }
  }
  function pong(data) {
    const measured = avgping(data.measurements);
    addStatus([
      `our ping: ${measured.ping.toFixed(1)}ms`, ", ",
      `their ping: ${measured.pong.toFixed(1)}ms`, " ",
      "(", Ve.HTML.a({href:"https://en.wikipedia.org/wiki/Round-trip_time"}, "RTT"), ")",
    ]);
  }

  setTimeout(() => {
    if (role === 'guest') ping(25);
  }, 500);

  return {
    handlers: { SYN, SYNACK, ACK, pong },
    commands: { ping },
  };
});
