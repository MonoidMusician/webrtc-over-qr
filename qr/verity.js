Verity = Ve = {};
(function Veritification() {
  Ve.noop = ()=>{};

  function pythonic(fn) {
    return function(...args) {
      return fn(this, ...args);
    };
  };

  //////////////////////////////////////////////////////////////////////////////

  // Create a simple proxy for syntactic sugar for method names and function calls
  const sugar = (handler, applier=undefined) => new Proxy(applier ? ()=>{} : {}, {
    get: (_target, property, _thisArg) => {
      return handler(property);
    },
    apply: applier && ((_target, _thisArg, args) => applier(...args)),
  });
  const sugarArg = handler => sugar(handler, handler(undefined));
  const sugarStr = handler => sugar(handler, handler)

  // Create a getter for the property:
  //     _.name = v => v.name
  //     _.name({name:"hello"}) == "hello"
  //
  // Or create a function that applies fixed arguments:
  //     _("la", "la") = fn => fn("la", "la")
  //     _("la", "la")(Array) = ["la", "la"]
  const _ = sugar(
    name => value => value[name],
    // Capture `this` from the second call, so that
    // ({ foo: "bar" }) == _().call({ foo: "bar" }, (function () { return this }))
    (...args) => function (fn) { return fn.call(this, ...args) }
  );

  const _this = sugar(
    name => function() { return this[name] }
  );

  // Create a wrapper for the property:
  //     mk.name = name => ({ name })
  //     mk.name("hello") == {name: "hello"}
  const mk = sugar(
    name => value => ({ [name]: value }),
  );

  // Create a modifier for the property:
  //     modifier.name(fn) = value => ({ ...value, name: fn(value.name) })
  //     modifier.name(x => x.join(""))({ name: ["Monoid", "Musician"], value: 42 }) == { name: "MonoidMusician", value: 42 }
  // Works in reverse too:
  //     modifier(fn).name = value => ({ ...value, name: fn(value.name) })
  //     modifier(x => x.join("")).name({ name: ["Monoid", "Musician"], value: 42 }) == { name: "MonoidMusician", value: 42 }
  const modifier = sugar(
    name => fn => value => ({ ...value, [name]: fn(value[name]) }),
    fn => sugar(name => value => ({ ...value, [name]: fn(value[name]) })),
  );

  // That's the easy stuff. Let's dig deeper!

  // The identity function. You know it and love it. <3
  const identity = v => v;

  // Could this be a name of a method? Note that `new String("")` objects do not
  // count, nor do numbers. In particular, note that
  //     typeof sugar(identity)[new String("x")] != typeof new String("x")
  const _isMethod = p => typeof p === 'string' || typeof p === 'symbol';

  // Compose left to right (the first function can take multiple arguments and
  // also the implicit `this` reference). If a function is a string or symbol,
  // it is treated as a method name (this preserves the parent object as
  // the `this` reference for the next function in the composition pipeline).
  const compose = (...allFns) => {
    // Comparing functions is bad but I just think it is funny if it strictly
    // satisfies the category laws for the wrong reasons:
    const fns = allFns.filter(x => x !== identity);

    if (!fns.length) return identity;

    const fn0 = _isMethod(fns[0]) ? (v => v[fns[0]]) : fns[0];
    if (fns.length === 1) return fn0;

    // Return a function that can capture `this` and thus operate like a method.
    return function(...args) {
      // Start by applying the original `this` and `args`
      let v = fn0.call(this, ...args);
      // We preserve the last object as `thisArg` iff the function is a string
      // for a method name
      let thisArg = _isMethod(fns[0]) ? args[0] : undefined;
      for (let fn of fns.slice(1)) {
        if (_isMethod(fn)) {
          // For method names we take the value of the property and preserve
          // the old object as the new `thisArg`
          thisArg = v;
          v = v[fn];
        } else {
          // For functions, we call them with the current value of `thisArg`
          // (which is only defined if the last function was a method name)
          // and then set the next `thisArg` to `undefined`.
          v = fn.call(thisArg, v);
          thisArg = undefined;
        }
      }
      return v;
    };
  };

  // Collect arguments to compose via proxied member/method/function applications.
  const pipelining = pipelined => new Proxy(()=>{}, {
    get: (_target, property, _thisArg) => {
      // Special case to end the pipeline
      // (yeah, it could be a symbol to be pedantic about abstraction,
      // but that makes it less symmetrical!)
      if (property === "line_") return compose(...pipelined);

      // See documentation for `compose` for why this is inserted as
      // a string/symbol still, instead of `_[property]`:
      return pipelining([ ...pipelined, property ]);
    },
    apply: (_target, _thisArg, args) => {
      return pipelining([ ...pipelined, _(...args) ]);
    },
  });

  // Create a pipeline of `_`-style accessors that end with `.line_`:
  //     _pipe.join("").line_ = x => x.join("")
  //     _pipe.join(", ").line_(["do", "re", "mi"]) == "do, re, mi"
  //     _pipe.join(", ").length.line_(["do", "re", "mi"]) == 10
  const _pipe = pipelining([]);

  const intercalate = (fixed, ...intermediates) => {
    const result = [];
    fixed.forEach((item, i) => {
      result.push(item);
      if (i < fixed.length - 1)
        result.push(intermediates[i]);
    });
    return result;
  };
  intercalate.raw = ({ raw: fixed }, ...intermediates) => {
    return intercalate(fixed, ...intermediates);
  };

  //////////////////////////////////////////////////////////////////////////////

  Object.assign(Ve, {
    sugar, _, _this, mk, modifier, compose, _pipe, intercalate,
  });

  // Create a string whose value is computed on demand
  //     Ve.StringOnDemand(() => "hi") instanceof String == true
  //     String(Ve.StringOnDemand(() => "hi")) == "hi"
  //     Ve.StringOnDemand(() => "hello") + " world" == "hello world"
  Ve.StringOnDemand = fn => Object.create(Object.assign(new String(), { toString: fn, valueOf: fn }));

  // Create a number whose value is computed on demand
  //     Ve.NumberOnDemand(() => Math.random()) instanceof Number == true
  //     Number(Ve.NumberOnDemand(() => Math.PI)) == Math.PI
  //     Ve.NumberOnDemand(() => 2) + 3 == 5
  Ve.NumberOnDemand = fn => Object.create(Object.assign(new Number(), { valueOf: fn }));

  //////////////////////////////////////////////////////////////////////////////

  var SPECIALS = {
    style: (e, style) =>
      style && Object.assign(e.style, typeof style === 'string' ? {style} : style),
    attrs: (e, attrs) =>
      attrs && Object.assign(e.attrs, attrs),
    data: (e, attrs) =>
      attrs && Object.assign(e.dataset, attrs),
    dataset: (e, attrs) =>
      attrs && Object.assign(e.dataset, attrs),
    $parent: (e, parent) =>
      parent && parent !== e.parentNode && parent.appendChild(e),
    $textContent: (e, textContent) =>
      e.textContent = textContent,
    $children: (parent, topChildren) => {
      parent.clearChildren();
      function go(children) {
        if (typeof children === 'function') children = children();
        if
          ( typeof children === 'string' || children instanceof String
          || typeof children === 'number' || children instanceof Number
          || children instanceof Node
          )
          children = [children];
        if (!children) return;
        for (let child of children) {
          if (child === undefined || child === null) continue;
          if (Array.isArray(child)) {
            go(child);
          } else {
            parent.appendChild(createChildOf(parent, child));
          }
        }
      }
      go(topChildren);
      return parent;
    },
    classList: (e, classes) => {
      e.classList = '';
      if (classes) {
        if (typeof classes === 'string' || classes instanceof String) {
          e.classList = String(classes);
        } else {
          e.classList.add(...classes.flatMap(x=>x.split(/\s+/u).filter(Boolean)));
        }
      }
    },
    class: (...arg) => SPECIALS.classList(...arg),
    // $view: (e, view) =>
    //   view && (e.$view = view),
    // $preview: (e, preview) =>
    //   preview && (e.$preview = preview),
    // $model: (e, model) =>
    //   e.MVC(model, e.$view),
  };
  function applyProps(e, props) {
    props = props ? Object.assign({}, props) : {};
    var specialProps = {};
    for (let k in props) {
      if (k in SPECIALS) {
        specialProps[k] = props[k];
        delete props[k];
      } else if (k.startsWith('$')) {
        console.warn(`Warning: unknown special attribute ${k} on element`, e);
        delete props[k];
      }
    }
    var hadChildren = '$children' in specialProps;
    for (let k in props) {
      if (/\d+/.test(k)) {
        if (hadChildren) throw new Error("Cannot mix numeric and $children");
        if (!('$children' in specialProps)) specialProps['$children'] = [];
        specialProps['$children'][k] = props[k];
        delete props[k];
      }
    }
    Object.assign(e, props);
    for (let k in specialProps) {
      SPECIALS[k](e, specialProps[k]);
    }
    return e;
  };
  function createChildOf(parent, props, tag, ...children) {
    return createElementNS(parent?.namespaceURI, props, tag, ...children);
  }
  function createElementNS(namespaceURI, props, tag, ...children) {
    const resolved = precreateElementNS(namespaceURI, props, tag, ...children);
    return createElementResolved(resolved);
  }
  function createElementResolved({ namespaceURI, props, tag, children }) {
    if (!tag && !props) {
      if (children?.length === 1) {
        return children[0];
      } else {
        const result = document.createDocumentFragment();
        SPECIALS['$children'](result, children);
        return result;
      }
    }
    let e = namespaceURI
      ? document.createElementNS(namespaceURI || undefined, tag)
      : document.createElement(tag);
    if (children?.length) props['$children'] = children;
    applyProps(e, props);
    return e;
  }
  function precreateElementNS(namespaceURI, props, tag, ...children) {
    if (typeof tag === 'function') tag = tag();
    if (typeof props === 'string' || typeof props === 'number' || props instanceof String || props instanceof Number) {
      children = [document.createTextNode(String(props)), ...children];
      props = undefined;
    } else if (props instanceof Node) {
      children = [props, ...children];
      props = undefined;
    } else if (Array.isArray(props)) {
      children = [...props, ...children];
      props = undefined;
    }
    props = props ? Object.assign({}, props) : undefined;
    if (props) {
      tag = tag || props['$tag'];
      if (!tag) tag = 'div';
      delete props['$tag'];
      namespaceURI = namespaceURI || props['$NS'];
      delete props['$NS'];
      if (props['$children'])
        children = [props?.['$children'], children];
      delete props['$children'];
    } else if (tag) {
      props = {};
    }
    if (tag instanceof Element) tag = tag.tagName;
    if (namespaceURI instanceof Element) namespaceURI = namespaceURI.namespaceURI;
    return { namespaceURI, tag, props, children };
  };

  Object.assign(Ve, {
    applyProps, createChildOf,
  });

  Ve.ById = sugar(id => document.getElementById(id));

  Ve.NS = {
    SVG: "http://www.w3.org/2000/svg",
    XHTML: "http://www.w3.org/1999/xhtml",
    HTML: "XHTML", // DRY
    XLink: "http://www.w3.org/1999/xlink",
    XML: "http://www.w3.org/XML/1998/namespace",
    XMLNS: "http://www.w3.org/2000/xmlns/",
  };
  for (let k in Ve.NS) if (Ve.NS[k] in Ve.NS) Ve.NS[k] = Ve.NS[Ve.NS[k]];
  for (let k in Ve.NS) Ve.NS[k.toLowerCase()] = Ve.NS[k];

  // Templating a DocumentFragment
  Ve.DOM = (fixed, ...args) => {
    return createChildOf(null, Ve.dedent.intercalate(fixed, ...args));
  };
  Ve.DOM.NS = sugarStr(ns => sugarArg(tag => sugarArg(cls => (props = {}, ...children) => {
    if (ns in Ve.NS) ns = Ve.NS[ns];
    // hint that props needs to exist
    if (!props && cls) props = {};
    const resolved = precreateElementNS(ns, props, tag, ...children);
    if (cls) resolved.props.class = cls;
    return createElementResolved(resolved);
  })));
  Ve.HTML = Ve.DOM.NS.HTML;
  Ve.SVG = Ve.DOM.NS.SVG;

  Ve.ico = sugarStr(classList => Ve.HTML.i({classList}));
  Ve.iconoir = sugarStr(classList => {
    const prepend = s => `iconoir-${s.replaceAll('_','-')}`;
    if (typeof classList === 'string' || classList instanceof String) {
      classList = [prepend(classList)];
    } else {
      classList = [...prepend(classList[0]), classList.slice(1)];
    }
    return Ve.HTML.i({classList});
  });
  Ve.button = onclick => ({})

  Ve.on = sugar(ty => (tgt, handler, options) => {
    if (!handler && !options) {
      return new Promise(handler => Ve.on[ty](tgt, handler, {once:true}));
    }
    if (typeof options === 'function' && typeof handler !== 'function') {
      [handler, options] = [options, handler];
    };
    tgt.addEventListener(ty, handler, options);
    return () => {
      tgt.removeEventListener(ty, handler, options);
    };
  });
  Ve.once = sugar(ty => (tgt, handler, options) => {
    if (!handler && !options) {
      return new Promise(handler => Ve.on[ty](tgt, handler, {once:true}));
    }
    if (typeof options === 'function' && typeof handler !== 'function') {
      [handler, options] = [options, handler];
    };
    options = Object.assign({}, options, {once:true});
    return Ve.on[ty](tgt, handler, options);
  });
  Ve.immediately = (cb, ...args) => {
    cb(...args);
    return Ve.noop;
  };

  Ve.styl = {
    inline: { display: 'inline' },
    block: { display: 'block' },
    flex: { display: 'flex' },
    flexColumn: { display: 'flex', flexDirection: 'column' },
    flexRow: { display: 'flex', flexDirection: 'row' },
    pointer: { cursor: 'pointer' },
    textCursor: { cursor: 'text' },
  };

  Ve.CSS = Object.create(window.CSS);
  Object.defineProperty(Ve.CSS, ":root", { get: () => document.documentElement });
  Ve.CSS.styleRoot = function(tgt) {
    if (tgt instanceof Element) return tgt;
    if (tgt instanceof Document) return tgt.documentElement;
    return window.document.documentElement;
  };
  Ve.CSS.rootStyle = function(tgt, computed=false) {
    if (tgt instanceof CSSStyleDeclaration) return tgt;
    tgt = Ve.CSS.styleRoot(tgt);
    return computed ? getComputedStyle(tgt) : tgt.style;
  };
  // requires parsing stylesheets :-/
  // Ve.CSS.getVars = function(tgt) {};
  Ve.CSS.getVar = function(name, tgt) {
    const style = Ve.CSS.rootStyle(tgt || this, true);
    return style.getPropertyValue(`--${name}`);
  };
  Ve.CSS.etVar = function(...args) {
    if (args.length > 1) return Ve.CSS.setVar.call(this, ...args);
    return Ve.CSS.getVar.call(this, ...args);
  };
  Ve.CSS.setVar = function(name, value, tgt) {
    const style = Ve.CSS.rootStyle(tgt || this, false);
    if (value === null || value === undefined) {
      style.removeProperty(`--${name}`);
    } else {
      style.setProperty(`--${name}`, value);
    }
  };
  Ve.CSS.setVars = function(values, tgt) {
    const style = Ve.CSS.rootStyle(tgt || this, false);
    for (let [name, value] of Object.entries(values)) {
      if (value === null || value === undefined) {
        style.removeProperty(`--${name}`);
      } else {
        style.setProperty(`--${name}`, value);
      }
    }
  };
  Ve.__var = Ve.CSS.var = Ve.CSS.__ = Ve.CSS.__var = new Proxy(Ve.CSS.etVar, {
    get(__, name, tgt) {
      return Ve.CSS.getVar.call(tgt, name);
    },
    set(_, name, value, tgt) {
      return Ve.CSS.setVar.call(tgt, name, value);
    },
  });

  //////////////////////////////////////////////////////////////////////////////

  Ve.GET = async (url, options) => {
    const decisions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    };
    if (typeof options === 'string') {
      decisions.headers['Accept'] = options;
    } else if (typeof options === 'object') {
      Object.assign(decisions, options, {
        headers: Object.assign(decisions.headers, options.headers),
      });
    }
    let r = await fetch(url, decisions);
    if (decisions.headers['Accept'] === 'application/json') r = r.json();
    return r;
  };

  Ve.DELETE = async (url, options) => {
    const decisions = {
      method: 'DELETE',
    };
    if (typeof options === 'object') {
      Object.assign(decisions, options);
    }
    let r = await fetch(url, decisions);
    r = r.text();
    return r;
  };

  Ve.POST = async (url, data, options) => {
    const decisions = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };
    if (typeof options === 'string') {
      decisions.headers['Accept'] = options;
    } else if (typeof options === 'object') {
      Object.assign(decisions, options, {
        headers: Object.assign(decisions.headers, options.headers),
      });
    }
    let r = await fetch(url, decisions);
    if (decisions.headers['Accept'] === 'application/json') r = r.json();
    return r;
  };

  Ve.PUT = async (url, data, options) => {
    const decisions = {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };
    if (typeof options === 'string') {
      decisions.headers['Accept'] = options;
    } else if (typeof options === 'object') {
      Object.assign(decisions, options, {
        headers: Object.assign(decisions.headers, options.headers),
      });
    }
    let r = await fetch(url, decisions);
    if (decisions.headers['Accept'] === 'application/json') r = r.json();
    return r;
  };

  //////////////////////////////////////////////////////////////////////////////

  Object.defineProperty(Element.prototype, "attrs", {
    get: function () {
      return new Proxy(this, {
        get: (t, p) => t.getAttribute(p),
        set: (t, p, v) => { t.setAttribute(p, v); return true; },
      });
    },
    set: function (newAttrs) {
      this.clearAttributes();
      Object.assign(this.attrs, newAttrs);
    },
  });
  Object.defineProperty(Element.prototype, "on", {
    get: function () {
      return sugar(ty => (handler, options) => Ve.on[ty](this, handler, options));
    },
  });
  Object.defineProperty(Element.prototype, "once", {
    get: function () {
      return sugar(ty => (handler, options) => Ve.once[ty](this, handler, options));
    },
  });
  Object.defineProperty(Element.prototype, "__var", {
    get: function () {
      return new Proxy(this, {
        get: (t, p) => Ve.CSS.getVar.call(t, p),
        set: (t, p, v) => { Ve.CSS.setVar.call(t, p, v); return true; },
      });
    },
  });


  Element.prototype.applyProps = pythonic(applyProps);
  Element.prototype.getAttributes = function() {
    return Object.fromEntries(this.getAttributeNames().map(name => [name, this.getAttribute(name)]));
  };
  Element.prototype.setAttributes = function(attrs) {
    for (let [name, value] in Object.entries(attrs)) {
      this.setAttribute(name, value);
    }
  };
  Element.prototype.clearAttributes = function() {
    for (let attr of this.getAttributeNames()) {
      this.removeAttribute(attr);
    }
  };
  Element.prototype.copyAttributes = function(copyFrom) {
    this.setAttributes(copyFrom.getAttributes());
  };
  Node.prototype.clearChildren = function() {
    for (let c of Array.from(this.children)) {
      c.removeSelf();
    }
  };
  Node.prototype.removeSelf = function() {
    this.parentNode.removeChild(this);
  };

  // Useful for typed DOM APIs like `document.querySelectorAll`
  Ve.forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
  Ve.forQuery = (query, cb) => {
    const results = [];
    const selected = document.querySelectorAll(query);
    Ve.forEach(selected, (...args) => {
      results.push(cb ? cb(...args) : args[0]);
    });
    return results;
  };

  var PromiseOrCb = executor => Object.assign(executor, { then: (...args) => executor(...args) });

  Ve.TimeoutMs = (timeout, cb) => {
    if (!cb) return new PromiseOrCb(resolve => Ve.TimeoutMs(timeout, resolve));
    let id = setTimeout(cb, timeout);
    return () => { clearTimeout(id); };
  };
  Ve.ContentLoad = PromiseOrCb(cb => {
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState
    // 'loading', 'interactive', 'completed'
    //
    // interactive
    //   The document has finished loading and the document has been parsed but
    //   sub-resources such as scripts, images, stylesheets and frames are still
    //   loading. The state indicates that the DOMContentLoaded event is about
    //   to fire.
    if (document.readyState === 'completed') {
      return Ve.immediately(cb);
    } else {
      // https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event
      // The DOMContentLoaded event fires when the HTML document has been
      // completely parsed, and all deferred scripts (<script defer src="…"> and
      // <script type="module">) have downloaded and executed. It doesn't wait
      // for other things like images, subframes, and async scripts to finish
      // loading.
      //
      // DOMContentLoaded does not wait for stylesheets to load, however
      // deferred scripts do wait for stylesheets, and the DOMContentLoaded
      // event is queued after deferred scripts. Also, scripts which aren't
      // deferred or async (e.g. <script>) will wait for already-parsed
      // stylesheets to load.
      //
      // A different event, load, should be used only to detect a fully-loaded
      // page. It is a common mistake to use load where DOMContentLoaded would
      // be more appropriate.
      return Ve.once.DOMContentLoaded(window, cb);
    }
  });
  Ve.FullLoad = PromiseOrCb(cb => {
    if (document.readyState === 'completed') {
      return Ve.immediately(cb);
    } else {
      return Ve.once.load(window, cb);
    }
  });

  //////////////////////////////////////////////////////////////////////////////

  Ve.RAFBuffer = function() {
    let buffer = [];
    function flush() {
      const buffered = buffer;
      console.log("Buffered", buffered.length);
      buffer = [];
      for (let event of buffered) {
        event[0].call(event[1], ...event[2]);
      }
    }
    return function(cb) {
      return function(...event) {
        if (!buffer.length) requestAnimationFrame(flush);
        buffer.push([cb, this, event]);
      };
    };
  }
  Ve.AggregateRAF = function(handle) {
    let buffer = [];
    function flush() {
      const buffered = buffer;
      buffer = [];
      handle(buffered);
    }
    return function(datum) {
      if (!buffer.length) requestAnimationFrame(flush);
      buffer.push(datum);
    };
  }

  // Fucked code that does not work.
  Ve.$Buffer = Symbol("buffer");
  Ve.BufferEv = (upstream, cb) => {
    let buffer = [];
    let buffered = new Proxy(upstream, {
      get: (tgt, name, receiver) => {
        if (name === Ve.$Buffer) return buffer;
        if (name === "addEventListener") {
          return Object.assign(function addEventListener(...args) {
            if (!this[Ve.$Buffer]) {
              return this.addEventListener(...args);
            }
            const outer = this;
            const originalCb = args[1];
            function bufferEvent(...event) {
              console.log("Capture", event);
              if (cb && !outer[Ve.$Buffer].length) {
                cb(() => { console.debug("FLUSH"); buffered.flush(); });
              }
              outer[Ve.$Buffer].push([originalCb, this, ...event]);
            }
            return this.addEventListener.original.call(this.addEventListener.upstream, args[0], bufferEvent, ...args.slice(2));
          }, { upstream, original: tgt.addEventListener });
        }
        if (name === "flush") {
          return function flush() {
            const toRun = buffer;
            buffer = [];
            for (let event of toRun) {
              console.log(event);
              event[0].call(event[1], event.slice(2));
            }
          };
        }
        return Reflect.get(tgt, name);
      }
    });
    return buffered;
  };
  Ve.BufferEvRAF = (upstream) => Ve.BufferEv(upstream, requestAnimationFrame);

  //////////////////////////////////////////////////////////////////////////////

  Ve.dedent = (strings, ...values) => {
    return Ve.dedent.intercalate(strings, ...values).join('');
  };
  Ve.dedent.intercalate = (strings, ...values) => {
    if ('raw' in strings) strings = strings['raw'];
    if (typeof strings === 'string' || strings instanceof String) strings = [strings];
    if (!strings.length) return '';
    const lines = strings.flatMap((string, i) => {
      const these_lines = string.split('\n').slice(1);
      return these_lines.map((line, j) => {
        return {line, follows: i !== strings.length-1 && j === these_lines.length-1};
      });
    });
    if (!lines.length) return Ve.intercalate(strings, ...values);
    let commonPrefix = null;
    for (const {line, follows} of lines) {
      const prefix = line.match(/^[^\S\r\n\f]*/u)[0];
      if (!follows && prefix === line) continue; // no content
      if (!commonPrefix || commonPrefix.startsWith(prefix)) {
        commonPrefix = prefix;
      }
      if (!commonPrefix) break;
    }
    const replaced =
      commonPrefix === null ? strings.map(s => s.split('\n').map(_=>'').join('\n')) :
      strings.map(string => string.replaceAll('\n'+commonPrefix, '\n'));
    // If there is no content on the first line, remove it
    if (!replaced[0].split("\n")[0].trim())
      // https://forum.keyboardmaestro.com/t/regex-for-horizontal-whitespace-s-h-t-blank-etc/8287/12
      replaced[0] = replaced[0].replace(/^[^\S\r\n\f]*\n/, '');
    const last = replaced.length-1;
    // Trim the last line if it has no content but there is content in the string
    const last_lines = replaced[last].split('\n');
    if (commonPrefix !== null || values.length) {
      if (!last_lines[last_lines.length - 1].trim()) {
        replaced[last] = replaced[last].replace(/\n[^\S\r\n\f]*$/, '');
      }
    }
    return intercalate.raw({ raw: replaced }, ...values);
  };

  Ve.escape = {
    HTML: s => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;'),
    CSS: s => CSS.escape(s),
    JS: s => JSON.stringify(s),
    JSON: s => JSON.stringify(s),
  };

  //////////////////////////////////////////////////////////////////////////////

  return this;
}).call(Verity);
