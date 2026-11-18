import { CATEGORIES, subcategoriesOf } from '../model/taxonomy';
import type { Category, RigKind } from '../model/types';
import { BOTTOM_RIGS, ONEPIECE_RIGS, RIGID_CATEGORIES, rigKindOf, rigPointNames } from './rigs';

const kinds: RigKind[] = ['top', 'trousers', 'skirt', 'dress', 'jumpsuit'];

describe('rigKindOf', () => {
  it('maps every top, mid layer and outerwear subcategory to the top rig', () => {
    for (const category of ['top', 'outerwear'] as Category[]) {
      for (const subcategory of subcategoriesOf(category)) {
        expect(rigKindOf({ category, subcategory })).toBe('top');
      }
    }
  });

  it.each([
    ['jeans', 'trousers'],
    ['trousers', 'trousers'],
    ['suit-trousers', 'trousers'],
    ['chinos', 'trousers'],
    ['shorts', 'trousers'],
    ['sports-shorts', 'trousers'],
    ['leggings', 'trousers'],
    ['joggers', 'trousers'],
    ['skirt', 'skirt'],
    ['mini-skirt', 'skirt'],
    ['denim-skirt', 'skirt'],
  ])('bottom %s uses the %s rig', (subcategory, kind) => {
    expect(rigKindOf({ category: 'bottom', subcategory })).toBe(kind);
  });

  it.each([
    ['casual-dress', 'dress'],
    ['day-dress', 'dress'],
    ['shirt-dress', 'dress'],
    ['sweater-dress', 'dress'],
    ['cocktail-dress', 'dress'],
    ['evening-gown', 'dress'],
    ['jumpsuit', 'jumpsuit'],
    ['dungarees', 'jumpsuit'],
  ])('one-piece %s uses the %s rig', (subcategory, kind) => {
    expect(rigKindOf({ category: 'onepiece', subcategory })).toBe(kind);
  });

  it('leaves shoes, legwear, belts, bags, headwear, neckwear, jewellery, eyewear and watches rigid', () => {
    for (const category of RIGID_CATEGORIES) {
      for (const subcategory of subcategoriesOf(category)) {
        expect(rigKindOf({ category, subcategory })).toBeUndefined();
      }
    }
  });

  it('classifies every taxonomy subcategory deliberately', () => {
    const covered = new Set<Category>([
      'top',
      'outerwear',
      'bottom',
      'onepiece',
      ...RIGID_CATEGORIES,
    ]);
    expect([...covered].sort()).toEqual([...CATEGORIES].sort());
    expect(Object.keys(BOTTOM_RIGS).sort()).toEqual([...subcategoriesOf('bottom')].sort());
    expect(Object.keys(ONEPIECE_RIGS).sort()).toEqual([...subcategoriesOf('onepiece')].sort());
  });

  it('does not fit unknown subcategories of one-pieces and bottoms', () => {
    expect(rigKindOf({ category: 'bottom', subcategory: 'toString' })).toBeUndefined();
    expect(rigKindOf({ category: 'onepiece', subcategory: 'nope' })).toBeUndefined();
  });
});

describe('rigPointNames', () => {
  it('lists the §12.1 points per kind', () => {
    expect(rigPointNames('top')).toEqual([
      'neckL',
      'neckR',
      'shoulderL',
      'shoulderR',
      'armpitL',
      'armpitR',
      'cuffOuterL',
      'cuffInnerL',
      'cuffOuterR',
      'cuffInnerR',
      'hemL',
      'hemR',
    ]);
    expect(rigPointNames('trousers')).toContain('crotch');
    expect(rigPointNames('skirt')).toEqual(['waistL', 'waistR', 'hipL', 'hipR', 'hemL', 'hemR']);
  });

  it('gives dresses the top points plus skirt points, and jumpsuits top plus trouser points', () => {
    const dress = rigPointNames('dress');
    for (const n of ['neckL', 'shoulderR', 'armpitL', 'cuffOuterL', 'waistL', 'hipR', 'hemL']) {
      expect(dress).toContain(n);
    }
    const jumpsuit = rigPointNames('jumpsuit');
    for (const n of ['neckL', 'cuffInnerR', 'waistR', 'crotch', 'hemOuterL', 'hemInnerR']) {
      expect(jumpsuit).toContain(n);
    }
  });

  it('has no duplicates', () => {
    for (const k of kinds) expect(new Set(rigPointNames(k)).size).toBe(rigPointNames(k).length);
  });
});
