"use strict";
app.registerModule(function textModule({ sendMessage }) {
  const { HTML } = Ve;
  const messageTypes = {
    'code': ({ content }) => HTML.pre(HTML.code(content)),
    'italic': ({ content }) => HTML.i(content),
    'bold': ({ content }) => HTML.b(content),
    'bolditalic': ({ content }) => HTML.b(HTML.i(content)),
    'quote': ({ content }) => HTML.blockquote(content),
    'strikethrough': ({ content }) => HTML.s(content),
    'link': ({ href, content }) => HTML.a({ href }, String(content || href)),
  };
  const commands = {
    'code': ['Send code formatting', content => content && sendMessage.code(content)],
    'italic': ['Send italic formatting', content => content && sendMessage.italic(content), { aliases: ['i'] }],
    'bold': ['Send bold formatting', content => content && sendMessage.bold(content), { aliases: ['b'] }],
    'bolditalic': ['Send bold italic formatting', content => content && sendMessage.bolditalic(content), { aliases: ['bi'] }],
    'quote': ['Send quote formatting', content => content && sendMessage.bolditalic(content), { aliases: ['q', 'blockquote'] }],
    'strikethrough': ['Send strikethrough formatting', content => content && sendMessage.strikethrough(content), { aliases: ['s', 'strike'] }],
    'escape': [
      Ve.StringOnDemand(() => `Escape a message (which might start with ${JSON.stringify(cmdpre)})`),
      (_,original) => sendMessage(original.replace(cmdpre+'escape ','')),
      { get aliases() {return [cmdpre]} },
    ],
    'link': ['Send a link', href => href && sendMessage.link({ href }), { aliases: ['url', 'href'] }],
  };

  var shrug = String.raw`¯\_(ツ)_/¯`;
  const replacements = {
    'shrug': ['Just a shrug emoticon ' + shrug, shrug],
  };
  for (const name in replacements) {
    const [help, replacement] = replacements[name];
    commands[name] = [help, (_,original) => sendMessage(original.replaceAll('/'+name, replacement))];
  }
  return { messageTypes, commands };
});
