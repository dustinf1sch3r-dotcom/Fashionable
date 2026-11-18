import { nameColor } from '../color/classify';
import { newItem } from '../model/factories';
import type { NewItemInit } from '../model/factories';
import type { Category, Item, Material, Metal, Pattern } from '../model/types';

/** Virtual item ids are `archetype:<archetypeId>`. */
export const ARCHETYPE_ID_PREFIX = 'archetype:';

export interface Archetype {
  /** Stable kebab-case id, e.g. `white-sneakers`. Never changes once shipped. */
  archetypeId: string;
  /** Attribute-only virtual item (placeholder image ids); id is `archetype:<archetypeId>`. */
  item: Item;
}

interface Extra {
  pattern?: Pattern;
  patternBold?: boolean;
  material?: Material;
  metal?: Metal;
  /** Second swatch (e.g. breton stripes). */
  hex2?: string;
  layer?: 'base' | 'mid';
}

/** Frozen clock: archetypes are static data, so no time is ever read. */
const FIXED_CLOCK = { now: () => new Date('2026-01-01T00:00:00.000Z') };

function make(
  archetypeId: string,
  name: string,
  category: Category,
  subcategory: string,
  hex: string,
  extra: Extra = {},
): Archetype {
  const colors = [{ hex, share: extra.hex2 ? 0.55 : 1, name: nameColor(hex) }];
  if (extra.hex2) colors.push({ hex: extra.hex2, share: 0.45, name: nameColor(extra.hex2) });
  const init: NewItemInit = {
    name,
    category,
    subcategory,
    colors,
    images: {
      originalId: `${archetypeId}-orig`,
      cutoutId: `${archetypeId}-cutout`,
      thumbId: `${archetypeId}-thumb`,
    },
    cutout: { aspectRatio: 1, hasAlpha: true },
    ...(extra.pattern ? { pattern: extra.pattern } : {}),
    ...(extra.patternBold !== undefined ? { patternBold: extra.patternBold } : {}),
    ...(extra.material ? { material: extra.material } : {}),
    ...(extra.metal ? { metal: extra.metal } : {}),
    ...(extra.layer ? { layer: extra.layer } : {}),
  };
  const item = newItem(init, FIXED_CLOCK, { uuid: () => `${ARCHETYPE_ID_PREFIX}${archetypeId}` });
  return { archetypeId, item };
}

const WHITE = '#f5f5f2';
const BLACK = '#1b1b1d';
const GREY = '#8a8d91';
const NAVY = '#1f2a44';
const BEIGE = '#d4c0a1';
const BROWN = '#6b4a2f';
const TAN = '#b98a5a';

