import {
  analysePhoto,
  estimateCast,
  estimateExposure,
  estimateNoise,
  estimateSharpness,
  luminancePlane,
} from './stats';
import { fill, noisy, solid } from './testUtils';

describe('photo statistics', () => {
  it('a neutral photo has no cast', () => {
    const c = estimateCast(solid(40, 40, [128, 128, 128, 255]));
    for (const v of c) expect(v).toBeCloseTo(1, 3);
  });

  it('a warm photo has a warm, luminance-neutral cast', () => {
    const c = estimateCast(solid(40, 40, [170, 140, 110, 255]));
    expect(c[0]).toBeGreaterThan(1.05);
    expect(c[2]).toBeLessThan(0.95);
    expect(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]).toBeCloseTo(1, 1);
  });

  it('the cast is clamped to +-15%', () => {
    const c = estimateCast(solid(40, 40, [250 - 15, 120, 100, 255]));
    for (const v of c) {
      expect(v).toBeLessThanOrEqual(1.15 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0.85 - 1e-9);
    }
  });

  it('grey-world ignores near-white, near-black and saturated pixels', () => {
    // Half warm-grey, half pure white / black / saturated blue: only the first half counts.
    const img = fill(40, 40, (x, y) => {
      if (x < 20) return [150, 130, 110, 255];
      return [
        [255, 255, 255, 255],
        [0, 0, 0, 255],
        [0, 0, 255, 255],
        [250, 250, 250, 255],
      ][y % 4] as [number, number, number, number];
    });
    const only = estimateCast(solid(40, 40, [150, 130, 110, 255]));
    const c = estimateCast(img);
    for (let i = 0; i < 3; i++) expect(c[i]).toBeCloseTo(only[i] as number, 3);
  });

  it('a photo with nothing usable falls back to no cast; transparent pixels are ignored', () => {
    expect(estimateCast(solid(20, 20, [255, 255, 255, 255]))).toEqual([1, 1, 1]);
    expect(estimateCast(solid(20, 20, [170, 140, 110, 0]))).toEqual([1, 1, 1]);
  });

  it('exposure is the median luminance', () => {
    expect(estimateExposure(solid(10, 10, [51, 51, 51, 255]))).toBeCloseTo(0.2, 2);
    const img = fill(10, 10, (x) => (x < 7 ? [200, 200, 200, 255] : [0, 0, 0, 255]));
    expect(estimateExposure(img)).toBeCloseTo(200 / 255, 2);
  });

  it('noise level is recovered on a flat noisy image', () => {
    for (const sigma of [2, 4, 8]) {
      const img = noisy(120, 120, [120, 120, 120], sigma, 3);
      expect(estimateNoise(luminancePlane(img), 120, 120)).toBeGreaterThan(sigma * 0.75);
      expect(estimateNoise(luminancePlane(img), 120, 120)).toBeLessThan(sigma * 1.25);
    }
  });

  it('a clean flat or steep-gradient image has noise 0', () => {
    expect(estimateNoise(luminancePlane(solid(60, 60, [100, 100, 100, 255])), 60, 60)).toBeLessThan(
      0.01,
    );
    const ramp = fill(60, 60, (x) => [x * 4, x * 4, x * 4, 255]);
    expect(estimateNoise(luminancePlane(ramp), 60, 60)).toBe(0);
  });

  it('edges do not inflate the noise estimate (flat-region test)', () => {
    const img = fill(120, 120, (x, y) => {
      const v = (x >> 3) % 2 ? 60 : 180;
      return [v + ((x * 7 + y * 13) % 5) - 2, v, v, 255];
    });
    expect(estimateNoise(luminancePlane(img), 120, 120)).toBeLessThan(3);
  });

  it('sharp stripes score higher than the same stripes blurred', () => {
    const sharp = fill(80, 40, (x) => {
      const v = (x >> 1) % 2 ? 40 : 210;
      return [v, v, v, 255];
    });
    const soft = fill(80, 40, (x) => {
      const v = 125 + 85 * Math.cos((x * Math.PI) / 2);
      return [v, v, v, 255];
    });
    const s1 = estimateSharpness(luminancePlane(sharp), 80, 40);
    const s2 = estimateSharpness(luminancePlane(soft), 80, 40);
    expect(s1).toBeGreaterThan(s2);
    expect(estimateSharpness(luminancePlane(solid(20, 20, [9, 9, 9, 255])), 20, 20)).toBe(1);
  });

  it('analysePhoto bundles all four', () => {
    const s = analysePhoto(noisy(60, 60, [150, 130, 110], 3));
    expect(s.cast[0]).toBeGreaterThan(1);
    expect(s.exposure).toBeGreaterThan(0.4);
    expect(s.noise).toBeGreaterThan(1.5);
    expect(s.sharpness).toBeGreaterThan(1);
  });
});
