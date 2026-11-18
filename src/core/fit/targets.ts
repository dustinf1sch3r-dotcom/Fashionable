/**
 * Where each rig point should land on a body (docs/TRY_ON.md §12.3). Pure.
 *
 * Garment points are converted to garment units (x × aspect, y). Each garment gets one physical
 * scale `s` (body reference width ÷ garment reference width); every length is the garment's own
 * length × s measured along the body from its start point, then clamped to the hem bounds in
 * `FIT_RULES.target` (docs/TRY_ON.md §12.3).
 */
import type { FitBody, GarmentRig, Point } from '../model/types';
import { FIT_RULES } from './weights';

type Slot = 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece';

const T = FIT_RULES.target;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Linear interpolation of x along a polyline of points going down (y increasing). */
function xAtY(poly: readonly Point[], y: number): number {
  const first = poly[0] as Point;
  if (y <= first.y) return first.x;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1] as Point;
    const b = poly[i] as Point;
    if (y <= b.y) return b.y === a.y ? b.x : a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  const a = poly[poly.length - 2] as Point;
  const b = poly[poly.length - 1] as Point;
  return b.y === a.y ? b.x : b.x + ((b.x - a.x) * (y - b.y)) / (b.y - a.y);
}

/** The point at arc length `len` along a polyline; past its end the last segment continues. */
export function pointAlong(poly: readonly Point[], len: number): { p: Point; dir: Point } {
  let remaining = len;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1] as Point;
    const b = poly[i] as Point;
    const seg = dist(a, b);
    const last = i === poly.length - 1;
    if (remaining <= seg || last) {
      const t = seg === 0 ? 0 : remaining / seg;
      const dir = seg === 0 ? { x: 0, y: 1 } : { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg };
      return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir };
    }
    remaining -= seg;
  }
  return { p: poly[0] as Point, dir: { x: 0, y: 1 } };
}

interface Ctx {
  rig: GarmentRig;
  body: FitBody;
  slot: Slot;
  aspect: number;
  /** Garment point in garment units, or undefined when the rig lacks it. */
  g: (name: string) => Point | undefined;
  out: Record<string, Point>;
}

function upperEase(slot: Slot): number {
  const e = T.shoulderEase;
  return slot === 'mid' ? e.mid : slot === 'outer' ? e.outer : e.base;
}

/** Body measurements the length rules refer to. */
function bodyYs(body: FitBody): {
  shoulder: number;
  waist: number;
  hip: number;
  knee: number;
  ankle: number;
  foot: number;
} {
  const m = (a: Point, b: Point): number => (a.y + b.y) / 2;
  return {
    shoulder: m(body.shoulderL, body.shoulderR),
    waist: m(body.waistL, body.waistR),
    hip: m(body.hipL, body.hipR),
    knee: m(body.kneeL, body.kneeR),
    ankle: m(body.ankleL, body.ankleR),
    foot: Math.max(body.footL.y, body.footR.y),
  };
}

/**
 * Neck, shoulders, armpits and sleeves. Returns the garment's physical scale `s` (§12.3): body
 * shoulder width (plus ease) ÷ garment shoulder width, or, on sleeveless garments, body chest width
 * ÷ the garment's width at the armpits.
 */
