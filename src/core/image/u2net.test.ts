import {
  applyMaskAlpha,
  coverage,
  normalizeMinMax,
  resizeMask,
  softThreshold,
  toModelInput,
  U2NET_MEAN,
  U2NET_STD,
} from './u2net';

describe('toModelInput', () => {
  it('is channel-first and normalised by the image maximum, mean and std', () => {
    // 2 x 2 image: max channel value is 200.
    const rgba = new Uint8ClampedArray([
      200, 100, 0, 255, 0, 0, 0, 255, 50, 50, 50, 255, 200, 200, 200, 255,
    ]);
    const out = toModelInput(rgba, 2);
    expect(out).toHaveLength(12);
    const expected = (v: number, c: number) => (v / 200 - U2NET_MEAN[c]) / U2NET_STD[c];
    expect(out[0]).toBeCloseTo(expected(200, 0), 5); // R plane, pixel 0
    expect(out[1]).toBeCloseTo(expected(0, 0), 5); // R plane, pixel 1
    expect(out[4]).toBeCloseTo(expected(100, 1), 5); // G plane, pixel 0
    expect(out[8]).toBeCloseTo(expected(0, 2), 5); // B plane, pixel 0
    expect(out[11]).toBeCloseTo(expected(200, 2), 5); // B plane, pixel 3
  });

  it('ignores alpha and survives an all-black image', () => {
    const out = toModelInput(new Uint8ClampedArray([0, 0, 0, 0]), 1);
    expect(out[0]).toBeCloseTo(-U2NET_MEAN[0] / U2NET_STD[0], 5);
    expect(Number.isFinite(out[1])).toBe(true);
  });

  it('rejects a buffer that is too small', () => {
    expect(() => toModelInput(new Uint8ClampedArray(4), 2)).toThrow();
  });
});

describe('normalizeMinMax', () => {
  it('stretches to 0..1', () => {
    expect(Array.from(normalizeMinMax([0.2, 0.4, 0.6]))).toEqual([
      0,
      expect.closeTo(0.5, 5),
      expect.closeTo(1, 5),
    ]);
  });

  it('returns zeros for a flat map', () => {
    expect(Array.from(normalizeMinMax([0.7, 0.7, 0.7]))).toEqual([0, 0, 0]);
  });

  it('handles an empty input', () => {
    expect(normalizeMinMax([])).toHaveLength(0);
  });
});

describe('softThreshold', () => {
  it('clamps below lo and above hi and is monotonic and symmetric in between', () => {
    const out = softThreshold(new Float32Array([0, 0.2, 0.5, 0.8, 1]), 0.2, 0.8);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(0.5, 5);
    expect(out[3]).toBeCloseTo(1, 5);
    expect(out[4]).toBe(1);
    const mid = softThreshold(new Float32Array([0.35, 0.65]), 0.2, 0.8);
    expect(mid[0]).toBeGreaterThan(0);
    expect(mid[0] + mid[1]).toBeCloseTo(1, 5);
  });
});

describe('resizeMask', () => {
  it('returns the same values at the same size', () => {
    const m = new Float32Array([0, 1, 1, 0]);
    expect(Array.from(resizeMask(m, 2, 2, 2, 2))).toEqual([0, 1, 1, 0]);
  });

  it('keeps a constant map constant and stays within the source range', () => {
    const out = resizeMask(new Float32Array(9).fill(0.4), 3, 3, 10, 7);
    expect(out).toHaveLength(70);
    for (const v of out) expect(v).toBeCloseTo(0.4, 5);
    const ramp = resizeMask(new Float32Array([0, 1, 0, 1]), 2, 2, 8, 8);
    for (const v of ramp) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('interpolates between neighbours when upscaling', () => {
    const out = resizeMask(new Float32Array([0, 1]), 2, 1, 4, 1);
    expect(out[0]).toBe(0);
    expect(out[3]).toBeCloseTo(1, 5);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[1]).toBeLessThan(out[2]);
  });

  it('rejects mismatched data', () => {
    expect(() => resizeMask(new Float32Array(3), 2, 2, 4, 4)).toThrow();
  });
});

describe('applyMaskAlpha', () => {
  it('multiplies alpha by the mask and leaves colour alone', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 200]);
    applyMaskAlpha(rgba, new Float32Array([0, 0.5]));
    expect(Array.from(rgba)).toEqual([10, 20, 30, 0, 40, 50, 60, 100]);
  });

  it('rejects a mismatched grid', () => {
    expect(() => applyMaskAlpha(new Uint8ClampedArray(8), new Float32Array(3))).toThrow();
  });
});

describe('coverage', () => {
  it('is the share of values above one half', () => {
    expect(coverage(new Float32Array([0, 0.4, 0.6, 1]))).toBe(0.5);
    expect(coverage(new Float32Array())).toBe(0);
  });
});
