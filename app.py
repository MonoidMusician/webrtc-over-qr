import quart
from quart import Quart, request, websocket
from werkzeug.datastructures import Headers
from hypercorn.typing import Scope

import os
import watchfiles

import re
import urllib
from urllib.request import urlopen
from urllib.parse import urlparse
from base64 import b64encode

# Remove the static route
app = Quart(__name__, static_folder=None)
app.config.from_prefixed_env()

@app.get("/")
async def index():
    return quart.redirect('/design/embed.html')

@app.websocket("/watch/<path:path>")
async def watching(path):
    await websocket.accept()
    resolved = os.path.abspath(path)
    # print(path, resolved)
    watch_filter = lambda _, changed: changed==resolved or changed.startswith(resolved + "/")
    async for notifs in watchfiles.awatch('.', path, recursive=path.endswith("/"), watch_filter=watch_filter):
        for notif in notifs:
            change_type, changed = notif
            if changed == resolved:
                changed = "/" + os.path.normpath(path).rstrip("/")
            elif changed.startswith(resolved + "/"):
                changed = "/" + os.path.normpath(path).rstrip("/") + "/" + changed[len(resolved + "/"):]
            else: changed = "/" # should not happen
            await websocket.send(changed)

# A proxy path to escalate permissions on `data:` so we can fetch files
# (instead of baking them into the served HTML)
@app.get("/data:<path:_filename>")
async def dataURI(_filename):
    uri = request.path.lstrip('/')
    if uri.startswith(pre := 'data:text/html,'):
        uri = uri[len(pre):]
        return urllib.parse.unquote(uri)
    else:
        with urlopen(uri) as rawdata:
            resp = await quart.make_response(rawdata.getvalue())
            for hd, vl in rawdata.headers.items():
                resp.headers.remove(hd)
                resp.headers.add(hd, vl)
            return resp

@app.get("/<path:filename>")
async def static(filename):
    resp = await quart.send_from_directory(".", filename)
    resp.headers.add("Cache-Control", "no-cache, no-store, must-revalidate")
    resp.headers.add("Pragma", "no-cache")
    resp.headers.add("Expires", "0")
    return resp

def add_dataURI(fn):
    async def wrapped(scope: Scope, receive, send, *args, **kwargs):
        if scope['type'] == 'http':
            if scope['raw_path'].startswith(b'/data:'):
                query = b'?'+scope['query_string'] if scope['query_string'] else b''
                uri = (scope['raw_path']+query).decode()
                scope['path'] = uri
                scope['raw_path'] = scope['path'].encode()
                scope['query_string'] = b''
                # print(scope, receive, send)
        return await fn(scope, receive, send, *args, **kwargs)
    return wrapped

app.asgi_app = add_dataURI(app.asgi_app)

