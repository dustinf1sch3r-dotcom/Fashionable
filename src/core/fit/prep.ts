import { FIT_RULES } from './weights';
import type { AlphaMask } from './contract';

/** A horizontal opaque run, cells `a` (inclusive) to `b` (exclusive). */
export interface Run {
  a: number;
  b: number;
}

/** A cleaned, downsampled mask with the row/column summaries detection works on. */
export interface Prep {
  w: number;
  h: number;
  /** 1 = opaque. */
  px: Uint8Array;
  /** Opaque runs per row, left to right. */
  rows: Run[][];
  /** Bounding box, `x1` / `y1` exclusive. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Horizontal middle of the bounding box. */
  cx: number;
  /** First opaque row per column (−1 for an empty column). */
  topY: Int32Array;
  /** End (exclusive) of the first vertical run per column (−1 for an empty column). */
  firstBottom: Int32Array;
  /** Mask pixels per cell side. */
  scale: number;
  /** Multiplier 0–1 on confidence for stray specks, pinholes and ragged edges. */
  cleanliness: number;
  /** The original mask, so straightening resamples real pixels rather than coarse cells. */
  source?: { alpha: Uint8Array | Uint8ClampedArray; width: number; height: number };
}

const D = FIT_RULES.detect;
const C = FIT_RULES.confidence;

function labelComponents(
  px: Uint8Array,
  w: number,
  h: number,
): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (px[s] === 0 || label[s] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    label[s] = id;
    stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop() as number;
      size++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (px[j] === 0 || label[j] !== -1) continue;
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

/** Threshold, downsample and clean a mask. `undefined` when it is empty. */
export function prepare(mask: AlphaMask): Prep | undefined {
  const { width: W, height: H, alpha } = mask;
  if (!(W > 0 && H > 0) || alpha.length < W * H) return undefined;
  const scale = Math.max(1, Math.ceil(Math.max(W, H) / D.maxGridSide));
  const w = Math.ceil(W / scale);
  const h = Math.ceil(H / scale);
  let px = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      let on = 0;
      let total = 0;
      const yEnd = Math.min(H, (gy + 1) * scale);
      const xEnd = Math.min(W, (gx + 1) * scale);
      for (let y = gy * scale; y < yEnd; y++) {
        for (let x = gx * scale; x < xEnd; x++) {
          total++;
          if ((alpha[y * W + x] as number) >= D.alphaThreshold) on++;
        }
      }
      if (total > 0 && on / total >= D.cellFill) px[gy * w + gx] = 1;
    }
  }

  // Keep the garment: the largest component and any comparable ones (e.g. a detached sleeve).
  const { label, sizes } = labelComponents(px, w, h);
  if (sizes.length === 0) return undefined;
  const biggest = Math.max(...sizes);
  if (biggest < D.minCells) return undefined;
  const keep = sizes.map((s) => s >= D.strayComponent * biggest);
  const clean = new Uint8Array(w * h);
  let kept = 0;
  let strayCells = 0;
  for (let i = 0; i < w * h; i++) {
    const l = label[i] as number;
    if (l < 0) continue;
    if (keep[l]) {
      clean[i] = 1;
      kept++;
    } else strayCells++;
  }
  const strayCount = keep.filter((k) => !k).length;
  px = clean;

  // Fill small holes: background not reachable from the border.
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number): void => {
    const i = y * w + x;
    if (px[i] === 0 && outside[i] === 0) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  const holeLabel = new Int32Array(w * h).fill(-1);
  let holeCells = 0;
  for (let s = 0; s < w * h; s++) {
    if (px[s] !== 0 || outside[s] !== 0 || holeLabel[s] !== -1) continue;
    const cells: number[] = [];
    holeLabel[s] = 1;
    stack.push(s);
    while (stack.length > 0) {
      const i = stack.pop() as number;
      cells.push(i);
      const x = i % w;
      const y = (i - x) / w;
      const nb = [
        x > 0 ? i - 1 : -1,
        x < w - 1 ? i + 1 : -1,
        y > 0 ? i - w : -1,
        y < h - 1 ? i + w : -1,
      ];
      for (const j of nb) {
        if (j >= 0 && px[j] === 0 && outside[j] === 0 && holeLabel[j] === -1) {
          holeLabel[j] = 1;
          stack.push(j);
        }
      }
    }
    if (cells.length <= D.smallHole * kept) {
      for (const i of cells) px[i] = 1;
      holeCells += cells.length;
    }
  }

  const noiseFraction = (strayCells + holeCells) / Math.max(1, kept);
  const base = build(px, w, h, scale, 1);
  if (!base) return undefined;
  const penalty = Math.min(
    C.maxNoisePenalty,
    C.perStray * strayCount + C.perNoise * noiseFraction + C.perJitter * jitterOf(base),
  );
  return {
    ...base,
    cleanliness: 1 - penalty,
    source: { alpha, width: W, height: H },
  };
}

