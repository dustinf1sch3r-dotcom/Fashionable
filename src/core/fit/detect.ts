/**
 * Automatic rig detection from a cutout's alpha mask (docs/TRY_ON.md §12.2). Pure.
 *
 * The mask is thresholded, downsampled, cleaned (stray specks and pinholes removed) and straightened
 * (the tilt of its symmetry axis is undone). The right-hand side of a garment is detected by running
 * the left-hand code on a mirrored copy. Every rule's numbers live in `FIT_RULES.detect`.
 */
import type { GarmentRig, Point, RigKind } from '../model/types';
import { deskew, flip, prepare, type Prep, type Run } from './prep';
import { RIG_VERSION, type AlphaMask } from './contract';
import { FIT_RULES } from './weights';

const D = FIT_RULES.detect;
const C = FIT_RULES.confidence;

/** Points in cell coordinates of the straightened grid (x right, y down, cell edges). */
type Pt = Point;
type Pts = Record<string, Pt>;

interface Raw {
  points: Pts;
  /** Left/right pairs for the symmetry score. */
  pairs: [string, string][];
  /** Height the vertical symmetry error is measured against. */
  height: number;
  noNeck?: boolean;
  /** At least one sleeve was found (a neckless garment with sleeves is probably still a top). */
  sleeved?: boolean;
  badOrder?: boolean;
  badRatio?: boolean;
  notKind?: boolean;
}

const pt = (x: number, y: number): Pt => ({ x, y });

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function linfit(xs: number[], ys: number[]): { m: number; c: number } | undefined {
  const n = xs.length;
  if (n < 2) return undefined;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * (ys[i] as number), 0);
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return undefined;
  const m = (n * sxy - sx * sy) / den;
  return { m, c: (sy - m * sx) / n };
}

const rowL = (p: Prep, y: number): number => (p.rows[y] as Run[])[0]?.a ?? Infinity;
const rowR = (p: Prep, y: number): number => {
  const r = p.rows[y] as Run[];
  return r.length > 0 ? (r[r.length - 1] as Run).b : -Infinity;
};
const hasRow = (p: Prep, y: number): boolean =>
  y >= 0 && y < p.h && (p.rows[y] as Run[]).length > 0;

/**
 * The first row, walking from `start` in direction `dir`, whose run is nearly as wide as the widest
 * one in the next few rows: a slightly tilted straight edge still gives its full width.
 */
function edgeRow(
  start: number,
  dir: 1 | -1,
  limit: number,
  band: number,
  runAt: (y: number) => Run | undefined,
): { y: number; run: Run } | undefined {
  let maxW = 0;
  for (let k = 0; k < band; k++) {
    const y = start + dir * k;
    if (y < 0 || y >= limit) break;
    const r = runAt(y);
    if (r) maxW = Math.max(maxW, r.b - r.a);
  }
  if (maxW === 0) return undefined;
  for (let k = 0; k < band; k++) {
    const y = start + dir * k;
    if (y < 0 || y >= limit) break;
    const r = runAt(y);
    if (r && r.b - r.a >= D.edgeFill * maxW) return { y, run: r };
  }
  return undefined;
}

const outerRun =
  (p: Prep) =>
  (y: number): Run | undefined =>
    hasRow(p, y) ? { a: rowL(p, y), b: rowR(p, y) } : undefined;

/** The run (after merging runs closer than `tol`) that contains x, if any. */
function runAround(p: Prep, y: number, x: number, tol: number): Run | undefined {
  const merged: Run[] = [];
  for (const r of p.rows[y] as Run[]) {
    const last = merged[merged.length - 1];
    if (last && r.a - last.b <= tol) last.b = r.b;
    else merged.push({ a: r.a, b: r.b });
  }
  return merged.find((r) => r.a <= x && x < r.b);
}

// ── Upper body (tops, dresses, jumpsuits) ─────────────────────────────────────────────────────

interface Side {
  neck: Pt;
  noNeck: boolean;
  shoulder: Pt;
  armpit: Pt;
  cuffOuter?: Pt;
  cuffInner?: Pt;
  sleeved: boolean;
  /** Left edge of the torso beside a sleeve gap (undefined without a gap). */
  torso?: number;
}

/**
 * A sleeve with no jump below its cuff: a slit separates it from the torso for at least
 * `openSleeveSlit` of the height and the sleeve (the left run) goes on to the last row. Returns the
 * sleeve's last row and the torso's left edge beside the slit.
 */
function openSleeve(
  p: Prep,
  yMin: number,
  yEnd: number,
  minL: number,
  reachT: number,
  wb: number,
): { end: number; torso: number } | undefined {
  if (minL > p.x0 + 0.5 * wb) return undefined;
  const slit: { y: number; torso: number }[] = [];
  let misses = 0;
  for (let y = yMin; y < yEnd; y++) {
    const r = p.rows[y] as Run[];
    const first = r[0];
    const second = r[1];
    if (
      first &&
      second &&
      second.a - first.b >= D.minGap &&
      second.a < p.cx - D.gapFromCentre * wb &&
      first.a <= minL + reachT
    ) {
      slit.push({ y, torso: second.a });
      misses = 0;
    } else if (slit.length > 0 && ++misses > D.gapMisses) break;
  }
  if (slit.length < Math.max(3, D.openSleeveSlit * (yEnd - p.y0))) return undefined;
  const last = slit[slit.length - 1] as { y: number };
  // The sleeve is the left run alone, left of the slit, down to the last row.
  let end = last.y;
  while (end + 1 < yEnd) {
    const r = p.rows[end + 1] as Run[];
    const first = r[0];
    if (!first || first.a > minL + reachT || first.b >= p.cx - D.gapFromCentre * wb) break;
    end++;
  }
  if (end + 1 < yEnd) return undefined;
  const tail = slit.slice(-3).map((q) => q.torso);
  return { end, torso: median(tail) };
}

