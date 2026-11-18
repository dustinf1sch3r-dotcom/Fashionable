import type { Item, Reason, Slot } from '../../model/types';
import { slotOf } from '../../model/slots';

/** Result of one scoring component. `null` from a component means "does not apply". */
export interface ComponentResult {
  /** 0–1 */
  value: number;
  reasons: Reason[];
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function itemsInSlots(items: readonly Item[], slots: readonly Slot[]): Item[] {
  return items.filter((i) => slots.includes(slotOf(i)));
}

export function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Largest-share colour of an item (first wins ties); undefined if it has none. */
export function primaryColour(item: Item): Item['colors'][number] | undefined {
  let best: Item['colors'][number] | undefined;
  for (const c of item.colors) if (!best || c.share > best.share) best = c;
  return best;
}
