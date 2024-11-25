const express = require("express");

const app = express();

// A map of the paths that clients are waiting on to an array of their response
// objects, to send the events on.
const listening = {};

// Try static files first
app.use(express.static(__dirname));
// If the path requested is not a static file:

// Create a `text/event-stream` response, which can transmit several events of
// data over long periods without timing out. Accessed via the `EventSource`
// API in JavaScript.
//
// GET requests will sit and listen for any POST requests to the same path,
// and each POST body will show up as a distinct event data in the `EventSource`.
app.get('*', function(req, res, next) {
  res.writeHead(200, {
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });
  const path = req.path;
  if (!listening[path])
    listening[path] = [];
  listening[path].push(res);
  res.on('close', () => {
    const idx = listening[path].indexOf(res);
    listening[path].splice(idx, 1);
    if (!listening[path].length)
      delete listening[path];
  });
});
// A POST event pushes its data to the active listeners
app.post('*', async function(req, res, next) {
  const path = req.path;
  req.setEncoding('utf-8');
  const content = await new Promise((resolve, reject) => {
    const chunks = [];

    // The POST body is async, so we have to drain it ...
    req.on('readable', () => {
      let chunk;
      while (null !== (chunk = req.read())) {
        chunks.push(chunk);
      }
    });

    req.on('error', reject);

    // ... and wait for it to finish
    req.on('end', () => {
      resolve(chunks.join(''));
    });
  });
  if (!(path in listening) || !listening[path].length) {
    res.status(404);
    return;
  }
  res.status(202);
  res.end();
  // The format is not well documented, but it consists of `data: ` prefixes on
  // each line, followed by a blank line to accept the event.
  // (It can also be preceded by an `event: ` type descriptor, unused here.)
  // (The spaces are optional: zero or one space is ignored, two spaces stands
  // for one space, etc.)
  const prefix = 'data: ';
  const wire = prefix + content.replaceAll('\n', '\n'+prefix) + '\n\n';

  // Broadcast this POST message to all clients currently listening
  if (listening[path]) {
    listening[path].forEach(pipe => pipe.write(wire));
  }
});

var port = 5167; // somewhat mneumonic
app.listen(port, function() {
  console.log("1:", "http://localhost:"+port+"/guest.html");
  console.log("2:", "http://localhost:"+port+"/host.html");
});
