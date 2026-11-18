import { blurLarge, boxBlur, distanceTransform, downsample, upsample } from './filters';
import type { Plane } from './filters';
import { COMPOSITE_RULES } from './rules';

// A module-level alias: global `Math` lookups are very slow inside Jest's sandbox, which matters in hot loops.
const M = Math;

const clamp = (v: number, lo: number, hi: number): number => M.min(hi, M.max(lo, v));

/** Blur of `value` weighted by `weight`, ignoring pixels outside the weight (normalised convolution). */
function weightedBlur(
  value: Plane,
  weight: Plane,
  blur: (p: Plane) => Plane,
  fallback: number,
): Plane {
  const vw = new Float32Array(value.length);
  for (let i = 0; i < vw.length; i++) vw[i] = (value[i] as number) * (weight[i] as number);
  const num = blur(vw);
  const den = blur(weight);
  for (let i = 0; i < num.length; i++) {
    const dd = den[i] as number;
    num[i] = dd > 1e-3 ? (num[i] as number) / dd : fallback;
  }
  return num;
}

/**
 * Photo shading multipliers (per pixel, around 1): low-pass backdrop luminance under the garment,
 * normalised to mean 1 over the garment, clamped, plus a small high-pass fold term; softened by
 * `strength`. `lum` is the backdrop luminance cropped to the garment region, `alpha` its coverage 0..1.
 */
export function photoShading(
  lum: Plane,
  alpha: Plane,
  w: number,
  h: number,
  canvasWidth: number,
): Plane {
  const R = COMPOSITE_RULES.photoShading;
  let sumA = 0;
  let sumL = 0;
  for (let i = 0; i < alpha.length; i++) {
    sumA += alpha[i] as number;
    sumL += (alpha[i] as number) * (lum[i] as number);
  }
  const out = new Float32Array(alpha.length).fill(1);
  if (sumA <= 0 || sumL <= 0) return out;
  const mean = sumL / sumA;
  const lowSigma = M.max(1, R.lowPassSigmaFrac * canvasWidth);
  const base = weightedBlur(lum, alpha, (p) => blurLarge(p, w, h, lowSigma), mean);
  const fineRadius = M.max(1, M.round(R.detailSigmaFrac * canvasWidth * 0.7));
  const fine = weightedBlur(lum, alpha, (p) => boxBlur(p, w, h, fineRadius), mean);
  let sumB = 0;
  for (let i = 0; i < alpha.length; i++) sumB += (alpha[i] as number) * (base[i] as number);
  const baseMean = sumB / sumA;
  for (let i = 0; i < out.length; i++) {
    const b = base[i] as number;
    const fold = clamp((R.foldGain * ((fine[i] as number) - b)) / baseMean, -R.foldMax, R.foldMax);
    const map = clamp(b / baseMean + fold, R.min, R.max);
    out[i] = 1 + R.strength * (map - 1);
  }
  return out;
}

/** Silhouette "pillow" shading: darker toward the garment's own edge, gentle top-left light. */
export function silhouetteShading(alpha: Plane, w: number, h: number, canvasWidth: number): Plane {
  const R = COMPOSITE_RULES.silhouetteShading;
  const inside = new Uint8Array(alpha.length);
  let sumA = 0;
  for (let i = 0; i < alpha.length; i++) {
    inside[i] = (alpha[i] as number) > 0.5 ? 1 : 0;
    sumA += alpha[i] as number;
  }
  const out = new Float32Array(alpha.length).fill(1);
  if (sumA <= 0) return out;
  // Large garments: distance at half resolution (good to about a pixel, 4x cheaper), then upsampled.
  let dist: Plane;
  if (w * h > R.halfResolutionAbove) {
    const half = downsample(alpha, w, h, 2);
    const mask = new Uint8Array(half.data.length);
    for (let i = 0; i < mask.length; i++) mask[i] = (half.data[i] as number) > 0.5 ? 1 : 0;
    dist = upsample(distanceTransform(mask, half.w, half.h), half.w, half.h, w, h, 2);
    for (let i = 0; i < dist.length; i++)
      dist[i] = inside[i] ? M.max(0.5, (dist[i] as number) * 2 - 0.5) : 0;
  } else {
    dist = distanceTransform(inside, w, h);
  }
  const rim = M.max(1, R.rimFrac * canvasWidth);
  const raw = new Float32Array(alpha.length);
  const SQ = M.SQRT1_2;
  let sumR = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = dist[i] as number;
      const t = clamp(d / rim, 0, 1);
      const p = t * t * (3 - 2 * t);
      const dx =
        (dist[y * w + M.min(x + 1, w - 1)] as number) - (dist[y * w + M.max(x - 1, 0)] as number);
      const dy =
        (dist[M.min(y + 1, h - 1) * w + x] as number) - (dist[M.max(y - 1, 0) * w + x] as number);
      const len = M.hypot(dx, dy);
      // The outward normal is minus the distance gradient; light comes from the top-left.
      const facing = len > 1e-6 ? ((dx + dy) * SQ) / len : 0;
      const v = 1 - R.edgeDarkening * (1 - p) + R.lightGain * facing * (1 - p);
      raw[i] = v;
      sumR += (alpha[i] as number) * v;
    }
  }
  const mean = sumR / sumA;
  for (let i = 0; i < out.length; i++) {
    const map = clamp((raw[i] as number) / mean, R.min, R.max);
    out[i] = 1 + R.strength * (map - 1);
  }
  return out;
}