function upperTargets(c: Ctx): { s: number } | undefined {
  const { body, g, out } = c;
  const sL = g('shoulderL');
  const sR = g('shoulderR');
  const aL = g('armpitL');
  const aR = g('armpitR');
  if (!sL || !sR || !aL || !aR) return undefined;
  const gs = Math.abs(sR.x - sL.x);
  const gw = Math.abs(aR.x - aL.x);
  if (gs < 1e-6 || gw < 1e-6) return undefined;
  const S = body.shoulderR.x - body.shoulderL.x;
  const e = upperEase(c.slot);
  const cx = (body.shoulderL.x + body.shoulderR.x) / 2;
  const half = (e * S) / 2;
  const sleeveless = !g('cuffOuterL') && !g('cuffOuterR');
  const scale = sleeveless ? (T.chestWidth * S * (1 + e)) / gw : (S * (1 + e)) / gs;

  // Armpits on the torso's sides a fixed share of the way from shoulders to hips.
  const ys = bodyYs(body);
  const yA = ys.shoulder + T.armpitDrop * (ys.hip - ys.shoulder);
  const sidesL = [body.shoulderL, body.waistL, body.hipL];
  const sidesR = [body.shoulderR, body.waistR, body.hipR];
  out.armpitL = { x: xAtY(sidesL, yA) - half, y: yA };
  out.armpitR = { x: xAtY(sidesR, yA) + half, y: yA };

  // Shoulders: the eased shoulder tips; on straps, the strap positions at the garment's own scale.
  let shL: Point = { x: body.shoulderL.x - half, y: body.shoulderL.y };
  let shR: Point = { x: body.shoulderR.x + half, y: body.shoulderR.y };
  if (sleeveless) {
    shL = { x: cx - (gs * scale) / 2, y: body.shoulderL.y };
    shR = { x: cx + (gs * scale) / 2, y: body.shoulderR.y };
  }
  out.shoulderL = shL;
  out.shoulderR = shR;

  const nL = g('neckL');
  const nR = g('neckR');
  if (nL && nR) {
    const sep = clamp(((nR.x - nL.x) / gs) * S, T.neckSeparation[0] * S, T.neckSeparation[1] * S);
    out.neckL = { x: body.neckBase.x - sep / 2, y: body.neckBase.y };
    out.neckR = { x: body.neckBase.x + sep / 2, y: body.neckBase.y };
  }

  // Sleeves follow shoulder → elbow → wrist (then on along the forearm); length = garment sleeve
  // length × scale, clamped to the arm.
  const cuffRange = c.slot === 'outer' ? T.cuffWidthOuter : T.cuffWidth;
  for (const side of ['L', 'R'] as const) {
    const outer = g(`cuffOuter${side}`);
    const inner = g(`cuffInner${side}`);
    const shoulderG = side === 'L' ? sL : sR;
    if (!outer || !inner) continue;
    const start = side === 'L' ? shL : shR;
    const wrist = side === 'L' ? body.wristL : body.wristR;
    const elbow = (side === 'L' ? body.elbowL : body.elbowR) ?? mid(start, wrist);
    const dir = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
    const far = { x: wrist.x + dir.x * 4, y: wrist.y + dir.y * 4 };
    const poly = [start, elbow, wrist, far];
    const arm = dist(start, elbow) + dist(elbow, wrist);
    const len = clamp(
      dist(shoulderG, mid(outer, inner)) * scale,
      T.sleeveMin * arm,
      T.sleeveMax * arm,
    );
    const at = pointAlong(poly, len);
    const sign = side === 'L' ? -1 : 1;
    // Perpendicular to the arm, pointing away from the body.
    let n = { x: -at.dir.y, y: at.dir.x };
    if (n.x * sign < 0) n = { x: -n.x, y: -n.y };
    const w = clamp(dist(outer, inner) * scale, cuffRange[0] * S, cuffRange[1] * S);
    out[`cuffOuter${side}`] = { x: at.p.x + (n.x * w) / 2, y: at.p.y + (n.y * w) / 2 };
    out[`cuffInner${side}`] = { x: at.p.x - (n.x * w) / 2, y: at.p.y - (n.y * w) / 2 };
  }
  return { s: scale };
}

