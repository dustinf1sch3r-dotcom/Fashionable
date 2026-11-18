/**
 * Moving Least Squares image deformation, similarity variant (Schaefer, McPhail & Warren, 2006,
 * "Image Deformation Using Moving Least Squares", §2.3). Pure.
 *
 * For a point v the best similarity transform (rotation + uniform scale + translation) taking the
 * handles p to q, weighted by w = 1 / |p − v|^(2α), is found in closed form; with points as complex
 * numbers it is f(v) = q* + c · (v − p*), c = Σ wᵢ q̂ᵢ·conj(p̂ᵢ) / Σ wᵢ |p̂ᵢ|².
 */
import type { Point } from '../model/types';
import { FIT_RULES } from './weights';

export interface Handle {
  /** Source position. */
  p: Point;
  /** Where it must land. */
  q: Point;
}

/** A deformation function for a fixed set of handles. Handles map exactly to their targets. */
export function mlsSimilarity(
  handles: readonly Handle[],
  alpha: number = FIT_RULES.mesh.alpha,
): (v: Point) => Point {
  const n = handles.length;
  const px = handles.map((h) => h.p.x);
  const py = handles.map((h) => h.p.y);
  const qx = handles.map((h) => h.q.x);
  const qy = handles.map((h) => h.q.y);
  const snap2 = FIT_RULES.mesh.snap * FIT_RULES.mesh.snap;
  const w = new Float64Array(n);
  return (v: Point): Point => {
    if (n === 0) return { x: v.x, y: v.y };
    let sw = 0;
    let psx = 0;
    let psy = 0;
    let qsx = 0;
    let qsy = 0;
    for (let i = 0; i < n; i++) {
      const dx = (px[i] as number) - v.x;
      const dy = (py[i] as number) - v.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= snap2) return { x: qx[i] as number, y: qy[i] as number };
      const wi = alpha === 1 ? 1 / d2 : Math.pow(d2, -alpha);
      w[i] = wi;
      sw += wi;
      psx += wi * (px[i] as number);
      psy += wi * (py[i] as number);
      qsx += wi * (qx[i] as number);
      qsy += wi * (qy[i] as number);
    }
    psx /= sw;
    psy /= sw;
    qsx /= sw;
    qsy /= sw;
    let re = 0;
    let im = 0;
    let mu = 0;
    for (let i = 0; i < n; i++) {
      const wi = w[i] as number;
      const ax = (px[i] as number) - psx;
      const ay = (py[i] as number) - psy;
      const bx = (qx[i] as number) - qsx;
      const by = (qy[i] as number) - qsy;
      re += wi * (bx * ax + by * ay);
      im += wi * (by * ax - bx * ay);
      mu += wi * (ax * ax + ay * ay);
    }
    const zx = v.x - psx;
    const zy = v.y - psy;
    if (mu < 1e-18) return { x: qsx + zx, y: qsy + zy };
    return { x: qsx + (re * zx - im * zy) / mu, y: qsy + (re * zy + im * zx) / mu };
  };
}
