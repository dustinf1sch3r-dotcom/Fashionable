#!/usr/bin/env node
/**
 * Makes "floor photo" versions of three garment fixtures for the real-photo trial: the cut-out
 * is placed on a slightly textured grey, an off-white and a wood-coloured floor, with margin, a
 * soft shadow and a little sensor noise, like a garment laid flat and photographed.
 *
 *   node scripts/make-floor-photos.mjs <outDir>
 *
 * Writes <outDir>/<fixture>-<floor>.png. Deterministic (no randomness). No dependencies.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const outDir = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!outDir) {
  console.error('usage: node scripts/make-floor-photos.mjs <outDir>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const SRC = new URL('../e2e/fixtures/garments/', import.meta.url);

function decode(file) {
  const buf = readFileSync(file);
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      type = body[9];
    } else if (name === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  if (type !== 6) throw new Error('expected RGBA fixtures');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 4 ? px[y * stride + i - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= 4 ? px[(y - 1) * stride + i - 4] : 0;
      let v;
      if (f === 0) v = x;
      else if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      px[y * stride + i] = v & 255;
    }
  }
  return { w, h, px };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encode(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.subarray(y * w * 3, (y + 1) * w * 3)).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const noise = (x, y) => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};
const FLOORS = {
  textured: (x, y) => {
    const n = noise(x, y) * 7 + noise(x >> 3, y >> 3) * 5;
    return [158 + n, 156 + n, 154 + n];
  },
  offwhite: (x, y) => {
    const n = noise(x, y) * 2;
    return [244 + n, 242 + n, 236 + n];
  },
  wood: (x, y) => {
    const g = Math.sin(y * 0.22 + noise(x >> 4, 0) * 3) * 7 + noise(x, y) * 4;
    return [156 + g, 112 + g, 72 + g];
  },
};
const JOBS = [
  ['dress-green', 'wood'],
  ['jeans-dark', 'offwhite'],
  ['jacket-denim', 'textured'],
];
const MARGIN = 0.18;
const SHADOW = { dx: 5, dy: 7, blur: 5, strength: 0.1 };

for (const [name, floor] of JOBS) {
  const { w, h, px } = decode(new URL(`${name}.png`, SRC));
  const mx = Math.round(w * MARGIN);
  const my = Math.round(h * MARGIN);
  const W = w + 2 * mx;
  const H = h + 2 * my;
  const alpha = new Float32Array(W * H);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) alpha[(y + my) * W + x + mx] = px[(y * w + x) * 4 + 3] / 255;
  // Shadow: the alpha shifted and box-blurred.
  const shadow = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let j = -SHADOW.blur; j <= SHADOW.blur; j++) {
        for (let i = -SHADOW.blur; i <= SHADOW.blur; i++) {
          const sx = x - SHADOW.dx + i;
          const sy = y - SHADOW.dy + j;
          n++;
          if (sx >= 0 && sy >= 0 && sx < W && sy < H) sum += alpha[sy * W + sx];
        }
      }
      shadow[y * W + x] = sum / n;
    }
  }
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const bg = FLOORS[floor](x, y);
      const k = 1 - SHADOW.strength * shadow[y * W + x];
      const a = alpha[y * W + x];
      const gx = x - mx;
      const gy = y - my;
      for (let c = 0; c < 3; c++) {
        const g = gx >= 0 && gy >= 0 && gx < w && gy < h ? px[(gy * w + gx) * 4 + c] : 0;
        const v = g * a + bg[c] * k * (1 - a) + noise(x + 11, y + c) * 1.5;
        rgb[(y * W + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  const file = join(outDir, `${name}-${floor}.png`);
  writeFileSync(file, encode(W, H, rgb));
  console.log(file);
}
