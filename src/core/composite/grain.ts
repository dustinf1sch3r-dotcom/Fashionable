import { COMPOSITE_RULES } from './rules';

const M = Math;
const imul = M.imul;
const BYTE_SUM_SD = M.sqrt((4 * 256 * 256) / 12);
const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Blur sigma (px) that brings a sharp garment to the photo's sharpness; 0 for a fully sharp photo. */
export function softnessSigma(sharpness: number, densityScale: number): number {
  const R = COMPOSITE_RULES.softness;
  const t = M.min(1, M.max(0, (R.sharpRatio - sharpness) / (R.sharpRatio - 1)));
  return t * R.maxBlurSigma * densityScale;
}

/** Grain standard deviation (levels) for a photo noise level. */
export function grainSigma(noise: number): number {
  const R = COMPOSITE_RULES.softness;
  return M.min(R.grainMax, noise * R.grainStrength);
}

/**
 * Add seeded, roughly Gaussian luminance grain to pixels with alpha > 0. The RNG advances for every
 * pixel so the same seed always gives the same pixels.
 */
export function addGrain(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  alpha: Float32Array,
  sigma: number,
  seed: number,
): void {
  if (sigma <= 0) return;
  // mulberry32 (same generator as engine/rng, inlined so the hot loop makes one draw per pixel).
  let state = seed >>> 0;
  for (let i = 0; i < r.length; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = imul(t ^ (t >>> 15), t | 1);
    t ^= t + imul(t ^ (t >>> 7), t | 61);
    const u = (t ^ (t >>> 14)) >>> 0;
    // Sum of the four bytes of one draw: approximately Gaussian, variance 4 * 256^2 / 12.
    const n =
      (((u & 255) + ((u >>> 8) & 255) + ((u >>> 16) & 255) + (u >>> 24) - 510) / BYTE_SUM_SD) *
      sigma;
    if ((alpha[i] as number) <= 0) continue;
    r[i] = clamp255((r[i] as number) + n);
    g[i] = clamp255((g[i] as number) + n);
    b[i] = clamp255((b[i] as number) + n);
  }
}
