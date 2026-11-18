import { slotOf } from '@/core/model/slots';
import type { FitAdjust, ID, Item } from '@/core/model/types';
import { effectiveFit, sameFit } from '@/ui/mannequin/fit';

/**
 * The per-outfit fit tweaks worth saving: only for items in the outfit, and only where they
 * differ from the item's own saved fit. `undefined` when nothing is left.
 */
export function prunedOverrides(
  items: readonly Item[],
  overrides: Readonly<Record<ID, FitAdjust>>,
): Record<ID, FitAdjust> | undefined {
  const out: Record<ID, FitAdjust> = {};
  for (const item of items) {
    const o = overrides[item.id];
    if (o && !sameFit(o, effectiveFit(item))) out[item.id] = o;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Whether an item is a base top (the only slot the tuck toggle affects). */
export const hasBaseTop = (items: readonly Item[]): boolean =>
  items.some((i) => slotOf(i) === 'base');
