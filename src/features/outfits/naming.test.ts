import { fixtureById } from '@/core/testing/fixtures';
import { autoName, FALLBACK_OUTFIT_NAME, outfitName } from './naming';

const pick = (...ids: string[]) => ids.map((id) => fixtureById(id));

describe('autoName', () => {
  it('names a top-and-bottom outfit from colour and type', () => {
    expect(autoName(pick('tee-navy', 'jeans-dark', 'sneakers-white'))).toBe(
      'Navy tee & dark jeans',
    );
  });

  it('adds shoes to a dress, which stands alone above the waist', () => {
    const name = autoName(pick('dress-wrap-green', 'heels-black', 'bag-shoulder-brown'));
    expect(name).toBe('Green wrap dress & black suede heels');
  });

  it('ignores a mid layer when there is a base top, and an outer layer over anything', () => {
    expect(autoName(pick('tee-navy', 'cardigan-cream', 'jeans-dark', 'trench-beige'))).toBe(
      'Navy tee & dark jeans',
    );
  });

  it('keeps names the user gave their pieces as written', () => {
    const tee = { ...fixtureById('tee-navy'), name: 'Uniqlo Tee' };
    expect(autoName([tee, fixtureById('jeans-dark')])).toBe('Uniqlo Tee & dark jeans');
  });

  it('falls back when nothing is left', () => {
    expect(autoName([])).toBe(FALLBACK_OUTFIT_NAME);
  });
});

describe('autoName without item names', () => {
  it('builds the name from colour and type', () => {
    const unnamed = pick('tee-navy', 'jeans-dark').map((i) => ({ ...i, name: undefined }));
    expect(autoName(unnamed)).toBe('Navy t-shirt & navy jeans');
  });
});

describe('outfitName', () => {
  it('prefers the saved name and ignores blanks', () => {
    const items = pick('tee-navy', 'jeans-dark');
    expect(outfitName({ name: ' Friday ' }, items)).toBe('Friday');
    expect(outfitName({ name: '  ' }, items)).toBe('Navy tee & dark jeans');
    expect(outfitName({}, items)).toBe('Navy tee & dark jeans');
  });
});
