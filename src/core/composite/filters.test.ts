import {
  boxBlur,
  boxRadiiForSigma,
  distanceTransform,
  featherAlpha,
  gaussianBlur,
} from './filters';

const sum = (p: Float32Array): number => p.reduce((a, b) => a + b, 0);

describe('filters', () => {
  it('box blur keeps a constant plane constant (clamped edges)', () => {
    const p = new Float32Array(7 * 5).fill(3);
    for (const v of boxBlur(p, 7, 5, 2)) expect(v).toBeCloseTo(3, 4);
  });

  it('box blur of an impulse spreads it evenly and conserves mass away from edges', () => {
    const p = new Float32Array(21 * 21);
    p[10 * 21 + 10] = 25;
    const out = boxBlur(p, 21, 21, 2);
    expect(out[10 * 21 + 10]).toBeCloseTo(1, 4);
    expect(out[8 * 21 + 12]).toBeCloseTo(1, 4);
    expect(out[7 * 21 + 10]).toBeCloseTo(0, 6);
    expect(sum(out)).toBeCloseTo(25, 2);
  });

  it('gaussian blur: radius 0 box and tiny sigma are near-identity, sigma smooths a step', () => {
    const p = new Float32Array(30 * 3);
    for (let y = 0; y < 3; y++) for (let x = 15; x < 30; x++) p[y * 30 + x] = 1;
    const tiny = gaussianBlur(p, 30, 3, 0.02);
    expect(Array.from(tiny)).toEqual(Array.from(p));
    const out = gaussianBlur(p, 30, 3, 3);
    expect(out[30 + 14]).toBeGreaterThan(0.3);
    expect(out[30 + 14]).toBeLessThan(0.5);
    expect(out[30 + 16]).toBeGreaterThan(0.5);
    expect(out[30 + 2]).toBeLessThan(0.01);
    expect(out[30 + 27]).toBeGreaterThan(0.99);
  });

  it('three box radii approximate the requested variance', () => {
    for (const sigma of [1, 2.5, 6]) {
      const variance = boxRadiiForSigma(sigma).reduce((a, r) => a + ((2 * r + 1) ** 2 - 1) / 12, 0);
      expect(Math.sqrt(variance)).toBeCloseTo(sigma, 0);
    }
  });

  it('sub-pixel feather softens a hard edge without moving it', () => {
    const a = new Float32Array(20 * 4);
    for (let y = 0; y < 4; y++) for (let x = 10; x < 20; x++) a[y * 20 + x] = 1;
    const f = featherAlpha(a, 20, 4, 0.5);
    expect(f[20 + 9]).toBeGreaterThan(0);
    expect(f[20 + 9]).toBeLessThan(0.3);
    expect(f[20 + 10]).toBeGreaterThan(0.7);
    expect(f[20 + 10]).toBeLessThan(1);
    expect(f[20 + 5]).toBe(0);
  });

  it('distance transform is exact on a rectangle and zero outside', () => {
    const w = 15;
    const h = 11;
    const inside = new Uint8Array(w * h);
    for (let y = 2; y < 9; y++) for (let x = 3; x < 12; x++) inside[y * w + x] = 1;
    const d = distanceTransform(inside, w, h);
    expect(d[0]).toBe(0);
    expect(d[2 * w + 3]).toBeCloseTo(1, 5);
    expect(d[5 * w + 7]).toBeCloseTo(4, 5); // 3 rows from the top... nearest outside is row 1/9 -> min(4,4)
    // Diagonal: from the pixel (3,2) the nearest outside is a neighbour at distance 1.
    const single = new Uint8Array(w * h);
    single[5 * w + 5] = 1;
    expect(distanceTransform(single, w, h)[5 * w + 5]).toBeCloseTo(1, 5);
    const disc = new Uint8Array(w * h).fill(1);
    disc[0] = 0;
    expect(distanceTransform(disc, w, h)[3 * w + 4]).toBeCloseTo(5, 5);
  });

  it('distance transform with nothing outside gives large distances (no false edge)', () => {
    const d = distanceTransform(new Uint8Array(16).fill(1), 4, 4);
    expect(d[5]).toBeGreaterThan(1000);
  });
});
