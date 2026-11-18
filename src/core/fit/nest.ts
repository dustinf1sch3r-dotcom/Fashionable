/**
 * Layering (docs/TRY_ON.md §12.3): keeps an inner top (a sweater under a coat, a tee under a
 * sweater) inside the sleeves and shoulders of the layer worn over it. Pure.
 */
import type { FitBody, Point } from '../model/types';
import { pointAlong } from './targets';
import { FIT_RULES } from './weights';

const N = FIT_RULES.nest;
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Arc length along a polyline of the point closest to `p`. */
function arcOf(poly: readonly Point[], p: Point): number {
  let best = Infinity;
  let arc = 0;
  let walked = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1] as Point;
    const b = poly[i] as Point;
    const seg = dist(a, b);
    const t =
      seg === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (seg * seg)),
          );
    const d = dist(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (d < best) {
      best = d;
      arc = walked + t * seg;
    }
    walked += seg;
  }
  return arc;
}

/**
 * `inner` and `outer` are `rigTargets` of two `top` rigs on the same `body`. Returns the inner
 * targets with shoulders and armpits inset inside the outer's, and cuffs centred on the outer cuff,
 * narrower than it and (for a long outer sleeve) shorter. Hems are left alone. Returns the inner
 * targets unchanged when they are already inside.
 */
export function nestInside(
  inner: Record<string, Point>,
  outer: Record<string, Point>,
  body: FitBody,
): Record<string, Point> {
  const out: Record<string, Point> = { ...inner };
  const S = body.shoulderR.x - body.shoulderL.x;
  const inset = N.inset * S;

  for (const name of ['shoulder', 'armpit']) {
    const iL = inner[`${name}L`];
    const oL = outer[`${name}L`];
    if (iL && oL) out[`${name}L`] = { x: Math.max(iL.x, oL.x + inset), y: iL.y };
    const iR = inner[`${name}R`];
    const oR = outer[`${name}R`];
    if (iR && oR) out[`${name}R`] = { x: Math.min(iR.x, oR.x - inset), y: iR.y };
  }

  for (const side of ['L', 'R'] as const) {
    const io = inner[`cuffOuter${side}`];
    const ii = inner[`cuffInner${side}`];
    const oo = outer[`cuffOuter${side}`];
    const oi = outer[`cuffInner${side}`];
    const shoulderO = outer[`shoulder${side}`];
    if (!io || !ii || !oo || !oi || !shoulderO) continue;
    const wo = dist(oo, oi);
    const wi = dist(io, ii);
    const centreO = { x: (oo.x + oi.x) / 2, y: (oo.y + oi.y) / 2 };
    const centreI = { x: (io.x + ii.x) / 2, y: (io.y + ii.y) / 2 };

    const wrist = side === 'L' ? body.wristL : body.wristR;
    const elbow =
      (side === 'L' ? body.elbowL : body.elbowR) ??
      ({ x: (shoulderO.x + wrist.x) / 2, y: (shoulderO.y + wrist.y) / 2 } as Point);
    const arm = dist(shoulderO, elbow) + dist(elbow, wrist);
    const dir = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
    const poly = [shoulderO, elbow, wrist, { x: wrist.x + dir.x * 4, y: wrist.y + dir.y * 4 }];
    const outerLen = arcOf(poly, centreO);
    const longOuter = outerLen > dist(shoulderO, elbow);
    const innerLen = arcOf(poly, centreI);
    const maxLen = longOuter ? outerLen - N.sleeveMargin * arm : Infinity;
    const maxWidth = Math.max(wo - N.cuffMargin * S, 0.02 * S);

    const width = Math.min(wi, maxWidth);
    const len = Math.min(innerLen, maxLen);
    const inside = wi <= maxWidth + 1e-6 && innerLen <= maxLen + 1e-6;
    if (inside) continue;

    // Slide along the outer sleeve's own line (shoulder → elbow → wrist) to the wanted length.
    const centre = pointAlong(poly, len).p;
    // If the inner sleeve is shorter than the outer, still sit on the outer sleeve's axis.
    const ux = (oo.x - oi.x) / (wo || 1);
    const uy = (oo.y - oi.y) / (wo || 1);
    out[`cuffOuter${side}`] = { x: centre.x + (ux * width) / 2, y: centre.y + (uy * width) / 2 };
    out[`cuffInner${side}`] = { x: centre.x - (ux * width) / 2, y: centre.y - (uy * width) / 2 };
  }
  return out;
}