/** Left-hand side of the upper body. `hu` is the upper part's height; sleeves are searched above row `searchTo`. */
function leftSide(p: Prep, hu: number, searchTo: number): Side {
  const wb = p.x1 - p.x0;
  const yEnd = p.y1;
  // The top of this half: a tilted garment's two halves start at different rows.
  let y0 = p.y1;
  for (let x = p.x0; x < Math.min(p.x1, Math.ceil(p.cx)); x++) {
    const t = p.topY[x] as number;
    if (t >= 0) y0 = Math.min(y0, t);
  }

  // Outermost left point of the upper part, then the jump back to the torso at the cuff bottom.
  let yMin = y0;
  for (let y = y0; y < Math.min(yEnd, searchTo); y++) {
    if (hasRow(p, y) && rowL(p, y) < rowL(p, yMin)) yMin = y;
  }
  const minL = rowL(p, yMin);
  const jumpT = Math.max(2, D.cuffJump * wb);
  const reachT = Math.max(2, D.sleeveReach * wb);
  let jumpRow = -1;
  const after = Math.max(3, Math.ceil(D.minAfterCuff * (yEnd - y0)));
  // A leap of the left edge back towards the torso: one sharp step (a cuff that ends flat), or a
  // steady slant over a few rows (a sleeve whose underside runs diagonally into the torso). A slant
  // is a sleeve only if the torso below it is straight (the edge stays about where the slant ended)
  // rather than going on curving, as a waist does.
  const slantEnd = (y: number): number | undefined => {
    const W = D.cuffWindow;
    if (y + W >= yEnd) return undefined;
    for (let k = 0; k <= W; k++) if (!hasRow(p, y + k)) return undefined;
    for (let k = 0; k < W; k++) if (rowL(p, y + k + 1) < rowL(p, y + k)) return undefined;
    if (rowL(p, y + W) - rowL(p, y) < D.cuffSlant * jumpT) return undefined;
    if (rowL(p, y + W) - minL < reachT) return undefined;
    let e = y + W;
    while (
      e + 1 < yEnd - after &&
      hasRow(p, e + 1) &&
      rowL(p, e + 1) - rowL(p, e) >= D.cuffSlantStep
    ) {
      e++;
    }
    // A sleeve's underside is steep (a waist or a bust curves gently), and the sleeve really
    // sticks out: the slant ends well inside the outermost point.
    if (rowL(p, e) - rowL(p, y) < D.cuffSlope * (e - y)) return undefined;
    if (rowL(p, e) - minL < D.cuffSlantReach * wb) return undefined;
    const rows = Math.max(4, Math.ceil(D.cuffPlateau * (yEnd - y0)));
    for (let k = 1; k <= rows; k++) {
      if (!hasRow(p, e + k)) return undefined;
      if (Math.abs(rowL(p, e + k) - rowL(p, e + 1)) > D.cuffDrift * k) return undefined;
    }
    return e;
  };
  const chain = (from: number): number => {
    // A ragged, slanted cuff edge leaps in steps: the last leap of a chain is the one that reaches
    // the torso.
    let last = from;
    for (let k = 1; k <= D.cuffChainRows && last + k + 1 < yEnd; k++) {
      if (hasRow(p, last + k + 1) && rowL(p, last + k + 1) - rowL(p, last + k) >= jumpT) {
        last += k;
        k = 0;
      }
    }
    return last;
  };
  for (let y = yMin; y < yEnd - after; y++) {
    if (!hasRow(p, y + 1)) break;
    if (rowL(p, y + 1) - rowL(p, y) >= jumpT && rowL(p, y + 1) - minL >= reachT) {
      jumpRow = chain(y);
      break;
    }
  }
  if (jumpRow < 0) {
    // No sharp step: a sleeve whose underside is a slant, if there is one.
    for (let y = yMin; y < yEnd - after; y++) {
      const e = slantEnd(y);
      if (e !== undefined) {
        jumpRow = chain(e);
        break;
      }
    }
  }
  let jumpTorso: number | undefined;
  if (jumpRow < 0) {
    // Sleeves that reach the bottom row (a jacket whose sleeves are longer than its body): there is
    // no jump back to the torso, but a slit between sleeve and torso that is open at the bottom.
    const found = openSleeve(p, yMin, yEnd, minL, reachT, wb);
    if (found) {
      jumpRow = found.end;
      jumpTorso = found.torso;
    }
  }
  let sleeved = jumpRow >= 0;

  let torsoL = Infinity;
  /** Left edge of the body just below the cuff: bounds the sleeve pixels. */
  let torsoJump = Infinity;
  let sleeveEnd = jumpRow;
  let armpit: Pt | undefined;
  let gapTorso: number | undefined;
  if (sleeved) {
    torsoJump = jumpTorso ?? median([2, 3, 4].map((k) => rowL(p, Math.min(yEnd - 1, jumpRow + k))));
    torsoL = torsoJump;
    while (
      sleeveEnd + 1 < yEnd &&
      hasRow(p, sleeveEnd + 1) &&
      rowL(p, sleeveEnd + 1) < torsoJump - 0.5
    ) {
      sleeveEnd++;
    }
    // Gap between sleeve and torso (sleeves hanging beside the body): its apex is the armpit.
    const gapRows: { y: number; w: number; mid: number; torso: number }[] = [];
    let misses = 0;
    for (let y = y0; y <= jumpRow; y++) {
      const r = p.rows[y] as Run[];
      const first = r[0];
      const second = r[1];
      if (
        first &&
        second &&
        second.a - first.b >= D.minGap &&
        second.a < p.cx - D.gapFromCentre * wb
      ) {
        gapRows.push({ y, w: second.a - first.b, mid: (first.b + second.a) / 2, torso: second.a });
        misses = 0;
      } else if (gapRows.length > 0 && ++misses > D.gapMisses) {
        if (gapRows.length >= 3) break;
        // A short run of rows is noise, not the sleeve gap: start over.
        gapRows.length = 0;
        misses = 0;
      }
    }
    if (gapRows.length >= 3) {
      const maxGap = Math.max(...gapRows.map((g) => g.w));
      let upto = 0;
      while (upto < gapRows.length && (gapRows[upto] as { w: number }).w <= D.apexFill * maxGap) {
        upto++;
      }
      const head = gapRows.slice(0, Math.max(3, upto));
      const fit = linfit(
        head.map((g) => g.y + 0.5),
        head.map((g) => g.w),
      );
      const firstRow = (gapRows[0] as { y: number }).y;
      let apexY = firstRow;
      if (fit && fit.m > D.apexMinSlope && maxGap >= D.apexMinGap)
        apexY = clamp(-fit.c / fit.m, firstRow - D.apexBack * hu, firstRow);
      armpit = pt((gapRows[0] as { mid: number }).mid, apexY);
      torsoL = median(gapRows.slice(0, 5).map((g) => g.torso));
      gapTorso = median(gapRows.slice(-5).map((g) => g.torso));
    }
  }

  // Shoulder: the top edge where the torso's side meets it (or the strap's outer corner).
  const bandRows = Math.max(1, Math.round(0.02 * hu));
  let bandMin = Infinity;
  for (let y = y0; y < Math.min(yEnd, y0 + bandRows); y++) bandMin = Math.min(bandMin, rowL(p, y));
  const shoulderAt = (torso: number): Pt => {
    const xs = sleeved ? torso : bandMin;
    let col = clamp(Math.floor(xs), p.x0, p.x1 - 1);
    while (col < p.x1 - 1 && (p.topY[col] as number) < 0) col++;
    return pt(xs, p.topY[col] as number);
  };
  let shoulder = shoulderAt(torsoL);

  // Neck: where the collar dip meets the top edge, walking left from the centre.
  const cc = clamp(Math.floor(p.cx), 0, p.w - 1);
  const topC = p.topY[cc] as number;
  const dip = topC < 0 ? hu : topC - y0;
  let neck: Pt | undefined;
  if (dip >= Math.max(2, D.neckDip * hu)) {
    const thr = y0 + Math.max(1, D.neckEdge * dip);
    for (let x = cc; x >= p.x0; x--) {
      const t = p.topY[x] as number;
      if (t >= 0 && t <= thr) {
        neck = pt(x + 1, t);
        break;
      }
    }
  }
  const noNeck = neck === undefined;
  if (!neck) neck = pt(p.cx - D.neckFallback * 2 * Math.max(1, p.cx - shoulder.x), y0);

  let cuffOuter: Pt | undefined;
  let cuffInner: Pt | undefined;
  if (sleeved) {
    // Sleeve pixels: outside the torso, in the contiguous rows around the outermost point.
    let yFirst = yMin;
    while (yFirst - 1 >= y0 && hasRow(p, yFirst - 1) && rowL(p, yFirst - 1) < torsoJump - 0.5) {
      yFirst--;
    }
    const pxs: Pt[] = [];
    for (let y = yFirst; y <= sleeveEnd; y++) {
      for (const r of p.rows[y] as Run[]) {
        const to = Math.min(r.b, Math.ceil(torsoJump - 0.5));
        for (let x = r.a; x < to; x++) pxs.push(pt(x + 0.5, y + 0.5));
      }
    }
    if (pxs.length > 0) {
      const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
      let far = pxs[0] as Pt;
      for (const q of pxs) if (dist(shoulder, q) > dist(shoulder, far)) far = q;
      let dx = far.x - shoulder.x;
      let dy = far.y - shoulder.y;
      let outer = far;
      let inner = far;
      const depth = Math.max(1.5, D.cuffSlab * hu);
      for (let iter = 0; iter < 3; iter++) {
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const t = (q: Pt): number => (q.x - shoulder.x) * dx + (q.y - shoulder.y) * dy;
        let tmax = -Infinity;
        for (const q of pxs) tmax = Math.max(tmax, t(q));
        outer = far;
        inner = far;
        let first = true;
        for (const q of pxs) {
          if (t(q) < tmax - depth) continue;
          if (first || q.x < outer.x) outer = q;
          if (first || q.x > inner.x) inner = q;
          first = false;
        }
        dx = (outer.x + inner.x) / 2 - shoulder.x;
        dy = (outer.y + inner.y) / 2 - shoulder.y;
      }
      cuffOuter = pt(outer.x - 0.5, outer.y);
      cuffInner = pt(inner.x + 0.5, inner.y);
    } else sleeved = false;
  }

  if (sleeved && !armpit) {
    // No gap: the sleeve's underside meets the torso at the lowest point of the columns between
    // the cuff and the torso (their first vertical run ends at the sleeve's underside).
    // A sleeve whose underside is flat (or whose cuff meets the torso) has no slanted underside to
    // scan: look at the few columns under it, left of the torso's edge.
    const from = clamp(
      Math.floor(Math.min((cuffInner as Pt).x, torsoJump - D.undersideCols)),
      p.x0,
      p.x1 - 1,
    );
    let best = -1;
    const fb = (c: number): number => {
      const a = p.firstBottom[Math.max(p.x0, c - 1)] as number;
      const b = p.firstBottom[c] as number;
      const d = p.firstBottom[Math.min(p.x1 - 1, c + 1)] as number;
      return a < 0 || b < 0 || d < 0 ? b : median([a, b, d]);
    };
    const profile: { c: number; b: number }[] = [];
    for (let c = Math.max(from, Math.ceil(torsoJump) - 1); c >= from; c--) {
      const b = fb(c);
      if (b >= 0) profile.push({ c, b });
    }
    // The highest point of the underside; on a (nearly) flat underside the one next to the torso.
    const bestB = profile.length > 0 ? Math.min(...profile.map((q) => q.b)) : Infinity;
    const tie = Math.max(1, D.armpitTie * hu);
    for (const q of profile) {
      if (q.b <= bestB + tie) {
        best = q.c;
        break;
      }
    }
    if (best >= 0) {
      armpit = pt(best + 0.5, (profile.find((q) => q.c === best) as { b: number }).b);
      torsoL = best + 0.5;
    } else armpit = pt(torsoJump, sleeveEnd + 1);
    shoulder = shoulderAt(torsoL);
  } else if (sleeved && armpit) shoulder = shoulderAt(torsoL);

  if (!armpit) {
    // Sleeveless: the armhole's bottom, where the left edge first reaches the torso's side.
    const lim = Math.min(yEnd, Math.ceil(y0 + D.armholeMax * hu));
    let m = Infinity;
    for (let y = y0; y < lim; y++) if (hasRow(p, y)) m = Math.min(m, rowL(p, y));
    let at = y0;
    for (let y = y0; y < lim; y++) {
      if (hasRow(p, y) && rowL(p, y) <= m) {
        at = y;
        break;
      }
    }
    armpit = pt(m, at + 0.5);
  }
  armpit = pt(armpit.x, Math.max(armpit.y, shoulder.y + 0.03 * hu));
  return { neck, noNeck, shoulder, armpit, cuffOuter, cuffInner, sleeved, torso: gapTorso };
}

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

