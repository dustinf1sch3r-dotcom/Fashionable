import type { FitBody, GarmentRig, Point } from '../model/types';
import type { GarmentName } from '../testing/garmentMasks';
import { BODY_A } from '../tryon/bodies';
import { FIT_RULES } from './weights';
import { rigPointNames } from './rigs';
import { rigTargets } from './targets';
import {
  bodyA,
  detected,
  KIND,
  NAMES,
  photoBody,
  scaleBody,
  slotsOf,
  type FitSlot,
} from './testHelpers';

const L = BODY_A.landmarks;
const S = L.shoulderR.x - L.shoulderL.x;

function targetsFor(
  name: GarmentName,
  slot: FitSlot,
  body: FitBody = bodyA,
): Record<string, Point> {
  const d = detected(name);
  return rigTargets(d.rig, d.aspect, body, slot);
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Distance from a point to a polyline. */
function distToPolyline(p: Point, poly: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1] as Point;
    const b = poly[i] as Point;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

describe('rigTargets: general', () => {
  it.each(NAMES)('%s: targets exactly the rig points the garment has, all finite', (name) => {
    for (const slot of slotsOf(name)) {
      const d = detected(name);
      const t = rigTargets(d.rig, d.aspect, bodyA, slot);
      expect(Object.keys(t).sort()).toEqual(Object.keys(d.rig.points).sort());
      for (const n of Object.keys(t)) expect(rigPointNames(KIND[name])).toContain(n);
      for (const q of Object.values(t)) {
        expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
        expect(q.x).toBeGreaterThan(0);
        expect(q.x).toBeLessThan(1000);
        expect(q.y).toBeGreaterThan(0);
        expect(q.y).toBeLessThan(2000);
      }
    }
  });

  it('is deterministic and does not touch its inputs', () => {
    const d = detected('tee');
    const before = JSON.stringify([d.rig, bodyA]);
    const a = rigTargets(d.rig, d.aspect, bodyA, 'base');
    expect(rigTargets(d.rig, d.aspect, bodyA, 'base')).toEqual(a);
    expect(JSON.stringify([d.rig, bodyA])).toBe(before);
  });

  it('returns nothing useful for a rig missing its anchor points', () => {
    const rig: GarmentRig = { kind: 'top', version: 1, points: {}, confidence: 0, edited: false };
    expect(rigTargets(rig, 1, bodyA, 'base')).toEqual({});
    expect(rigTargets({ ...rig, kind: 'trousers' }, 1, bodyA, 'bottom')).toEqual({});
  });
});

describe('rigTargets: tops', () => {
  it('puts shoulders just outside the body shoulders by the slot ease', () => {
    const e = FIT_RULES.target.shoulderEase;
    for (const [slot, ease] of [
      ['base', e.base],
      ['mid', e.mid],
      ['outer', e.outer],
    ] as [FitSlot, number][]) {
      const t = targetsFor('tee', slot);
      expect(t.shoulderL?.y).toBe(L.shoulderL.y);
      expect(t.shoulderR?.y).toBe(L.shoulderR.y);
      const width = (t.shoulderR as Point).x - (t.shoulderL as Point).x;
      expect(width).toBeCloseTo(S * (1 + ease), 6);
      expect((t.shoulderL as Point).x).toBeLessThan(L.shoulderL.x);
      expect((t.shoulderR as Point).x).toBeGreaterThan(L.shoulderR.x);
    }
  });

  it('gives mid layers and outerwear progressively more room', () => {
    const w = (slot: FitSlot): number => {
      const t = targetsFor('tee', slot);
      return (t.hemR as Point).x - (t.hemL as Point).x;
    };
    expect(w('mid')).toBeGreaterThanOrEqual(w('base'));
    expect(w('outer')).toBeGreaterThan(w('mid'));
    const sw = (slot: FitSlot): number => {
      const t = targetsFor('tee', slot);
      return (t.shoulderR as Point).x - (t.shoulderL as Point).x;
    };
    expect(sw('base')).toBeLessThan(sw('mid'));
    expect(sw('mid')).toBeLessThan(sw('outer'));
  });

  it('puts the neck points either side of the neck base', () => {
    const t = targetsFor('tee', 'base');
    expect(t.neckL?.y).toBe(L.neckBase.y);
    expect(((t.neckL as Point).x + (t.neckR as Point).x) / 2).toBeCloseTo(L.neckBase.x, 6);
    expect((t.neckL as Point).x).toBeLessThan(L.neckBase.x);
    expect((t.neckR as Point).x - (t.neckL as Point).x).toBeLessThan(S * 0.5);
  });

  it('puts armpits on the torso sides 22% of the way from shoulders to hips', () => {
    const t = targetsFor('tee', 'base');
    const y = L.shoulderL.y + FIT_RULES.target.armpitDrop * (L.hipL.y - L.shoulderL.y);
    expect((t.armpitL as Point).y).toBeCloseTo(y, 6);
    expect((t.armpitR as Point).y).toBeCloseTo(y, 6);
    expect((t.armpitL as Point).x).toBeLessThan(L.shoulderL.x + 50);
    expect((t.armpitL as Point).x).toBeGreaterThan(L.wristL.x);
  });

  it('runs long sleeves along shoulder, elbow and wrist, and short sleeves ends above the elbow region', () => {
    const t = targetsFor('longSleeve', 'base');
    const arm = (side: 'L' | 'R'): Point[] =>
      side === 'L'
        ? [
            t.shoulderL as Point,
            bodyA.elbowL as Point,
            L.wristL,
            { x: L.wristL.x - 60, y: L.wristL.y + 250 },
          ]
        : [
            t.shoulderR as Point,
            bodyA.elbowR as Point,
            L.wristR,
            { x: L.wristR.x + 60, y: L.wristR.y + 250 },
          ];
    for (const side of ['L', 'R'] as const) {
      const outer = t[`cuffOuter${side}`] as Point;
      const inner = t[`cuffInner${side}`] as Point;
      const mid = { x: (outer.x + inner.x) / 2, y: (outer.y + inner.y) / 2 };
      expect(distToPolyline(mid, arm(side))).toBeLessThan(5);
      // Long sleeves reach about the wrist.
      expect(dist(mid, side === 'L' ? L.wristL : L.wristR)).toBeLessThan(160);
      // The outer corner is on the outside of the arm.
      expect(side === 'L' ? outer.x < inner.x : outer.x > inner.x).toBe(true);
    }
    const tee = targetsFor('tee', 'base');
    const teeMid = {
      x: ((tee.cuffOuterL as Point).x + (tee.cuffInnerL as Point).x) / 2,
      y: ((tee.cuffOuterL as Point).y + (tee.cuffInnerL as Point).y) / 2,
    };
    expect(teeMid.y).toBeLessThan((bodyA.elbowL as Point).y + 120);
    expect(teeMid.y).toBeLessThan((t.cuffOuterL as Point).y);
    expect(distToPolyline(teeMid, arm('L'))).toBeLessThan(5);
  });

  it('uses the shoulder–wrist midpoint when no elbow is given', () => {
    const { elbowL, elbowR, ...rest } = bodyA;
    void elbowL;
    void elbowR;
    const t = targetsFor('longSleeve', 'base', rest);
    const mid = {
      x: ((t.cuffOuterL as Point).x + (t.cuffInnerL as Point).x) / 2,
      y: ((t.cuffOuterL as Point).y + (t.cuffInnerL as Point).y) / 2,
    };
    const sh = t.shoulderL as Point;
    const wrist = L.wristL;
    const mp = { x: (sh.x + wrist.x) / 2, y: (sh.y + wrist.y) / 2 };
    expect(
      distToPolyline(mid, [sh, mp, wrist, { x: wrist.x - 40, y: wrist.y + 200 }]),
    ).toBeLessThan(5);
  });

  it('drops the hem to the garment’s own proportions: cropped stays shorter than a coat', () => {
    const tee = targetsFor('tee', 'base');
    const coat = targetsFor('coat', 'outer');
    expect((tee.hemL as Point).y).toBeLessThan((coat.hemL as Point).y);
    expect((tee.hemL as Point).y).toBeGreaterThan(L.hipL.y - 120);
    expect((tee.hemL as Point).y).toBeLessThan(L.hipL.y + 200);
    expect((coat.hemL as Point).y).toBeGreaterThan(L.hipL.y + 150);
    expect((coat.hemL as Point).y).toBeLessThan(L.kneeL.y);
  });

  it('centres the hem on the body', () => {
    const t = targetsFor('tee', 'base');
    expect(((t.hemL as Point).x + (t.hemR as Point).x) / 2).toBeCloseTo(500, 6);
  });
});

describe('rigTargets: bottoms', () => {
  it('puts waist and hips on the body’s with a little ease', () => {
    const t = targetsFor('jeans', 'bottom');
    expect((t.waistL as Point).y).toBe(L.waistL.y);
    expect((t.hipL as Point).y).toBe(L.hipL.y);
    expect((t.waistL as Point).x).toBeLessThan(L.waistL.x);
    expect((t.waistL as Point).x).toBeGreaterThan(L.waistL.x - 30);
    expect((t.hipR as Point).x).toBeGreaterThan(L.hipR.x);
    expect((t.hipR as Point).x).toBeLessThan(L.hipR.x + 40);
  });

  it('puts the crotch on the centre line just below the hips', () => {
    const t = targetsFor('jeans', 'bottom');
    const c = t.crotch as Point;
    expect(c.x).toBeCloseTo(500, 6);
    expect(c.y).toBeCloseTo(L.hipL.y + FIT_RULES.target.crotchDrop * (L.kneeL.y - L.hipL.y), 6);
  });

  it('brings long trousers down to the ankles and shorts above the knees', () => {
    const jeans = targetsFor('jeans', 'bottom');
    const shorts = targetsFor('shorts', 'bottom');
    for (const side of ['L', 'R'] as const) {
      const ankle = side === 'L' ? L.ankleL : L.ankleR;
      const knee = side === 'L' ? L.kneeL : L.kneeR;
      expect(Math.abs((jeans[`hemOuter${side}`] as Point).y - ankle.y)).toBeLessThan(200);
      expect((shorts[`hemOuter${side}`] as Point).y).toBeLessThan(knee.y);
      expect((shorts[`hemOuter${side}`] as Point).y).toBeGreaterThan(L.hipL.y);
    }
  });

  it('keeps each leg on the hip–knee–ankle line and the inner edges off the centre', () => {
    const t = targetsFor('jeans', 'bottom');
    const leg = [
      { x: (L.hipL.x + 500) / 2, y: L.hipL.y },
      L.kneeL,
      L.ankleL,
      { x: L.ankleL.x - 20, y: L.ankleL.y + 120 },
    ];
    const outer = t.hemOuterL as Point;
    const inner = t.hemInnerL as Point;
    expect(distToPolyline({ x: (outer.x + inner.x) / 2, y: outer.y }, leg)).toBeLessThan(25);
    expect(outer.x).toBeLessThan(inner.x);
    expect(inner.x).toBeLessThan(500);
    expect((t.hemInnerR as Point).x).toBeGreaterThan(500);
    expect((t.hemOuterR as Point).x).toBeGreaterThan((t.hemInnerR as Point).x);
  });

  it('keeps legs apart even for very wide legs, and wide legs are wider than jeans', () => {
    const wide = targetsFor('wideLeg', 'bottom');
    const jeans = targetsFor('jeans', 'bottom');
    expect((wide.hemInnerL as Point).x).toBeLessThan((wide.hemInnerR as Point).x);
    const hemW = (t: Record<string, Point>): number =>
      (t.hemInnerL as Point).x - (t.hemOuterL as Point).x;
    expect(hemW(wide)).toBeGreaterThan(hemW(jeans) * 1.6);
  });

  it('centres skirts and keeps A-line wider than pencil', () => {
    const a = targetsFor('aLineSkirt', 'bottom');
    const p = targetsFor('pencilSkirt', 'bottom');
    expect(((a.hemL as Point).x + (a.hemR as Point).x) / 2).toBeCloseTo(500, 6);
    expect((a.hemR as Point).x - (a.hemL as Point).x).toBeGreaterThan(
      ((p.hemR as Point).x - (p.hemL as Point).x) * 1.4,
    );
    for (const t of [a, p]) {
      expect((t.waistL as Point).y).toBe(L.waistL.y);
      expect((t.hemL as Point).y).toBeGreaterThan(L.hipL.y + 200);
      expect((t.hemL as Point).y).toBeLessThan(L.ankleL.y);
    }
  });
});

describe('rigTargets: one-pieces', () => {
  it('fits a sleeved dress like a top above the waist and a skirt below', () => {
    const t = targetsFor('sleevedDress', 'onepiece');
    expect((t.shoulderL as Point).y).toBe(L.shoulderL.y);
    expect((t.waistL as Point).y).toBe(L.waistL.y);
    expect((t.hipR as Point).y).toBe(L.hipR.y);
    expect((t.hemL as Point).y).toBeGreaterThan(L.kneeL.y - 150);
    expect(((t.hemL as Point).x + (t.hemR as Point).x) / 2).toBeCloseTo(500, 6);
    expect(t.cuffOuterL).toBeDefined();
  });

  it('gives a sleeveless dress no sleeve targets', () => {
    const t = targetsFor('sleevelessDress', 'onepiece');
    expect(t.cuffOuterL).toBeUndefined();
    expect(t.cuffInnerR).toBeUndefined();
    expect(t.shoulderL).toBeDefined();
  });

  it('fits a jumpsuit with legs, crotch and sleeves', () => {
    const t = targetsFor('jumpsuit', 'onepiece');
    expect(t.crotch).toBeDefined();
    expect((t.hemOuterL as Point).y).toBeGreaterThan(L.kneeL.y);
    expect((t.hemInnerL as Point).x).toBeLessThan(500);
    expect(t.cuffOuterR).toBeDefined();
  });
});

describe('rigTargets: body size', () => {
  it.each(NAMES)('%s: targets scale with the body', (name) => {
    for (const slot of slotsOf(name)) {
      const d = detected(name);
      const a = rigTargets(d.rig, d.aspect, bodyA, slot);
      const b = rigTargets(d.rig, d.aspect, scaleBody(bodyA, 1.2), slot);
      for (const [k, v] of Object.entries(a)) {
        expect((b[k] as Point).x).toBeCloseTo(v.x * 1.2, 4);
        expect((b[k] as Point).y).toBeCloseTo(v.y * 1.2, 4);
      }
    }
  });

  it('makes lengths and widths follow a body that is wider but not taller', () => {
    const wide: FitBody = {
      ...bodyA,
      hipL: { x: bodyA.hipL.x - 40, y: bodyA.hipL.y },
      hipR: { x: bodyA.hipR.x + 40, y: bodyA.hipR.y },
      waistL: { x: bodyA.waistL.x - 30, y: bodyA.waistL.y },
      waistR: { x: bodyA.waistR.x + 30, y: bodyA.waistR.y },
    };
    const d = detected('aLineSkirt');
    const a = rigTargets(d.rig, d.aspect, bodyA, 'bottom');
    const b = rigTargets(d.rig, d.aspect, wide, 'bottom');
    expect((b.waistR as Point).x - (b.waistL as Point).x).toBeGreaterThan(
      (a.waistR as Point).x - (a.waistL as Point).x + 50,
    );
    expect((b.hemR as Point).x - (b.hemL as Point).x).toBeGreaterThan(
      (a.hemR as Point).x - (a.hemL as Point).x,
    );
  });

  it('fits a photo-like body too: shoulders and hems follow it', () => {
    const photo = photoBody();
    for (const name of ['tee', 'jeans', 'sleevedDress'] as GarmentName[]) {
      const d = detected(name);
      const slot = slotsOf(name)[0] as FitSlot;
      const t = rigTargets(d.rig, d.aspect, photo, slot);
      for (const q of Object.values(t)) {
        expect(q.x).toBeGreaterThan(0);
        expect(q.x).toBeLessThan(1000);
        expect(q.y).toBeGreaterThan(0);
        expect(q.y).toBeLessThan(2000);
      }
    }
    const t = rigTargets(detected('tee').rig, detected('tee').aspect, photo, 'base');
    expect((t.shoulderL as Point).x).toBeLessThan(photo.shoulderL.x);
    expect((t.shoulderL as Point).y).toBeCloseTo(photo.shoulderL.y, 6);
  });
});

describe('rigTargets: length and width clamps', () => {
  const kh = L.kneeL.y - L.hipL.y;
  const T = FIT_RULES.target;

  it('keeps base and mid hems between the waist and just below the hip', () => {
    for (const name of ['tee', 'longSleeve', 'sleevelessTop'] as GarmentName[]) {
      for (const slot of ['base', 'mid'] as FitSlot[]) {
        const y = (targetsFor(name, slot).hemL as Point).y;
        expect(y).toBeGreaterThanOrEqual(L.waistL.y - 1e-6);
        expect(y).toBeLessThanOrEqual(L.hipL.y + T.hem.base.hi * kh + 1e-6);
      }
    }
  });

  it('keeps outerwear between the hip and 60% of the way from knee to ankle', () => {
    const y = (targetsFor('coat', 'outer').hemL as Point).y;
    expect(y).toBeGreaterThanOrEqual(L.hipL.y);
    expect(y).toBeLessThanOrEqual(L.kneeL.y + 0.6 * (L.ankleL.y - L.kneeL.y) + 1e-6);
  });

  it('puts long trousers at the ankle (within 3% of the leg) and never below the feet', () => {
    for (const name of ['jeans', 'wideLeg'] as GarmentName[]) {
      const t = targetsFor(name, 'bottom');
      for (const side of ['hemOuterL', 'hemInnerR']) {
        const y = (t[side] as Point).y;
        expect(Math.abs(y - L.ankleL.y)).toBeLessThanOrEqual(0.03 * (L.ankleL.y - L.hipL.y) + 1e-6);
        expect(y).toBeLessThanOrEqual(L.footL.y);
      }
    }
    const t = targetsFor('jumpsuit', 'onepiece');
    expect(Math.abs((t.hemOuterL as Point).y - L.ankleL.y)).toBeLessThan(
      0.04 * (L.ankleL.y - L.hipL.y),
    );
  });

  it('puts shorts between the upper thigh and the knee', () => {
    const y = (targetsFor('shorts', 'bottom').hemOuterL as Point).y;
    expect(y).toBeGreaterThanOrEqual(L.hipL.y + T.hem.shorts.lo * kh - 1e-6);
    expect(y).toBeLessThanOrEqual(L.kneeL.y + 1e-6);
  });

  it('keeps skirts and dresses between the thigh and the ankle', () => {
    for (const name of [
      'aLineSkirt',
      'pencilSkirt',
      'sleevedDress',
      'sleevelessDress',
    ] as GarmentName[]) {
      const y = (targetsFor(name, slotsOf(name)[0] as FitSlot).hemL as Point).y;
      expect(y).toBeGreaterThanOrEqual(L.hipL.y + 0.35 * kh - 1e-6);
      expect(y).toBeLessThanOrEqual(L.ankleL.y + 1e-6);
    }
  });

  it('scales lengths physically: a skirt twice as long for its waist reaches twice as far', () => {
    // Replaces the old "ratio only chooses within the range" test (the ratio mapping is gone).
    const skirt = (hemY: number): Record<string, Point> => {
      const rig = {
        kind: 'skirt' as const,
        version: 1,
        confidence: 1,
        edited: false,
        points: {
          waistL: { x: 0.4, y: 0 },
          waistR: { x: 0.6, y: 0 },
          hipL: { x: 0.39, y: 0.05 },
          hipR: { x: 0.61, y: 0.05 },
          hemL: { x: 0.35, y: hemY },
          hemR: { x: 0.65, y: hemY },
        },
      };
      return rigTargets(rig, 1, bodyA, 'bottom');
    };
    const waistY = (L.waistL.y + L.waistR.y) / 2;
    const s = ((bodyA.waistR.x - bodyA.waistL.x) * (1 + T.bottomEase.waist)) / 0.2;
    // Knee-length by proportion: 0.38 of the cutout height at 0.2 width.
    const knee = (skirt(0.38).hemL as Point).y;
    expect(knee).toBeCloseTo(waistY + 0.38 * s, 6);
    expect(Math.abs(knee - L.kneeL.y)).toBeLessThan(0.06 * (L.footL.y - bodyA.headTop.y));
    // Shorter (still inside the bounds, so exact).
    const short = (skirt(0.34).hemL as Point).y;
    expect(short).toBeCloseTo(waistY + 0.34 * s, 6);
    expect(short).toBeLessThan(knee);
    // Far too long: clamped to the ankle.
    expect((skirt(2).hemL as Point).y).toBeCloseTo(L.ankleL.y, 6);
    // Far too short: clamped to the upper-thigh bound.
    expect((skirt(0.05).hemL as Point).y).toBeCloseTo(L.hipL.y + T.hem.skirt.lo * kh, 6);
  });

  it('scales a top by its shoulder width: hem and sleeve are length × (body ÷ garment shoulders)', () => {
    const rig = {
      kind: 'top' as const,
      version: 1,
      confidence: 1,
      edited: false,
      points: {
        neckL: { x: 0.45, y: 0.05 },
        neckR: { x: 0.55, y: 0.05 },
        shoulderL: { x: 0.3, y: 0.05 },
        shoulderR: { x: 0.7, y: 0.05 },
        armpitL: { x: 0.3, y: 0.25 },
        armpitR: { x: 0.7, y: 0.25 },
        cuffOuterL: { x: 0.1, y: 0.35 },
        cuffInnerL: { x: 0.2, y: 0.4 },
        cuffOuterR: { x: 0.9, y: 0.35 },
        cuffInnerR: { x: 0.8, y: 0.4 },
        hemL: { x: 0.3, y: 0.6 },
        hemR: { x: 0.7, y: 0.6 },
      },
    };
    const t = rigTargets(rig, 1, bodyA, 'base');
    const S = bodyA.shoulderR.x - bodyA.shoulderL.x;
    const s = (S * (1 + T.shoulderEase.base)) / 0.4;
    expect((t.hemL as Point).y).toBeCloseTo(L.shoulderL.y + 0.55 * s, 6);
    const sh = t.shoulderL as Point;
    const cm = {
      x: ((t.cuffOuterL as Point).x + (t.cuffInnerL as Point).x) / 2,
      y: ((t.cuffOuterL as Point).y + (t.cuffInnerL as Point).y) / 2,
    };
    // Sleeve = |shoulder → cuff middle| in the garment × s, along shoulder → elbow → wrist.
    const want = Math.hypot(0.15 - 0.3, 0.375 - 0.05) * s;
    const elbow = bodyA.elbowL as Point;
    const upper = dist(sh, elbow);
    expect(upper).toBeLessThan(want);
    expect(dist(elbow, cm)).toBeCloseTo(want - upper, 4);
  });

  it('keeps sleeves between a quarter of the arm and just past the wrist', () => {
    for (const name of ['tee', 'longSleeve', 'coat', 'jumpsuit'] as GarmentName[]) {
      const slot = slotsOf(name)[0] as FitSlot;
      const t = targetsFor(name, slot);
      const sh = t.shoulderL as Point;
      const mid = {
        x: ((t.cuffOuterL as Point).x + (t.cuffInnerL as Point).x) / 2,
        y: ((t.cuffOuterL as Point).y + (t.cuffInnerL as Point).y) / 2,
      };
      const arm = dist(sh, bodyA.elbowL as Point) + dist(bodyA.elbowL as Point, L.wristL);
      const reach = dist(sh, mid);
      expect(reach).toBeGreaterThanOrEqual(0.2 * arm);
      expect(reach).toBeLessThanOrEqual(1.05 * arm);
    }
  });

  it('clamps cuff width to 18–32% of the shoulder width (outerwear to 36%)', () => {
    for (const [name, slot, max] of [
      ['tee', 'base', 0.32],
      ['longSleeve', 'base', 0.32],
      ['coat', 'outer', 0.36],
      ['sleevedDress', 'onepiece', 0.32],
    ] as [GarmentName, FitSlot, number][]) {
      const t = targetsFor(name, slot);
      for (const side of ['L', 'R']) {
        const w = dist(t[`cuffOuter${side}`] as Point, t[`cuffInner${side}`] as Point);
        expect(w).toBeGreaterThanOrEqual(0.18 * S - 1e-6);
        expect(w).toBeLessThanOrEqual(max * S + 1e-6);
      }
    }
  });

  it('keeps the garment’s neck width relative to its shoulders, within 25–60%', () => {
    for (const name of NAMES.filter((n) => KIND[n] === 'top' || KIND[n] === 'dress')) {
      const d = detected(name);
      const t = rigTargets(d.rig, d.aspect, bodyA, slotsOf(name)[0] as FitSlot);
      const gs =
        ((d.rig.points.shoulderR as Point).x - (d.rig.points.shoulderL as Point).x) * d.aspect;
      const gn = ((d.rig.points.neckR as Point).x - (d.rig.points.neckL as Point).x) * d.aspect;
      const sep = (t.neckR as Point).x - (t.neckL as Point).x;
      const want = Math.min(0.6 * S, Math.max(0.25 * S, (gn / gs) * S));
      expect(sep).toBeCloseTo(want, 6);
    }
  });

  it('maps straps in proportion to the torso on sleeveless garments', () => {
    const t = targetsFor('sleevelessTop', 'base');
    const d = detected('sleevelessTop');
    const gs = (d.rig.points.shoulderR as Point).x - (d.rig.points.shoulderL as Point).x;
    const ga = (d.rig.points.armpitR as Point).x - (d.rig.points.armpitL as Point).x;
    const bw = (t.armpitR as Point).x - (t.armpitL as Point).x;
    // Physical scale: body chest width (85% of the shoulders, plus ease) ÷ garment armpit width.
    const S = L.shoulderR.x - L.shoulderL.x;
    const scale = (T.chestWidth * S * (1 + T.shoulderEase.base)) / ga;
    expect((t.shoulderR as Point).x - (t.shoulderL as Point).x).toBeCloseTo(gs * scale, 6);
    expect(bw).toBeGreaterThan(0);
    // Straps sit inside the shoulder tips.
    expect((t.shoulderL as Point).x).toBeGreaterThan(L.shoulderL.x);
  });

  it('keeps armpits on the torso sides, not out on the arms', () => {
    for (const name of ['tee', 'coat', 'sleevedDress'] as GarmentName[]) {
      const t = targetsFor(name, slotsOf(name)[0] as FitSlot);
      const a = t.armpitL as Point;
      expect(a.x).toBeGreaterThan(L.shoulderL.x - 30);
      expect(a.x).toBeLessThan(L.waistL.x);
    }
  });
});
