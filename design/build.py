#!/usr/bin/env python3
import os
import sys
import html
import watchfiles
import asyncio
import json
from base64 import b64decode, b64encode
from jinja2 import Environment, FileSystemLoader

__file__=os.path.normpath(__file__)
root = os.path.dirname(os.path.dirname(__file__))
templates = os.path.join(root, 'design/templates/')

jinja = Environment(loader=FileSystemLoader(templates))

inputs = []
built = {}
def input(name):
  path = os.path.normpath(os.path.join(root, 'design', name))
  with open(path, 'r') as f:
    inputs.append(path)
    return f.read()
def output(name, text=None):
  if text is None:
    return lambda: built[name]
  with open(os.path.join(root, 'built', name), 'w') as f:
    f.write(text)

def toDataURI(content, mimetype='text/plain'):
  return f'data:{mimetype};base64,{b64encode(content.encode()).decode()}'
def toScript(content, **kw):
  return tag('script', content, **kw)
  return tag('script', src=toDataURI(content, 'text/javascript'), **kw)
def toStyle(content, **kw):
  return tag('style', content, **kw)
  return tag('link', rel='stylesheet', href=toDataURI(content, 'text/css'), type='text/css', **kw)

def tag(tagName, *children, **kw):
  if tagName in ['script','style'] and not len(children):
    children = ['']
  if 'className' in kw:
    kw['class'] = kw['className']
    del kw['className']
  attrs = ''.join(f' {k}="{html.escape(v)}"' for k, v in kw.items())
  start = f"<{tagName}{attrs}{'/' if not len(children) else ''}>"
  end = f"</{tagName}>" if len(children) else ''
  return [start, children, end]

DOCTYPE = '<!DOCTYPE html>'
CHARSET = tag('meta', charset='utf-8')

def plans():
  dynamic = {}
  for f in os.listdir(templates):
    dynamic[f] = jinja.get_template(f).render
  static = {
    'stage0.min.html': [
      DOCTYPE,
      # CHARSET,
      tag('meta', name='viewport', content="width=device-width,initial-scale=1.0"),
      lambda: tag('script', output('stage0.min.js')()),
    ],
    'index.html': [
      DOCTYPE,
      tag('html', [
        tag('head', [
          CHARSET,
          # viewport-fit=cover???
          tag('meta', name='viewport', content="width=device-width,initial-scale=1.0"),
          toScript(input('stage1.js'), className='stage1'),
          toStyle(input('index.css')),
          """<!--
            Copyright 2024 Verity J.S.

            Licensed under the Apache License, Version 2.0 (the "License");
            you may not use this file except in compliance with the License.
            You may obtain a copy of the License at

                http://www.apache.org/licenses/LICENSE-2.0

            Unless required by applicable law or agreed to in writing, software
            distributed under the License is distributed on an "AS IS" BASIS,
            WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
            See the License for the specific language governing permissions and
            limitations under the License.
          -->""",
          [
            toScript(input(src)) for src in
            [
              'utils.js',
              'debug.js',
              'scroll.js',
              'verity.js',
              'upload.js',

              'app.js',
              *[os.path.join('app', p) for p in os.listdir(os.path.join(root, 'design', 'app'))],

              'media.js',
              'stage2.js',
              'host/to_guest.js',
              'host/from_guest.js',
              'host/ui.js',
              'host.js',
              'zxing.min.js',
            ]
          ]
        ]),
        tag('body', [
          output('app.html'),
          lambda: r"""
            <script class="host-only">
              // Base64 encode as a way to avoid problems with the closing script tag in the source
              window.getTemplate = () => atob("""+json.dumps(b64encode(output('stage0.min.html')().encode()).decode())+""");
            </script>
          """,
        ])
      ])
    ]
  }
  dynamic.update(static)
  return dynamic

def evaluate(plan):
  text = ''
  if callable(plan):
    plan = plan()
  if isinstance(plan, str):
    text += plan
  else:
    for value in plan:
      text += evaluate(value)
  return text

def build():
  global built
  built = {}
  for name, plan in plans().items():
    text = evaluate(plan)
    built[name] = text
    output(name, text)

async def building():
  print("Watching ...")
  build()
  def watch_filter(_, changed):
    return changed==__file__ or changed in inputs or changed.startswith(templates)
  async for notifs in watchfiles.awatch(root, recursive=True, watch_filter=watch_filter):
    for notif in notifs:
      if notif[1] == __file__:
        return os.execv(__file__, sys.argv)
    print("build")
    build()

if __name__ == '__main__':
  asyncio.run(building())
