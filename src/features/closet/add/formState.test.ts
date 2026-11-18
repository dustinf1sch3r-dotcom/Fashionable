import { CATEGORIES, subcategoriesOf, subcategoryDefaults } from '@/core/model/taxonomy';
import type { ColorSwatch } from '@/core/model/types';
import {
  formReducer,
  initialFormState,
  toNewItemInit,
  validateForm,
  type FormState,
} from './formState';

const NAVY: ColorSwatch = { hex: '#1f2a5c', share: 1, name: 'navy' };

const run = (state: FormState, ...actions: Parameters<typeof formReducer>[1][]): FormState =>
  actions.reduce(formReducer, state);

describe('initialFormState', () => {
  it('prefills top / t-shirt with taxonomy defaults', () => {
    const s = initialFormState([NAVY]);
    expect([s.category, s.subcategory]).toEqual(['top', 'tshirt']);
    expect([s.formality, s.warmth, s.rainOk, s.sporty]).toEqual([2, 1, true, false]);
    expect(s.colors).toEqual([NAVY]);
  });
});

describe('defaults re-application', () => {
  it('follows the subcategory while nothing was touched', () => {
    const s = run(initialFormState([NAVY]), { type: 'setSubcategory', subcategory: 'sweater' });
    const d = subcategoryDefaults('top', 'sweater');
    expect([s.formality, s.warmth]).toEqual([d?.formality, d?.warmth]);
  });

  it('picks the first subcategory and its defaults when the category changes', () => {
    const s = run(initialFormState([NAVY]), { type: 'setCategory', category: 'outerwear' });
    const [first] = subcategoriesOf('outerwear');
    expect(s.subcategory).toBe(first);
    expect(s.formality).toBe(subcategoryDefaults('outerwear', first)?.formality);
  });

  it('keeps a value the user changed but still updates the others', () => {
    const s = run(
      initialFormState([NAVY]),
      { type: 'setWarmth', value: 5 },
      { type: 'setSubcategory', subcategory: 'sports-top' },
    );
    expect(s.warmth).toBe(5);
    expect(s.formality).toBe(1);
    expect(s.sporty).toBe(true);
  });

  it('keeps toggles the user changed', () => {
    const s = run(
      initialFormState([NAVY]),
      { type: 'setSporty', value: true },
      { type: 'setRainOk', value: false },
      { type: 'setCategory', category: 'shoes' },
    );
    expect(s.sporty).toBe(true);
    expect(s.rainOk).toBe(false);
  });

  it('keeps a user-set value even when set back to the default', () => {
    const s = run(
      initialFormState([NAVY]),
      { type: 'setFormality', value: 2 },
      { type: 'setSubcategory', subcategory: 'shirt' },
    );
    expect(s.formality).toBe(2);
  });

  it('every category yields a valid subcategory', () => {
    for (const category of CATEGORIES) {
      const s = run(initialFormState([NAVY]), { type: 'setCategory', category });
      expect(validateForm(s)).toEqual([]);
    }
  });

  it('ignores re-selecting the current category', () => {
    const start = run(initialFormState([NAVY]), { type: 'setSubcategory', subcategory: 'polo' });
    expect(formReducer(start, { type: 'setCategory', category: 'top' })).toBe(start);
  });
});

describe('validateForm', () => {
  it('requires a colour', () => {
    expect(validateForm(initialFormState([]))).toEqual(['no-colour']);
  });

  it('accepts a colour chosen by hand', () => {
    const s = run(initialFormState([]), { type: 'setPrimaryColor', color: 'olive' });
    expect(s.colors[0].name).toBe('olive');
    expect(validateForm(s)).toEqual([]);
  });

  it('rejects a subcategory that does not belong to the category', () => {
    const s = { ...initialFormState([NAVY]), subcategory: 'jeans' };
    expect(validateForm(s)).toEqual(['no-subcategory']);
  });
});

describe('toNewItemInit', () => {
  const images = { originalId: 'o', cutoutId: 'c', thumbId: 't' };
  const cutout = { aspectRatio: 0.67, hasAlpha: false };

  it('trims the name and omits it when blank', () => {
    const s = initialFormState([NAVY]);
    expect(toNewItemInit(s, images, cutout)).not.toHaveProperty('name');
    const named = run(s, { type: 'setName', name: '  Favourite tee ' });
    expect(toNewItemInit(named, images, cutout).name).toBe('Favourite tee');
  });

  it('carries tags, images and cutout', () => {
    const s = run(initialFormState([NAVY]), { type: 'setPattern', pattern: 'stripe' });
    expect(toNewItemInit(s, images, cutout)).toMatchObject({
      category: 'top',
      subcategory: 'tshirt',
      pattern: 'stripe',
      images,
      cutout,
      colors: [NAVY],
    });
  });
});