/** ~45 staple pieces a wardrobe is built from. Order is stable; ties elsewhere break by id. */
export const ARCHETYPES: readonly Archetype[] = [
  // base tops
  make('white-tee', 'White tee', 'top', 'tshirt', WHITE, { material: 'cotton' }),
  make('black-tee', 'Black tee', 'top', 'tshirt', BLACK, { material: 'cotton' }),
  make('white-oxford-shirt', 'White oxford shirt', 'top', 'shirt', WHITE, { material: 'cotton' }),
  make('light-blue-shirt', 'Light blue shirt', 'top', 'shirt', '#9db8d6', { material: 'cotton' }),
  make('breton-stripe-top', 'Breton stripe top', 'top', 'longsleeve-tee', WHITE, {
    hex2: NAVY,
    pattern: 'stripe',
    material: 'cotton',
  }),
  make('black-longsleeve-tee', 'Black long-sleeve tee', 'top', 'longsleeve-tee', BLACK, {
    material: 'cotton',
  }),
  // mid layers
  make('grey-crewneck-sweater', 'Grey crewneck sweater', 'top', 'sweater', '#9a9da1', {
    material: 'knit',
  }),
  make('cream-knit-sweater', 'Cream knit sweater', 'top', 'sweater', '#efe6d2', {
    material: 'knit',
  }),
  make('navy-cardigan', 'Navy cardigan', 'top', 'cardigan', NAVY, { material: 'knit' }),
  make('grey-hoodie', 'Grey hoodie', 'top', 'hoodie', GREY, { material: 'cotton' }),
  // bottoms
  make('dark-jeans', 'Dark jeans', 'bottom', 'jeans', '#2b3550', { material: 'denim' }),
  make('light-jeans', 'Light jeans', 'bottom', 'jeans', '#8fa9c8', { material: 'denim' }),
  make('black-jeans', 'Black jeans', 'bottom', 'jeans', BLACK, { material: 'denim' }),
  make('black-trousers', 'Black trousers', 'bottom', 'trousers', BLACK, { material: 'wool' }),
  make('beige-chinos', 'Beige chinos', 'bottom', 'chinos', BEIGE, { material: 'cotton' }),
  make('navy-chinos', 'Navy chinos', 'bottom', 'chinos', NAVY, { material: 'cotton' }),
  make('grey-wool-trousers', 'Grey wool trousers', 'bottom', 'trousers', '#6d7075', {
    material: 'wool',
  }),
  make('black-midi-skirt', 'Black midi skirt', 'bottom', 'skirt', BLACK, { material: 'synthetic' }),
  make('denim-skirt', 'Denim skirt', 'bottom', 'denim-skirt', '#8fa9c8', { material: 'denim' }),
  // one-pieces
  make('little-black-dress', 'Little black dress', 'onepiece', 'day-dress', BLACK, {
    material: 'synthetic',
  }),
  make('navy-shirt-dress', 'Navy shirt dress', 'onepiece', 'shirt-dress', NAVY, {
    material: 'cotton',
  }),
  make('white-casual-dress', 'White casual dress', 'onepiece', 'casual-dress', WHITE, {
    material: 'cotton',
  }),
  // outerwear
  make('navy-blazer', 'Navy blazer', 'outerwear', 'blazer', NAVY, { material: 'wool' }),
  make('beige-trench', 'Beige trench coat', 'outerwear', 'trench', BEIGE, { material: 'cotton' }),
  make('black-leather-jacket', 'Black leather jacket', 'outerwear', 'leather-jacket', BLACK, {
    material: 'leather',
  }),
  make('camel-coat', 'Camel coat', 'outerwear', 'overcoat', '#c19a6b', { material: 'wool' }),
  make('black-puffer', 'Black puffer jacket', 'outerwear', 'puffer', BLACK, {
    material: 'synthetic',
  }),
  make('denim-jacket', 'Denim jacket', 'outerwear', 'denim-jacket', '#6f8cb0', {
    material: 'denim',
  }),
  // shoes
  make('white-sneakers', 'White sneakers', 'shoes', 'sneakers', WHITE, { material: 'leather' }),
  make('black-sneakers', 'Black sneakers', 'shoes', 'sneakers', BLACK, { material: 'synthetic' }),
  make('black-chelsea-boots', 'Black chelsea boots', 'shoes', 'chelsea-boots', BLACK, {
    material: 'leather',
  }),
  make('brown-loafers', 'Brown loafers', 'shoes', 'loafers', BROWN, { material: 'leather' }),
  make('black-ankle-boots', 'Black ankle boots', 'shoes', 'ankle-boots', BLACK, {
    material: 'leather',
  }),
  make('tan-sandals', 'Tan sandals', 'shoes', 'sandals', TAN, { material: 'leather' }),
  make('black-pumps', 'Black pumps', 'shoes', 'pumps', BLACK, { material: 'leather' }),
  make('black-flats', 'Black flats', 'shoes', 'flats', BLACK, { material: 'leather' }),
  // belts
  make('brown-leather-belt', 'Brown leather belt', 'belt', 'leather-belt', BROWN, {
    material: 'leather',
  }),
  make('black-leather-belt', 'Black leather belt', 'belt', 'leather-belt', BLACK, {
    material: 'leather',
  }),
  // bags
  make('black-tote', 'Black tote', 'bag', 'tote', BLACK, { material: 'leather' }),
  make('brown-crossbody', 'Brown crossbody bag', 'bag', 'crossbody', BROWN, {
    material: 'leather',
  }),
  // accessories
  make('grey-scarf', 'Grey scarf', 'neckwear', 'scarf', GREY, { material: 'wool' }),
  make('black-tights', 'Black tights', 'legwear', 'tights', BLACK, { material: 'synthetic' }),
  make('black-beanie', 'Black beanie', 'headwear', 'beanie', BLACK, { material: 'knit' }),
  make('silver-watch', 'Silver watch', 'watch', 'dress-watch', '#c0c3c7', { metal: 'silver' }),
  make('gold-necklace', 'Gold necklace', 'jewelry', 'necklace', '#d4af37', { metal: 'gold' }),
  make('black-sunglasses', 'Black sunglasses', 'eyewear', 'sunglasses', BLACK),
];

const BY_ID: ReadonlyMap<string, Archetype> = new Map(ARCHETYPES.map((a) => [a.archetypeId, a]));

export function archetypeById(archetypeId: string): Archetype | undefined {
  return BY_ID.get(archetypeId);
}

/** Archetype id of a virtual item id, or undefined for a closet item. */
export function archetypeIdOfItemId(itemId: string): string | undefined {
  return itemId.startsWith(ARCHETYPE_ID_PREFIX)
    ? itemId.slice(ARCHETYPE_ID_PREFIX.length)
    : undefined;
}
