/**
 * Plain-background keying: a program-based way to cut a garment out of a photo whose background is
 * one flat colour (a floor, a bed sheet, a wall, a sheet of paper). Pure code: pixels in, numbers
 * out. The cutout service runs it next to the U-2-Netp model and `scoreCutout` picks the better
 * mask (docs/ARCHITECTURE.md "Background removal").
 *
 * Steps (all constants in `KEY_RULES`):
 * 1. Estimate the background colour model from a band along the image border: median colour and
 *    spread (75th percentile of the CIE76 distance to the median) in Lab. A border that is uniform
 *    enough is "plain"; otherwise keying is not attempted.
 * 2. Flood-fill from the border over pixels within a tolerance of the median. The tolerance grows
 *    with the spread, so textured or gradient backgrounds still key.
 * 3. Soft edge: pixels reached by the fill get alpha from their distance to the tolerance, but only
 *    in a thin halo next to the garment (elsewhere they are fully transparent).
 * 4. Holes: background-coloured regions the fill cannot reach are fully enclosed by garment. Small
 *    ones stay part of the garment; big ones (a gap between arm and body) are removed. Openings
 *    connected to the border (between trouser legs) are background by construction.
 * 5. Clean-up: connected pieces of the garment far smaller than the biggest one (dust, shadows,
 *    seams of the floor) are dropped.
 */
import { rgbToLab } from '../color/classify';

export const KEY_RULES = {
  /** Border band width as a fraction of the shorter side, and its minimum in pixels. */
  borderBand: 0.03,
  minBand: 2,
  /** The border is plain when this share of it lies within the tolerance, its spread is small and it is calm. */
  plainSpread: 12,
  plainShare: 0.3,
  /** Colour cell (Lab units) and radius used to find the border's main colour. */
  modeCell: 8,
  clusterRadius: 16,
  tightRadius: 10,
  /** The border may leave and re-enter the background colour this often (share of its length). */
  ringChanges: 0.04,
  minRingChanges: 12,
  /** Tolerance = tolBase + tolPerSpread * spread, never above tolMax (CIE76 units). */
  tolBase: 8,
  tolPerSpread: 2.5,
  tolMax: 40,
  /** Pixels within this fraction of the tolerance are fully background. */
  softStart: 0.5,
  /** Width of the soft halo around the garment, in pixels (at the keying resolution). */
  haloPx: 2,
  /** Enclosed background-coloured regions up to this share of the garment area are filled. */
  holeMaxShare: 0.02,
  /** Pieces smaller than this share of the biggest piece are dropped. */
  speckShare: 0.02,
} as const;

export interface BackgroundModel {
  /** Median Lab colour of the border. */
  L: number;
  a: number;
  b: number;
  /** 75th percentile of the distance of border pixels to the median. */
  spread: number;
  /** Colour distance within which a pixel counts as background. */
  tolerance: number;
  /** Share of border pixels within the tolerance. */
  borderShare: number;
  /** Whether the border is uniform enough to key. */
  plain: boolean;
}

/** Per-pixel Lab values of an RGBA image (channel-interleaved, 3 floats per pixel). */
function toLab(rgba: ArrayLike<number>, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  // Lab of the 256 grey-free combinations is not worth caching; recompute only when the colour
  // changes from the previous pixel (flat backgrounds make long runs).
  let pr = -1;
  let pg = -1;
  let pb = -1;
  let L = 0;
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const bl = rgba[i * 4 + 2];
    if (r !== pr || g !== pg || bl !== pb) {
      const lab = rgbToLab({ r, g, b: bl });
      L = lab.L;
      a = lab.a;
      b = lab.b;
      pr = r;
      pg = g;
      pb = bl;
    }
    out[i * 3] = L;
    out[i * 3 + 1] = a;
    out[i * 3 + 2] = b;
  }
  return out;
}

function median(values: number[]): number {
  const sorted = Float64Array.from(values).sort();
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Indices of the pixels in the border band. */
function borderIndices(w: number, h: number): number[] {
  const band = Math.max(KEY_RULES.minBand, Math.round(KEY_RULES.borderBand * Math.min(w, h)), 1);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    const edgeRow = y < band || y >= h - band;
    for (let x = 0; x < w; x++) {
      if (edgeRow || x < band || x >= w - band) out.push(y * w + x);
    }
  }
  return out;
}

function distanceMap(lab: Float32Array, model: BackgroundModel, n: number): Float32Array {
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    d[i] = Math.hypot(lab[i * 3] - model.L, lab[i * 3 + 1] - model.a, lab[i * 3 + 2] - model.b);
  }
  return d;
}

