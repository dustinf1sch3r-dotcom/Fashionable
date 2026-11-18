import type { FitBody, Point } from '../model/types';
import { FIT_RULES } from './weights';
import { nestInside } from './nest';
import { rigTargets } from './targets';
import { bodyA, detected, photoBody, scaleBody } from './testHelpers';

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function pair(body: FitBody, innerName: 'tee' | 'longSleeve', outerName: 'coat' | 'longSleeve') {
  const di = detected(innerName);
  const dout = detected(outerName);
  return {
    inner: rigTargets(di.rig, di.aspect, body, 'mid'),
    outer: rigTargets(dout.rig, dout.aspect, body, 'outer'),
  };
}

function armLength(body: FitBody, side: 'L' | 'R'): number {
  const sh = side === 'L' ? body.shoulderL : body.shoulderR;
  const el = (side === 'L' ? body.elbowL : body.elbowR) as Point;
  const wr = side === 'L' ? body.wristL : body.wristR;
  return dist(sh, el) + dist(el, wr);
}

describe('nestInside', () => {
  const bodies: [string, FitBody][] = [
    ['BODY_A', bodyA],
    ['small', scaleBody(bodyA, 0.8)],
    ['large', scaleBody(bodyA, 1.15)],
    ['photo', photoBody()],
  ];

  it.each(bodies)('keeps inner sleeves inside outer sleeves (%s)', (_n, body) => {
    const S = body.shoulderR.x - body.shoulderL.x;
    for (const innerName of ['tee', 'longSleeve'] as const) {
      const { inner, outer } = pair(body, innerName, 'coat');
      const n = nestInside(inner, outer, body);
      for (const side of ['L', 'R'] as const) {
        const wo = dist(outer[`cuffOuter${side}`] as Point, outer[`cuffInner${side}`] as Point);
        const wi = dist(n[`cuffOuter${side}`] as Point, n[`cuffInner${side}`] as Point);
        expect(wi).toBeLessThanOrEqual(wo - FIT_RULES.nest.cuffMargin * S + 1e-6);
        const co = mid(outer[`cuffOuter${side}`] as Point, outer[`cuffInner${side}`] as Point);
        const ci = mid(n[`cuffOuter${side}`] as Point, n[`cuffInner${side}`] as Point);
        // A long inner sleeve ends on the outer cuff; a short one just ends earlier on the arm.
        if (innerName === 'longSleeve') {
          expect(dist(ci, co)).toBeLessThanOrEqual(
            FIT_RULES.nest.sleeveMargin * armLength(body, side) + 1e-6,
          );
        }
        const sh = outer[`shoulder${side}`] as Point;
        const arm =
          dist(sh, (side === 'L' ? body.elbowL : body.elbowR) as Point) +
          dist(
            (side === 'L' ? body.elbowL : body.elbowR) as Point,
            side === 'L' ? body.wristL : body.wristR,
          );
        // Sleeve length is measured along the arm; Euclid distance is a safe lower bound check.
        expect(dist(sh, ci)).toBeLessThanOrEqual(dist(sh, co) + 1e-6);
        void arm;
      }
    }
  });

  it('insets shoulders and armpits inside the outer layer', () => {
    const { inner, outer } = pair(bodyA, 'longSleeve', 'coat');
    const n = nestInside(inner, outer, bodyA);
    const inset = FIT_RULES.nest.inset * (bodyA.shoulderR.x - bodyA.shoulderL.x);
    for (const name of ['shoulder', 'armpit']) {
      expect((n[`${name}L`] as Point).x).toBeGreaterThanOrEqual(
        (outer[`${name}L`] as Point).x + inset - 1e-6,
      );
      expect((n[`${name}R`] as Point).x).toBeLessThanOrEqual(
        (outer[`${name}R`] as Point).x - inset + 1e-6,
      );
    }
  });

  it('leaves hems, necks and unrelated points alone', () => {
    const { inner, outer } = pair(bodyA, 'tee', 'coat');
    const n = nestInside(inner, outer, bodyA);
    expect(n.hemL).toEqual(inner.hemL);
    expect(n.hemR).toEqual(inner.hemR);
    expect(n.neckL).toEqual(inner.neckL);
  });

  it('is the identity when the inner layer is already inside', () => {
    const { inner, outer } = pair(bodyA, 'tee', 'coat');
    const once = nestInside(inner, outer, bodyA);
    expect(nestInside(once, outer, bodyA)).toEqual(once);
    // Outer layer far outside: nothing to change.
    const wide: Record<string, Point> = {};
    for (const [k, v] of Object.entries(outer))
      wide[k] = { x: v.x < 500 ? v.x - 200 : v.x + 200, y: v.y };
    const roomy = nestInside(inner, wide, bodyA);
    for (const k of ['shoulderL', 'armpitR', 'hemL']) expect(roomy[k]).toEqual(inner[k]);
  });

  it('does not mutate its inputs and ignores sides without outer sleeves', () => {
    const { inner, outer } = pair(bodyA, 'longSleeve', 'coat');
    const before = JSON.stringify([inner, outer]);
    const { cuffOuterL, cuffInnerL, ...noLeft } = outer;
    void cuffOuterL;
    void cuffInnerL;
    const n = nestInside(inner, noLeft, bodyA);
    expect(JSON.stringify([inner, outer])).toBe(before);
    expect(n.cuffOuterL).toEqual(inner.cuffOuterL);
    expect(n.cuffOuterR).not.toEqual(inner.cuffOuterR);
  });

  it('works for base under mid', () => {
    const { inner, outer } = pair(bodyA, 'tee', 'longSleeve');
    const n = nestInside(inner, outer, bodyA);
    const wo = dist(outer.cuffOuterL as Point, outer.cuffInnerL as Point);
    expect(dist(n.cuffOuterL as Point, n.cuffInnerL as Point)).toBeLessThan(wo);
  });
});
