import type { AlphaMask } from './contract';

/** Which sides of a cutout the garment reaches (it was photographed cut off there, or cropped). */
export interface EdgeContact {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  /** How many of the four sides are touched. */
  sides: number;
}

/**
 * A side is touched when at least this share of its length (in the outermost `EDGE_BAND` pixels)
 * is opaque. The cutout service pads the garment by 2% of its size, so a cutout whose border is
 * opaque can only come from a garment that reaches the photo's own edge.
 */
export const EDGE_MIN_SHARE = 0.04;
export const EDGE_BAND = 2;
const OPAQUE = 128;

/** Which sides of the mask the garment touches. Pure. */
export function edgeContact(mask: AlphaMask): EdgeContact {
  const { width: w, height: h, alpha } = mask;
  const none: EdgeContact = { top: false, bottom: false, left: false, right: false, sides: 0 };
  if (!(w > 0 && h > 0) || alpha.length < w * h) return none;
  const band = Math.min(EDGE_BAND, Math.floor(Math.min(w, h) / 2));
  const row = (y0: number): number => {
    let n = 0;
    for (let x = 0; x < w; x++) {
      for (let y = y0; y < y0 + band; y++) {
        if ((alpha[y * w + x] as number) >= OPAQUE) {
          n++;
          break;
        }
      }
    }
    return n / w;
  };
  const col = (x0: number): number => {
    let n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = x0; x < x0 + band; x++) {
        if ((alpha[y * w + x] as number) >= OPAQUE) {
          n++;
          break;
        }
      }
    }
    return n / h;
  };
  const top = row(0) >= EDGE_MIN_SHARE;
  const bottom = row(h - band) >= EDGE_MIN_SHARE;
  const left = col(0) >= EDGE_MIN_SHARE;
  const right = col(w - band) >= EDGE_MIN_SHARE;
  return { top, bottom, left, right, sides: [top, bottom, left, right].filter(Boolean).length };
}
