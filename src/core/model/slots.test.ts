import { MAIN_SLOTS, SLOT_CAPACITY, slotOf } from './slots';
import { CATEGORIES, subcategoriesOf } from './taxonomy';
import type { Category, Slot } from './types';

const EXPECTED: Record<Exclude<Category, 'top'>, Slot> = {
  bottom: 'bottom',
  onepiece: 'onepiece',
  outerwear: 'outer',
  shoes: 'shoes',
  legwear: 'legs',
  belt: 'belt',
  bag: 'bag',
  headwear: 'head',
  neckwear: 'neck',
  jewelry: 'jewelry',
  eyewear: 'eyes',
  watch: 'wrist',
};

describe('slotOf', () => {
  it('maps every non-top category to its slot', () => {
    for (const c of CATEGORIES) {
      if (c === 'top') continue;
      for (const s of subcategoriesOf(c)) {
        expect(slotOf({ category: c, subcategory: s })).toBe(EXPECTED[c]);
      }
    }
  });

  it('uses the explicit layer for tops', () => {
    expect(slotOf({ category: 'top', subcategory: 'tshirt', layer: 'base' })).toBe('base');
    expect(slotOf({ category: 'top', subcategory: 'tshirt', layer: 'mid' })).toBe('mid');
    expect(slotOf({ category: 'top', subcategory: 'sweater', layer: 'base' })).toBe('base');
  });

  it('falls back to the taxonomy default layer, then base', () => {
    expect(slotOf({ category: 'top', subcategory: 'cardigan' })).toBe('mid');
    expect(slotOf({ category: 'top', subcategory: 'polo' })).toBe('base');
    expect(slotOf({ category: 'top', subcategory: 'unknown-thing' })).toBe('base');
  });

  it('ignores a stray layer on non-tops', () => {
    expect(slotOf({ category: 'bottom', subcategory: 'jeans', layer: 'mid' })).toBe('bottom');
  });
});

describe('slot constants', () => {
  it('has a capacity for each of the 14 slots, 3 for jewelry and 1 otherwise', () => {
    const slots = Object.keys(SLOT_CAPACITY);
    expect(slots).toHaveLength(14);
    for (const s of slots) expect(SLOT_CAPACITY[s as Slot]).toBe(s === 'jewelry' ? 3 : 1);
  });

  it('main slots are the core-combo slots', () => {
    expect([...MAIN_SLOTS].sort()).toEqual(['base', 'bottom', 'onepiece', 'shoes']);
  });
});
