import {
  chooseCutout,
  estimateBackground,
  keyBackground,
  maskAgreement,
  SCORE_RULES,
  scoreCutout,
} from './key';

const W = 120;
const H = 160;

type Rgb = [number, number, number];
type Paint = (x: number, y: number) => Rgb | undefined;

/** Deterministic noise in -1..1 (no Math.random in core tests either). */
function noise(x: number, y: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

function image(background: Paint, garment: Paint, w = W, h = H): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = garment(x, y) ?? background(x, y) ?? [0, 0, 0];
      out.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return out;
}

const flat =
  (c: Rgb): Paint =>
  () =>
    c;
const rect =
  (x0: number, y0: number, x1: number, y1: number, c: Rgb): Paint =>
  (x, y) =>
    x >= x0 && x < x1 && y >= y0 && y < y1 ? c : undefined;

const RED: Rgb = [190, 30, 40];
const FLOOR: Rgb = [214, 208, 196];

const at = (alpha: Float32Array, x: number, y: number, w = W): number => alpha[y * w + x];

describe('estimateBackground', () => {
  it('finds a flat border and calls it plain', () => {
    const m = estimateBackground(image(flat(FLOOR), rect(30, 30, 90, 130, RED)), W, H);
    expect(m.plain).toBe(true);
    expect(m.spread).toBeLessThan(1);
    expect(m.borderShare).toBeGreaterThan(0.99);
  });

  it('does not call a busy border plain', () => {
    const busy: Paint = (x, y) =>
      ((x >> 2) + (y >> 2)) % 2 === 0 ? [20, 20, 20] : [240, 240, 240];
    const m = estimateBackground(image(busy, rect(30, 30, 90, 130, RED)), W, H);
    expect(m.plain).toBe(false);
    expect(keyBackground(image(busy, rect(30, 30, 90, 130, RED)), W, H)).toBeUndefined();
  });

  it('raises the tolerance with the spread of a textured border', () => {
    const textured: Paint = (x, y) => {
      const n = noise(x, y) * 10;
      return [FLOOR[0] + n, FLOOR[1] + n, FLOOR[2] + n];
    };
    const flatM = estimateBackground(image(flat(FLOOR), rect(30, 30, 90, 130, RED)), W, H);
    const texM = estimateBackground(image(textured, rect(30, 30, 90, 130, RED)), W, H);
    expect(texM.plain).toBe(true);
    expect(texM.tolerance).toBeGreaterThan(flatM.tolerance);
  });
});

describe('keyBackground', () => {
  it('keeps a garment on a plain background and clears the rest', () => {
    const r = keyBackground(image(flat(FLOOR), rect(30, 30, 90, 130, RED)), W, H);
    expect(r).toBeDefined();
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 60, 80)).toBe(1);
    expect(at(a, 5, 5)).toBe(0);
    expect(at(a, 60, 150)).toBe(0);
    expect(scoreCutout(a, W, H).score).toBeGreaterThan(SCORE_RULES.accept);
  });

  it('works on a gradient background', () => {
    const gradient: Paint = (_x, y) => {
      const t = y / H;
      return [200 + 25 * t, 195 + 25 * t, 185 + 25 * t];
    };
    const r = keyBackground(image(gradient, rect(30, 30, 90, 130, RED)), W, H);
    expect(r).toBeDefined();
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 60, 80)).toBe(1);
    expect(at(a, 5, 5)).toBe(0);
    expect(at(a, 110, 155)).toBe(0);
    expect(scoreCutout(a, W, H).score).toBeGreaterThan(SCORE_RULES.accept);
  });

  it('works on a textured background and leaves no specks', () => {
    const textured: Paint = (x, y) => {
      const n = noise(x, y) * 9;
      return [150 + n, 110 + n, 70 + n]; // wood-ish
    };
    const r = keyBackground(image(textured, rect(30, 30, 90, 130, RED)), W, H);
    expect(r).toBeDefined();
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 60, 80)).toBe(1);
    let strays = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inside = x >= 28 && x < 92 && y >= 28 && y < 132;
        if (!inside && a[y * W + x] > 0.05) strays++;
      }
    }
    expect(strays).toBe(0);
    expect(scoreCutout(a, W, H).score).toBeGreaterThan(SCORE_RULES.accept);
  });

  it('handles a garment that touches the image edge', () => {
    const r = keyBackground(image(flat(FLOOR), rect(30, 40, 90, H, RED)), W, H);
    expect(r).toBeDefined();
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 60, 155)).toBe(1);
    expect(at(a, 10, 155)).toBe(0);
    expect(at(a, 60, 20)).toBe(0);
  });

  it('keeps the gap between trouser legs transparent because it reaches the border', () => {
    const trousers = (x: number, y: number): Rgb | undefined => {
      const waist = y >= 20 && y < 60 && x >= 30 && x < 90;
      const left = y >= 60 && y < 150 && x >= 30 && x < 56;
      const right = y >= 60 && y < 150 && x >= 64 && x < 90;
      return waist || left || right ? RED : undefined;
    };
    const r = keyBackground(image(flat(FLOOR), trousers), W, H);
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 60, 120)).toBe(0); // between the legs
    expect(at(a, 40, 120)).toBe(1);
    expect(at(a, 80, 120)).toBe(1);
  });

  it('fills a small enclosed hole but opens a large enclosed one', () => {
    const body = rect(20, 20, 100, 140, RED);
    const smallHole = rect(58, 30, 62, 34, FLOOR); // 16 px
    const bigHole = rect(30, 70, 50, 120, FLOOR); // 1000 px
    const garment: Paint = (x, y) => smallHole(x, y) ?? bigHole(x, y) ?? body(x, y);
    const r = keyBackground(image(flat(FLOOR), garment), W, H);
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 60, 32)).toBe(1);
    expect(at(a, 40, 95)).toBe(0);
    expect(at(a, 80, 95)).toBe(1);
  });

  it('gives a soft edge, not a staircase', () => {
    const r = keyBackground(image(flat(FLOOR), rect(30, 30, 90, 130, RED)), W, H);
    const a = (r as { alpha: Float32Array }).alpha;
    // The halo pixel just outside the rectangle is background-coloured: fully transparent. A
    // blended edge pixel (half red, half floor) has partial alpha.
    const rgba = image(flat(FLOOR), rect(30, 30, 90, 130, RED));
    const o = (60 * W + 29) * 4;
    rgba.set([202, 119, 118, 255], o); // a mix of the two colours
    const mixed = (keyBackground(rgba, W, H) as { alpha: Float32Array }).alpha;
    expect(mixed[60 * W + 29]).toBeGreaterThan(0);
    expect(at(a, 29, 60)).toBe(0);
  });

  it('drops small pieces such as dust on the floor', () => {
    const dust = rect(10, 10, 13, 13, [60, 60, 60]);
    const body = rect(30, 30, 90, 130, RED);
    const r = keyBackground(
      image(flat(FLOOR), (x, y) => dust(x, y) ?? body(x, y)),
      W,
      H,
    );
    const a = (r as { alpha: Float32Array }).alpha;
    expect(at(a, 11, 11)).toBe(0);
    expect(at(a, 60, 80)).toBe(1);
  });

  it('cannot see a garment that is the colour of the floor: the score is low', () => {
    const r = keyBackground(image(flat(FLOOR), rect(30, 30, 90, 130, [212, 207, 195])), W, H);
    const a = (r as { alpha: Float32Array }).alpha;
    expect(scoreCutout(a, W, H).score).toBeLessThan(SCORE_RULES.accept);
  });
});

