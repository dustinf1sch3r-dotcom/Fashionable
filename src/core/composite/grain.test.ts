import { addGrain, grainSigma, softnessSigma } from './grain';

const planes = (n: number, v: number): [Float32Array, Float32Array, Float32Array, Float32Array] => [
  new Float32Array(n).fill(v),
  new Float32Array(n).fill(v),
  new Float32Array(n).fill(v),
  new Float32Array(n).fill(1),
];

describe('sharpness and grain', () => {
  it('softness: sharp photo no blur, blurry photo capped blur, scaled by density', () => {
    expect(softnessSigma(3, 1)).toBe(0);
    expect(softnessSigma(1.6, 1)).toBe(0);
    expect(softnessSigma(1, 1)).toBeCloseTo(1.5, 6);
    expect(softnessSigma(0.5, 1)).toBeCloseTo(1.5, 6);
    expect(softnessSigma(1, 2)).toBeCloseTo(3, 6);
    expect(softnessSigma(1.3, 1)).toBeGreaterThan(0);
    expect(softnessSigma(1.3, 1)).toBeLessThan(1.5);
  });

  it('grain sigma follows the photo noise and is capped', () => {
    expect(grainSigma(0)).toBe(0);
    expect(grainSigma(3)).toBe(3);
    expect(grainSigma(40)).toBe(8);
  });

  it('adds noise of about the requested sigma, mean preserved', () => {
    const [r, g, b, a] = planes(20000, 128);
    addGrain(r, g, b, a, 5, 9);
    let s = 0;
    let s2 = 0;
    for (const v of r) {
      s += v - 128;
      s2 += (v - 128) ** 2;
    }
    expect(Math.abs(s / r.length)).toBeLessThan(0.2);
    expect(Math.sqrt(s2 / r.length)).toBeGreaterThan(4.5);
    expect(Math.sqrt(s2 / r.length)).toBeLessThan(5.5);
    expect(Array.from(g)).toEqual(Array.from(r));
  });

  it('is deterministic for a seed and differs between seeds', () => {
    const a1 = planes(500, 100);
    const a2 = planes(500, 100);
    const a3 = planes(500, 100);
    addGrain(a1[0], a1[1], a1[2], a1[3], 4, 1);
    addGrain(a2[0], a2[1], a2[2], a2[3], 4, 1);
    addGrain(a3[0], a3[1], a3[2], a3[3], 4, 2);
    expect(Array.from(a1[0])).toEqual(Array.from(a2[0]));
    expect(Array.from(a1[0])).not.toEqual(Array.from(a3[0]));
  });

  it('sigma 0 changes nothing and transparent pixels are untouched', () => {
    const p = planes(100, 50);
    addGrain(p[0], p[1], p[2], p[3], 0, 1);
    expect(p[0].every((v) => v === 50)).toBe(true);
    const q = planes(100, 50);
    q[3].fill(0);
    addGrain(q[0], q[1], q[2], q[3], 5, 1);
    expect(q[0].every((v) => v === 50)).toBe(true);
  });
});
