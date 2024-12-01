// The idea of this runtime is that it has (mutable?) JSON state, so it is
// able to be serialised and sent over the wire, or saved to an HTML file.
// It still needs some JavaScript runtime access (such as window and DOM APIs),
// but aside from that, the only real active state are the communications
// channel(s). Everything else will be static functions that operate on the
// runtime state.
var runtime = {
  data: {
    local: {
      id: undefined,
      private: undefined,
    },
    store: {
      // key "key1.key2.key3"
      // intent: 'unified' | 'shared' | 'broadcast' | 'private'
      // transport: 'push' | 'lazy-push' | 'pull'
      // schema?
      // resolver (hmm ... associative ids resolution?)
      // value: JSON
      // uid: int32
      // conflicts[]: [ { value, seen: { peer, uid }[] } ]
    },
  },
  interface: {
    window,
    document,
    comms: {
      channel: null,
      send: (msg) => {},
      receive: (cb) => () => {},
    },
  },
};

// Part of the initial QR code, set up a comms channel based on an SDP offer
function setupComms(offer) {}
// First thing to happen after it establishes a connection and sends the first
// JavaScript bundle across. This will tear down all of the side-effects of
// `setupComms()` and preserve the comms channel to establish new listeners
// to finish streaming resources and then migrate to a normal flow of information.
function commsToLoader(comms) {}
// Now that resources are loaded, set up listeners for the normal flow of information.
function loadedRuntime(runtime) {}
// Create a blank runtime
function blankRuntime() {}
// Create a new comms host from a context with fully loaded assets?
function newComms() {}
// Save it out as an HTML page with all resources and data bundled
function toHTML() {}

// HTML layout: everything needed for bootstrapping is injected inline.
// Additionally there are some dynamic elements that are not sent over the wire:
// if the client needs them, they will recreate them from the JSON state.
var assetTypes = {
  script: {
    send: () => {},
    load: () => {},
  },
  style: {
    send: () => {},
    load: () => {},
  },
};

// Hmm i was thinking of having a static (non-executed) JavaScript template
// with the offer ... but i see no reason that it needs to be stored in a
// `<script>` tag instead of as a literal in the already delivered JavaScript.