describe('scoreCutout', () => {
  const box = (x0: number, y0: number, x1: number, y1: number, value = 1): Float32Array => {
    const a = new Float32Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * W + x] = value;
    return a;
  };

  it('accepts one solid piece of a plausible size', () => {
    const s = scoreCutout(box(30, 30, 90, 130), W, H);
    expect(s.score).toBeGreaterThan(0.9);
    expect(s.subjectFraction).toBeCloseTo(0.3125, 3);
  });

  it('rejects an erased subject and a kept frame', () => {
    expect(scoreCutout(box(58, 78, 62, 82), W, H).score).toBeLessThan(SCORE_RULES.accept);
    expect(scoreCutout(new Float32Array(W * H), W, H).score).toBe(0);
    expect(scoreCutout(box(0, 0, W, H), W, H).score).toBeLessThan(SCORE_RULES.accept);
    expect(scoreCutout(box(1, 1, W - 1, H - 1), W, H).score).toBeLessThan(SCORE_RULES.accept);
  });

  it('prefers one dominant piece but allows a pair', () => {
    const union = (...parts: Float32Array[]): Float32Array => {
      const out = new Float32Array(W * H);
      for (const part of parts)
        for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], part[i]);
      return out;
    };
    const pair = union(box(10, 60, 55, 100), box(65, 60, 110, 100));
    expect(scoreCutout(pair, W, H).score).toBeGreaterThan(0.9);
    const scatter = union(
      box(10, 10, 30, 30),
      box(60, 10, 80, 30),
      box(10, 80, 30, 100),
      box(60, 80, 80, 100),
      box(90, 120, 110, 140),
    );
    expect(scoreCutout(scatter, W, H).score).toBeLessThan(SCORE_RULES.accept);
  });

  it('penalises blotchy alpha', () => {
    const blotchy = box(30, 30, 90, 130, 0.5);
    expect(scoreCutout(blotchy, W, H).score).toBeLessThan(SCORE_RULES.accept);
  });

  it('uses agreement with the other mask', () => {
    const a = box(30, 30, 90, 130);
    const same = scoreCutout(a, W, H, box(30, 30, 90, 130));
    const apart = scoreCutout(a, W, H, box(0, 0, 25, 25));
    expect(same.score).toBeGreaterThan(apart.score);
    expect(maskAgreement(a, box(30, 30, 90, 130))).toBe(1);
    expect(maskAgreement(a, box(0, 0, 25, 25))).toBe(0);
  });
});

describe('chooseCutout', () => {
  const box = (x0: number, y0: number, x1: number, y1: number, value = 1): Float32Array => {
    const a = new Float32Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * W + x] = value;
    return a;
  };

  it('takes the crisp key mask over a blotchy model mask', () => {
    const choice = chooseCutout(W, H, {
      u2net: box(30, 30, 90, 130, 0.5),
      key: box(30, 30, 90, 130),
    });
    expect(choice?.method).toBe('key');
  });

  it('takes the model when it is the only candidate and good', () => {
    expect(chooseCutout(W, H, { u2net: box(30, 30, 90, 130) })?.method).toBe('u2net');
  });

  it('returns nothing when neither passes', () => {
    expect(
      chooseCutout(W, H, { u2net: box(58, 78, 62, 82), key: box(0, 0, W, H) }),
    ).toBeUndefined();
    expect(chooseCutout(W, H, {})).toBeUndefined();
  });
});
