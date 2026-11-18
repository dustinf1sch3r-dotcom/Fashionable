import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import type { RigKind } from '../model/types';
import type { AlphaMask } from './contract';

/** The real garment cutouts the e2e tests and the fit gallery use (e2e/fixtures/garments). */
export const FIXTURE_DIR = join(process.cwd(), 'e2e/fixtures/garments');

export const FIXTURE_KIND: Record<string, RigKind> = {
  'tee-navy': 'top',
  'tee-white': 'top',
  'shirt-blue': 'top',
  'jacket-denim': 'top',
  'jeans-dark': 'trousers',
  'trousers-grey': 'trousers',
  'skirt-olive': 'skirt',
  'dress-green': 'dress',
};

/** Minimal PNG reader (8-bit, non-interlaced, any colour type) returning the alpha channel. */
export function decodePngAlpha(bytes: Uint8Array): AlphaMask {
  const buf = Buffer.from(bytes);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Buffer | undefined;
  let trns: Buffer | undefined;
  const data: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8] as number;
      colorType = body[9] as number;
      interlace = body[12] as number;
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error('unsupported PNG (need 8-bit, no interlace)');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] as number;
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] as number;
      const a = i >= channels ? (rows[y * stride + i - channels] as number) : 0;
      const b = y > 0 ? (rows[(y - 1) * stride + i] as number) : 0;
      const c = y > 0 && i >= channels ? (rows[(y - 1) * stride + i - channels] as number) : 0;
      let v: number;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      rows[y * stride + i] = v & 255;
    }
  }
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (colorType === 6) alpha[i] = rows[i * 4 + 3] as number;
    else if (colorType === 4) alpha[i] = rows[i * 2 + 1] as number;
    else if (colorType === 3) alpha[i] = trns ? (trns[rows[i] as number] ?? 255) : 255;
    else alpha[i] = 255;
  }
  void palette;
  return { width, height, alpha };
}

/** Alpha mask of one fixture by name (file name without `.png`). */
export function fixtureMask(name: string): AlphaMask {
  return decodePngAlpha(readFileSync(join(FIXTURE_DIR, `${name}.png`)));
}