interface Upper {
  points: Pts;
  noNeck: boolean;
  sleeved: boolean;
  oneSided: boolean;
  /** Torso edges beside the sleeve gaps, where there are gaps. */
  torsoL?: number;
  torsoR?: number;
}

function upper(p: Prep, hu: number, searchTo: number): Upper {
  const l = leftSide(p, hu, searchTo);
  const f = flip(p);
  const r = leftSide(f, hu, searchTo);
  const m = (q: Pt): Pt => pt(p.w - q.x, q.y);
  const points: Pts = {
    neckL: l.neck,
    neckR: m(r.neck),
    shoulderL: l.shoulder,
    shoulderR: m(r.shoulder),
    armpitL: l.armpit,
    armpitR: m(r.armpit),
  };
  if (l.cuffOuter && l.cuffInner) {
    points.cuffOuterL = l.cuffOuter;
    points.cuffInnerL = l.cuffInner;
  }
  if (r.cuffOuter && r.cuffInner) {
    points.cuffOuterR = m(r.cuffOuter);
    points.cuffInnerR = m(r.cuffInner);
  }
  return {
    points,
    noNeck: l.noNeck || r.noNeck,
    sleeved: l.sleeved || r.sleeved,
    oneSided: l.sleeved !== r.sleeved,
    torsoL: l.torso,
    torsoR: r.torso === undefined ? undefined : p.w - r.torso,
  };
}

