import { createRng } from '../engine/rng';
import type { RGBAImage } from './types';

export function solid(
  w: number,
  h: number,
  rgba: readonly [number, number, number, number],
): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
}

export function fill(
  w: number,
  h: number,
  f: (x: number, y: number) => readonly [number, number, number, number],
): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(f(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
}

/** Solid image plus seeded roughly-Gaussian noise of the given sigma. */
export function noisy(
  w: number,
  h: number,
  rgb: readonly [number, number, number],
  sigma: number,
  seed = 1,
): RGBAImage {
  const rng = createRng(seed);
  return fill(w, h, () => {
    const n = (rng.next() + rng.next() + rng.next() - 1.5) * 2 * sigma;
    return [rgb[0] + n, rgb[1] + n, rgb[2] + n, 255];
  });
}

export function px(img: RGBAImage, x: number, y: number): [number, number, number, number] {
  const p = (y * img.width + x) * 4;
  const d = img.data;
  return [d[p] as number, d[p + 1] as number, d[p + 2] as number, d[p + 3] as number];
}

export function meanRect(
  img: RGBAImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ch = 0,
): number {
  let s = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      s += img.data[(y * img.width + x) * 4 + ch] as number;
      n++;
    }
  }
  return s / n;
}
