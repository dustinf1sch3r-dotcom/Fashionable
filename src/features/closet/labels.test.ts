import { CATEGORIES, subcategoriesOf } from '@/core/model/taxonomy';
import { CATEGORY_LABELS, SUBCATEGORY_LABELS } from './labels';

describe('closet labels', () => {
  it('labels every category', () => {
    for (const c of CATEGORIES) expect(CATEGORY_LABELS[c]).toBeTruthy();
  });

  it('labels every subcategory and has no stray labels', () => {
    const codes = CATEGORIES.flatMap((c) => subcategoriesOf(c));
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(SUBCATEGORY_LABELS[code]).toBeTruthy();
    expect(Object.keys(SUBCATEGORY_LABELS).sort()).toEqual([...codes].sort());
  });
});
