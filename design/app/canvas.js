"use strict";
app.registerModule(function canvasModule({ dc, scrollManager, shared, addMessage }) {
  const { HTML } = Ve;

  function liveCanvas() {
    var id = newID();
    var canvas = HTML.canvas({width:500,height:500});
    function record(...args) {
      fragmentDC(dc, JSON.stringify({ type: 'shared', id, args }));
    }
    /** @type CanvasRenderingContext2D */
    var ctx = new Proxy(canvas.getContext('2d'), {
      get(tgt, name) {
        const value = Reflect.get(tgt, name);
        if (typeof value !== 'function' || name.startsWith('is') || name.startsWith('get')) return value;
        return (...args) => {
          record('call', name, ...args);
          return tgt[name](...args);
        };
      },
      set(tgt, name, value) {
        Reflect.set(tgt, name, value);
        record('set', name, value);
        return true;
      },
    });
    scrollManager.adding(() => {
      return addMessage(canvas, {}, 'echo');
    });
    fragmentDC(dc, JSON.stringify({ type: 'message', messageType: 'canvas', id, width: canvas.width, height: canvas.height }));
    window.ctx = ctx;
    function coords(/** @type MouseEvent */ ev) {
      var bb = canvas.getBoundingClientRect();
      var ret = [
        coord(ev.clientX, ctx.canvas.width, bb.left, bb.width),
        coord(ev.clientY, ctx.canvas.height, bb.top, bb.height),
      ];
      return ret;
    }
    function coord(current, range, min, diff) {
      return range*(current - min)/diff;
    }
    canvas.on.mousedown((ev) => {
      ctx.beginPath();
      ctx.moveTo(...coords(ev));
      ev.preventDefault();
    });
    canvas.on.mousemove((ev) => {
      if (!ev.buttons) return;
      ctx.lineTo(...coords(ev));
      ctx.stroke();
    });
    return canvas;
  };
  liveCanvas.guest = function({ id, width, height }) {
    var canvas = HTML.canvas({width,height});
    var ctx = canvas.getContext('2d');
    shared[id] = ({ args }) => {
      if (args[0] === 'call') {
        ctx[args[1]](...args.slice(2));
      } else if (args[0] === 'set') {
        ctx[args[1]] = args[2];
      }
    };
    return canvas;
  };

  return {
    messageTypes: { 'canvas': liveCanvas.guest },
    commands: { 'canvas': ['canvas', liveCanvas] },
  };
});
