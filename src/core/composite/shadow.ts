import { blurLarge } from './filters';
import type { Plane } from './filters';

/**
 * Contact-shadow multipliers (1 = untouched): 1 - opacity × blurred alpha, but not under the layer's
 * own coverage (× (1 - alpha)), so only the halo around and beneath the soft edge darkens.
 */
export function shadowMultiplier(
  alpha: Plane,
  w: number,
  h: number,
  sigma: number,
  opacity: number,
): Plane {
  const blurred = blurLarge(alpha, w, h, sigma);
  const out = new Float32Array(alpha.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = 1 - opacity * (blurred[i] as number) * (1 - (alpha[i] as number));
  }
  return out;
}
