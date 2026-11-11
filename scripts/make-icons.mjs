// make-icons.mjs: draws Fuel's app icon (a fuel gauge) as PNG and SVG files.
// Run with: node scripts/make-icons.mjs
// It uses only what comes with Node, so no extra tools are needed.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const INK = [0x13, 0x23, 0x3a];
const MANGO = [0xff, 0xb6, 0x27];
const TURF = [0x3f, 0xbf, 0x86];
const PAPER = [0xf2, 0xf5, 0xf0];

// Shapes in a 100 x 100 box. Arcs run along the top half of a circle.
const CX = 50;
const CY = 60;
const outer = { r: 30, w: 9, from: 180, to: 360 };   // gauge track (mango fills most of it)
const inner = { r: 18, w: 6, from: 180, to: 290 };   // green protein arc

function arcDistance(x, y, a) {
  const dx = x - CX;
  const dy = y - CY;
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (ang < 0) ang += 360;
  const inside = ang >= a.from && ang <= a.to;
  if (inside) return Math.abs(Math.hypot(dx, dy) - a.r) - a.w / 2;
  // Round end caps.
  const cap = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return Math.hypot(x - (CX + a.r * Math.cos(rad)), y - (CY + a.r * Math.sin(rad))) - a.w / 2;
  };
  return Math.min(cap(a.from), cap(a.to));
}

const cover = (d, px) => Math.max(0, Math.min(1, 0.5 - d / px));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function draw(size) {
  const px = 100 / size; // one pixel in shape units
  const rgba = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const x = (i + 0.5) * px;
      const y = (j + 0.5) * px;
      let c = INK;
      c = mix(c, PAPER.map((v, k) => v * 0.16 + INK[k] * 0.84), cover(arcDistance(x, y, outer), px));
      c = mix(c, MANGO, cover(arcDistance(x, y, { ...outer, to: 330 }), px));
      c = mix(c, TURF, cover(arcDistance(x, y, inner), px));
      // Needle dot in the middle.
      c = mix(c, PAPER, cover(Math.hypot(x - CX, y - CY) - 4.5, px));
      const o = (j * size + i) * 4;
      rgba[o] = Math.round(c[0]);
      rgba[o + 1] = Math.round(c[1]);
      rgba[o + 2] = Math.round(c[2]);
      rgba[o + 3] = 255;
    }
  }
  return png(size, rgba);
}

// ---- A tiny PNG writer ----

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}
function png(size, rgba) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; // bits per channel
  head[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j += 1) rgba.copy(rows, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- The SVG version (used as the browser tab icon) ----

function arcPath(a, to = a.to) {
  const p = (deg) => [CX + a.r * Math.cos((deg * Math.PI) / 180), CY + a.r * Math.sin((deg * Math.PI) / 180)].map((v) => v.toFixed(2)).join(' ');
  return `M${p(a.from)} A${a.r} ${a.r} 0 ${to - a.from > 180 ? 1 : 0} 1 ${p(to)}`;
}
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${hex(INK)}"/>
  <path d="${arcPath(outer)}" fill="none" stroke="${hex(PAPER.map((v, k) => v * 0.16 + INK[k] * 0.84))}" stroke-width="${outer.w}" stroke-linecap="round"/>
  <path d="${arcPath(outer, 330)}" fill="none" stroke="${hex(MANGO)}" stroke-width="${outer.w}" stroke-linecap="round"/>
  <path d="${arcPath(inner)}" fill="none" stroke="${hex(TURF)}" stroke-width="${inner.w}" stroke-linecap="round"/>
  <circle cx="${CX}" cy="${CY}" r="4.5" fill="${hex(PAPER)}"/>
</svg>
`;

mkdirSync('public', { recursive: true });
for (const size of [180, 192, 512]) writeFileSync(`public/icon-${size}.png`, draw(size));
writeFileSync('public/icon.svg', svg);
console.log('Made public/icon-180.png, icon-192.png, icon-512.png, icon.svg');