const UPPER_PAIRS: [string, string][] = [
  ['neckL', 'neckR'],
  ['shoulderL', 'shoulderR'],
  ['armpitL', 'armpitR'],
  ['cuffOuterL', 'cuffOuterR'],
  ['cuffInnerL', 'cuffInnerR'],
];

function upperOrderOk(pts: Pts): boolean {
  const g = (n: string): Pt => pts[n] as Pt;
  if (!(g('neckL').x < g('neckR').x)) return false;
  if (!(g('shoulderL').x < g('shoulderR').x)) return false;
  if (!(g('armpitL').y > g('shoulderL').y && g('armpitR').y > g('shoulderR').y)) return false;
  if (!(g('armpitL').x < g('armpitR').x)) return false;
  for (const s of ['L', 'R']) {
    const c = pts[`cuffOuter${s}`];
    if (c && !(c.y > g(`shoulder${s}`).y)) return false;
  }
  return true;
}

/** The narrowest row of the body (the run containing the centre) in a band of the height. */
function findWaist(
  p: Prep,
  from: number,
  to: number,
): { y: number; a: number; b: number } | undefined {
  const wb = p.x1 - p.x0;
  const rows: { y: number; w: number; a: number; b: number }[] = [];
  for (let y = Math.max(p.y0, Math.ceil(from)); y < Math.min(p.y1, Math.floor(to)); y++) {
    const r = runAround(p, y, p.cx, 0.06 * wb);
    if (r) rows.push({ y, w: r.b - r.a, a: r.a, b: r.b });
  }
  if (rows.length < 5) return undefined;
  const smooth = rows.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -2; k <= 2; k++) {
      const q = rows[i + k];
      if (q) {
        s += q.w;
        n++;
      }
    }
    return s / n;
  });
  const lo = Math.min(...smooth);
  const ties: number[] = [];
  smooth.forEach((w, i) => {
    if (w <= lo + 0.5) ties.push(i);
  });
  return rows[ties[Math.floor(ties.length / 2)] as number];
}

