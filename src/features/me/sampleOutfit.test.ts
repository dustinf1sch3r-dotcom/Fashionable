import { fixtureCloset, fixtureById } from '@/core/testing/fixtures';
import { sampleOutfit } from './sampleOutfit';

describe('sampleOutfit', () => {
  it('uses stand-ins with drawn art for an empty closet', () => {
    const s = sampleOutfit([]);
    expect(s.fromCloset).toBe(false);
    expect(s.items).toHaveLength(3);
    for (const item of s.items) expect(s.artUris[item.images.cutoutId]).toMatch(/^data:image\/svg/);
  });

  it('picks a top, a bottom and shoes from the closet', () => {
    const s = sampleOutfit(fixtureCloset());
    expect(s.fromCloset).toBe(true);
    expect(s.items.map((i) => i.category)).toEqual(['top', 'bottom', 'shoes']);
    expect(s.artUris).toEqual({});
  });

  it('ignores archived pieces and photos without a cutout', () => {
    const archived = { ...fixtureById('tee-white'), status: 'archived' as const };
    expect(sampleOutfit([archived]).fromCloset).toBe(false);
    const flat = { ...fixtureById('tee-white'), cutout: { aspectRatio: 1, hasAlpha: false } };
    expect(sampleOutfit([flat, fixtureById('jeans-dark')]).fromCloset).toBe(false);
  });
});
