import type { Category, Formality, Warmth } from './types';

/**
 * Subcategories per category with the defaults the add-item form is prefilled with.
 * Keys are kebab-case identifiers; display labels live in the UI layer.
 */
export interface SubcategoryDefaults {
  /** Tops only. */
  layer?: 'base' | 'mid';
  formality: Formality;
  warmth: Warmth;
  rainOk: boolean;
  sporty: boolean;
  /** Bottoms only: a belt may be added (OUTFIT_ENGINE §3 step 4). */
  beltCompatible?: boolean;
  /** Shoes only: excluded in cold weather (OUTFIT_ENGINE §6). */
  openShoe?: boolean;
  /** Bottoms only: excluded in cold weather (OUTFIT_ENGINE §6). */
  isShorts?: boolean;
}

type Extra = Partial<SubcategoryDefaults>;

function def(formality: Formality, warmth: Warmth, extra: Extra = {}): SubcategoryDefaults {
  return { formality, warmth, rainOk: true, sporty: false, ...extra };
}

const TAXONOMY: Readonly<Record<Category, Readonly<Record<string, SubcategoryDefaults>>>> = {
  top: {
    tshirt: def(2, 1, { layer: 'base' }),
    'longsleeve-tee': def(2, 2, { layer: 'base' }),
    tank: def(1, 1, { layer: 'base' }),
    polo: def(3, 2, { layer: 'base' }),
    shirt: def(3, 2, { layer: 'base' }),
    blouse: def(3, 2, { layer: 'base' }),
    'sports-top': def(1, 2, { layer: 'base', sporty: true }),
    sweater: def(3, 4, { layer: 'mid' }),
    cardigan: def(3, 3, { layer: 'mid' }),
    hoodie: def(2, 3, { layer: 'mid' }),
    sweatshirt: def(2, 3, { layer: 'mid' }),
    waistcoat: def(4, 2, { layer: 'mid' }),
  },
  bottom: {
    jeans: def(2, 3, { beltCompatible: true }),
    trousers: def(4, 3, { beltCompatible: true }),
    'suit-trousers': def(5, 3, { beltCompatible: true }),
    chinos: def(3, 3, { beltCompatible: true }),
    shorts: def(2, 1, { beltCompatible: true, isShorts: true }),
    'sports-shorts': def(1, 1, { sporty: true, isShorts: true, beltCompatible: false }),
    skirt: def(3, 2, { beltCompatible: false }),
    'mini-skirt': def(2, 1, { beltCompatible: false }),
    'denim-skirt': def(2, 2, { beltCompatible: true }),
    leggings: def(1, 2, { sporty: true, beltCompatible: false }),
    joggers: def(1, 3, { sporty: true, beltCompatible: false }),
  },
  onepiece: {
    'casual-dress': def(2, 1),
    'day-dress': def(3, 2),
    'shirt-dress': def(3, 2),
    'sweater-dress': def(3, 4),
    'cocktail-dress': def(4, 2),
    'evening-gown': def(5, 2),
    jumpsuit: def(3, 2),
    dungarees: def(2, 2),
  },
  outerwear: {
    blazer: def(4, 3, { rainOk: false }),
    'suit-jacket': def(5, 3, { rainOk: false }),
    'denim-jacket': def(2, 3),
    'leather-jacket': def(3, 3, { rainOk: false }),
    bomber: def(2, 3),
    trench: def(4, 3),
    overcoat: def(4, 5, { rainOk: false }),
    peacoat: def(4, 4, { rainOk: false }),
    parka: def(2, 5),
    puffer: def(2, 5),
    raincoat: def(2, 2),
    windbreaker: def(1, 2, { sporty: true }),
  },
  shoes: {
    sneakers: def(2, 2),
    'running-shoes': def(1, 2, { sporty: true }),
    'ankle-boots': def(3, 3),
    'chelsea-boots': def(4, 3),
    'combat-boots': def(2, 4),
    'hiking-boots': def(1, 4, { sporty: true }),
    'knee-boots': def(3, 4),
    wellies: def(1, 3),
    loafers: def(3, 2, { rainOk: false }),
    oxfords: def(5, 2, { rainOk: false }),
    derbies: def(4, 2, { rainOk: false }),
    heels: def(4, 2, { rainOk: false }),
    pumps: def(4, 2, { rainOk: false }),
    flats: def(3, 1, { rainOk: false }),
    sandals: def(2, 1, { rainOk: false, openShoe: true }),
    'heeled-sandals': def(4, 1, { rainOk: false, openShoe: true }),
    'flip-flops': def(1, 1, { openShoe: true }),
    slides: def(1, 1, { openShoe: true }),
  },
  legwear: {
    socks: def(2, 2),
    'ankle-socks': def(2, 1),
    tights: def(3, 2),
    stockings: def(4, 1),
    'thermal-tights': def(2, 4),
  },
  belt: {
    'leather-belt': def(3, 1),
    'casual-belt': def(2, 1),
    'dress-belt': def(4, 1),
  },
  bag: {
    tote: def(2, 1),
    backpack: def(2, 1),
    crossbody: def(2, 1, { rainOk: false }),
    'shoulder-bag': def(3, 1, { rainOk: false }),
    handbag: def(4, 1, { rainOk: false }),
    clutch: def(5, 1, { rainOk: false }),
    briefcase: def(4, 1, { rainOk: false }),
  },
  headwear: {
    cap: def(1, 1, { sporty: true }),
    beanie: def(2, 3),
    'bucket-hat': def(2, 1),
    'sun-hat': def(2, 1, { rainOk: false }),
    beret: def(3, 2),
    hat: def(3, 2, { rainOk: false }),
  },
  neckwear: {
    scarf: def(2, 3),
    'silk-scarf': def(3, 1, { rainOk: false }),
    tie: def(4, 1),
    'bow-tie': def(5, 1),
  },
  jewelry: {
    necklace: def(3, 1),
    earrings: def(3, 1),
    bracelet: def(3, 1),
    ring: def(3, 1),
    brooch: def(4, 1),
  },
  eyewear: {
    sunglasses: def(2, 1),
    glasses: def(3, 1),
  },
  watch: {
    'dress-watch': def(4, 1),
    'casual-watch': def(2, 1),
    'sports-watch': def(1, 1, { sporty: true }),
  },
};

export const CATEGORIES: readonly Category[] = Object.keys(TAXONOMY) as Category[];

function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function subcategoriesOf(category: Category): readonly string[] {
  return Object.keys(TAXONOMY[category]);
}

export function isValidSubcategory(category: Category, subcategory: string): boolean {
  return has(TAXONOMY[category], subcategory);
}

/** Defaults for a subcategory, or `undefined` when it is not listed for the category. */
export function subcategoryDefaults(
  category: Category,
  subcategory: string,
): SubcategoryDefaults | undefined {
  return isValidSubcategory(category, subcategory) ? TAXONOMY[category][subcategory] : undefined;
}
