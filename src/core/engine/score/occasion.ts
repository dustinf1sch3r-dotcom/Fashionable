import { MAIN_SLOTS, slotOf } from '../../model/slots';
import type { Item, Occasion, Slot } from '../../model/types';
import { OCCASION_DIVISOR, OCCASION_RULES, SPORTY_ALLOWED_OCCASIONS } from '../weights';
import { clamp01, itemsInSlots, mean } from './types';
import type { ComponentResult } from './types';

/** True when the occasion leaves this slot empty (`active` skips belt, jewelry, neck). */
export function occasionSkipsSlot(occasion: Occasion, slot: Slot): boolean {
  return OCCASION_RULES[occasion].skipSlots.includes(slot);
}

/**
 * Hard rule for the generator (OUTFIT_ENGINE §3 step 1, §5): formality inside the occasion's
 * range, skipped slots excluded, for `active` only `sporty` items, and sporty items only for
 * `active`, `lounge` and `any`.
 */
export function isItemAllowedForOccasion(item: Item, occasion: Occasion): boolean {
  const rule = OCCASION_RULES[occasion];
  if (item.formality < rule.minFormality || item.formality > rule.maxFormality) return false;
  if (occasionSkipsSlot(occasion, slotOf(item))) return false;
  if (rule.onlySporty && !item.sporty) return false;
  if (item.sporty && !SPORTY_ALLOWED_OCCASIONS.includes(occasion)) return false;
  return true;
}

/**
 * Occasion fit (OUTFIT_ENGINE §5): `1 − |mean formality of main pieces − ideal| / 2`.
 * `null` for `any` (no ideal) or when the outfit has no main pieces.
 */
export function scoreOccasion(items: readonly Item[], occasion: Occasion): ComponentResult | null {
  const ideal = OCCASION_RULES[occasion].ideal;
  if (ideal === null) return null;
  const main = itemsInSlots(items, MAIN_SLOTS);
  if (main.length === 0) return null;
  const avg = mean(main.map((i) => i.formality));
  return { value: clamp01(1 - Math.abs(avg - ideal) / OCCASION_DIVISOR), reasons: [] };
}
