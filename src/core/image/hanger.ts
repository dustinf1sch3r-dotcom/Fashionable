/**
 * Hanger removal (docs/TRY_ON.md §7): a garment photographed on a hanger keeps the hook (and
 * sometimes the hanger's neck) in its cutout, and that confuses neckline detection. This finds
 * them in the alpha mask alone, so it is plain code and needs no model. Pure.
 *
 * Two things are removed, both only above the garment's own top edge and both only when they are
 * clearly a hanger; when unsure the pixels stay (a hood or a collar is never cut):
 *
 * 1. Thin structures (a wire hook and the wire's arms). The mask is morphologically opened with a
 *    square a few percent of the garment's width wide: whatever cannot hold the square is thin.
 *    Such a piece goes when it is long compared with the square, sits (nearly) in the horizontal
 *    middle of the garment and every cell of it lies above the garment's local top edge. A pair of
 *    camisole straps is not in the middle, and a standing collar band is thicker than the square.
 * 2. A solid hanger neck: the topmost rows of the garment are one narrow run in the middle
 *    (narrower than a neck), the shoulders start beside it on both sides, and it is narrower than
 *    the neckline opening it rises from. A hood or a funnel neck is wider than a hanger neck.
 *
 * The decision is made on a coarse grid (`HANGER_RULES.maxGridSide`); the pixels of the removed
 * cells (plus the soft edge around a removed wire) are then cleared at full resolution.
 */
import type { AlphaMask } from '../fit/contract';

export const HANGER_RULES = {
  /** Alpha at or above this is part of the garment (low, so a soft anti-aliased wire counts). */
  alphaThreshold: 48,
  /** The analysis grid has at most this many cells on its longer side. */
  maxGridSide: 256,
  /** A grid cell is on when at least this share of its pixels is (low, so a thin wire survives). */
  cellFill: 0.1,
  /** The opening square is this fraction of the garment's width (at least `minOpen` cells). */
  openFraction: 0.035,
  minOpen: 2,
  /** A thin piece must be at least this many opening squares long to be a hanger part. */
  minLength: 1.2,
  /** A thin piece must be centred within this fraction of the garment's width of its middle. */
  centreTolerance: 0.15,
  /** Hanger neck: rows count while every run lies within this fraction of the width of the middle. */
  headBand: 0.12,
  /** Hanger neck: at most this wide (fraction of the garment's width). */
  headMaxWidth: 0.2,
  /** Hanger neck: at most this tall (fraction of the garment's height). */
  headMaxHeight: 0.12,
  /** Hanger neck: at most this share of the neckline opening it rises from. */
  headOfNeckline: 0.6,
  /** A removed wire also clears faint remains this many cells around it, above the garment's top edge. */
  softMargin: 8,
  /** Nothing is removed when it would be more than this share of the garment. */
  maxRemoved: 0.1,
} as const;

export interface HangerRemoval {
  /** The alpha with the hanger cleared (a copy; the input is not touched). */
  alpha: Uint8Array;
  /** Pixels that were opaque (above the alpha threshold) and are now cleared. */
  removedPixels: number;
}

const H = HANGER_RULES;
/** Alpha above which a pixel is visible (the trim threshold of docs/TRY_ON.md §7). */
const TRIM_ALPHA = 16;

interface Grid {
  w: number;
  h: number;
  k: number;
  on: Uint8Array;
}

function toGrid(mask: AlphaMask): Grid {
  const { width: W, height: Ht, alpha } = mask;
  const k = Math.max(1, Math.ceil(Math.max(W, Ht) / H.maxGridSide));
  const w = Math.ceil(W / k);
  const h = Math.ceil(Ht / k);
  // One pass over the pixels, counting the opaque ones per cell.
  const hits = new Uint32Array(w * h);
  for (let y = 0; y < Ht; y++) {
    const row = y * W;
    const cellRow = Math.floor(y / k) * w;
    for (let gx = 0, x = 0; gx < w; gx++) {
      const end = Math.min(W, x + k);
      let n = 0;
      for (; x < end; x++) if ((alpha[row + x] as number) >= H.alphaThreshold) n++;
      if (n > 0) hits[cellRow + gx] += n;
    }
  }
  const on = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    const cellH = Math.min(Ht, (gy + 1) * k) - gy * k;
    for (let gx = 0; gx < w; gx++) {
      const total = cellH * (Math.min(W, (gx + 1) * k) - gx * k);
      if (total > 0 && (hits[gy * w + gx] as number) / total >= H.cellFill) on[gy * w + gx] = 1;
    }
  }
  return { w, h, k, on };
}

