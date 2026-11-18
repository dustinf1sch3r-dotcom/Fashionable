import type { Point } from '../model/types';
import type { AlphaMask } from './contract';
import { detectRig } from './detect';
import { FIXTURE_KIND, fixtureMask } from './fixtureGarments';
import { layeredTargets } from './layers';
import { rigTargets } from './targets';
import { bodyA } from './testHelpers';

/**
 * The real garment cutouts the gallery and the browser tests use (e2e/fixtures/garments), run
 * through detection and fitting on BODY_A. Tolerances are in mannequin units (1000 x 2000).
 */
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const B = bodyA;
const bodyHeight = B.footL.y - B.headTop.y;
const hipY = (B.hipL.y + B.hipR.y) / 2;
const kneeY = (B.kneeL.y + B.kneeR.y) / 2;
const ankleY = (B.ankleL.y + B.ankleR.y) / 2;
const legLength = dist({ x: 0, y: hipY }, { x: 0, y: kneeY }) + (ankleY - kneeY);

const names = Object.keys(FIXTURE_KIND);
const loaded = names.map((name) => {
  const mask = fixtureMask(name);
  const kind = FIXTURE_KIND[name] as NonNullable<(typeof FIXTURE_KIND)[string]>;
  const rig = detectRig(mask, kind);
  return { name, mask, kind, rig, aspect: mask.width / mask.height };
});
const get = (name: string) => {
  const f = loaded.find((l) => l.name === name);
  if (!f || !f.rig) throw new Error(`no rig for ${name}`);
  return { ...f, rig: f.rig };
};
const slotOf = (kind: string): 'base' | 'bottom' | 'onepiece' =>
  kind === 'top' ? 'base' : kind === 'dress' ? 'onepiece' : 'bottom';

/** Distance (in cutout pixels) from a normalised point to the nearest outline pixel. */
function outlineDistance(mask: AlphaMask, p: Point) {
  const { width: w, height: h, alpha } = mask;
  const on = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && (alpha[y * w + x] as number) >= 128;
  const cx = Math.min(w - 1, Math.max(0, Math.round(p.x * w)));
  const cy = Math.min(h - 1, Math.max(0, Math.round(p.y * h)));
  let best = Infinity;
  const r = Math.ceil(0.1 * Math.max(w, h));
  for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      if (!on(x, y)) continue;
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      if (edge) best = Math.min(best, Math.hypot(x - cx, y - cy));
    }
  }
  return best;
}