function topHem(c: Ctx, u: { s: number }): void {
  const { body, g, out } = c;
  const hL = g('hemL');
  const hR = g('hemR');
  const sL = g('shoulderL');
  const sR = g('shoulderR');
  if (!hL || !hR || !sL || !sR) return;
  const H = T.hem;
  const ys = bodyYs(body);
  const kh = ys.knee - ys.hip;
  const length = ((hL.y + hR.y) / 2 - (sL.y + sR.y) / 2) * u.s;
  const [lo, hi] =
    c.slot === 'outer'
      ? [ys.hip + H.outer.lo * kh, ys.knee + H.outer.hiToAnkle * (ys.ankle - ys.knee)]
      : [ys.waist, ys.hip + H.base.hi * kh];
  const hemY = clamp(ys.shoulder + length, lo, hi);
  const cx = (body.shoulderL.x + body.shoulderR.x) / 2;
  const e = upperEase(c.slot);
  let halfHem = ((hR.x - hL.x) * u.s) / 2;
  if (hemY >= ys.hip) {
    const hipHalf = ((body.hipR.x - body.hipL.x) * (1 + e)) / 2;
    halfHem = Math.max(halfHem, hipHalf);
  }
  out.hemL = { x: cx - halfHem, y: hemY };
  out.hemR = { x: cx + halfHem, y: hemY };
}

/** Waist and hips with the bottom slot's ease; returns body waist width scale k_w or undefined. */
function waistHipTargets(c: Ctx): number | undefined {
  const { body, g, out } = c;
  const wL = g('waistL');
  const wR = g('waistR');
  if (!wL || !wR) return undefined;
  const gw = Math.abs(wR.x - wL.x);
  if (gw < 1e-6) return undefined;
  const W = body.waistR.x - body.waistL.x;
  const H = body.hipR.x - body.hipL.x;
  const ew = T.bottomEase.waist;
  const eh = T.bottomEase.hip;
  out.waistL = { x: body.waistL.x - (ew * W) / 2, y: body.waistL.y };
  out.waistR = { x: body.waistR.x + (ew * W) / 2, y: body.waistR.y };
  if (g('hipL')) out.hipL = { x: body.hipL.x - (eh * H) / 2, y: body.hipL.y };
  if (g('hipR')) out.hipR = { x: body.hipR.x + (eh * H) / 2, y: body.hipR.y };
  return (W * (1 + ew)) / gw;
}

/**
 * Skirt hem: the garment's waist-to-hem length × scale straight down from the body's waist (a skirt),
 * or its shoulder-to-hem length × the upper-body scale from the shoulders (a dress, `fromShoulder`).
 */
function skirtHem(
  c: Ctx,
  kw: number,
  rule: { lo: number },
  fromShoulder?: { s: number; garmentY: number },
): void {
  const { body, g, out } = c;
  const hL = g('hemL');
  const hR = g('hemR');
  const wL = g('waistL');
  const wR = g('waistR');
  if (!hL || !hR || !wL || !wR) return;
  const ys = bodyYs(body);
  const hemG = (hL.y + hR.y) / 2;
  const y0 = fromShoulder
    ? ys.shoulder + (hemG - fromShoulder.garmentY) * fromShoulder.s
    : ys.waist + (hemG - (wL.y + wR.y) / 2) * kw;
  const kh = ys.knee - ys.hip;
  const y = clamp(y0, ys.hip + rule.lo * kh, ys.ankle);
  const cx = (body.waistL.x + body.waistR.x) / 2;
  const half = ((hR.x - hL.x) * kw) / 2;
  out.hemL = { x: cx - half, y };
  out.hemR = { x: cx + half, y };
}

/**
 * Hem height of trousers from the physical length `y0` (waist-to-hem × scale below the waist):
 * shorts are clamped between thigh and knee, long ones to the ankle.
 */
function legHemY(c: Ctx, y0: number, ratio: number): number {
  const ys = bodyYs(c.body);
  const H = T.hem;
  if (ratio < H.shortsMaxRatio) {
    const kh = ys.knee - ys.hip;
    return clamp(y0, ys.hip + H.shorts.lo * kh, ys.hip + H.shorts.hi * kh);
  }
  const tol = H.long.ankleTolerance * (ys.ankle - ys.hip);
  return Math.min(clamp(y0, ys.ankle - tol, ys.ankle + tol), ys.foot);
}

