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

@app.get("/<path:filename>")
async def static(filename):
    resp = await quart.send_from_directory(".", filename)
    resp.headers.add("Cache-Control", "no-cache, no-store, must-revalidate")
    resp.headers.add("Pragma", "no-cache")
    resp.headers.add("Expires", "0")
    return resp