// ── Legs ──────────────────────────────────────────────────────────────────────────────────────

interface Legs {
  crotch: Pt;
  crotchRow: number;
  gapLength: number;
  hemOuterL: Pt;
  hemInnerL: Pt;
  hemOuterR: Pt;
  hemInnerR: Pt;
}

function findLegs(p: Prep): Legs | undefined {
  const wb = p.x1 - p.x0;
  const minLeg = Math.max(2, D.minLeg * wb);
  const gapsAt = (y: number): { a: number; b: number }[] => {
    const r = p.rows[y] as Run[];
    const out: { a: number; b: number }[] = [];
    for (let i = 1; i < r.length; i++) {
      const left = r[i - 1] as Run;
      const right = r[i] as Run;
      if (
        Math.abs((left.b + right.a) / 2 - p.cx) <= D.legGapCentre * wb &&
        right.a - left.b >= D.minGap &&
        left.b - left.a >= minLeg &&
        right.b - right.a >= minLeg
      ) {
        out.push({ a: left.b, b: right.a });
      }
    }
    return out;
  };
  // Lowest row that already shows two legs.
  let yStart = -1;
  for (let y = p.y1 - 1; y >= p.y0 + 1 && y > p.y1 - 1 - Math.ceil(0.15 * (p.y1 - p.y0)); y--) {
    if (gapsAt(y).length > 0) {
      yStart = y;
      break;
    }
  }
  if (yStart < 0) return undefined;
  const nearest = (
    gs: { a: number; b: number }[],
    c: number,
  ): { a: number; b: number } | undefined =>
    gs.reduce<{ a: number; b: number } | undefined>(
      (best, g) =>
        !best || Math.abs((g.a + g.b) / 2 - c) < Math.abs((best.a + best.b) / 2 - c) ? g : best,
      undefined,
    );
  const start = nearest(gapsAt(yStart), p.cx);
  if (!start) return undefined;
  const trace = new Map<number, { a: number; b: number }>();
  trace.set(yStart, start);
  let center = (start.a + start.b) / 2;
  let top = yStart;
  for (let y = yStart - 1; y >= p.y0; y--) {
    const g = nearest(gapsAt(y), center);
    if (!g || Math.abs((g.a + g.b) / 2 - center) > Math.max(3, 0.12 * wb)) break;
    trace.set(y, g);
    center = (g.a + g.b) / 2;
    top = y;
  }
  const gapLength = yStart + 1 - top;
  // Crotch apex: extrapolate how the gap opens to zero width.
  const ys: number[] = [];
  const ws: number[] = [];
  let maxGap = 0;
  for (const g of trace.values()) maxGap = Math.max(maxGap, g.b - g.a);
  for (let y = top; y <= yStart; y++) {
    const g = trace.get(y);
    if (!g || g.b - g.a > D.apexFill * maxGap) break;
    ys.push(y + 0.5);
    ws.push(g.b - g.a);
  }
  const fit = ys.length >= 3 ? linfit(ys, ws) : undefined;
  let apex = top;
  if (fit && fit.m > 0.05) {
    apex = clamp(-fit.c / fit.m, top - D.apexBack * (p.y1 - p.y0), top);
  }
  const topGap = trace.get(top) as { a: number; b: number };
  const crotch = pt((topGap.a + topGap.b) / 2, apex);

  // Hems: each leg's lowest row.
  const gcOf = (y: number): number => {
    let yy = y;
    while (yy > top && !trace.has(yy)) yy--;
    const g = trace.get(Math.min(yy, yStart)) as { a: number; b: number };
    return (g.a + g.b) / 2;
  };
  const gcLow = gcOf(yStart);
  const leftAt = (y: number): Run | undefined => {
    const r = (p.rows[y] as Run[]).filter((q) => q.b <= gcLow + 1);
    return r[r.length - 1];
  };
  const rightAt = (y: number): Run | undefined =>
    (p.rows[y] as Run[]).find((q) => q.a >= gcLow - 1);
  let yl = -1;
  let yr = -1;
  for (let y = p.y1 - 1; y > top; y--) {
    if (yl < 0 && leftAt(y)) yl = y;
    if (yr < 0 && rightAt(y)) yr = y;
    if (yl >= 0 && yr >= 0) break;
  }
  if (yl < 0 || yr < 0) return undefined;
  const lr = edgeRow(yl, -1, p.y1, D.edgeBand, leftAt);
  const rr = edgeRow(yr, -1, p.y1, D.edgeBand, rightAt);
  if (!lr || !rr) return undefined;
  return {
    crotch,
    crotchRow: top,
    gapLength,
    hemOuterL: pt(lr.run.a, lr.y + 1),
    hemInnerL: pt(lr.run.b, lr.y + 1),
    hemOuterR: pt(rr.run.b, rr.y + 1),
    hemInnerR: pt(rr.run.a, rr.y + 1),
  };
}

