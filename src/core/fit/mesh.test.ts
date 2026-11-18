import type { Point } from '../model/types';
import type { FitMesh } from './contract';
import { buildFitMesh } from './mesh';
import { rigTargets } from './targets';
import { bodyA, detected, NAMES, photoBody, slotsOf, type FitSlot } from './testHelpers';
import type { GarmentName } from '../testing/garmentMasks';

const area = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function meshFor(name: GarmentName, slot: FitSlot, body = bodyA, rotate = 0): FitMesh {
  const d = detected(name, rotate);
  return buildFitMesh(d.rig, rigTargets(d.rig, d.aspect, body, slot), d.aspect);
}

/**
 * Share of garment-carrying triangles that are flipped. Triangles over transparent background
 * (between the legs, under a sleeve) may fold without any visible effect and are not counted. A
 * flat sleeve bent down onto the arm folds a few cells at the armpit (and legs at the crotch);
 * anywhere else a flip is a bug.
 */
function flipShare(m: FitMesh, name: GarmentName, rotate = 0): number {
  const { width, height, alpha } = detected(name, rotate).mask.mask;
  let total = 0;
  let flipped = 0;
  for (const [a, b, c] of m.triangles) {
    const A = m.source[a] as Point;
    const B = m.source[b] as Point;
    const C = m.source[c] as Point;
    const px = Math.min(width - 1, Math.floor(((A.x + B.x + C.x) / 3) * width));
    const py = Math.min(height - 1, Math.floor(((A.y + B.y + C.y) / 3) * height));
    if (alpha[py * width + px] === 0) continue;
    total++;
    if (area(m.target[a] as Point, m.target[b] as Point, m.target[c] as Point) <= 0) flipped++;
  }
  return total === 0 ? 0 : flipped / total;
}

describe('buildFitMesh', () => {
  it('builds the default 24 × 48 grid over the whole cutout', () => {
    const m = meshFor('tee', 'base');
    expect(m.source).toHaveLength(25 * 49);
    expect(m.triangles).toHaveLength(2 * 24 * 48);
    expect(m.target).toHaveLength(m.source.length);
    for (const s of m.source) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
    for (const [a, b, c] of m.triangles) {
      for (const i of [a, b, c]) expect(i).toBeLessThan(m.source.length);
    }
  });

  it('honours a custom grid', () => {
    const d = detected('tee');
    const t = rigTargets(d.rig, d.aspect, bodyA, 'base');
    const m = buildFitMesh(d.rig, t, d.aspect, { cols: 6, rows: 10 });
    expect(m.source).toHaveLength(7 * 11);
    expect(m.triangles).toHaveLength(2 * 6 * 10);
  });

  it('is the identity (in garment units) when targets are the sources', () => {
    const d = detected('jeans');
    const t: Record<string, Point> = {};
    for (const [k, v] of Object.entries(d.rig.points)) t[k] = { x: v.x * d.aspect, y: v.y };
    const m = buildFitMesh(d.rig, t, d.aspect);
    m.source.forEach((s, i) => {
      expect((m.target[i] as Point).x).toBeCloseTo(s.x * d.aspect, 6);
      expect((m.target[i] as Point).y).toBeCloseTo(s.y, 6);
    });
  });

  it('reports the bounds of the target', () => {
    const m = meshFor('tee', 'base');
    const xs = m.target.map((p) => p.x);
    const ys = m.target.map((p) => p.y);
    expect(m.bounds.x).toBeCloseTo(Math.min(...xs), 9);
    expect(m.bounds.y).toBeCloseTo(Math.min(...ys), 9);
    expect(m.bounds.width).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 9);
    expect(m.bounds.height).toBeCloseTo(Math.max(...ys) - Math.min(...ys), 9);
  });

  it('is deterministic', () => {
    expect(meshFor('coat', 'outer')).toEqual(meshFor('coat', 'outer'));
  });

  it('returns an empty mesh without matching points', () => {
    const d = detected('tee');
    const m = buildFitMesh(d.rig, {}, d.aspect);
    expect(m.target.length).toBe(m.source.length);
    expect(Number.isFinite(m.bounds.width)).toBe(true);
  });

  it.each(NAMES)('%s: almost no flipped garment triangles on BODY_A in every slot', (name) => {
    for (const slot of slotsOf(name)) {
      for (const rotate of [0, 3])
        expect(flipShare(meshFor(name, slot, bodyA, rotate), name, rotate)).toBeLessThan(0.015);
    }
  });

  it.each(NAMES)('%s: almost no flipped garment triangles on a photo-like body', (name) => {
    for (const photo of [photoBody(), photoBody({ size: 0.9, cx: 0.45 })]) {
      for (const slot of slotsOf(name))
        expect(flipShare(meshFor(name, slot, photo), name)).toBeLessThan(0.015);
    }
  });
});

/** Map a source point (0–1) through the mesh to the target by barycentric interpolation. */
function mapThrough(m: FitMesh, p: Point): Point | undefined {
  for (const [a, b, c] of m.triangles) {
    const A = m.source[a] as Point;
    const B = m.source[b] as Point;
    const C = m.source[c] as Point;
    const den = area(A, B, C);
    const u = area(p, B, C) / den;
    const v = area(A, p, C) / den;
    const w = 1 - u - v;
    if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
    const TA = m.target[a] as Point;
    const TB = m.target[b] as Point;
    const TC = m.target[c] as Point;
    return { x: u * TA.x + v * TB.x + w * TC.x, y: u * TA.y + v * TB.y + w * TC.y };
  }
  return undefined;
}

describe('fit mesh outline is smooth', () => {
  /**
   * Walk the garment's real outer edge (leftmost opaque pixel per row, over a row range), map each
   * sample through the mesh and check no sample departs from the straight line through its
   * neighbours by more than 2% of the fitted garment width.
   */
  function stepError(name: GarmentName, slot: FitSlot, from: number, to: number): number {
    const d = detected(name);
    const m = buildFitMesh(d.rig, rigTargets(d.rig, d.aspect, bodyA, slot), d.aspect);
    const { width, height, alpha } = d.mask.mask;
    const pts: Point[] = [];
    for (let y = Math.floor(from * height); y < Math.floor(to * height); y += 2) {
      let x = 0;
      while (x < width && alpha[y * width + x] === 0) x++;
      if (x >= width) continue;
      const q = mapThrough(m, { x: (x + 0.5) / width, y: (y + 0.5) / height });
      if (q) pts.push(q);
    }
    expect(pts.length).toBeGreaterThan(10);
    let worst = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      const c = pts[i + 1] as Point;
      worst = Math.max(worst, Math.hypot(b.x - (a.x + c.x) / 2, b.y - (a.y + c.y) / 2));
    }
    return worst / m.bounds.width;
  }

  it('has no steps along a long sleeve’s outer edge', () => {
    // From the shoulder slope down to just above the cuff.
    expect(stepError('longSleeve', 'base', 0.1, 0.8)).toBeLessThan(0.02);
  });

  it('has no steps along the outer side of jeans', () => {
    expect(stepError('jeans', 'bottom', 0.22, 0.97)).toBeLessThan(0.02);
  });
});
