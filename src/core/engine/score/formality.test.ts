import { outfit, tweak } from '../testUtils';
import { scoreFormality } from './formality';

// base tee=2, jeans=2, sneakers=2 as the all-2 baseline.
const f = (b: number, bottom: number, shoes: number, extra = []) =>
  scoreFormality([
    tweak('tee-white', { formality: b as 1 }),
    tweak('jeans-dark', { formality: bottom as 1 }),
    tweak('sneakers-white', { formality: shoes as 1 }),
    ...extra,
  ]);

describe('scoreFormality (§4.2)', () => {
  it('spread 0 → 1.00', () => {
    const r = f(2, 2, 2);
    expect(r?.value).toBe(1);
    expect(r?.reasons[0].code).toBe('FORMALITY_COHESIVE');
  });
  it('spread 1 → 0.90', () => {
    expect(f(2, 3, 3)?.value).toBe(0.9);
  });
  it('spread 2 without a single outlier → 0.55', () => {
    const r = f(2, 3, 4);
    expect(r?.value).toBe(0.55);
    expect(r?.reasons[0].code).toBe('FORMALITY_MISMATCH');
  });
  it('spread 2 with exactly one outlier (high-low) → 0.75', () => {
    const r = scoreFormality(outfit('blazer-navy', 'tee-white', 'jeans-dark', 'sneakers-white'));
    expect(r?.value).toBe(0.75);
    expect(r?.reasons[0]).toEqual({
      code: 'FORMALITY_HIGH_LOW',
      params: { slot: 'outer', spread: 2 },
    });
  });
  it('low outlier counts too (2,4,4)', () => {
    expect(f(4, 4, 2)?.value).toBe(0.75);
  });
  it('spread 2 with two items is not high-low', () => {
    const r = scoreFormality([
      tweak('tee-white', { formality: 2 }),
      tweak('jeans-dark', { formality: 4 }),
    ]);
    expect(r?.value).toBe(0.55);
  });
  it('spread 3 → 0.20', () => {
    expect(f(2, 2, 5)?.value).toBe(0.2);
  });
  it('spread 4 → 0.00', () => {
    expect(f(1, 3, 5)?.value).toBe(0);
  });
  it('ignores accessories and needs two garments', () => {
    expect(scoreFormality(outfit('tee-white', 'watch-silver', 'necklace-gold'))).toBeNull();
    expect(scoreFormality([])).toBeNull();
  });
  it('compares mid and outer slots too', () => {
    const r = scoreFormality(outfit('tee-white', 'sweater-red', 'jeans-dark', 'sneakers-white'));
    expect(r?.value).toBe(0.9);
  });
});
