import {
  BODIES,
  BODY_A,
  bodyCenterX,
  getBody,
  headWidth,
  hipWidth,
  shoulderWidth,
  waistWidth,
} from './bodies';
import type { Point } from '../model/types';

const L = BODY_A.landmarks;

describe('BODY_A landmarks', () => {
  it('is registered and retrievable', () => {
    expect(BODIES['body-a']).toBe(BODY_A);
    expect(getBody('body-a')).toBe(BODY_A);
    expect(getBody('nope')).toBeUndefined();
  });

  it('has every point inside the 1000 x 2000 canvas', () => {
    for (const [name, pt] of Object.entries(L) as [string, Point][]) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(1000);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(2000);
      expect(name).toBeTruthy();
    }
  });

  it('is symmetric about the centre line', () => {
    expect(bodyCenterX(L)).toBe(500);
    const pairs: [Point, Point][] = [
      [L.shoulderL, L.shoulderR],
      [L.waistL, L.waistR],
      [L.hipL, L.hipR],
      [L.kneeL, L.kneeR],
      [L.ankleL, L.ankleR],
      [L.wristL, L.wristR],
      [L.footL, L.footR],
    ];
    for (const [l, r] of pairs) {
      expect(l.x + r.x).toBe(1000);
      expect(l.y).toBe(r.y);
      expect(l.x).toBeLessThan(r.x);
    }
    for (const c of [L.headTop, L.chin, L.eyeLine, L.neckBase]) expect(c.x).toBe(500);
  });

  it('has plausible proportions', () => {
    expect(shoulderWidth(L)).toBeGreaterThan(waistWidth(L));
    expect(hipWidth(L)).toBeGreaterThan(waistWidth(L));
    expect(L.hipL.y).toBeGreaterThan(L.waistL.y);
    expect(L.waistL.y).toBeGreaterThan(L.shoulderL.y);
    const order = [
      L.headTop,
      L.eyeLine,
      L.chin,
      L.neckBase,
      L.shoulderL,
      L.waistL,
      L.hipL,
      L.kneeL,
      L.ankleL,
      L.footL,
    ];
    for (let i = 1; i < order.length; i++) expect(order[i].y).toBeGreaterThan(order[i - 1].y);
    const height = L.footL.y - L.headTop.y;
    expect(height / (L.chin.y - L.headTop.y)).toBeCloseTo(8, 0);
  });

  it('keeps arms away from the body (A-pose)', () => {
    expect(L.wristL.x).toBeLessThan(L.hipL.x);
    expect(L.wristR.x).toBeGreaterThan(L.hipR.x);
  });

  it('derives widths', () => {
    expect(shoulderWidth(L)).toBe(380);
    expect(hipWidth(L)).toBe(340);
    expect(waistWidth(L)).toBe(300);
    expect(headWidth(L)).toBeCloseTo(162.4);
  });
});