// ── Kinds ─────────────────────────────────────────────────────────────────────────────────────

function bottomHem(p: Prep): { a: number; b: number; y: number } | undefined {
  const wb = p.x1 - p.x0;
  const hb = p.y1 - p.y0;
  const runAt = (y: number): Run | undefined => runAround(p, y, p.cx, 0.06 * wb);
  for (let y = p.y1 - 1; y >= p.y0; y--) {
    if (!runAt(y)) continue;
    // A wavy hem (wrinkles, a curled corner) leaves a few short rows at the bottom: the hem is the
    // lowest row that is nearly as wide as the rows just above it.
    const widths: number[] = [];
    for (let k = Math.ceil(D.hemRefFrom * hb); k <= Math.ceil(D.hemRefTo * hb); k++) {
      const r = y - k >= p.y0 ? runAt(y - k) : undefined;
      if (r) widths.push(r.b - r.a);
    }
    if (widths.length >= 3) {
      const ref = median(widths);
      for (let yy = y; yy >= Math.max(p.y0, y - Math.ceil(D.hemSearch * hb)); yy--) {
        const r = runAt(yy);
        if (r && r.b - r.a >= D.hemFill * ref) return { a: r.a, b: r.b, y: yy + 1 };
      }
    }
    const e = edgeRow(y, -1, p.y1, D.edgeBand, runAt);
    return e ? { a: e.run.a, b: e.run.b, y: e.y + 1 } : undefined;
  }
  return undefined;
}

function detectTop(p: Prep): Raw | undefined {
  const hb = p.y1 - p.y0;
  const up = upper(p, hb, p.y0 + 0.8 * hb);
  const hem = bottomHem(p);
  if (!hem) return undefined;
  // Sleeves reaching past the torso's hem merge with it at that row: the hem is the torso's own.
  if (up.torsoL !== undefined && hem.a < up.torsoL - 1) hem.a = up.torsoL;
  if (up.torsoR !== undefined && hem.b > up.torsoR + 1) hem.b = up.torsoR;
  const points: Pts = { ...up.points, hemL: pt(hem.a, hem.y), hemR: pt(hem.b, hem.y) };
  const g = up.points;
  const sw = (g.shoulderR as Pt).x - (g.shoulderL as Pt).x;
  const length = hem.y - ((g.shoulderL as Pt).y + (g.shoulderR as Pt).y) / 2;
  const ok =
    upperOrderOk(g) && hem.y > (g.armpitL as Pt).y && hem.y > (g.armpitR as Pt).y && hem.a < hem.b;
  return {
    points,
    pairs: [...UPPER_PAIRS, ['hemL', 'hemR']],
    height: hb,
    noNeck: up.noNeck,
    sleeved: up.sleeved,
    badOrder: !ok,
    badRatio: up.oneSided || !(length / sw >= 0.2 && length / sw <= 4),
  };
}

function detectTrousers(p: Prep): Raw | undefined {
  const legs = findLegs(p);
  if (!legs) return undefined;
  const hb = p.y1 - p.y0;
  if (legs.gapLength < 0.1 * hb) return undefined;
  const top = edgeRow(p.y0, 1, p.y1, D.edgeBand, outerRun(p));
  if (!top) return undefined;
  const y0 = top.y;
  const yHip = y0 + D.hipAlongRise * (legs.crotch.y - y0);
  const rowHip = clamp(Math.floor(yHip), y0, p.y1 - 1);
  const points: Pts = {
    waistL: pt(top.run.a, y0),
    waistR: pt(top.run.b, y0),
    hipL: pt(rowL(p, rowHip), yHip),
    hipR: pt(rowR(p, rowHip), yHip),
    crotch: legs.crotch,
    hemOuterL: legs.hemOuterL,
    hemInnerL: legs.hemInnerL,
    hemOuterR: legs.hemOuterR,
    hemInnerR: legs.hemInnerR,
  };
  const frac = (legs.crotch.y - y0) / hb;
  const ok =
    yHip > y0 &&
    legs.crotch.y > yHip &&
    legs.hemInnerL.y > legs.crotch.y &&
    legs.hemInnerR.y > legs.crotch.y &&
    legs.hemOuterL.x < legs.hemInnerL.x &&
    legs.hemInnerR.x < legs.hemOuterR.x;
  return {
    points,
    pairs: [
      ['waistL', 'waistR'],
      ['hipL', 'hipR'],
      ['hemOuterL', 'hemOuterR'],
      ['hemInnerL', 'hemInnerR'],
    ],
    height: hb,
    badOrder: !ok,
    badRatio: !(frac >= 0.08 && frac <= 0.9),
  };
}

