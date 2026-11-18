import { COMPOSITE_RULES } from './rules';
import { applyGains, colourGains } from './colour';

const apply = (rgb: [number, number, number], gains: [number, number, number]): number[] => {
  const r = Float32Array.of(rgb[0]);
  const g = Float32Array.of(rgb[1]);
  const b = Float32Array.of(rgb[2]);
  applyGains(r, g, b, gains);
  return [r[0] as number, g[0] as number, b[0] as number];
};

describe('colour matching', () => {
  it('a neutral, mid-exposed photo leaves the garment unchanged', () => {
    const gains = colourGains({ cast: [1, 1, 1], exposure: 0.5 });
    expect(gains).toEqual([1, 1, 1]);
    expect(apply([200, 40, 90], gains)).toEqual([200, 40, 90]);
  });

  it('a white garment on a warm, dim photo gets slightly warm and darker but stays clearly white', () => {
    const gains = colourGains({ cast: [1.1, 1, 0.88], exposure: 0.35 });
    const [r, g, b] = apply([245, 245, 245], gains) as [number, number, number];
    expect(r).toBeGreaterThan(b + 10);
    expect(g).toBeLessThan(245);
    expect(Math.min(r, g, b)).toBeGreaterThan(170);
    expect(Math.max(r, g, b)).toBeLessThan(250);
  });

  it('exposure moves only part-way and is bounded', () => {
    const half = colourGains({ cast: [1, 1, 1], exposure: 0.41 })[0];
    expect(half).toBeCloseTo(Math.sqrt(0.82), 5); // strength 0.5, inside the bounds
    const { exposureGainMin, exposureGainMax } = COMPOSITE_RULES.colour;
    expect(colourGains({ cast: [1, 1, 1], exposure: 0.01 })[0]).toBeCloseTo(exposureGainMin, 5);
    expect(colourGains({ cast: [1, 1, 1], exposure: 1 })[0]).toBeCloseTo(exposureGainMax, 5);
  });

  it('lightness scales: a dark garment stays dark, colour ratios are kept without a cast', () => {
    const out = apply([60, 30, 30], colourGains({ cast: [1, 1, 1], exposure: 0.35 }));
    expect(out[0]! / out[1]!).toBeCloseTo(2, 3);
    expect(out[0]).toBeLessThan(60);
  });
});
