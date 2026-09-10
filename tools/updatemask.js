#!/usr/bin/env node
/* updatemask.js — mask.png is the source; the rest of the piece follows it.

   The page never reads mask.png. It reads mask.raw (one grey byte per mask
   pixel, row by row, no header) and, when index.html is opened straight from
   disk where fetch is refused, the base64 copy of those same bytes in
   mask-data.js. Both are generated here — together with the two grid constants,
   W and H, that a headerless raw cannot carry.

   Usage: node tools/updatemask.js [image.png]       (default: mask.png)
          It works from any directory: paths come from __dirname, never from the
          current one. An argument that exists where you are is used as given; a
          bare name is looked up next to the piece.

   It reads the source and always writes inside site/src/mask/, next to the
   piece:
     mask.png       the source you replace (the argument overrides it)
     mask.raw       generated: the raw pixels, ink is dark
     mask-data.js   generated: the same bytes embedded, so file:// keeps working
     mask.js        only its `var W` / `var H` lines, and only if they moved

   No dependencies: the PNG is decoded here. 8 and 16 bit, greyscale / RGB /
   greyscale+alpha / RGBA, non-interlaced. Transparency is composited over
   white, because paper is what sits behind a mask. */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');                 // the project root
const PIECE = path.join(ROOT, 'site', 'src', 'mask');      // the piece's folder
const RAW = path.join(PIECE, 'mask.raw');
const DATA = path.join(PIECE, 'mask-data.js');
const SCRIPT = path.join(PIECE, 'mask.js');
const WRAP = 96;   // base64 characters per line in the generated file

/* The source. A path that exists where you are is used as given — absolute or
   relative; a bare name is looked up next to the piece. Output always lands in
   the piece's folder, wherever you called from: its data lives with it. */
const ARG = process.argv[2];
const SRC = !ARG ? path.join(PIECE, 'mask.png')
  : fs.existsSync(path.resolve(ARG)) ? path.resolve(ARG)
  : path.resolve(PIECE, ARG);

/* ---------- PNG ---------- */

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const SAMPLES = { 0: 1, 2: 3, 4: 2, 6: 4 };   // meaningful samples per pixel

function fail(message) {
  console.error('updatemask: ' + message);
  process.exit(1);
}

function decode(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    fail(path.basename(file) + ' is not a PNG. Convert it first: the page wants a flat mask, not a layered file.');
  }

  let p = 8;
  let w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];

  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);

    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
      if (data[12] !== 0) fail('mask.png is interlaced (Adam7), which this decoder does not read. Re-export it non-interlaced.');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len;
  }

  if (!w || !h) fail('mask.png has no readable header.');
  if (depth !== 8 && depth !== 16) fail('bit depth ' + depth + ' is not supported; use 8 or 16.');
  if (!CHANNELS[ctype] || ctype === 3) fail('colour type ' + ctype + ' is not supported; use greyscale, RGB, greyscale+alpha or RGBA.');

  const channels = CHANNELS[ctype];
  const bpp = channels * (depth / 8);          // filter offset, in bytes
  const stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * h) fail('mask.png is truncated.');

  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const cur = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));

    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];

      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (filter !== 0) {
        fail('mask.png uses filter ' + filter + ', which does not exist.');
      }
      cur[i] = v & 255;
    }

    cur.copy(out, y * stride);
    prev = cur;
  }

  return { w, h, depth, ctype, channels, data: out };
}

/* One byte per pixel, the mask's own grey, with alpha laid on paper. */
function grayscale(img) {
  const { w, h, depth, ctype, channels, data } = img;
  const samples = SAMPLES[ctype];
  const step = depth === 16 ? 2 : 1;   // 16 bit: the high byte is plenty for a mask
  const g = new Uint8Array(w * h);

  for (let i = 0, o = 0; i < w * h; i++, o += channels * step) {
    let r, gg, b, alpha = 255;

    if (samples === 1) {
      r = gg = b = data[o];
    } else if (samples === 2) {
      r = gg = b = data[o];
      alpha = data[o + step];
    } else {
      r = data[o];
      gg = data[o + step];
      b = data[o + 2 * step];
      if (samples === 4) alpha = data[o + 3 * step];
    }

    const lum = (r * 77 + gg * 150 + b * 29) >> 8;
    g[i] = alpha === 255 ? lum : (lum * alpha + 255 * (255 - alpha)) / 255 | 0;
  }

  return g;
}

/* ---------- writing ---------- */

function dataFile(bytes) {
  const b64 = Buffer.from(bytes).toString('base64');
  const lines = [];
  for (let i = 0; i < b64.length; i += WRAP) lines.push("  '" + b64.slice(i, i + WRAP) + "',");

  return [
    '/* mask.raw, embedded. Generated by tools/updatemask.js from mask.png —',
    '   do not edit this file.',
    '',
    '   The same bytes as mask.raw, next to it: one grey byte per mask pixel, row',
    '   by row, no header. The page fetches mask.raw first and only falls back to',
    '   this copy when it cannot — which is what happens when index.html is opened',
    '   straight from disk, because file:// refuses a sibling fetch.',
    '',
    '   Regenerate after changing mask.png:  node tools/updatemask.js */',
    'window.MASK_RAW = [',
    ...lines,
    "].join('');",
    ''
  ].join('\n');
}

/* The two constants a headerless raw file cannot carry, kept in step with the
   image the raw came from. Returns true when a line moved. */
function patchGrid(w, h) {
  if (!fs.existsSync(SCRIPT)) return false;
  const text = fs.readFileSync(SCRIPT, 'utf8');
  const next = text
    .replace(/^(\s*var W = )\d+(;)/m, '$1' + w + '$2')
    .replace(/^(\s*var H = )\d+(;)/m, '$1' + h + '$2');

  if (next === text) return false;
  fs.writeFileSync(SCRIPT, next);
  return true;
}

/* ---------- run ---------- */

if (!fs.existsSync(SRC)) fail(path.basename(SRC) + ' not found in site/src/mask/.');

const img = decode(SRC);
const bytes = grayscale(img);

let ink = 0;
for (let i = 0; i < bytes.length; i++) if (bytes[i] < 128) ink++;

let runs = 0;
for (let y = 0; y < img.h; y++) {
  let x = 0;
  while (x < img.w) {
    if (bytes[y * img.w + x] < 128) {
      while (x < img.w && bytes[y * img.w + x] < 128) x++;
      runs++;
    } else {
      x++;
    }
  }
}

if (ink === 0) fail('mask.png is entirely paper: there is nothing to draw.');
if (ink === bytes.length) fail('mask.png is entirely ink: there is nothing to read.');

fs.writeFileSync(RAW, Buffer.from(bytes));
fs.writeFileSync(DATA, dataFile(bytes));
const moved = patchGrid(img.w, img.h);

const shared = (ink / bytes.length * 100).toFixed(1);
const shown = path.relative(ROOT, SRC);
console.log(
  (shown.indexOf('..') === 0 ? SRC : shown) + ' ' + img.w + 'x' + img.h + ' (' + img.depth + ' bit, colour type ' + img.ctype + ')'
  + ' -> mask.raw ' + bytes.length + ' bytes, ' + ink + ' ink (' + shared + '%), ' + runs + ' runs'
  + '\n  mask-data.js written, ' + bytes.length + ' bytes embedded'
  + (moved ? '\n  mask.js: grid updated to W = ' + img.w + ', H = ' + img.h : '\n  mask.js: grid already ' + img.w + 'x' + img.h)
);