function legTargets(c: Ctx): void {
  const { body, g, out } = c;
  const wL = g('waistL');
  const wR = g('waistR');
  if (!wL || !wR) return;
  const gw = Math.abs(wR.x - wL.x);
  const W = body.waistR.x - body.waistL.x;
  const kw = (W * (1 + T.bottomEase.waist)) / gw;
  const cx = (body.hipL.x + body.hipR.x) / 2;
  const ys = bodyYs(body);
  const hipW = body.hipR.x - body.hipL.x;
  const crotch = g('crotch');
  if (crotch) out.crotch = { x: cx, y: ys.hip + T.crotchDrop * (ys.knee - ys.hip) };

  for (const side of ['L', 'R'] as const) {
    const outer = g(`hemOuter${side}`);
    const inner = g(`hemInner${side}`);
    if (!outer || !inner) continue;
    const hip = side === 'L' ? body.hipL : body.hipR;
    const knee = side === 'L' ? body.kneeL : body.kneeR;
    const ankle = side === 'L' ? body.ankleL : body.ankleR;
    const joint: Point = { x: hip.x + (cx - hip.x) * T.hipJoint, y: hip.y };
    const below: Point = {
      x: ankle.x + (ankle.x - knee.x) * 3,
      y: ankle.y + (ankle.y - knee.y) * 3,
    };
    const axis = [joint, knee, ankle, below];
    const outseamG = (outer.y + inner.y) / 2 - (wL.y + wR.y) / 2;
    // Physical length: down from the waist to the hip, then along the leg.
    const along = outseamG * kw - (ys.hip - ys.waist);
    const y0 = along <= 0 ? ys.waist + outseamG * kw : pointAlong(axis, along).p.y;
    const hemY = legHemY(c, y0, outseamG / gw);
    const centreX = xAtY(axis, hemY);
    const w = Math.min(dist(outer, inner) * kw, T.legHemMax * hipW);
    const sign = side === 'L' ? -1 : 1;
    // The inner edge never crosses the body's centre line.
    const gap = T.legGap * hipW;
    const rawInner = centreX - sign * (w / 2);
    const innerX = side === 'L' ? Math.min(rawInner, cx - gap) : Math.max(rawInner, cx + gap);
    out[`hemOuter${side}`] = { x: innerX + sign * w, y: hemY };
    out[`hemInner${side}`] = { x: innerX, y: hemY };
  }
}

/** Where each rig point should land on this body, in mannequin units (§12.3). */
export function rigTargets(
  rig: GarmentRig,
  cutoutAspectRatio: number,
  body: FitBody,
  slot: 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece',
): Record<string, Point> {
  const aspect = cutoutAspectRatio > 0 ? cutoutAspectRatio : 1;
  const out: Record<string, Point> = {};
  const c: Ctx = {
    rig,
    body,
    slot,
    aspect,
    out,
    g: (name) => {
      const q = rig.points[name];
      return q ? { x: q.x * aspect, y: q.y } : undefined;
    },
  };
  switch (rig.kind) {
    case 'top': {
      const u = upperTargets(c);
      if (u) topHem(c, u);
      break;
    }
    case 'trousers': {
      const kw = waistHipTargets(c);
      if (kw !== undefined) legTargets(c);
      break;
    }
    case 'skirt': {
      const kw = waistHipTargets(c);
      if (kw !== undefined) skirtHem(c, kw, T.hem.skirt);
      break;
    }
    case 'dress': {
      const u = upperTargets(c);
      const kw = waistHipTargets(c);
      if (kw !== undefined) {
        const sh = c.g('shoulderL');
        const sr = c.g('shoulderR');
        skirtHem(
          c,
          kw,
          T.hem.dress,
          u && sh && sr ? { s: u.s, garmentY: (sh.y + sr.y) / 2 } : undefined,
        );
      }
      break;
    }
    case 'jumpsuit': {
      upperTargets(c);
      const kw = waistHipTargets(c);
      if (kw !== undefined) legTargets(c);
      break;
    }
  }
  return out;
}
