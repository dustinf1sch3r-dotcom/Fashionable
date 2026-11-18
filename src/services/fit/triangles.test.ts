import { applyAffine, expandTriangle, pointsBounds, triangleAffine, type Pt } from './triangles';

const tri = (a: number[], b: number[], c: number[]): [Pt, Pt, Pt] => [
  { x: a[0] ?? 0, y: a[1] ?? 0 },
  { x: b[0] ?? 0, y: b[1] ?? 0 },
  { x: c[0] ?? 0, y: c[1] ?? 0 },
];

describe('triangleAffine', () => {
  it('maps each source vertex onto its target vertex', () => {
    const from = tri([10, 10], [50, 12], [14, 70]);
    const to = tri([100, 200], [180, 190], [90, 320]);
    const m = triangleAffine(from, to);
    expect(m).toBeDefined();
    if (!m) return;
    from.forEach((p, i) => {
      const q = applyAffine(m, p);
      expect(q.x).toBeCloseTo(to[i]?.x ?? NaN, 6);
      expect(q.y).toBeCloseTo(to[i]?.y ?? NaN, 6);
    });
  });

  it('is the identity for identical triangles', () => {
    const t = tri([0, 0], [10, 0], [0, 10]);
    const m = triangleAffine(t, t);
    expect(m?.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('handles reflections (negative determinant)', () => {
    const m = triangleAffine(tri([0, 0], [10, 0], [0, 10]), tri([0, 0], [-10, 0], [0, 10]));
    expect(m && applyAffine(m, { x: 10, y: 0 }).x).toBeCloseTo(-10, 6);
  });

  it('returns undefined for a degenerate source triangle', () => {
    expect(
      triangleAffine(tri([0, 0], [5, 5], [10, 10]), tri([0, 0], [1, 0], [0, 1])),
    ).toBeUndefined();
  });
});

describe('expandTriangle', () => {
  it('moves every edge out by the given amount, whichever way the triangle winds', () => {
    for (const t of [tri([0, 0], [10, 0], [0, 10]), tri([0, 0], [0, 10], [10, 0])]) {
      const e = expandTriangle(t, 0.5);
      // The hypotenuse x + y = 10 moves to x + y = 10 + 0.5·√2.
      const onHypotenuse = e.filter((p) => p.x + p.y > 5);
      expect(onHypotenuse).toHaveLength(2);
      for (const p of onHypotenuse) expect(p.x + p.y).toBeCloseTo(10 + 0.5 * Math.SQRT2, 6);
      // The legs x = 0 and y = 0 move to −0.5.
      expect(Math.min(...e.map((p) => p.x))).toBeCloseTo(-0.5, 6);
      expect(Math.min(...e.map((p) => p.y))).toBeCloseTo(-0.5, 6);
    }
  });

  it('leaves a collapsed triangle alone instead of producing NaN', () => {
    const e = expandTriangle(tri([3, 3], [3, 3], [3, 3]), 0.5);
    expect(e.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});

describe('pointsBounds', () => {
  it('covers all points', () => {
    expect(
      pointsBounds([
        { x: 1, y: 5 },
        { x: -2, y: 9 },
        { x: 4, y: 0 },
      ]),
    ).toEqual({
      x0: -2,
      y0: 0,
      x1: 4,
      y1: 9,
    });
  });
});
