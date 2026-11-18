import {
  archetypeTitle,
  closetReadiness,
  closetSignature,
  computeInsights,
  goesWithLabel,
  improvedLabel,
  unlockedLabel,
  wouldHelpText,
} from './insights';
import { testItem } from './testItems';

const tee = testItem('tee', { category: 'top', subcategory: 'tshirt' });
const jeans = testItem('jeans', { category: 'bottom', subcategory: 'jeans' });
const shoes = testItem('shoes', { category: 'shoes', subcategory: 'sneakers' });

describe('titles and labels', () => {
  it('uses the archetype name', () => {
    expect(archetypeTitle('white-sneakers')).toBe('White sneakers');
    expect(archetypeTitle('nope')).toBe('nope');
    expect(wouldHelpText(['black-pumps', 'black-flats'])).toBe('Black pumps, Black flats');
    expect(wouldHelpText([])).toBe('');
  });
  it('pluralises counts', () => {
    expect(unlockedLabel(1)).toBe('+1 outfit');
    expect(unlockedLabel(12)).toBe('+12 outfits');
    expect(improvedLabel(3)).toBe('Improves 3 outfits');
    expect(goesWithLabel(0)).toBe('Goes with nothing yet');
    expect(goesWithLabel(2)).toBe('Goes with 2 outfits');
  });
});

describe('closetReadiness', () => {
  it('needs a top, a bottom and shoes (or a dress and shoes) and four pieces', () => {
    expect(closetReadiness([]).ready).toBe(false);
    expect(closetReadiness([tee, jeans, shoes]).ready).toBe(false);
    const tee2 = testItem('tee2', { category: 'top', subcategory: 'shirt' });
    expect(closetReadiness([tee, tee2, jeans, shoes])).toEqual({
      ready: true,
      tops: 2,
      bottoms: 1,
      shoes: 1,
    });
    expect(closetReadiness([tee, tee2, jeans, tee2]).ready).toBe(false);
  });
  it('ignores archived pieces', () => {
    const gone = testItem('gone', {
      category: 'shoes',
      subcategory: 'sneakers',
      status: 'archived',
    });
    expect(closetReadiness([tee, jeans, tee, tee, gone]).shoes).toBe(0);
  });
});

describe('closetSignature', () => {
  it('changes with active content only', () => {
    const base = closetSignature([tee, jeans]);
    expect(closetSignature([jeans, tee])).toBe(base);
    expect(closetSignature([tee, jeans, { ...shoes, status: 'archived' }])).toBe(base);
    expect(closetSignature([tee, { ...jeans, updatedAt: '2026-02-02T00:00:00.000Z' }])).not.toBe(
      base,
    );
  });
});

describe('computeInsights', () => {
  it('splits core and add-on suggestions and spots duplicates', () => {
    const tee2 = testItem('tee2', { category: 'top', subcategory: 'tshirt' });
    const out = computeInsights([tee, tee2, jeans, shoes]);
    expect(out.core.every((g) => g.kind === 'core')).toBe(true);
    expect(out.addons.every((g) => g.kind === 'addon')).toBe(true);
    expect(out.duplicates).toEqual([{ itemIds: ['tee', 'tee2'] }]);
  });
});
