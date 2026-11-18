import type { GarmentRig, Point, RigKind } from '../model/types';
import { hemShadow, fillDip, softenEdges, wobbleEdges } from '../testing/maskEffects';
import { garmentMask, type GarmentMask, type GarmentName } from '../testing/garmentMasks';
import { FIT_MIN_CONFIDENCE, RIG_VERSION } from './contract';
import { detectRig } from './detect';
import { rigPointNames } from './rigs';

const KIND: Record<GarmentName, RigKind> = {
  tee: 'top',
  longSleeve: 'top',
  sleevelessTop: 'top',
  coat: 'top',
  jeans: 'trousers',
  wideLeg: 'trousers',
  shorts: 'trousers',
  aLineSkirt: 'skirt',
  pencilSkirt: 'skirt',
  sleevedDress: 'dress',
  sleevelessDress: 'dress',
  jumpsuit: 'jumpsuit',
};
const NAMES = Object.keys(KIND) as GarmentName[];
const SLEEVELESS: GarmentName[] = ['sleevelessTop', 'sleevelessDress'];

/** Largest coordinate difference (normalised mask units) between detected and constructed points. */
function errors(rig: GarmentRig, g: GarmentMask): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, t] of Object.entries(g.truth)) {
    const d = rig.points[name];
    out[name] = d ? Math.max(Math.abs(d.x - t.x), Math.abs(d.y - t.y)) : Infinity;
  }
  return out;
}

/** Armpits, hips, the crotch and cuff corners are ambiguous on curved garments; more slack. */
const loose = (name: string): boolean => /^(armpit|hip|crotch|cuff)/.test(name);

function expectClose(name: GarmentName, rig: GarmentRig | undefined, g: GarmentMask, tol: number) {
  expect(rig).toBeDefined();
  if (!rig) return;
  for (const [point, err] of Object.entries(errors(rig, g))) {
    const limit = loose(point) ? tol * 2.4 : tol;
    if (err > limit) throw new Error(`${name} ${point}: off by ${err.toFixed(3)} (limit ${limit})`);
  }
}

