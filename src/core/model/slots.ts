import { subcategoryDefaults } from './taxonomy';
import type { Category, Item, Slot } from './types';

/** Maximum items per slot in one outfit (OUTFIT_ENGINE §2). */
export const SLOT_CAPACITY: Readonly<Record<Slot, number>> = {
  base: 1,
  mid: 1,
  bottom: 1,
  onepiece: 1,
  outer: 1,
  shoes: 1,
  legs: 1,
  belt: 1,
  bag: 1,
  head: 1,
  neck: 1,
  eyes: 1,
  wrist: 1,
  jewelry: 3,
};

/**
 * The slots that form the core combos (`base × bottom × shoes` or `onepiece × shoes`,
 * OUTFIT_ENGINE §3). Used for "main pieces" in scoring and orphan detection.
 */
export const MAIN_SLOTS: readonly Slot[] = ['base', 'bottom', 'onepiece', 'shoes'];

const SLOT_BY_CATEGORY: Readonly<Record<Exclude<Category, 'top'>, Slot>> = {
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

/**
 * Slot an item occupies. Tops use the item's own `layer`, then the taxonomy default for its
 * subcategory, then `base`.
 */
export function slotOf(item: Pick<Item, 'category' | 'subcategory' | 'layer'>): Slot {
  if (item.category !== 'top') return SLOT_BY_CATEGORY[item.category];
  const layer = item.layer ?? subcategoryDefaults('top', item.subcategory)?.layer ?? 'base';
  return layer === 'mid' ? 'mid' : 'base';
}
