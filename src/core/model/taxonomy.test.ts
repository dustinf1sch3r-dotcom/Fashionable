import {
  CATEGORIES,
  isValidSubcategory,
  subcategoriesOf,
  subcategoryDefaults,
  type SubcategoryDefaults,
} from './taxonomy';

const KEBAB = /^[a-z]+(-[a-z]+)*$/;

describe('taxonomy', () => {
  it('covers all 13 categories', () => {
    expect(CATEGORIES).toHaveLength(13);
  });

  it('has at least one subcategory per category and a sensible total', () => {
    let total = 0;
    for (const c of CATEGORIES) {
      expect(subcategoriesOf(c).length).toBeGreaterThanOrEqual(1);
      total += subcategoriesOf(c).length;
    }
    expect(total).toBeGreaterThanOrEqual(70);
    expect(total).toBeLessThanOrEqual(100);
  });

  it('uses unique kebab-case keys within a category', () => {
    for (const c of CATEGORIES) {
      const keys = subcategoriesOf(c);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(k).toMatch(KEBAB);
    }
  });

  it('keeps every default in range', () => {
    for (const c of CATEGORIES) {
      for (const s of subcategoriesOf(c)) {
        const d = subcategoryDefaults(c, s) as SubcategoryDefaults;
        expect([1, 2, 3, 4, 5]).toContain(d.formality);
        expect([1, 2, 3, 4, 5]).toContain(d.warmth);
        expect(typeof d.rainOk).toBe('boolean');
        expect(typeof d.sporty).toBe('boolean');
      }
    }
  });

  it('gives a layer to every top and to nothing else', () => {
    for (const c of CATEGORIES) {
      for (const s of subcategoriesOf(c)) {
        const d = subcategoryDefaults(c, s) as SubcategoryDefaults;
        if (c === 'top') expect(['base', 'mid']).toContain(d.layer);
        else expect(d.layer).toBeUndefined();
      }
    }
  });

  it('assigns layers per OUTFIT_ENGINE §2', () => {
    for (const s of ['tshirt', 'shirt', 'blouse', 'tank', 'polo']) {
      expect(subcategoryDefaults('top', s)?.layer).toBe('base');
    }
    for (const s of ['sweater', 'cardigan', 'hoodie', 'waistcoat']) {
      expect(subcategoryDefaults('top', s)?.layer).toBe('mid');
    }
  });

  it('sets belt/shorts/open-shoe flags only on their categories', () => {
    for (const c of CATEGORIES) {
      for (const s of subcategoriesOf(c)) {
        const d = subcategoryDefaults(c, s) as SubcategoryDefaults;
        if (c === 'bottom') expect(typeof d.beltCompatible).toBe('boolean');
        else {
          expect(d.beltCompatible).toBeUndefined();
          expect(d.isShorts).toBeUndefined();
        }
        if (c !== 'shoes') expect(d.openShoe).toBeUndefined();
      }
    }
  });

  it('marks belt-compatible bottoms per OUTFIT_ENGINE §3', () => {
    for (const s of ['trousers', 'jeans', 'chinos', 'shorts']) {
      expect(subcategoryDefaults('bottom', s)?.beltCompatible).toBe(true);
    }
    expect(subcategoryDefaults('bottom', 'leggings')?.beltCompatible).toBe(false);
  });

  it('flags shorts and open shoes', () => {
    expect(subcategoryDefaults('bottom', 'shorts')?.isShorts).toBe(true);
    expect(subcategoryDefaults('bottom', 'sports-shorts')?.isShorts).toBe(true);
    expect(subcategoryDefaults('bottom', 'jeans')?.isShorts).toBeFalsy();
    expect(subcategoryDefaults('shoes', 'sandals')?.openShoe).toBe(true);
    expect(subcategoryDefaults('shoes', 'sneakers')?.openShoe).toBeFalsy();
  });

  it('lists the expected staples', () => {
    expect(subcategoriesOf('top')).toEqual(expect.arrayContaining(['tshirt', 'hoodie']));
    expect(subcategoriesOf('onepiece')).toEqual(expect.arrayContaining(['jumpsuit', 'dungarees']));
    expect(subcategoriesOf('outerwear')).toEqual(expect.arrayContaining(['blazer', 'trench']));
    expect(subcategoriesOf('shoes')).toEqual(
      expect.arrayContaining(['sneakers', 'loafers', 'heels', 'sandals', 'ankle-boots']),
    );
    expect(subcategoriesOf('neckwear')).toEqual(expect.arrayContaining(['tie', 'scarf']));
    expect(subcategoriesOf('eyewear')).toEqual(['sunglasses', 'glasses']);
  });

  it('validates subcategories', () => {
    expect(isValidSubcategory('top', 'tshirt')).toBe(true);
    expect(isValidSubcategory('bottom', 'tshirt')).toBe(false);
    expect(isValidSubcategory('top', '')).toBe(false);
    expect(isValidSubcategory('top', 'constructor')).toBe(false);
    expect(subcategoryDefaults('top', 'nope')).toBeUndefined();
  });
});