describe('fixture garments: detection', () => {
  it.each(names)('%s: every rig point lies on the outline', (name) => {
    const f = get(name);
    const size = Math.max(f.mask.width, f.mask.height);
    for (const [point, q] of Object.entries(f.rig.points)) {
      // The crotch is extrapolated up the leg gap's apex, so it may sit inside the solid cloth.
      const tol = (point === 'crotch' ? 0.06 : 0.03) * size;
      const d = outlineDistance(f.mask, q);
      if (d > tol)
        throw new Error(
          `${name} ${point} is ${d.toFixed(1)} px off the outline (limit ${tol.toFixed(1)})`,
        );
    }
    expect(f.rig.confidence).toBeGreaterThan(0.8);
  });

  it.each(['tee-navy', 'tee-white', 'shirt-blue', 'jacket-denim'])(
    '%s: tops have neck, shoulders, armpits, cuffs and hem in the expected places',
    (name) => {
      const p = get(name).rig.points as Record<string, Point>;
      for (const s of ['L', 'R'] as const) {
        const sh = p[`shoulder${s}`] as Point;
        const ar = p[`armpit${s}`] as Point;
        const cm = mid(p[`cuffOuter${s}`] as Point, p[`cuffInner${s}`] as Point);
        expect(sh.y).toBeLessThan(0.15);
        expect(ar.y).toBeGreaterThan(sh.y);
        expect(cm.y).toBeGreaterThan(ar.y);
        expect((p[`hem${s}`] as Point).y).toBeGreaterThan(0.85);
      }
      expect((p.neckL as Point).x).toBeLessThan(0.5);
      expect((p.neckR as Point).x).toBeGreaterThan(0.5);
      expect((p.neckL as Point).y).toBeLessThan(0.05);
    },
  );

  it('puts the cuffs where the sleeves end: short on the tee, at the bottom on shirt and coat', () => {
    const cuffY = (n: string, s: 'L' | 'R'): number => {
      const p = get(n).rig.points as Record<string, Point>;
      return mid(p[`cuffOuter${s}`] as Point, p[`cuffInner${s}`] as Point).y;
    };
    for (const s of ['L', 'R'] as const) {
      expect(cuffY('tee-navy', s)).toBeLessThan(0.4);
      expect(cuffY('shirt-blue', s)).toBeGreaterThan(0.8);
      expect(cuffY('jacket-denim', s)).toBeGreaterThan(0.9);
    }
  });

  it('finds the coat’s own hem (the torso), not the sleeve ends', () => {
    const p = get('jacket-denim').rig.points as Record<string, Point>;
    expect((p.hemL as Point).y).toBeCloseTo(0.9, 1);
    expect((p.hemL as Point).x).toBeGreaterThan(0.15);
    expect((p.hemR as Point).x).toBeLessThan(0.85);
    expect(Math.abs((p.armpitL as Point).y - (p.armpitR as Point).y)).toBeLessThan(0.03);
  });

  it.each(['jeans-dark', 'trousers-grey'])(
    '%s: waist on top, crotch near a third, hems at the bottom',
    (name) => {
      const p = get(name).rig.points as Record<string, Point>;
      expect((p.waistL as Point).y).toBeLessThan(0.03);
      expect((p.crotch as Point).y).toBeGreaterThan(0.2);
      expect((p.crotch as Point).y).toBeLessThan(0.4);
      for (const k of ['hemOuterL', 'hemInnerL', 'hemOuterR', 'hemInnerR']) {
        expect((p[k] as Point).y).toBeGreaterThan(0.97);
      }
    },
  );

  it('skirt and dress: waist band on top (skirt) or mid-height (dress), hem at the bottom', () => {
    const s = get('skirt-olive').rig.points as Record<string, Point>;
    expect((s.waistL as Point).y).toBeLessThan(0.03);
    expect((s.hemL as Point).y).toBeGreaterThan(0.97);
    const d = get('dress-green').rig.points as Record<string, Point>;
    expect((d.waistL as Point).y).toBeGreaterThan(0.2);
    expect((d.waistL as Point).y).toBeLessThan(0.35);
    expect((d.hemL as Point).y).toBeGreaterThan(0.97);
    expect(d.cuffOuterL).toBeUndefined();
  });
});

