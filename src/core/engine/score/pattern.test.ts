import { outfit, tweak } from '../testUtils';
import { scorePattern } from './pattern';

const striped = (id: string, bold = false) => tweak(id, { pattern: 'stripe', patternBold: bold });
const checked = (id: string, bold = false) => tweak(id, { pattern: 'check', patternBold: bold });

describe('scorePattern (§4.3)', () => {
  it('0 patterned → 0.85', () => {
    expect(scorePattern(outfit('tee-white', 'jeans-dark', 'sneakers-white')).value).toBe(0.85);
  });
  it('1 patterned → 1.00 with PATTERN_STATEMENT', () => {
    const r = scorePattern(outfit('top-breton', 'jeans-dark', 'sneakers-white'));
    expect(r.value).toBe(1);
    expect(r.reasons[0].code).toBe('PATTERN_STATEMENT');
  });
  it('2 different types, at most one bold → 0.70', () => {
    const r = scorePattern([
      striped('tee-white', true),
      checked('jeans-dark'),
      ...outfit('sneakers-white'),
    ]);
    expect(r.value).toBe(0.7);
  });
  it('2 different types, both bold → 0.35', () => {
    const r = scorePattern([striped('tee-white', true), checked('jeans-dark', true)]);
    expect(r.value).toBe(0.35);
  });
  it('2 of the same type → 0.35', () => {
    const r = scorePattern([striped('tee-white'), striped('jeans-dark')]);
    expect(r.value).toBe(0.35);
    expect(r.reasons[0].code).toBe('PATTERN_BUSY');
  });
  it('3+ patterned → 0.10', () => {
    const r = scorePattern([
      striped('tee-white'),
      checked('jeans-dark'),
      tweak('jacket-denim', { pattern: 'dot' }),
    ]);
    expect(r.value).toBe(0.1);
  });
  it('counts only base/mid/bottom/onepiece/outer/neck', () => {
    const r = scorePattern([
      tweak('sneakers-white', { pattern: 'animal' }),
      tweak('bag-shoulder-brown', { pattern: 'check' }),
    ]);
    expect(r.value).toBe(0.85);
    expect(scorePattern([tweak('scarf-wool-red', { pattern: 'check' })]).value).toBe(1);
  });
  it('smart occasion: bonus on one patterned piece is clamped to 1', () => {
    const items = outfit('top-breton', 'jeans-dark');
    expect(scorePattern(items, 'smart').value).toBe(1);
    // bonus does not touch other counts
    expect(scorePattern(outfit('tee-white', 'jeans-dark'), 'smart').value).toBe(0.85);
  });
});