/** Does the top edge of the garment look like a collar dip (two runs far apart)? */
function topSplit(p: Prep, y0: number): boolean {
  const wb = p.x1 - p.x0;
  const y = Math.min(p.y1 - 1, y0 + Math.max(2, Math.round(0.03 * (p.y1 - p.y0))));
  const r = p.rows[y] as Run[];
  return r.some((q, i) => i > 0 && q.a - (r[i - 1] as Run).b > 0.06 * wb);
}

function detectSkirt(p: Prep): Raw | undefined {
  const hb = p.y1 - p.y0;
  const legs = findLegs(p);
  if (legs && legs.gapLength >= 0.25 * hb) return undefined;
  const top = edgeRow(p.y0, 1, p.y1, D.edgeBand, outerRun(p));
  let yb = p.y1 - 1;
  while (yb > p.y0 && !hasRow(p, yb)) yb--;
  const bottom = edgeRow(yb, -1, p.y1, D.edgeBand, outerRun(p));
  if (!top || !bottom) return undefined;
  const y0 = top.y;
  const yHip = y0 + D.hipAlongSkirt * (bottom.y + 1 - y0);
  const rowHip = clamp(Math.floor(yHip), y0, p.y1 - 1);
  const points: Pts = {
    waistL: pt(top.run.a, y0),
    waistR: pt(top.run.b, y0),
    hipL: pt(rowL(p, rowHip), yHip),
    hipR: pt(rowR(p, rowHip), yHip),
    hemL: pt(bottom.run.a, bottom.y + 1),
    hemR: pt(bottom.run.b, bottom.y + 1),
  };
  const waistW = (points.waistR as Pt).x - (points.waistL as Pt).x;
  const hemW = (points.hemR as Pt).x - (points.hemL as Pt).x;
  const hipW = (points.hipR as Pt).x - (points.hipL as Pt).x;
  const ok = waistW > 0 && hipW > 0 && hemW > 0;
  return {
    points,
    pairs: [
      ['waistL', 'waistR'],
      ['hipL', 'hipR'],
      ['hemL', 'hemR'],
    ],
    height: hb,
    badOrder: !ok,
    badRatio: !ok || !(hb / waistW >= 0.25 && hb / waistW <= 4) || hemW < 0.5 * waistW,
    // A skirt's top edge is one run; a collar dip or two straps mean this is something else.
    notKind: topSplit(p, top.y),
  };
}

function detectDress(p: Prep): Raw | undefined {
  const hb = p.y1 - p.y0;
  const wb = p.x1 - p.x0;
  const waist = findWaist(p, p.y0 + D.waistBand[0] * hb, p.y0 + D.waistBand[1] * hb);
  const hem = bottomHem(p);
  if (!waist || !hem) return undefined;
  const waistY = waist.y + 0.5;
  const up = upper(p, waistY - p.y0, p.y0 + 0.6 * hb);
  const yHip = waistY + D.hipAlongSkirt * (hem.y - waistY);
  const hipRun = runAround(p, clamp(Math.floor(yHip), p.y0, p.y1 - 1), p.cx, 0.06 * wb);
  if (!hipRun) return undefined;
  const points: Pts = {
    ...up.points,
    waistL: pt(waist.a, waistY),
    waistR: pt(waist.b, waistY),
    hipL: pt(hipRun.a, yHip),
    hipR: pt(hipRun.b, yHip),
    hemL: pt(hem.a, hem.y),
    hemR: pt(hem.b, hem.y),
  };
  const g = up.points;
  const ok =
    upperOrderOk(g) &&
    waistY > Math.max((g.armpitL as Pt).y, (g.armpitR as Pt).y) &&
    hem.y > yHip &&
    yHip > waistY;
  return {
    points,
    pairs: [...UPPER_PAIRS, ['waistL', 'waistR'], ['hipL', 'hipR'], ['hemL', 'hemR']],
    height: hb,
    noNeck: up.noNeck,
    sleeved: up.sleeved,
    badOrder: !ok,
    badRatio: up.oneSided || (hem.y - waistY) / hb < 0.15,
  };
}

