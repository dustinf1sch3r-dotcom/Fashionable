// Generates e2e/fixtures/navy-200x300.png: a solid navy (#1f2a5c) 200x300 PNG.
// Run: node e2e/fixtures/make-navy-tee.mjs
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const WIDTH = 200;
const HEIGHT = 300;
const RGB = [0x1f, 0x2a, 0x5c];

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

const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(WIDTH).fill(RGB).flat())]);
const raw = Buffer.concat(Array(HEIGHT).fill(row));

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(new URL('./navy-200x300.png', import.meta.url), png);
