import { MAIN_SLOTS, slotOf } from '../../model/slots';
import type { ISODate, Item, WearLog } from '../../model/types';
import { FRESHNESS_RECENT_DAYS, FRESHNESS_RECENT_PENALTY, FRESHNESS_WINDOW_DAYS } from '../weights';
import { clamp01 } from './types';
import type { ComponentResult } from './types';

const MS_PER_DAY = 86_400_000;

/** Whole days since the Unix epoch for a `YYYY-MM-DD` string (UTC maths, no current time). */
export function dayNumber(date: ISODate): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** `later − earlier` in whole days. */
export function daysBetween(earlier: ISODate, later: ISODate): number {
  return dayNumber(later) - dayNumber(earlier);
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

/**
 * Freshness (OUTFIT_ENGINE §4.5): `clamp(min(d,14)/14) × (1 − 0.5·r)`.
 *
 * Interpretations:
 * - Only logs with `planned: false` dated on or before `date` count as worn.
 * - No such logs at all ("no history yet") → `null`.
 * - "Never worn → 1.0" is applied to the `d` factor (d term = 1); the recent-repeat penalty `r`
 *   still applies, since r measures the individual pieces, not the set.
 * - "Worn in the last 3 days" = 0 ≤ days ago ≤ 3 (inclusive).
 * - Main pieces = MAIN_SLOTS (base, bottom, onepiece, shoes); `r` = 0 if there are none.
 */
export function scoreFreshness(
  items: readonly Item[],
  date: ISODate,
  wearLogs: readonly WearLog[],
): ComponentResult | null {
  const worn = wearLogs.filter((l) => !l.planned && daysBetween(l.date, date) >= 0);
  if (worn.length === 0) return null;

  const ids = items.map((i) => i.id);
  const sets = worn.filter((l) => sameSet(l.itemIds, ids));
  const daysSince = sets.length
    ? Math.min(...sets.map((l) => daysBetween(l.date, date)))
    : Number.POSITIVE_INFINITY;
  const dFactor = clamp01(Math.min(daysSince, FRESHNESS_WINDOW_DAYS) / FRESHNESS_WINDOW_DAYS);

  const recentIds = new Set(
    worn
      .filter((l) => daysBetween(l.date, date) <= FRESHNESS_RECENT_DAYS)
      .flatMap((l) => l.itemIds),
  );
  const main = items.filter((i) => MAIN_SLOTS.includes(slotOf(i)));
  const r = main.length ? main.filter((i) => recentIds.has(i.id)).length / main.length : 0;

  const value = clamp01(dFactor * (1 - FRESHNESS_RECENT_PENALTY * r));
  return {
    value,
    reasons: sets.length === 0 ? [{ code: 'FRESH_COMBINATION', params: {} }] : [],
  };
}