function detectJumpsuit(p: Prep): Raw | undefined {
  const hb = p.y1 - p.y0;
  const wb = p.x1 - p.x0;
  const legs = findLegs(p);
  if (!legs || legs.gapLength < 0.1 * hb) return undefined;
  const crotchFrac = (legs.crotch.y - p.y0) / hb;
  const waist = findWaist(
    p,
    p.y0 + D.waistBand[0] * hb,
    p.y0 + Math.min(D.waistBand[1], crotchFrac - 0.08) * hb,
  );
  if (!waist) return undefined;
  const waistY = waist.y + 0.5;
  const up = upper(p, waistY - p.y0, p.y0 + 0.6 * hb);
  const yHip = waistY + D.hipAlongRise * (legs.crotch.y - waistY);
  const hipRun = runAround(p, clamp(Math.floor(yHip), p.y0, p.y1 - 1), p.cx, 0.06 * wb);
  if (!hipRun) return undefined;
  const points: Pts = {
    ...up.points,
    waistL: pt(waist.a, waistY),
    waistR: pt(waist.b, waistY),
    hipL: pt(hipRun.a, yHip),
    hipR: pt(hipRun.b, yHip),
    crotch: legs.crotch,
    hemOuterL: legs.hemOuterL,
    hemInnerL: legs.hemInnerL,
    hemOuterR: legs.hemOuterR,
    hemInnerR: legs.hemInnerR,
  };
  const g = up.points;
  const ok =
    upperOrderOk(g) &&
    waistY > Math.max((g.armpitL as Pt).y, (g.armpitR as Pt).y) &&
    legs.crotch.y > yHip &&
    legs.hemInnerL.y > legs.crotch.y;
  return {
    points,
    pairs: [
      ...UPPER_PAIRS,
      ['waistL', 'waistR'],
      ['hipL', 'hipR'],
      ['hemOuterL', 'hemOuterR'],
      ['hemInnerL', 'hemInnerR'],
    ],
    height: hb,
    noNeck: up.noNeck,
    sleeved: up.sleeved,
    badOrder: !ok,
    badRatio: up.oneSided || !(crotchFrac >= 0.3 && crotchFrac <= 0.8),
  };
}

// ── Confidence ────────────────────────────────────────────────────────────────────────────────

function confidenceOf(raw: Raw, cleanliness: number): number {
  const pts = raw.points;
  const mids: number[] = [];
  for (const [a, b] of raw.pairs) {
    const l = pts[a];
    const r = pts[b];
    if (l && r) mids.push((l.x + r.x) / 2);
  }
  const center = mids.length > 0 ? mids.reduce((x, y) => x + y, 0) / mids.length : 0;
  let sum = 0;
  let n = 0;
  for (const [a, b] of raw.pairs) {
    const l = pts[a];
    const r = pts[b];
    if (!l || !r) continue;
    const dl = center - l.x;
    const dr = r.x - center;
    const ex = dl + dr > 0 ? Math.abs(dl - dr) / (dl + dr) / C.asymmetryX : 1;
    const ey = Math.abs(l.y - r.y) / (C.asymmetryY * raw.height);
    sum += clamp(ex, 0, 1) + clamp(ey, 0, 1);
    n += 2;
  }
  const asym = n > 0 ? sum / n : 1;
  let c = cleanliness * (1 - C.asymmetry * asym);
  if (raw.noNeck) c *= raw.sleeved ? C.noNeckSleeved : C.noNeck;
  if (raw.badOrder) c *= C.badOrder;
  if (raw.badRatio) c *= C.badRatio;
  if (raw.notKind) c *= C.notKind;
  return clamp(c, 0, 1);
}

/** What detection found besides the rig: used to judge how the garment was photographed. */
export interface GarmentStructure {
  rig: GarmentRig | undefined;
  /** Sleeves found (0–2); `undefined` for kinds without an upper body. */
  sleeves?: number;
  /** A neck dip was found (tops, dresses, jumpsuits). */
  neck?: boolean;
  /** Trousers and jumpsuits: the gap between the legs was found. */
  legGap?: boolean;
}

function run(mask: AlphaMask, kind: RigKind): GarmentStructure | undefined {
  const base = prepare(mask);
  if (!base) return { rig: undefined };
  const { prep, unrotate } = deskew(
    base,
    kind === 'trousers' || kind === 'skirt' ? 'topEdge' : 'bbox',
  );
  const raw =
    kind === 'top'
      ? detectTop(prep)
      : kind === 'trousers'
        ? detectTrousers(prep)
        : kind === 'skirt'
          ? detectSkirt(prep)
          : kind === 'dress'
            ? detectDress(prep)
            : detectJumpsuit(prep);
  const upperKind = kind === 'top' || kind === 'dress' || kind === 'jumpsuit';
  const legKind = kind === 'trousers' || kind === 'jumpsuit';
  if (!raw) return { rig: undefined, ...(legKind ? { legGap: false } : {}) };
  const points: Record<string, Point> = {};
  for (const [name, q] of Object.entries(raw.points)) {
    const [gx, gy] = unrotate(q.x, q.y);
    points[name] = {
      x: clamp((gx * base.scale) / mask.width, 0, 1),
      y: clamp((gy * base.scale) / mask.height, 0, 1),
    };
  }
  const rig: GarmentRig = {
    kind,
    version: RIG_VERSION,
    points,
    confidence: confidenceOf(raw, base.cleanliness),
    edited: false,
  };
  return {
    rig,
    ...(upperKind
      ? {
          sleeves: ['cuffOuterL', 'cuffOuterR'].filter((n) => n in points).length,
          neck: !raw.noNeck,
        }
      : {}),
    ...(legKind ? { legGap: true } : {}),
  };
}

/** Automatic rig detection from the cutout's alpha mask (§12.2). */
export function detectRig(mask: AlphaMask, kind: RigKind): GarmentRig | undefined {
  return run(mask, kind)?.rig;
}

/** Detection plus what it saw (sleeves, neck, gap between the legs), for capture checks. */
export function detectStructure(mask: AlphaMask, kind: RigKind): GarmentStructure {
  return run(mask, kind) ?? { rig: undefined };
}
