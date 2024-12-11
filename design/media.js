// https://source.chromium.org/chromium/chromium/src/+/main:net/base/mime_util.cc;l=675-743;drc=482a810cb3635f84e6a9e74b6a64ecbe7acaa897

const kStandardImageTypes = [
  "image/avif",
  "image/bmp",
  "image/cis-cod",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/ief",
  "image/jpeg",
  "image/webp",
  "image/pict",
  "image/pipeg",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "image/vnd.microsoft.icon",
  "image/x-cmu-raster",
  "image/x-cmx",
  "image/x-icon",
  "image/x-portable-anymap",
  "image/x-portable-bitmap",
  "image/x-portable-graymap",
  "image/x-portable-pixmap",
  "image/x-rgb",
  "image/x-xbitmap",
  "image/x-xpixmap",
  "image/x-xwindowdump",
];
const kStandardAudioTypes = [
  "audio/aac",
  "audio/aiff",
  "audio/amr",
  "audio/basic",
  "audio/flac",
  "audio/midi",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpeg3",
  "audio/ogg",
  "audio/vorbis",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-ms-wma",
  "audio/vnd.rn-realaudio",
  "audio/vnd.wave",
];
// https://tools.ietf.org/html/rfc8081
const kStandardFontTypes = [
  "font/collection", "font/otf",  "font/sfnt",
  "font/ttf",        "font/woff", "font/woff2",
];
const kStandardVideoTypes = [
  "video/avi",
  "video/divx",
  "video/flc",
  "video/mp4",
  "video/mpeg",
  "video/ogg",
  "video/quicktime",
  "video/sd-video",
  "video/webm",
  "video/x-dv",
  "video/x-m4v",
  "video/x-mpeg",
  "video/x-ms-asf",
  "video/x-ms-wmv",
];
const kStandardTypes = Object.assign([
  ...kStandardImageTypes,
  ...kStandardAudioTypes,
  ...kStandardFontTypes,
  ...kStandardVideoTypes,
], {
  "image": kStandardImageTypes,
  "audio": kStandardAudioTypes,
  "font": kStandardFontTypes,
  "video": kStandardVideoTypes,
});