/** Ragged edges: rows whose outer extent differs from the median of their neighbours. */
function jitterOf(p: Prep): number {
  const { rows, y0, y1 } = p;
  const ext = (y: number): [number, number] => {
    const r = rows[y] as Run[];
    return [(r[0] as Run).a, (r[r.length - 1] as Run).b];
  };
  const med3 = (a: number, b: number, c: number): number =>
    Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
  let ragged = 0;
  let counted = 0;
  for (let y = y0 + 1; y < y1 - 1; y++) {
    if ([y - 1, y, y + 1].some((r) => (rows[r] as Run[]).length === 0)) continue;
    const [pa, pb] = ext(y - 1);
    const [ca, cb] = ext(y);
    const [na, nb] = ext(y + 1);
    counted += 2;
    if (Math.abs(ca - med3(pa, ca, na)) >= 1) ragged++;
    if (Math.abs(cb - med3(pb, cb, nb)) >= 1) ragged++;
  }
  return counted > 0 ? ragged / counted : 0;
}

/** Runs, bounding box and column summaries of a cleaned cell mask. */
function build(
  px: Uint8Array,
  w: number,
  h: number,
  scale: number,
  cleanliness: number,
): Prep | undefined {
  const rows: Run[][] = [];
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    const runs: Run[] = [];
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && px[y * w + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push({ a: start, b: x });
        start = -1;
      }
    }
    rows.push(runs);
    if (runs.length > 0) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y + 1);
      x0 = Math.min(x0, (runs[0] as Run).a);
      x1 = Math.max(x1, (runs[runs.length - 1] as Run).b);
    }
  }
  if (y1 <= y0 || x1 <= x0) return undefined;
  const topY = new Int32Array(w).fill(-1);
  const firstBottom = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    let y = y0;
    while (y < y1 && px[y * w + x] === 0) y++;
    if (y >= y1) continue;
    topY[x] = y;
    let e = y;
    while (e < y1 && px[e * w + x] === 1) e++;
    firstBottom[x] = e;
  }
  return {
    w,
    h,
    px,
    rows,
    x0,
    x1,
    y0,
    y1,
    cx: (x0 + x1) / 2,
    topY,
    firstBottom,
    scale,
    cleanliness,
  };
}

/** The tilt that makes the outline's bounding box smallest (garments are built on straight lines). */
function bboxTilt(p: Prep): number {
  const edge: [number, number][] = [];
  for (let y = p.y0; y < p.y1; y++) {
    for (const r of p.rows[y] as Run[]) edge.push([r.a, y + 0.5], [r.b, y + 0.5]);
  }
  const area = (alpha: number): number => {
    const c = Math.cos(alpha);
    const s = Math.sin(alpha);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [x, y] of edge) {
      const u = c * x - s * y;
      const v = s * x + c * y;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    return (u1 - u0) * (v1 - v0);
  };
  let alpha = 0;
  let best = area(0);
  for (let k = 1; k * D.skewStep <= D.skewMax; k++) {
    for (const sign of [1, -1]) {
      const a = sign * k * D.skewStep;
      const v = area(a);
      if (v < best * (1 - 1e-4)) {
        best = v;
        alpha = a;
      }
    }
  }
  return alpha;
}

