import type { Category, Item, RigKind } from '../model/types';

/** Bottoms: every subcategory is classified on purpose (a test checks the taxonomy is covered). */
export const BOTTOM_RIGS: Readonly<Record<string, RigKind>> = {
  jeans: 'trousers',
  trousers: 'trousers',
  'suit-trousers': 'trousers',
  chinos: 'trousers',
  shorts: 'trousers',
  'sports-shorts': 'trousers',
  leggings: 'trousers',
  joggers: 'trousers',
  skirt: 'skirt',
  'mini-skirt': 'skirt',
  'denim-skirt': 'skirt',
};

/** One-pieces: dresses use the dress rig, jumpsuits and dungarees the jumpsuit rig. */
export const ONEPIECE_RIGS: Readonly<Record<string, RigKind>> = {
  'casual-dress': 'dress',
  'day-dress': 'dress',
  'shirt-dress': 'dress',
  'sweater-dress': 'dress',
  'cocktail-dress': 'dress',
  'evening-gown': 'dress',
  jumpsuit: 'jumpsuit',
  dungarees: 'jumpsuit',
};

/** Categories fitted as a `top` (mid layers and outerwear included). */
const TOP_CATEGORIES: ReadonlySet<Category> = new Set<Category>(['top', 'outerwear']);

/** Categories that keep rigid placement (§12 intro). */
export const RIGID_CATEGORIES: readonly Category[] = [
  'shoes',
  'legwear',
  'belt',
  'bag',
  'headwear',
  'neckwear',
  'jewelry',
  'eyewear',
  'watch',
];

/** Which rig kind an item uses, or `undefined` if it keeps rigid placement. */
export function rigKindOf(item: Pick<Item, 'category' | 'subcategory'>): RigKind | undefined {
  if (TOP_CATEGORIES.has(item.category)) return 'top';
  const table =
    item.category === 'bottom' ? BOTTOM_RIGS : item.category === 'onepiece' ? ONEPIECE_RIGS : {};
  return Object.prototype.hasOwnProperty.call(table, item.subcategory)
    ? table[item.subcategory]
    : undefined;
}

const TOP_POINTS = [
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
] as const;
const UPPER_POINTS = TOP_POINTS.filter((n) => n !== 'hemL' && n !== 'hemR');

const POINTS: Readonly<Record<RigKind, readonly string[]>> = {
  top: TOP_POINTS,
  trousers: [
    'waistL',
    'waistR',
    'hipL',
    'hipR',
    'crotch',
    'hemOuterL',
    'hemInnerL',
    'hemOuterR',
    'hemInnerR',
  ],
  skirt: ['waistL', 'waistR', 'hipL', 'hipR', 'hemL', 'hemR'],
  dress: [...UPPER_POINTS, 'waistL', 'waistR', 'hipL', 'hipR', 'hemL', 'hemR'],
  jumpsuit: [
    ...UPPER_POINTS,
    'waistL',
    'waistR',
    'hipL',
    'hipR',
    'crotch',
    'hemOuterL',
    'hemInnerL',
    'hemOuterR',
    'hemInnerR',
  ],
};

/** Point names a rig of this kind has (sleeve points may be absent on sleeveless garments). */
export function rigPointNames(kind: RigKind): readonly string[] {
  return POINTS[kind];
}

/** Points that may be missing (sleeveless garments). */
export const OPTIONAL_POINTS: readonly string[] = [
  'cuffOuterL',
  'cuffInnerL',
  'cuffOuterR',
  'cuffInnerR',
];
