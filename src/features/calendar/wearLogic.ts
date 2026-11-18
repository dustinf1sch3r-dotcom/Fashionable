import { addDays, daysBetween, lastDates } from '@/core/dates';
import { slotOf } from '@/core/model/slots';
import type { ID, ISODate, Item, Slot, WearLog } from '@/core/model/types';

export const logsOnDate = (logs: readonly WearLog[], date: ISODate): WearLog[] =>
  logs.filter((l) => l.date === date);

export const wornLogs = (logs: readonly WearLog[]): WearLog[] => logs.filter((l) => !l.planned);

export const plannedLogs = (logs: readonly WearLog[]): WearLog[] => logs.filter((l) => l.planned);

/** Plans whose day has arrived (today or earlier) and still need a "did you wear it?" answer. */
export const duePlans = (logs: readonly WearLog[], today: ISODate): WearLog[] =>
  logs.filter((l) => l.planned && l.date <= today);

/** How a day is marked on the grid: a thumbnail (worn), a dot (planned) or nothing. */
export type DayMark = 'worn' | 'planned' | 'none';

export function dayMark(logs: readonly WearLog[]): DayMark {
  if (logs.some((l) => !l.planned)) return 'worn';
  return logs.length > 0 ? 'planned' : 'none';
}

/** Groups logs by date. */
export function logsByDate(logs: readonly WearLog[]): Map<ISODate, WearLog[]> {
  const map = new Map<ISODate, WearLog[]>();
  for (const l of logs) {
    const list = map.get(l.date);
    if (list) list.push(l);
    else map.set(l.date, [l]);
  }
  return map;
}

const THUMB_SLOT_ORDER: readonly Slot[] = ['onepiece', 'base', 'mid', 'outer', 'bottom', 'shoes'];

/** The piece that stands for an outfit in a thumbnail: the dress or the base top, else the next best. */
export function thumbnailItem(items: readonly Item[]): Item | undefined {
  for (const slot of THUMB_SLOT_ORDER) {
    const hit = items.find((i) => slotOf(i) === slot);
    if (hit) return hit;
  }
  return items[0];
}

/** The thumbnail piece for the first worn log (else first planned log) of a day. */
export function thumbnailForDay(
  logs: readonly WearLog[],
  byId: ReadonlyMap<ID, Item>,
): Item | undefined {
  const log = logs.find((l) => !l.planned) ?? logs[0];
  if (!log) return undefined;
  return thumbnailItem(log.itemIds.flatMap((id) => byId.get(id) ?? []));
}

export interface WearSummary {
  /** Distinct days with something worn among the last seven (today included). */
  loggedLast7: number;
  /** Consecutive logged days up to today, or up to yesterday while today is still open. */
  streak: number;
  /** Days with something worn, ever. */
  totalDays: number;
}

export function summarize(logs: readonly WearLog[], today: ISODate): WearSummary {
  const days = new Set(wornLogs(logs).map((l) => l.date));
  const loggedLast7 = lastDates(today, 7).filter((d) => days.has(d)).length;
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return { loggedLast7, streak, totalDays: days.size };
}

/** How far ahead the forecast reaches. */
export const FORECAST_DAYS = 14;

/** True when `date` is today or one of the following days the forecast covers. */
export const inForecastRange = (date: ISODate, today: ISODate): boolean => {
  const d = daysBetween(today, date);
  return d >= 0 && d < FORECAST_DAYS;
};

/** Where an existing set of items matches an outfit (order does not matter). */
export const sameItems = (a: readonly ID[], b: readonly ID[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