/** The tilt of the flat top edge (waistband): median slope between its columns. */
function topEdgeTilt(p: Prep): number {
  const hb = p.y1 - p.y0;
  const cols: [number, number][] = [];
  for (let x = p.x0; x < p.x1; x++) {
    const t = p.topY[x] as number;
    if (t >= 0 && t - p.y0 <= D.topEdgeBand * hb) cols.push([x, t]);
  }
  if (cols.length < 8) return 0;
  const trim = Math.floor(cols.length * 0.1);
  const use = cols.slice(trim, cols.length - trim);
  const gap = Math.max(4, Math.floor(use.length / 3));
  const slopes: number[] = [];
  for (let i = 0; i < use.length; i++) {
    for (let j = i + gap; j < use.length; j++) {
      const a = use[i] as [number, number];
      const b = use[j] as [number, number];
      slopes.push((b[1] - a[1]) / (b[0] - a[0]));
    }
  }
  if (slopes.length === 0) return 0;
  slopes.sort((u, v) => u - v);
  // A top edge sloping down to the right means the garment is turned clockwise; undo it.
  return -Math.atan(slopes[Math.floor(slopes.length / 2)] as number);
}

/**
 * Straighten a slightly rotated garment: the angle of its symmetry axis (midpoints of the row
 * extents) is removed by resampling. `unrotate` maps points of the result back to `p`'s cells.
 */
export function deskew(
  p: Prep,
  mode: 'bbox' | 'topEdge',
): {
  prep: Prep;
  unrotate: (x: number, y: number) => [number, number];
} {
  const identity = { prep: p, unrotate: (x: number, y: number): [number, number] => [x, y] };
  const alpha = mode === 'bbox' ? bboxTilt(p) : topEdgeTilt(p);
  if (Math.abs(alpha) < D.skewMin || Math.abs(alpha) > D.skewMax) return identity;
  const cs = Math.cos(alpha);
  const sn = Math.sin(alpha);
  const w2 = Math.ceil(cs * p.w + Math.abs(sn) * p.h) + 2;
  const h2 = Math.ceil(cs * p.h + Math.abs(sn) * p.w) + 2;
  const cxs = p.w / 2;
  const cys = p.h / 2;
  const cxd = w2 / 2;
  const cyd = h2 / 2;
  const out = new Uint8Array(w2 * h2);
  const src = p.source;
  const sub = D.skewSamples;
  for (let v = 0; v < h2; v++) {
    for (let u = 0; u < w2; u++) {
      let on = 0;
      for (let j = 0; j < sub; j++) {
        for (let i = 0; i < sub; i++) {
          const du = u + (i + 0.5) / sub - cxd;
          const dv = v + (j + 0.5) / sub - cyd;
          const sx = cs * du + sn * dv + cxs;
          const sy = -sn * du + cs * dv + cys;
          const cx0 = Math.floor(sx);
          const cy0 = Math.floor(sy);
          if (cx0 < 0 || cy0 < 0 || cx0 >= p.w || cy0 >= p.h || p.px[cy0 * p.w + cx0] === 0)
            continue;
          if (!src) {
            on++;
            continue;
          }
          const px0 = Math.min(src.width - 1, Math.floor(sx * p.scale));
          const py0 = Math.min(src.height - 1, Math.floor(sy * p.scale));
          if ((src.alpha[py0 * src.width + px0] as number) >= D.alphaThreshold) on++;
        }
      }
      if (on * 2 >= sub * sub) out[v * w2 + u] = 1;
    }
  }
  const built = build(out, w2, h2, p.scale, p.cleanliness);
  if (!built) return identity;
  return {
    prep: built,
    unrotate: (x: number, y: number): [number, number] => {
      const du = x - cxd;
      const dv = y - cyd;
      return [cs * du + sn * dv + cxs, -sn * du + cs * dv + cys];
    },
  };
}

/** A left–right mirrored copy (so right-hand sides reuse the left-hand code). */
export function flip(p: Prep): Prep {
  const px = new Uint8Array(p.w * p.h);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) px[y * p.w + x] = p.px[y * p.w + (p.w - 1 - x)] as number;
  }
  const rows = p.rows.map((runs) => runs.map((r) => ({ a: p.w - r.b, b: p.w - r.a })).reverse());
  const topY = new Int32Array(p.w);
  const firstBottom = new Int32Array(p.w);
  for (let x = 0; x < p.w; x++) {
    topY[x] = p.topY[p.w - 1 - x] as number;
    firstBottom[x] = p.firstBottom[p.w - 1 - x] as number;
  }
  return {
    ...p,
    px,
    rows,
    x0: p.w - p.x1,
    x1: p.w - p.x0,
    cx: p.w - p.cx,
    topY,
    firstBottom,
  };
}
