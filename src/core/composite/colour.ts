import { COMPOSITE_RULES } from './rules';
import type { PhotoStats } from './stats';

// A module-level alias: global `Math` lookups are very slow inside Jest's sandbox, which matters in hot loops.
const M = Math;

const R = COMPOSITE_RULES.colour;

/** Per-channel multipliers that make a garment look lit like the photo (cast + part-way exposure). */
export function colourGains(
  stats: Pick<PhotoStats, 'cast' | 'exposure'>,
): [number, number, number] {
  const exposure = M.min(
    R.exposureGainMax,
    M.max(
      R.exposureGainMin,
      M.pow(M.max(stats.exposure, 0.01) / R.exposureReference, R.exposureStrength),
    ),
  );
  const g = (c: number): number => M.pow(c, R.castStrength) * exposure;
  return [g(stats.cast[0]), g(stats.cast[1]), g(stats.cast[2])];
}

/**
 * Multiplicative (so lightness scales, colour identity stays): a white garment stays near white,
 * a neutral photo changes nothing.
 */
export function applyGains(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  gains: readonly [number, number, number],
): void {
  for (let i = 0; i < r.length; i++) {
    r[i] = M.min(255, (r[i] as number) * gains[0]);
    g[i] = M.min(255, (g[i] as number) * gains[1]);
    b[i] = M.min(255, (b[i] as number) * gains[2]);
  }
}
