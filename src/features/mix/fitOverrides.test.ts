import { fixtureById } from '@/core/testing/fixtures';
import { hasBaseTop, prunedOverrides } from './fitOverrides';

const tee = fixtureById('tee-white');
const jeans = {
  ...fixtureById('jeans-dark'),
  fitAdjust: { dx: 10, dy: 0, scale: 1.1, rotation: 0 },
};
const moved = { dx: 40, dy: 0, scale: 1, rotation: 0 };

describe('prunedOverrides', () => {
  it('keeps real differences only for items in the outfit', () => {
    const out = prunedOverrides([tee, jeans], {
      [tee.id]: moved,
      [jeans.id]: jeans.fitAdjust,
      gone: moved,
    });
    expect(out).toEqual({ [tee.id]: moved });
  });

  it('drops an override equal to the default fit and returns undefined when empty', () => {
    expect(
      prunedOverrides([tee], { [tee.id]: { dx: 0, dy: 0, scale: 1, rotation: 0 } }),
    ).toBeUndefined();
    expect(prunedOverrides([tee], {})).toBeUndefined();
  });

  it('keeps a reset override on an item with a saved fit', () => {
    const reset = { dx: 0, dy: 0, scale: 1, rotation: 0 };
    expect(prunedOverrides([jeans], { [jeans.id]: reset })).toEqual({ [jeans.id]: reset });
  });
});

describe('hasBaseTop', () => {
  it('is true only with a base top', () => {
    expect(hasBaseTop([tee])).toBe(true);
    expect(hasBaseTop([fixtureById('cardigan-cream'), fixtureById('jeans-dark')])).toBe(false);
  });
});