/** 8-connected components of the cells that are on: label per cell (-1 off) and component sizes. */
function label(on: Uint8Array, w: number, h: number): { id: Int32Array; sizes: number[] } {
  const id = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!on[s] || id[s] !== -1) continue;
    const c = sizes.length;
    let n = 0;
    id[s] = c;
    stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop() as number;
      n++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (!on[j] || id[j] !== -1) continue;
          id[j] = c;
          stack.push(j);
        }
      }
    }
    sizes.push(n);
  }
  return { id, sizes };
}

/** Erosion or dilation by a `s` x `s` square, separable. `erode` true: min; false: max. */
function morph(src: Uint8Array, w: number, h: number, s: number, erode: boolean): Uint8Array {
  // The window is reflected for a dilation, so that erode-then-dilate is a true opening (even sizes).
  const a = Math.floor((s - 1) / 2);
  const lo = erode ? a : s - 1 - a;
  const hi = s - 1 - lo;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (let d = -lo; d <= hi; d++) {
        const xx = x + d;
        const c = xx < 0 || xx >= w ? (erode ? 1 : 0) : (src[y * w + xx] as number);
        if (erode ? c === 0 : c === 1) {
          v = erode ? 0 : 1;
          break;
        }
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (let d = -lo; d <= hi; d++) {
        const yy = y + d;
        const c = yy < 0 || yy >= h ? (erode ? 1 : 0) : (tmp[yy * w + x] as number);
        if (erode ? c === 0 : c === 1) {
          v = erode ? 0 : 1;
          break;
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

interface Run {
  a: number;
  b: number;
}

function runsOf(row: Uint8Array, w: number, y: number, gap: number): Run[] {
  const runs: Run[] = [];
  for (let x = 0; x < w; x++) {
    if (!row[y * w + x]) continue;
    let e = x;
    while (e + 1 < w && row[y * w + e + 1]) e++;
    const last = runs[runs.length - 1];
    if (last && x - last.b - 1 <= gap) last.b = e;
    else runs.push({ a: x, b: e });
    x = e;
  }
  return runs;
}

/**
 * The grid cells of the hanger in `mask`: 1 per removed cell, plus the grid. `undefined` when
 * there is nothing (clear enough) to remove.
 */
function findHanger(
  mask: AlphaMask,
): { cells: Uint8Array; grid: Grid; open: Uint8Array } | undefined {
  const grid = toGrid(mask);
  const { w, h, on } = grid;
  // Every piece counts as garment: a wire that does not quite touch the garment is still a wire.
  const body = on;
  let area = 0;
  let x0 = w;
  let x1 = -1;
  for (let i = 0; i < w * h; i++) {
    if (!body[i]) continue;
    area++;
    const x = i % w;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  if (area === 0) return undefined;
  const s = Math.max(H.minOpen, Math.round(H.openFraction * (x1 - x0 + 1)));
  const open = morph(morph(body, w, h, s, true), w, h, s, false);
  let openArea = 0;
  let ox0 = w;
  let ox1 = -1;
  let oy0 = h;
  let oy1 = -1;
  for (let i = 0; i < w * h; i++) {
    if (!open[i]) continue;
    openArea++;
    const x = i % w;
    const y = (i - x) / w;
    ox0 = Math.min(ox0, x);
    ox1 = Math.max(ox1, x);
    oy0 = Math.min(oy0, y);
    oy1 = Math.max(oy1, y);
  }
  // Nothing solid enough to be a garment: do not guess.
  if (openArea < 0.5 * area) return undefined;
  const bodyW = ox1 - ox0 + 1;
  const bodyH = oy1 - oy0 + 1;
  const cx = (ox0 + ox1 + 1) / 2;

  // First open cell of every column: the garment's local top edge (a large number when none).
  const topOpen = new Int32Array(w).fill(h + 1_000_000);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (open[y * w + x]) {
        topOpen[x] = y;
        break;
      }
    }
  }

  const cells = new Uint8Array(w * h);

  // 1. Thin pieces above the top edge, in the middle.
  const thin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (body[i] && !open[i]) thin[i] = 1;
  const parts = label(thin, w, h);
  const bounds = parts.sizes.map(() => ({ x0: w, x1: -1, y0: h, y1: -1, above: 0, n: 0 }));
  for (let i = 0; i < w * h; i++) {
    const c = parts.id[i] as number;
    if (c < 0) continue;
    const b = bounds[c] as (typeof bounds)[number];
    const x = i % w;
    const y = (i - x) / w;
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, y);
    b.y1 = Math.max(b.y1, y);
    b.n++;
    if (y < (topOpen[x] as number)) b.above++;
  }
  const accepted = new Set<number>();
  bounds.forEach((b, c) => {
    const extent = Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
    const mid = (b.x0 + b.x1 + 1) / 2;
    if (
      extent >= H.minLength * s &&
      Math.abs(mid - cx) <= H.centreTolerance * bodyW &&
      b.above === b.n
    ) {
      accepted.add(c);
    }
  });
  for (let i = 0; i < w * h; i++) if (accepted.has(parts.id[i] as number)) cells[i] = 1;
  // The soft edge and faint remains of a removed wire: everything above the garment's top edge
  // within a margin of the removed pieces.
  if (accepted.size > 0) {
    let zx0 = w;
    let zx1 = -1;
    let zy0 = h;
    let zy1 = -1;
    for (const c of accepted) {
      const b = bounds[c] as (typeof bounds)[number];
      zx0 = Math.min(zx0, b.x0);
      zx1 = Math.max(zx1, b.x1);
      zy0 = Math.min(zy0, b.y0);
      zy1 = Math.max(zy1, b.y1);
    }
    for (let y = Math.max(0, zy0 - H.softMargin); y <= Math.min(h - 1, zy1 + H.softMargin); y++) {
      for (let x = Math.max(0, zx0 - H.softMargin); x <= Math.min(w - 1, zx1 + H.softMargin); x++) {
        if (y < (topOpen[x] as number) && !on[y * w + x]) cells[y * w + x] = 1;
      }
    }
  }

  // 2. A solid hanger neck: one narrow run in the middle above the shoulders.
  const band = H.headBand * bodyW;
  let yb = -1;
  let headA = w;
  let headB = -1;
  for (let y = oy0; y < oy1; y++) {
    const runs = runsOf(open, w, y, 0);
    if (runs.length === 0) continue;
    const inside = runs.every((r) => r.a >= cx - band && r.b + 1 <= cx + band);
    const narrow =
      runs.length === 1 && (runs[0] as Run).b - (runs[0] as Run).a + 1 <= H.headMaxWidth * bodyW;
    if (inside && narrow) {
      headA = Math.min(headA, (runs[0] as Run).a);
      headB = Math.max(headB, (runs[0] as Run).b);
      continue;
    }
    yb = y;
    break;
  }
  if (yb > oy0 && yb - oy0 <= H.headMaxHeight * bodyH) {
    // The shoulders begin on both sides of the middle at row yb (merging nothing smaller).
    const runs = runsOf(open, w, yb, 0);
    const left = runs.filter((r) => r.b + 1 <= cx - band);
    const right = runs.filter((r) => r.a >= cx + band);
    const centre = runs.filter((r) => !(r.b + 1 <= cx - band) && !(r.a >= cx + band));
    const l = left[left.length - 1];
    const r = right[0];
    if (l && r) {
      // The head must be narrower than the neckline it rises from (when that can be measured).
      const opening = r.a - l.b - 1;
      const headW = headB - headA + 1;
      const fits = centre.length === 0 || headW <= H.headOfNeckline * opening;
      if (fits) {
        for (let y = oy0; y < yb; y++) {
          for (let x = Math.max(0, headA - 1); x <= Math.min(w - 1, headB + 1); x++) {
            if (body[y * w + x]) cells[y * w + x] = 1;
          }
        }
      }
    }
  }

  let removed = 0;
  for (let i = 0; i < w * h; i++) if (cells[i] && body[i]) removed++;
  if (removed === 0 || removed > H.maxRemoved * area) return undefined;
  return { cells, grid, open };
}

/**
 * Clears the hanger from the cutout's alpha. Returns the alpha unchanged (a copy) when no hanger
 * is found or the evidence is not clear.
 */
export function removeHanger(mask: AlphaMask): HangerRemoval {
  const alpha = Uint8Array.from(mask.alpha.subarray(0, mask.width * mask.height));
  const found = findHanger(mask);
  if (!found) return { alpha, removedPixels: 0 };
  const { cells, grid } = found;
  let removedPixels = 0;
  for (let y = 0; y < mask.height; y++) {
    const gy = Math.floor(y / grid.k);
    for (let x = 0; x < mask.width; x++) {
      if (!cells[gy * grid.w + Math.floor(x / grid.k)]) continue;
      const i = y * mask.width + x;
      if ((alpha[i] as number) >= TRIM_ALPHA) removedPixels++;
      alpha[i] = 0;
    }
  }
  return { alpha, removedPixels };
}

/** Clears the hanger from an RGBA buffer in place. Returns the number of opaque pixels cleared. */
export function removeHangerFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] as number;
  const result = removeHanger({ width, height, alpha });
  if (result.removedPixels === 0) return 0;
  for (let i = 0; i < alpha.length; i++) {
    if ((result.alpha[i] as number) === 0 && alpha[i] !== 0) rgba[i * 4 + 3] = 0;
  }
  return result.removedPixels;
}
