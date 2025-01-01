This is a set up for designing and developing this program, combined with the live-reloading server in `../app.py` and the small build system in `./build.py`.

The HTML entrypoint is `embed.html`. This imports all of the JavaScript dependencies and adds a bit more structure.

The standalone HTML file is `../built/index.html`. This has no external dependencies.

## Bootstrap

The large picture is that there is an initial bootstrap script (`stage0.min.js`) which then becomes a full-blown HTML replicator (`stage1.js`, `stage2.js`) to copy all of the JavaScript, CSS, and basic HTML content across the WebRTC connection (instead of using HTTP). At this point, host and guest should essentially be identical and bootstrap is complete: it then calls into `app.js` to start the chat app.

`host.js` uses the `stage0.min.html` template to generate the bootstrap HTML, with the SDP and password interpolated into it. `stage0.min.js` works to establish the connection with `host.js`.

`stage0.min.js` leaves an `eval()` hook that the WebRTC connection can call, which is used to inject `stage1.js`.

`stage1.js` works across the host and guest to load the rest of the HTML's `head`.

Once all of the resources in `head` are loaded, it goes into `stage2.js` which is responsible for loading the HTML `body`. This is pretty simple too, it mostly just copies across each DOM element and its static attributes (not any dynamic properties, really), and re-forms the tree structure ... but it is nice to have access to utilities and helpers while doing it.

(Both stages could have more features added, but what they have is more than sufficient for the current state of things.)

`stage2.js` calls into `app.js` on the host and guest when it is done.

## Chat App

`app.js`, optional plugins in `app/*.js`
