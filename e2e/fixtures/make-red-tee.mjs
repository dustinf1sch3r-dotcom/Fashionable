// Generates e2e/fixtures/red-tee-600x800.png: a red T-shirt silhouette with soft shading and fabric
// noise on a light grey backdrop, 600x800. Used to check background removal end to end.
// Run: node e2e/fixtures/make-red-tee.mjs
// A shorter photo cuts the tee off at the bottom edge (the capture hint test):
//   node e2e/fixtures/make-red-tee.mjs 450 red-tee-cutoff-600x450.png
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const WIDTH = 600;
const HEIGHT = Number(process.argv[2] ?? 800);
const OUT = process.argv[3] ?? 'red-tee-600x800.png';
const SUPER = 3; // samples per axis for anti-aliased edges

// Clockwise outline of a T-shirt: neckline, right shoulder and sleeve, body, left sleeve.
const SHIRT = [
  [232, 112],
  [262, 152],
  [300, 170],
  [338, 152],
  [368, 112],
  [432, 136],
  [548, 238],
  [500, 314],
  [436, 268],
  [436, 700],
  [164, 700],
  [164, 268],
  [100, 314],
  [52, 238],
  [168, 136],
];

function inside(x, y) {
  let c = false;
  for (let i = 0, j = SHIRT.length - 1; i < SHIRT.length; j = i++) {
    const [xi, yi] = SHIRT[i];
    const [xj, yj] = SHIRT[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Deterministic fabric noise, no Math.random so the file is reproducible.
const noise = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xff) / 255 - 0.5;
};

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (WIDTH * 3 + 1)] = 0; // filter: none
  for (let x = 0; x < WIDTH; x++) {
    let cover = 0;
    for (let sy = 0; sy < SUPER; sy++) {
      for (let sx = 0; sx < SUPER; sx++) {
        if (inside(x + (sx + 0.5) / SUPER, y + (sy + 0.5) / SUPER)) cover++;
      }
    }
    const a = cover / (SUPER * SUPER);
    // Backdrop: light grey with a gentle vignette and a faint floor shadow under the hem.
    const vignette = 1 - 0.08 * Math.hypot((x - 300) / 300, (y - 400) / 400);
    let bg = 222 * vignette + noise(x, y) * 4;
    if (y > 700 && y < 730 && x > 150 && x < 450) bg -= (1 - (y - 700) / 30) * 22;
    // Shirt: red, darker towards the sides, slight vertical folds.
    const side = Math.abs(x - 300) / 250;
    const fold = Math.sin(x / 23 + y / 90) * 5;
    const shade = 1 - 0.28 * side * side + fold / 255;
    const px = [200, 32, 44].map((c) => c * shade + noise(x + 7, y + 3) * 14);
    const o = y * (WIDTH * 3 + 1) + 1 + x * 3;
    for (let c = 0; c < 3; c++) raw[o + c] = clamp(px[c] * a + bg * (1 - a));
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: RGB

writeFileSync(
  new URL(`./${OUT}`, import.meta.url),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
