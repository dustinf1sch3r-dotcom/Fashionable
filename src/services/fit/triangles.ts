/** Triangle maths for the mesh renderer. Pure, so it runs (and is tested) without a canvas. */

export interface Pt {
  x: number;
  y: number;
}

/** Canvas `setTransform(a, b, c, d, e, f)` arguments: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [number, number, number, number, number, number];

/**
 * The affine map that sends the triangle `from` onto `to`, or `undefined` when `from` is
 * degenerate (zero area), in which case there is nothing to draw.
 */
export function triangleAffine(
  from: readonly [Pt, Pt, Pt],
  to: readonly [Pt, Pt, Pt],
): Affine | undefined {
  const [p0, p1, p2] = from;
  const [q0, q1, q2] = to;
  const det = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
  if (Math.abs(det) < 1e-12) return undefined;
  const ux = p1.x - p0.x;
  const uy = p1.y - p0.y;
  const vx = p2.x - p0.x;
  const vy = p2.y - p0.y;
  // Solve [ux vx; uy vy]·[a c]ᵀ = [q1.x−q0.x; q2.x−q0.x] and likewise for b, d.
  const a = ((q1.x - q0.x) * vy - (q2.x - q0.x) * uy) / det;
  const c = ((q2.x - q0.x) * ux - (q1.x - q0.x) * vx) / det;
  const b = ((q1.y - q0.y) * vy - (q2.y - q0.y) * uy) / det;
  const d = ((q2.y - q0.y) * ux - (q1.y - q0.y) * vx) / det;
  return [a, b, c, d, q0.x - a * p0.x - c * p0.y, q0.y - b * p0.x - d * p0.y];
}

/** Apply an affine map to a point. */
export function applyAffine(m: Affine, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/**
 * The triangle with every edge moved outwards by `amount` (same units). Neighbouring triangles
 * then overlap by about a pixel, which hides anti-aliasing seams. A collapsed triangle is returned
 * unchanged.
 */
export function expandTriangle(t: readonly [Pt, Pt, Pt], amount: number): [Pt, Pt, Pt] {
  const area2 = (t[1].x - t[0].x) * (t[2].y - t[0].y) - (t[2].x - t[0].x) * (t[1].y - t[0].y);
  if (Math.abs(area2) < 1e-9) return [t[0], t[1], t[2]];
  // Outward normal of edge a→b is (dy, −dx) for a counter-clockwise (positive area) triangle.
  const side = area2 > 0 ? 1 : -1;
  const line = (a: Pt, b: Pt) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return undefined;
    const nx = (side * dy) / len;
    const ny = (-side * dx) / len;
    // Offset point on the line and its direction.
    return { px: a.x + nx * amount, py: a.y + ny * amount, dx, dy };
  };
  const lines = [line(t[0], t[1]), line(t[1], t[2]), line(t[2], t[0])];
  const meet = (l1: (typeof lines)[number], l2: (typeof lines)[number], fallback: Pt): Pt => {
    if (!l1 || !l2) return fallback;
    const det = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(det) < 1e-9) return fallback;
    const k = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / det;
    return { x: l1.px + l1.dx * k, y: l1.py + l1.dy * k };
  };
  // Vertex 0 joins edges 2 and 0, vertex 1 joins edges 0 and 1, vertex 2 joins edges 1 and 2.
  const out: [Pt, Pt, Pt] = [
    meet(lines[2], lines[0], t[0]),
    meet(lines[0], lines[1], t[1]),
    meet(lines[1], lines[2], t[2]),
  ];
  // A very sharp corner would shoot far out; keep such a vertex within a few pixels.
  const limit = amount * 6;
  return out.map((p, i) => {
    const o = t[i] as Pt;
    return Math.hypot(p.x - o.x, p.y - o.y) > limit ? o : p;
  }) as [Pt, Pt, Pt];
}

/** Bounding box of a set of points. */
export function pointsBounds(pts: readonly Pt[]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}
