import type { ISODate, Weather } from '../model/types';

/** A stored forecast for one location: all fetched days, stamped with when they were fetched. */
export interface ForecastCacheEntry {
  fetchedAt: string;
  days: Record<ISODate, Weather>;
}

/** Today's forecast is refreshed after this long; other days are kept until the day changes. */
export const TODAY_STALE_MS = 3 * 60 * 60 * 1000;

/** The device-local calendar date of `d` as `YYYY-MM-DD`. */
export function localISODate(d: Date): ISODate {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Storage key: coordinates rounded to 2 decimals (~1 km) so nearby fixes share an entry. */
export function forecastCacheKey(lat: number, lon: number): string {
  return `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/**
 * Whether `entry` can answer a request for `date` at time `now`.
 * - Never fresh when it lacks that date, or was fetched in the future (clock change).
 * - For today: fresh for 3 hours after fetching.
 * - For any other date: fresh while it was fetched on the same local day as `now` (one forecast
 *   per location per day).
 */
export function isCacheFresh(entry: ForecastCacheEntry, date: ISODate, now: Date): boolean {
  if (!(date in entry.days)) return false;
  const fetched = new Date(entry.fetchedAt);
  const age = now.getTime() - fetched.getTime();
  if (Number.isNaN(age) || age < 0) return false;
  if (date === localISODate(now)) return age < TODAY_STALE_MS;
  return localISODate(fetched) === localISODate(now);
}

export function parseCacheEntry(raw: string | null): ForecastCacheEntry | undefined {
  if (!raw) return undefined;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return undefined;
    const e = v as { fetchedAt?: unknown; days?: unknown };
    if (typeof e.fetchedAt !== 'string' || typeof e.days !== 'object' || e.days === null) {
      return undefined;
    }
    return { fetchedAt: e.fetchedAt, days: e.days as Record<ISODate, Weather> };
  } catch {
    return undefined;
  }
}