/** Pixels along the outermost ring of the image, in walking order. */
function outerRing(w: number, h: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < w; x++) out.push(x);
  for (let y = 1; y < h; y++) out.push(y * w + w - 1);
  for (let x = w - 2; x >= 0 && h > 1; x--) out.push((h - 1) * w + x);
  for (let y = h - 2; y >= 1 && w > 1; y--) out.push(y * w);
  return out;
}

/**
 * The most common colour of the border: the Lab cell (and its neighbours) holding the most border
 * pixels. Unlike a median it still finds the background when the garment touches much of the
 * border (a tightly cropped photo).
 */
function borderMode(lab: Float32Array, border: number[]): [number, number, number] {
  const cell = KEY_RULES.modeCell;
  const counts = new Map<string, number>();
  const keyOf = (i: number, j: number, k: number) => `${i},${j},${k}`;
  const cellOf = (p: number): [number, number, number] => [
    Math.floor(lab[p * 3] / cell),
    Math.floor(lab[p * 3 + 1] / cell),
    Math.floor(lab[p * 3 + 2] / cell),
  ];
  for (const p of border) {
    const [i, j, k] = cellOf(p);
    const key = keyOf(i, j, k);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = '';
  let bestCount = -1;
  for (const key of counts.keys()) {
    const [i, j, k] = key.split(',').map(Number);
    let sum = 0;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) sum += counts.get(keyOf(i + di, j + dj, k + dk)) ?? 0;
      }
    }
    if (sum > bestCount) {
      bestCount = sum;
      best = key;
    }
  }
  const [bi, bj, bk] = best.split(',').map(Number);
  return [(bi + 0.5) * cell, (bj + 0.5) * cell, (bk + 0.5) * cell];
}

function modelFromLab(lab: Float32Array, w: number, h: number): BackgroundModel {
  const border = borderIndices(w, h);
  const mode = borderMode(lab, border);
  const near = (p: number, c: readonly [number, number, number], r: number): boolean =>
    Math.hypot(lab[p * 3] - c[0], lab[p * 3 + 1] - c[1], lab[p * 3 + 2] - c[2]) <= r;
  // Median of the pixels around the mode: the background colour, free of garment pixels.
  let members = border.filter((p) => near(p, mode, KEY_RULES.clusterRadius));
  const centreOf = (ps: number[]): [number, number, number] => [
    median(ps.map((p) => lab[p * 3])),
    median(ps.map((p) => lab[p * 3 + 1])),
    median(ps.map((p) => lab[p * 3 + 2])),
  ];
  // A second, tighter pass around the first median drops dark garment edges that sit close by.
  const first = centreOf(members);
  members = border.filter((p) => near(p, first, KEY_RULES.tightRadius));
  const [L, a, b] = centreOf(members);
  const dist = members.map((p) =>
    Math.hypot(lab[p * 3] - L, lab[p * 3 + 1] - a, lab[p * 3 + 2] - b),
  );
  const spread = percentile(dist, 0.75);
  const tolerance = Math.min(KEY_RULES.tolMax, KEY_RULES.tolBase + KEY_RULES.tolPerSpread * spread);
  const centre: [number, number, number] = [L, a, b];
  const inside = border.filter((p) => near(p, centre, tolerance)).length;
  const borderShare = border.length === 0 ? 0 : inside / border.length;
  // A busy border (stripes, checks) flips in and out of the background colour over and over; a
  // garment touching the edge only changes a few times.
  const ring = outerRing(w, h);
  let changes = 0;
  let prev = near(ring[ring.length - 1] ?? 0, centre, tolerance);
  for (const p of ring) {
    const now = near(p, centre, tolerance);
    if (now !== prev) changes++;
    prev = now;
  }
  const calm = changes <= Math.max(KEY_RULES.minRingChanges, KEY_RULES.ringChanges * ring.length);
  return {
    L,
    a,
    b,
    spread,
    tolerance,
    borderShare,
    plain: spread <= KEY_RULES.plainSpread && borderShare >= KEY_RULES.plainShare && calm,
  };
}

/** Background colour model from the border band of an RGBA image. */
export function estimateBackground(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): BackgroundModel {
  if (rgba.length < width * height * 4) throw new Error('estimateBackground: buffer too small');
  return modelFromLab(toLab(rgba, width * height), width, height);
}

interface Components {
  labels: Int32Array;
  sizes: number[];
}

