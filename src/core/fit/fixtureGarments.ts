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

/** Decoded PNG pixels: row-major RGBA, 4 bytes per pixel. */
export interface PngPixels {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/** Minimal PNG reader (8-bit, non-interlaced, any colour type) returning the alpha channel. */
export function decodePngAlpha(bytes: Uint8Array): AlphaMask {
  const { width, height, rgba } = decodePngPixels(bytes);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] as number;
  return { width, height, alpha };
}

/** Minimal PNG reader (8-bit, non-interlaced, any colour type) returning RGBA pixels. */
export function decodePngPixels(bytes: Uint8Array): PngPixels {
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
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r: number;
    let g: number;
    let b: number;
    let a = 255;
    if (colorType === 6) {
      [r, g, b, a] = [rows[i * 4], rows[i * 4 + 1], rows[i * 4 + 2], rows[i * 4 + 3]] as number[];
    } else if (colorType === 4) {
      r = g = b = rows[i * 2] as number;
      a = rows[i * 2 + 1] as number;
    } else if (colorType === 3) {
      const k = rows[i] as number;
      const pal = palette as Buffer;
      [r, g, b] = [pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2]] as number[];
      a = trns ? (trns[k] ?? 255) : 255;
    } else if (colorType === 2) {
      [r, g, b] = [rows[i * 3], rows[i * 3 + 1], rows[i * 3 + 2]] as number[];
    } else {
      r = g = b = rows[i] as number;
    }
    rgba.set([r, g, b, a], i * 4);
  }
  return { width, height, rgba };
}

/** RGBA pixels of one fixture by name. */
export function fixturePixels(name: string): PngPixels {
  return decodePngPixels(readFileSync(join(FIXTURE_DIR, `${name}.png`)));
}

/** Alpha mask of one fixture by name (file name without `.png`). */
export function fixtureMask(name: string): AlphaMask {
  return decodePngAlpha(readFileSync(join(FIXTURE_DIR, `${name}.png`)));
}