describe('fixture garments: fit on BODY_A', () => {
  const targetsOf = (name: string, slot?: 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece') => {
    const f = get(name);
    return rigTargets(f.rig, f.aspect, B, slot ?? slotOf(f.kind));
  };
  const armLength = (s: 'L' | 'R'): number => {
    const sh = s === 'L' ? B.shoulderL : B.shoulderR;
    const el = (s === 'L' ? B.elbowL : B.elbowR) as Point;
    const wr = s === 'L' ? B.wristL : B.wristR;
    return dist(sh, el) + dist(el, wr);
  };

  it.each([
    ['shirt-blue', 'base'],
    ['jacket-denim', 'outer'],
  ] as const)('%s: cuffs end at the wrists (within 4%% of the arm)', (name, slot) => {
    const t = targetsOf(name, slot);
    for (const s of ['L', 'R'] as const) {
      const c = mid(t[`cuffOuter${s}`] as Point, t[`cuffInner${s}`] as Point);
      const wrist = s === 'L' ? B.wristL : B.wristR;
      expect(dist(c, wrist)).toBeLessThan(0.04 * armLength(s));
    }
  });

  it('tee: hem between the hip and 15% of the way from hip to knee', () => {
    for (const name of ['tee-navy', 'tee-white']) {
      const t = targetsOf(name);
      const y = (t.hemL as Point).y;
      expect(y).toBeGreaterThanOrEqual(hipY);
      expect(y).toBeLessThanOrEqual(hipY + 0.15 * (kneeY - hipY));
    }
  });

  it('tee: sleeves end on the upper arm, above the elbow', () => {
    const t = targetsOf('tee-navy');
    const c = mid(t.cuffOuterL as Point, t.cuffInnerL as Point);
    expect(c.y).toBeLessThan((B.elbowL as Point).y);
    expect(c.y).toBeGreaterThan(B.shoulderL.y + 100);
  });

  it.each(['jeans-dark', 'trousers-grey'])(
    '%s: hems within 3%% of the leg length of the ankles',
    (name) => {
      const t = targetsOf(name);
      for (const [k, ankle] of [
        ['hemOuterL', B.ankleL],
        ['hemInnerL', B.ankleL],
        ['hemOuterR', B.ankleR],
        ['hemInnerR', B.ankleR],
      ] as const) {
        expect(Math.abs((t[k] as Point).y - ankle.y)).toBeLessThanOrEqual(0.03 * legLength);
      }
    },
  );

  it('skirt and dress: physical length. The fixtures are midi/maxi by their own proportions', () => {
    // Skirt: 360 px long and 138 px at the waist -> 2.6 waist widths. The body's waist (with ease)
    // is 312 units, so it reaches 800 + 2.6 x 312 = ~1614: past the knee (1400), short of the ankle.
    const skirt = (targetsOf('skirt-olive').hemL as Point).y;
    expect(skirt).toBeGreaterThan(kneeY);
    expect(skirt).toBeLessThan(ankleY);
    expect(Math.abs(skirt - 1614)).toBeLessThan(0.03 * bodyHeight);
    // Dress: a 75 px strap-to-strap bodice with a 225 px hem, 360 px long: at that scale it is a maxi.
    const dress = (targetsOf('dress-green').hemL as Point).y;
    expect(dress).toBeGreaterThan(kneeY + 0.6 * (ankleY - kneeY));
    expect(dress).toBeLessThanOrEqual(ankleY + 1e-6);
  });

  it('layered coat over sweater: every sweater sleeve target lies inside the coat’s sleeve band', () => {
    const sweater = get('shirt-blue');
    const coat = get('jacket-denim');
    const out = layeredTargets(
      [
        { itemId: 'sweater', rig: sweater.rig, aspect: sweater.aspect, slot: 'mid' },
        { itemId: 'coat', rig: coat.rig, aspect: coat.aspect, slot: 'outer' },
      ],
      B,
    );
    const s = out.sweater?.targets as Record<string, Point>;
    const c = out.coat?.targets as Record<string, Point>;
    for (const side of ['L', 'R'] as const) {
      const co = c[`cuffOuter${side}`] as Point;
      const ci = c[`cuffInner${side}`] as Point;
      const shoulder = c[`shoulder${side}`] as Point;
      // Band between the coat's two sleeve edges, measured across the sleeve axis at each point.
      const axis = { x: (co.x + ci.x) / 2 - shoulder.x, y: (co.y + ci.y) / 2 - shoulder.y };
      const len = Math.hypot(axis.x, axis.y);
      const along = (q: Point): number =>
        ((q.x - shoulder.x) * axis.x + (q.y - shoulder.y) * axis.y) / len;
      for (const key of [`cuffOuter${side}`, `cuffInner${side}`]) {
        const q = s[key] as Point;
        // Not past the outer cuff along the sleeve ...
        expect(along(q)).toBeLessThanOrEqual(len + 1e-6);
        // ... and between the coat's own sleeve edges at the cuff (cross-axis offset).
        const cross = ((q.x - shoulder.x) * -axis.y + (q.y - shoulder.y) * axis.x) / len;
        const crossOuter = ((co.x - shoulder.x) * -axis.y + (co.y - shoulder.y) * axis.x) / len;
        const crossInner = ((ci.x - shoulder.x) * -axis.y + (ci.y - shoulder.y) * axis.x) / len;
        expect(cross).toBeGreaterThanOrEqual(Math.min(crossOuter, crossInner) - 1e-6);
        expect(cross).toBeLessThanOrEqual(Math.max(crossOuter, crossInner) + 1e-6);
      }
      expect(
        dist(mid(s[`cuffOuter${side}`] as Point, s[`cuffInner${side}`] as Point), shoulder),
      ).toBeLessThanOrEqual(len + 1e-6);
    }
  });
});