/** Connected components of the set pixels of `mask` (label 0 is unset; sizes[k] is label k). */
function components(mask: Uint8Array, w: number, h: number, eight: boolean): Components {
  const labels = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const label = sizes.length;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!eight && dx !== 0 && dy !== 0)) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = label;
            stack[top++] = q;
          }
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export interface KeyResult {
  /** Alpha 0..1, `width * height`. */
  alpha: Float32Array;
  model: BackgroundModel;
}

/**
 * Keys the plain background out of an RGBA image. `undefined` when the border is not plain (the
 * caller then relies on the model alone). A result is not necessarily good: `scoreCutout` judges.
 */
export function keyBackground(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): KeyResult | undefined {
  const n = width * height;
  if (rgba.length < n * 4) throw new Error('keyBackground: buffer too small');
  const lab = toLab(rgba, n);
  const model = modelFromLab(lab, width, height);
  if (!model.plain) return undefined;
  const tol = model.tolerance;
  const d = distanceMap(lab, model, n);

  // Flood fill from the border over background-coloured pixels (4-connected).
  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  for (const i of borderIndices(width, height)) {
    if (d[i] <= tol && !bg[i]) {
      bg[i] = 1;
      stack[top++] = i;
    }
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % width;
    const y = (p - x) / width;
    const visit = (q: number) => {
      if (!bg[q] && d[q] <= tol) {
        bg[q] = 1;
        stack[top++] = q;
      }
    };
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (y > 0) visit(p - width);
    if (y < height - 1) visit(p + width);
  }

  // Holes: background-coloured pixels the fill did not reach.
  const garmentArea = n - bg.reduce((s, v) => s + v, 0);
  const candidates = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (!bg[i] && d[i] <= tol) candidates[i] = 1;
  const holes = components(candidates, width, height, false);
  const holeLimit = KEY_RULES.holeMaxShare * garmentArea;
  for (let i = 0; i < n; i++) {
    const label = holes.labels[i];
    if (label && holes.sizes[label] > holeLimit) bg[i] = 1;
  }

  // Garment pixels, then the halo of soft alpha around them.
  let near = new Uint8Array(n);
  for (let i = 0; i < n; i++) near[i] = bg[i] ? 0 : 1;
  for (let pass = 0; pass < KEY_RULES.haloPx; pass++) {
    const grown = near.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (near[p]) continue;
        if (
          (x > 0 && near[p - 1]) ||
          (x < width - 1 && near[p + 1]) ||
          (y > 0 && near[p - width]) ||
          (y < height - 1 && near[p + width])
        ) {
          grown[p] = 1;
        }
      }
    }
    near = grown;
  }
  const alpha = new Float32Array(n);
  const lo = KEY_RULES.softStart * tol;
  for (let i = 0; i < n; i++) {
    if (!bg[i]) alpha[i] = 1;
    else if (near[i]) alpha[i] = smooth((d[i] - lo) / (tol - lo));
  }

  // Drop pieces far smaller than the biggest.
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (alpha[i] > 0.5) solid[i] = 1;
  const pieces = components(solid, width, height, true);
  const biggest = Math.max(0, ...pieces.sizes);
  const keep = KEY_RULES.speckShare * biggest;
  for (let i = 0; i < n; i++) {
    if (alpha[i] > 0 && !(solid[i] && pieces.sizes[pieces.labels[i]] >= keep)) {
      // Soft halo pixels next to a kept piece stay; everything else of a dropped piece goes.
      const x = i % width;
      const y = (i - x) / width;
      let touchesKept = false;
      for (let dy = -KEY_RULES.haloPx; dy <= KEY_RULES.haloPx && !touchesKept; dy++) {
        for (let dx = -KEY_RULES.haloPx; dx <= KEY_RULES.haloPx; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (solid[q] && pieces.sizes[pieces.labels[q]] >= keep) {
            touchesKept = true;
            break;
          }
        }
      }
      if (!touchesKept) alpha[i] = 0;
    }
  }
  return { alpha, model };
}

// ── scoring ────────────────────────────────────────────────────────────────────────────────────

export const SCORE_RULES = {
  /** Share of the frame the subject covers: 0 below `fractionMin`, 1 from `fractionOk`, ... */
  fractionMin: 0.02,
  fractionOk: 0.08,
  fractionOkMax: 0.9,
  fractionMax: 0.99,
  /** The two biggest pieces (a pair of shoes) should hold this much of the subject. */
  dominantFull: 0.92,
  dominantZero: 0.5,
  /** Share of uncertain alpha (0.1..0.9) among visible pixels: crisp is fine, blotchy is not. */
  blotchFull: 0.2,
  blotchZero: 0.6,
  /** Share of the border ring covered by the subject. */
  borderFull: 0.5,
  borderZero: 0.9,
  /** Overlap (IoU) of the two masks. */
  agreeFull: 0.8,
  agreeZero: 0.3,
  /** Minimum score to accept a cutout. */
  accept: 0.5,
} as const;