describe('detectRig on clean procedural garments', () => {
  it.each(NAMES)('%s: points near the construction points at several sizes', (name) => {
    for (const height of [120, 240, 480]) {
      const g = garmentMask(name, { height });
      expectClose(name, detectRig(g.mask, KIND[name]), g, 0.05);
    }
  });

  it.each(NAMES)('%s: confident, versioned, normalised and unedited', (name) => {
    const g = garmentMask(name);
    const rig = detectRig(g.mask, KIND[name]) as GarmentRig;
    expect(rig.kind).toBe(KIND[name]);
    expect(rig.version).toBe(RIG_VERSION);
    expect(rig.edited).toBe(false);
    expect(rig.confidence).toBeGreaterThanOrEqual(0.9);
    for (const q of Object.values(rig.points)) {
      expect(q.x).toBeGreaterThanOrEqual(0);
      expect(q.x).toBeLessThanOrEqual(1);
      expect(q.y).toBeGreaterThanOrEqual(0);
      expect(q.y).toBeLessThanOrEqual(1);
    }
  });

  it.each(NAMES)('%s: only names the kind defines, and all required ones', (name) => {
    const rig = detectRig(garmentMask(name).mask, KIND[name]) as GarmentRig;
    const allowed = rigPointNames(KIND[name]);
    for (const n of Object.keys(rig.points)) expect(allowed).toContain(n);
    const optional = ['cuffOuterL', 'cuffInnerL', 'cuffOuterR', 'cuffInnerR'];
    for (const n of allowed) {
      if (!optional.includes(n)) expect(rig.points).toHaveProperty(n);
    }
  });

  it('omits sleeve points for sleeveless tops and dresses and keeps them for sleeved garments', () => {
    for (const name of NAMES.filter((n) => KIND[n] !== 'trousers' && KIND[n] !== 'skirt')) {
      const rig = detectRig(garmentMask(name).mask, KIND[name]) as GarmentRig;
      const hasCuffs = 'cuffOuterL' in rig.points && 'cuffInnerR' in rig.points;
      expect(hasCuffs).toBe(!SLEEVELESS.includes(name));
      expect(rig.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    }
  });

  it('tells short sleeves from long sleeves', () => {
    const sleeveShare = (name: GarmentName): number => {
      const p = (detectRig(garmentMask(name).mask, 'top') as GarmentRig).points;
      const sh = (p.shoulderL as Point).y;
      return ((p.cuffInnerL as Point).y - sh) / ((p.hemL as Point).y - sh);
    };
    expect(sleeveShare('tee')).toBeLessThan(0.4);
    expect(sleeveShare('longSleeve')).toBeGreaterThan(0.7);
    expect(sleeveShare('coat')).toBeGreaterThan(0.7);
  });

  it('tells cropped from long tops by the hem', () => {
    const ratio = (name: GarmentName): number => {
      const g = garmentMask(name);
      const p = (detectRig(g.mask, 'top') as GarmentRig).points;
      const width = ((p.shoulderR as Point).x - (p.shoulderL as Point).x) * g.aspect;
      return ((p.hemL as Point).y - (p.shoulderL as Point).y) / width;
    };
    expect(ratio('coat')).toBeGreaterThan(ratio('tee') * 1.25);
  });

  it('tells shorts from long trousers and wide legs from skinny ones', () => {
    const measure = (name: GarmentName): { drop: number; hem: number } => {
      const g = garmentMask(name);
      const p = (detectRig(g.mask, 'trousers') as GarmentRig).points;
      const waist = ((p.waistR as Point).x - (p.waistL as Point).x) * g.aspect;
      return {
        drop: ((p.hemOuterL as Point).y - (p.waistL as Point).y) / waist,
        hem: (((p.hemInnerL as Point).x - (p.hemOuterL as Point).x) * g.aspect) / waist,
      };
    };
    expect(measure('shorts').drop).toBeLessThan(measure('jeans').drop * 0.6);
    expect(measure('wideLeg').hem).toBeGreaterThan(measure('jeans').hem * 1.6);
  });

  it('tells A-line from pencil skirts by the hem width', () => {
    const hemOverWaist = (name: GarmentName): number => {
      const p = (detectRig(garmentMask(name).mask, 'skirt') as GarmentRig).points;
      return (
        ((p.hemR as Point).x - (p.hemL as Point).x) /
        ((p.waistR as Point).x - (p.waistL as Point).x)
      );
    };
    expect(hemOverWaist('aLineSkirt')).toBeGreaterThan(1.5);
    expect(hemOverWaist('pencilSkirt')).toBeLessThan(1.1);
  });

  it('finds crotch between the legs and hips above it', () => {
    for (const name of ['jeans', 'wideLeg', 'shorts', 'jumpsuit'] as GarmentName[]) {
      const p = (detectRig(garmentMask(name).mask, KIND[name]) as GarmentRig).points;
      const crotch = p.crotch as Point;
      expect(crotch.x).toBeCloseTo(0.5, 1);
      expect(crotch.y).toBeGreaterThan((p.hipL as Point).y);
      expect(crotch.y).toBeLessThan((p.hemInnerL as Point).y);
    }
  });

  it('is deterministic', () => {
    for (const name of NAMES) {
      const g = garmentMask(name, { rotate: 3, noise: 0.4, seed: 9 });
      expect(detectRig(g.mask, KIND[name])).toEqual(detectRig(g.mask, KIND[name]));
    }
  });
});

describe('detectRig with noise, tilt and cut edges', () => {
  it.each(NAMES)('%s: tilted ±4° stays close and confident', (name) => {
    for (const rotate of [4, -4]) {
      const g = garmentMask(name, { rotate });
      const rig = detectRig(g.mask, KIND[name]);
      expectClose(name, rig, g, 0.09);
      expect(rig?.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    }
  });

  it.each(NAMES)('%s: ragged edges, specks and pinholes stay close', (name) => {
    const g = garmentMask(name, { noise: 0.6, seed: 5 });
    const rig = detectRig(g.mask, KIND[name]);
    expectClose(name, rig, g, 0.09);
    expect(rig?.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
  });

  it.each(NAMES)('%s: noisy and tilted together still detect', (name) => {
    const g = garmentMask(name, { noise: 0.4, rotate: -3, seed: 11 });
    const rig = detectRig(g.mask, KIND[name]);
    expectClose(name, rig, g, 0.1);
  });

  it.each(NAMES)('%s: a clean cutout is more confident than a noisy one', (name) => {
    const clean = detectRig(garmentMask(name).mask, KIND[name]) as GarmentRig;
    const noisy = detectRig(
      garmentMask(name, { noise: 0.6, seed: 5 }).mask,
      KIND[name],
    ) as GarmentRig;
    expect(clean.confidence).toBeGreaterThan(noisy.confidence);
  });

  it.each(NAMES)('%s: a garment touching the mask edge is still detected', (name) => {
    const g = garmentMask(name, { margin: 0 });
    expectClose(name, detectRig(g.mask, KIND[name]), g, 0.06);
  });

  it('copes with small and large masks alike', () => {
    for (const height of [60, 90, 700]) {
      const g = garmentMask('tee', { height });
      expectClose('tee', detectRig(g.mask, 'top'), g, 0.08);
    }
  });
});

describe('detectRig on the wrong kind or no garment', () => {
  const run = (name: GarmentName, kind: RigKind): GarmentRig | undefined =>
    detectRig(garmentMask(name).mask, kind);

  it('returns undefined for an empty or tiny mask', () => {
    const empty = { width: 50, height: 50, alpha: new Uint8Array(2500) };
    for (const kind of ['top', 'trousers', 'skirt', 'dress', 'jumpsuit'] as RigKind[]) {
      expect(detectRig(empty, kind)).toBeUndefined();
    }
    const dot = new Uint8Array(2500);
    dot[25 * 50 + 25] = 255;
    expect(detectRig({ width: 50, height: 50, alpha: dot }, 'top')).toBeUndefined();
    expect(detectRig({ width: 0, height: 0, alpha: new Uint8Array(0) }, 'top')).toBeUndefined();
    expect(detectRig({ width: 10, height: 10, alpha: new Uint8Array(5) }, 'top')).toBeUndefined();
  });

  it('returns undefined when there are no legs for trousers or jumpsuits', () => {
    expect(run('tee', 'trousers')).toBeUndefined();
    expect(run('aLineSkirt', 'trousers')).toBeUndefined();
    expect(run('sleevelessDress', 'jumpsuit')).toBeUndefined();
  });

  it('returns undefined for trousers drawn as a skirt', () => {
    expect(run('jeans', 'skirt')).toBeUndefined();
    expect(run('wideLeg', 'skirt')).toBeUndefined();
  });

  it('is much less confident for a wrong kind than for the right one', () => {
    const right = (run('jeans', 'trousers') as GarmentRig).confidence;
    for (const [name, kind] of [
      ['jeans', 'top'],
      ['aLineSkirt', 'top'],
      ['pencilSkirt', 'top'],
      ['shorts', 'top'],
      ['tee', 'skirt'],
      ['longSleeve', 'skirt'],
    ] as [GarmentName, RigKind][]) {
      const wrong = run(name, kind);
      if (wrong) {
        expect(wrong.confidence).toBeLessThan(FIT_MIN_CONFIDENCE);
        expect(wrong.confidence).toBeLessThan(right);
      }
    }
  });

  it('ranks confidence clean > noisy > wrong kind for one garment', () => {
    const clean = run('tee', 'top') as GarmentRig;
    const noisy = detectRig(garmentMask('tee', { noise: 0.8, seed: 2 }).mask, 'top') as GarmentRig;
    const wrong = run('jeans', 'top') as GarmentRig;
    expect(clean.confidence).toBeGreaterThan(noisy.confidence);
    expect(noisy.confidence).toBeGreaterThan(wrong.confidence);
  });
});

describe('detectRig on real-photo artefacts', () => {
  const WHOLE = NAMES;
  /** Dresses and jumpsuits have more outline to go wrong; they get the milder artefacts only. */
  const SIMPLE = NAMES.filter((n) => !/dress|jumpsuit/i.test(n));

  // The jumpsuit has the most outline to lose (neck, sleeves, waist and two legs) and is left out of
  // the bumpy cases; the milder artefacts below include it.
  it.each(WHOLE.filter((n) => n !== 'jumpsuit'))(
    '%s: a wrinkled, bumpy outline (0.6%) stays close and confident',
    (name) => {
      for (const rotate of SIMPLE.includes(name) ? [0, 5, -7] : [0, 5]) {
        const g = garmentMask(name, { height: 400, rotate });
        const rig = detectRig(wobbleEdges(g.mask, 0.006, 1), KIND[name]);
        expectClose(name, rig, g, 0.08);
        expect(rig?.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
      }
    },
  );

  it.each(SIMPLE)('%s: a very bumpy outline (1.2%) still finds the points', (name) => {
    for (const rotate of [0, -7]) {
      const g = garmentMask(name, { height: 400, rotate });
      const rig = detectRig(wobbleEdges(g.mask, 0.012, 2), KIND[name]);
      expectClose(name, rig, g, 0.1);
      expect(rig?.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    }
  });

  it.each(WHOLE)('%s: a soft, anti-aliased alpha edge stays close and confident', (name) => {
    for (const rotate of SIMPLE.includes(name) ? [0, 5, -7] : [0, 5]) {
      const g = garmentMask(name, { height: 400, rotate });
      const rig = detectRig(softenEdges(g.mask, 2), KIND[name]);
      expectClose(name, rig, g, 0.08);
      expect(rig?.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    }
  });

  it.each(SIMPLE)('%s: tilted 8 degrees with a bumpy, soft outline', (name) => {
    for (const rotate of [8, -8]) {
      const g = garmentMask(name, { height: 400, rotate });
      const rig = detectRig(softenEdges(wobbleEdges(g.mask, 0.006, 3), 1), KIND[name]);
      expectClose(name, rig, g, 0.1);
      expect(rig?.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    }
  });

  it.each(['tee', 'longSleeve', 'coat', 'jeans', 'aLineSkirt'] as GarmentName[])(
    '%s: a shadow under the hem moves the hem points by the shadow at most',
    (name) => {
      const g = garmentMask(name, { height: 400 });
      const shadowed = hemShadow(g.mask, 6);
      const rig = detectRig(shadowed, KIND[name]) as GarmentRig;
      expect(rig.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
      const hem = (rig.points.hemL ?? rig.points.hemOuterL) as Point;
      const truth = (g.truth.hemL ?? g.truth.hemOuterL) as Point;
      // Compare in pixels of the original height: the shadow is 6 px of a 400+ px garment.
      expect(Math.abs(hem.y * shadowed.height - truth.y * g.mask.height)).toBeLessThan(0.05 * 400);
    },
  );

  it('a hanger filling the neck dip leaves a sleeved top fittable, but not a skirt read as a top', () => {
    const tee = garmentMask('tee', { height: 400 });
    const filled = detectRig(fillDip(tee.mask, 40), 'top') as GarmentRig;
    expect(filled.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    // The neck falls back to the middle of the top edge, inside the shoulders.
    const p = filled.points;
    expect((p.neckL as Point).x).toBeGreaterThan((p.shoulderL as Point).x);
    expect((p.neckR as Point).x).toBeLessThan((p.shoulderR as Point).x);
    const sleeveless = detectRig(
      fillDip(garmentMask('sleevelessTop', { height: 400 }).mask, 40),
      'top',
    );
    if (sleeveless) expect(sleeveless.confidence).toBeLessThan(FIT_MIN_CONFIDENCE);
    for (const name of ['jeans', 'aLineSkirt', 'pencilSkirt', 'shorts'] as GarmentName[]) {
      const wrong = detectRig(garmentMask(name).mask, 'top');
      if (wrong) expect(wrong.confidence).toBeLessThan(FIT_MIN_CONFIDENCE);
    }
  });

  it('finds a short sleeve whose underside is a slant with no step, as on a photographed tee', () => {
    // Design units of a 100-wide tee, drawn at 3 px a unit: shoulder slope out to the sleeve tip,
    // the underside running diagonally back in to the torso, a straight torso, a neck dip.
    const K = 3;
    const W = 100 * K;
    const H = 150 * K;
    const alpha = new Uint8Array(W * H);
    const left = (u: number): number =>
      u < 5 ? 40 : u < 30 ? 40 - (36 * (u - 5)) / 25 : u < 52 ? 4 + (24 * (u - 30)) / 22 : 28;
    for (let y = 0; y < H; y++) {
      const u = y / K;
      if (u < 5 || u > 140) continue;
      for (let x = 0; x < W; x++) {
        const v = x / K;
        const mirrored = 100 - v;
        const inside = Math.min(v, mirrored) >= left(u);
        const dip = u < 12 && v > 42 && v < 58 && u < 12 - (v - 50) ** 2 / 8;
        if (inside && !dip) alpha[y * W + x] = 255;
      }
    }
    const rig = detectRig({ width: W, height: H, alpha }, 'top') as GarmentRig;
    expect(rig.confidence).toBeGreaterThan(FIT_MIN_CONFIDENCE);
    for (const side of ['L', 'R']) {
      expect(rig.points[`cuffOuter${side}`]).toBeDefined();
    }
    const armpit = rig.points.armpitL as Point;
    expect(armpit.x).toBeCloseTo(0.28, 1);
    expect(armpit.y * 150).toBeGreaterThan(40);
    expect(armpit.y * 150).toBeLessThan(60);
  });
});
