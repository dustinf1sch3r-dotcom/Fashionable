import { boxBlur, gaussianBlur } from './filters';
import type { Plane } from './filters';
import { COMPOSITE_RULES } from './rules';
import type { RGBAImage } from './types';

// A module-level alias: global `Math` lookups are very slow inside Jest's sandbox, which matters in hot loops.
const M = Math;

const R = COMPOSITE_RULES.stats;

export interface PhotoStats {
  /** Illuminant multipliers per channel (luminance-neutral, within 1 ± castClamp). */
  cast: readonly [number, number, number];
  /** Median luminance, 0..1. */
  exposure: number;
  /** Noise standard deviation in 0..255 levels (0 when no flat region is found). */
  noise: number;
  /** Gradient energy ratio vs a blurred copy: about 1 is blurry, larger is sharper. */
  sharpness: number;
}

/** Luminance plane (0..255, Rec. 709 weights on sRGB values). */
export function luminancePlane(img: RGBAImage): Plane {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  const d = img.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    out[i] =
      0.2126 * (d[p] as number) + 0.7152 * (d[p + 1] as number) + 0.0722 * (d[p + 2] as number);
  }
  return out;
}

function strideFor(n: number): number {
  return M.max(1, M.floor(M.sqrt(n / R.sampleTarget)));
}

/** Robust grey-world illuminant: ignores near-black, near-white and saturated pixels. */
export function estimateCast(img: RGBAImage): [number, number, number] {
  const { width: w, height: h, data: d } = img;
  const step = strideFor(w * h);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const p = (y * w + x) * 4;
      if ((d[p + 3] as number) < R.minAlpha) continue;
      const r = d[p] as number;
      const g = d[p + 1] as number;
      const b = d[p + 2] as number;
      const mx = M.max(r, g, b);
      const mn = M.min(r, g, b);
      if (mx > R.nearWhite || mn < R.nearBlack) continue;
      if ((mx - mn) / mx > R.maxSaturation) continue;
      sr += r;
      sg += g;
      sb += b;
      count++;
    }
  }
  if (count < 16) return [1, 1, 1];
  const mean = (sr + sg + sb) / 3;
  const lo = 1 - R.castClamp;
  const hi = 1 + R.castClamp;
  const clamp = (v: number): number => M.min(hi, M.max(lo, v));
  let c = [clamp(sr / mean), clamp(sg / mean), clamp(sb / mean)];
  const lum = 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
  c = c.map((v) => clamp(v / lum));
  return [c[0] as number, c[1] as number, c[2] as number];
}

/** Median luminance (0..1) of the photo's opaque pixels. */
export function estimateExposure(img: RGBAImage): number {
  const { width: w, height: h, data: d } = img;
  const step = strideFor(w * h);
  const hist = new Uint32Array(256);
  let count = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const p = (y * w + x) * 4;
      if ((d[p + 3] as number) < R.minAlpha) continue;
      const l =
        0.2126 * (d[p] as number) + 0.7152 * (d[p + 1] as number) + 0.0722 * (d[p + 2] as number);
      hist[M.min(255, M.round(l))]++;
      count++;
    }
  }
  if (count === 0) return COMPOSITE_RULES.colour.exposureReference;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i] as number;
    if (acc * 2 >= count) return i / 255;
  }
  return 1;
}

function median(values: Float32Array, n: number): number {
  const a = values.slice(0, n).sort();
  return n % 2 ? (a[(n - 1) / 2] as number) : ((a[n / 2 - 1] as number) + (a[n / 2] as number)) / 2;
}

/** Noise sigma (levels): MAD of a 3x3 high-pass on flat regions. */
export function estimateNoise(lum: Plane, w: number, h: number): number {
  if (w < 9 || h < 9) return 0;
  const m = boxBlur(lum, w, h, 1);
  const step = strideFor(w * h);
  const hp = new Float32Array(M.ceil(w / step) * M.ceil(h / step));
  let n = 0;
  for (let y = 3; y < h - 3; y += step) {
    for (let x = 3; x < w - 3; x += step) {
      const i = y * w + x;
      const g =
        M.abs((m[i + 3] as number) - (m[i - 3] as number)) +
        M.abs((m[i + 3 * w] as number) - (m[i - 3 * w] as number));
      if (g >= R.flatGradient) continue;
      hp[n++] = (lum[i] as number) - (m[i] as number);
    }
  }
  if (n < R.minFlatPixels) return 0;
  const med = median(hp, n);
  const dev = new Float32Array(n);
  for (let i = 0; i < n; i++) dev[i] = M.abs((hp[i] as number) - med);
  const mad = median(dev, n);
  // The 3x3 mean removes 1/9 of the variance: residual sigma = sigma * sqrt(8/9).
  return (1.4826 * mad) / M.sqrt(8 / 9);
}

function gradientEnergy(p: Plane, w: number, h: number): number {
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      sum +=
        M.abs((p[i + 1] as number) - (p[i - 1] as number)) +
        M.abs((p[i + w] as number) - (p[i - w] as number));
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Gradient energy of the photo divided by that of a blurred copy (>= about 1). */
export function estimateSharpness(lum: Plane, w: number, h: number): number {
  if (w < 3 || h < 3) return 1;
  const blurred = gaussianBlur(lum, w, h, R.sharpnessBlurSigma);
  const gb = gradientEnergy(blurred, w, h);
  if (gb < 1e-6) return 1;
  return gradientEnergy(lum, w, h) / gb;
}

/** All photo statistics (computed once per composite). `lum` may be passed to avoid recomputing it. */
export function analysePhoto(img: RGBAImage, lum: Plane = luminancePlane(img)): PhotoStats {
  return {
    cast: estimateCast(img),
    exposure: estimateExposure(img),
    noise: estimateNoise(lum, img.width, img.height),
    sharpness: estimateSharpness(lum, img.width, img.height),
  };
}
