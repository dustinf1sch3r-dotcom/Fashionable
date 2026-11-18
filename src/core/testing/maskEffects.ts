import type { AlphaMask } from '../fit/contract';

/**
 * Real-photo artefacts applied to a clean alpha mask, for the detection tests: wrinkles that make
 * the outline bumpy, the soft edge of an anti-aliased cutout, a shadow under the hem, and a
 * hanger's arms filling the neck dip. Pure and deterministic (no randomness: sums of sines).
 */

/** A smooth pseudo-random wave in -1..1 (periods of about 15–55 px). */
function wave(t: number, phase: number): number {
  return (
    Math.sin(t * 0.11 + phase) * 0.5 +
    Math.sin(t * 0.23 + phase * 2.3) * 0.3 +
    Math.sin(t * 0.41 + phase * 0.7) * 0.2
  );
}

/**
 * Moves every edge of every run, row by row and then column by column, by a smooth wobble of up to
 * `amplitude` × the mask's longer side: a wrinkled, uneven outline with no sharp teeth.
 */
export function wobbleEdges(mask: AlphaMask, amplitude: number, seed = 1): AlphaMask {
  const { width: w, height: h } = mask;
  const a = amplitude * Math.max(w, h);
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let i = 0;
    for (let x = 0; x < w; x++) {
      if (!mask.alpha[y * w + x]) continue;
      let e = x;
      while (e + 1 < w && mask.alpha[y * w + e + 1]) e++;
      const from = Math.round(x + a * wave(y, seed + i));
      const to = Math.round(e + a * wave(y + 40, seed + 5 + i));
      for (let xx = Math.max(0, from); xx <= Math.min(w - 1, to); xx++) rows[y * w + xx] = 255;
      i++;
      x = e;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let i = 0;
    for (let y = 0; y < h; y++) {
      if (!rows[y * w + x]) continue;
      let e = y;
      while (e + 1 < h && rows[(e + 1) * w + x]) e++;
      const from = Math.round(y + a * wave(x, seed + 9 + i));
      const to = Math.round(e + a * wave(x + 70, seed + 3 + i));
      for (let yy = Math.max(0, from); yy <= Math.min(h - 1, to); yy++) out[yy * w + x] = 255;
      i++;
      y = e;
    }
  }
  return { width: w, height: h, alpha: out };
}

/** A box blur of the alpha (radius in pixels): the soft, anti-aliased edge of a cutout. */
export function softenEdges(mask: AlphaMask, radius: number): AlphaMask {
  const { width: w, height: h, alpha } = mask;
  const out = new Uint8Array(w * h);
  const n = (2 * radius + 1) ** 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) sum += alpha[yy * w + xx] as number;
        }
      }
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return { width: w, height: h, alpha: out };
}

/**
 * A shadow under the lowest row: `rows` more rows (opaque, as a keyed cutout keeps them) as wide
 * as the bottom row. The mask grows by `rows` pixels at the bottom.
 */
export function hemShadow(mask: AlphaMask, rows: number): AlphaMask {
  const { width: w, height: h, alpha } = mask;
  let last = -1;
  for (let y = h - 1; y >= 0 && last < 0; y--) {
    for (let x = 0; x < w; x++) if (alpha[y * w + x]) last = y;
  }
  if (last < 0) return mask;
  const out = new Uint8Array(w * (h + rows));
  out.set(alpha);
  for (let r = 1; r <= rows; r++) {
    for (let x = 0; x < w; x++) {
      if (alpha[last * w + x]) out[(h - 1 + r) * w + x] = 255;
    }
  }
  return { width: w, height: h + rows, alpha: out };
}

/** Fills the empty cells between the topmost rows' two peaks (a hanger's arms bridging the neck dip). */
export function fillDip(mask: AlphaMask, rows: number): AlphaMask {
  const { width: w, height: h, alpha } = mask;
  const out = Uint8Array.from(alpha);
  let top = -1;
  for (let y = 0; y < h && top < 0; y++) {
    for (let x = 0; x < w; x++) if (alpha[y * w + x]) top = y;
  }
  if (top < 0) return mask;
  for (let y = top; y < Math.min(h, top + rows); y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x]) {
        if (a < 0) a = x;
        b = x;
      }
    }
    for (let x = a; x <= b && a >= 0; x++) out[y * w + x] = 255;
  }
  return { width: w, height: h, alpha: out };
}