export interface CutoutScore {
  /** 0..1; `SCORE_RULES.accept` and above is a usable cutout. */
  score: number;
  parts: {
    fraction: number;
    dominant: number;
    crisp: number;
    border: number;
    /** 1 when there is no second mask to compare with. */
    agreement: number;
  };
  /** Share of the frame covered by the subject (alpha > 0.5). */
  subjectFraction: number;
}

const ramp = (v: number, zero: number, full: number): number =>
  Math.min(1, Math.max(0, (v - zero) / (full - zero)));

/** Intersection over union of the two masks (alpha > 0.5). */
export function maskAgreement(a: Float32Array, b: Float32Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const p = a[i] > 0.5;
    const q = b[i] > 0.5;
    if (p && q) inter++;
    if (p || q) union++;
  }
  return union === 0 ? 0 : inter / union;
}

/**
 * Quality of a cutout mask (alpha 0..1, `width * height`), judged without knowing the right
 * answer: a plausible share of the frame (not erased, not the whole frame), one dominant piece
 * (or two, for a pair), crisp rather than blotchy alpha, a subject that does not fill the border
 * ring, and, given `other`, agreement with the second method.
 */
export function scoreCutout(
  alpha: Float32Array,
  width: number,
  height: number,
  other?: Float32Array,
): CutoutScore {
  const n = width * height;
  if (alpha.length !== n) throw new Error('scoreCutout: size mismatch');
  const R = SCORE_RULES;
  const solid = new Uint8Array(n);
  let solidCount = 0;
  let visible = 0;
  let uncertain = 0;
  for (let i = 0; i < n; i++) {
    const a = alpha[i];
    if (a > 0.5) {
      solid[i] = 1;
      solidCount++;
    }
    if (a > 0.1) {
      visible++;
      if (a < 0.9) uncertain++;
    }
  }
  const subjectFraction = n === 0 ? 0 : solidCount / n;
  const fraction =
    Math.min(ramp(subjectFraction, R.fractionMin, R.fractionOk), 1) *
    (1 - ramp(subjectFraction, R.fractionOkMax, R.fractionMax));

  let dominant = 0;
  if (solidCount > 0) {
    const { sizes } = components(solid, width, height, true);
    const sorted = sizes.slice(1).sort((p, q) => q - p);
    const topTwo = (sorted[0] ?? 0) + (sorted[1] ?? 0);
    dominant = ramp(topTwo / solidCount, R.dominantZero, R.dominantFull);
  }
  const crisp = visible === 0 ? 0 : 1 - ramp(uncertain / visible, R.blotchFull, R.blotchZero);

  let ring = 0;
  let ringCovered = 0;
  for (const i of borderIndices(width, height)) {
    ring++;
    if (solid[i]) ringCovered++;
  }
  const border = ring === 0 ? 1 : 1 - ramp(ringCovered / ring, R.borderFull, R.borderZero);

  const agreement = other ? ramp(maskAgreement(alpha, other), R.agreeZero, R.agreeFull) : 1;
  const score = fraction * dominant * crisp * border * (0.5 + 0.5 * agreement);
  return {
    score,
    parts: { fraction, dominant, crisp, border, agreement },
    subjectFraction,
  };
}

export type CutoutMethod = 'u2net' | 'key';

export interface CutoutChoice {
  method: CutoutMethod;
  alpha: Float32Array;
  score: CutoutScore;
}

/**
 * Picks the better of the available masks (`undefined` entries are skipped), or `undefined` when
 * none reaches `SCORE_RULES.accept`. Ties go to the model (it understands more than colour).
 */
export function chooseCutout(
  width: number,
  height: number,
  candidates: { u2net?: Float32Array; key?: Float32Array },
): CutoutChoice | undefined {
  const { u2net, key } = candidates;
  const scored: CutoutChoice[] = [];
  if (u2net) {
    scored.push({ method: 'u2net', alpha: u2net, score: scoreCutout(u2net, width, height, key) });
  }
  if (key) {
    scored.push({ method: 'key', alpha: key, score: scoreCutout(key, width, height, u2net) });
  }
  scored.sort((a, b) => b.score.score - a.score.score);
  const best = scored[0];
  return best && best.score.score >= SCORE_RULES.accept ? best : undefined;
}
