import { fixtureById } from '@/core/testing/fixtures';
import { outfitNote, resolveOutfitItems } from './outfitItems';

const tee = fixtureById('tee-navy');
const jeans = fixtureById('jeans-dark');
const byId = new Map([
  [tee.id, tee],
  [jeans.id, { ...jeans, status: 'archived' as const }],
]);

describe('resolveOutfitItems', () => {
  it('splits present, missing and archived pieces', () => {
    const r = resolveOutfitItems([tee.id, jeans.id, 'gone'], byId);
    expect(r.items.map((i) => i.id)).toEqual([tee.id, jeans.id]);
    expect(r.missingIds).toEqual(['gone']);
    expect(r.archived.map((i) => i.id)).toEqual([jeans.id]);
  });
});

describe('outfitNote', () => {
  it('is silent when everything is in the closet', () => {
    expect(outfitNote(resolveOutfitItems([tee.id], byId))).toBeUndefined();
  });

  it('is gentle about deleted and archived pieces', () => {
    expect(outfitNote(resolveOutfitItems([tee.id, 'gone'], byId))).toBe(
      'One piece is no longer in your closet.',
    );
    expect(outfitNote(resolveOutfitItems(['a', 'b'], byId))).toBe(
      '2 pieces are no longer in your closet.',
    );
    expect(outfitNote(resolveOutfitItems([jeans.id], byId))).toBe('One piece is archived.');
    expect(outfitNote(resolveOutfitItems([jeans.id, 'gone'], byId))).toBe(
      'Some pieces were deleted or archived.',
    );
  });
});
