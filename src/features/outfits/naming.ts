import { slotOf } from '@/core/model/slots';
import type { Item, Outfit, Slot } from '@/core/model/types';
import { COLOR_LABELS, subcategoryLabel } from '../closet/labels';

/** Pieces that name an outfit, most defining first. */
const NAMING_SLOTS: readonly Slot[] = ['onepiece', 'base', 'mid', 'bottom', 'outer', 'shoes'];
const MAX_NAME_PIECES = 2;
export const FALLBACK_OUTFIT_NAME = 'Saved outfit';

/** "Navy t-shirt" from colour and type, or the item's own name when it has one. */
function describe(item: Item): string {
  const own = item.name?.trim();
  if (own) return own;
  const colour = item.colors[0] ? COLOR_LABELS[item.colors[0].name] : undefined;
  const type = subcategoryLabel(item.subcategory).toLowerCase();
  return colour ? `${colour} ${type}` : type;
}

/** "Dark jeans" → "dark jeans" mid-name, but leave "Uniqlo Tee" (other capitals) alone. */
function lowerSentenceCase(text: string): string {
  return /[A-Z]/.test(text.slice(1)) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** "Navy t-shirt & blue jeans": the two most defining pieces; shoes join when a dress stands alone. */
export function autoName(items: readonly Item[]): string {
  const bySlot = (s: Slot) => items.find((i) => slotOf(i) === s);
  const picked: Item[] = [];
  for (const slot of NAMING_SLOTS) {
    if (picked.length === MAX_NAME_PIECES) break;
    const hit = bySlot(slot);
    if (!hit) continue;
    // A mid layer only names the outfit when there is no base top.
    if (slot === 'mid' && bySlot('base')) continue;
    // An outer layer only names it when it is all there is above the waist.
    if (slot === 'outer' && (bySlot('base') || bySlot('mid') || bySlot('onepiece'))) continue;
    picked.push(hit);
  }
  if (picked.length === 0 && items[0]) picked.push(items[0]);
  if (picked.length === 0) return FALLBACK_OUTFIT_NAME;
  return picked
    .map((item, index) => {
      const text = describe(item);
      return index > 0 ? lowerSentenceCase(text) : text;
    })
    .join(' & ');
}

/** The user's name for a saved outfit, else a generated one from whatever pieces are left. */
export function outfitName(outfit: Pick<Outfit, 'name'>, items: readonly Item[]): string {
  return outfit.name?.trim() || autoName(items);
}
