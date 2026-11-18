import type { Category, ColorName, ID, Item, WearLog } from '@/core/model/types';

/** An item is "untouched" once it has gone this many days without being worn. */
export const UNTOUCHED_DAYS = 90;
/** Rows shown in each ranked list. */
export const LIST_SIZE = 5;

const DAY_MS = 86_400_000;

/** Whole days from calendar date `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const parse = (d: string): number => {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1);
  };
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export interface WearSummary {
  count: number;
  /** Latest worn date, or undefined when never worn. */
  last: string | undefined;
}

/** Times worn and last worn date per item. Planned logs do not count; an item counts once per log. */
export function wearSummaries(logs: readonly WearLog[]): Map<ID, WearSummary> {
  const out = new Map<ID, WearSummary>();
  for (const log of logs) {
    if (log.planned || log.deletedAt) continue;
    for (const id of new Set(log.itemIds)) {
      const prev = out.get(id);
      out.set(id, {
        count: (prev?.count ?? 0) + 1,
        last: prev?.last === undefined || log.date > prev.last ? log.date : prev.last,
      });
    }
  }
  return out;
}

export interface WornRow {
  item: Item;
  count: number;
  last: string | undefined;
}

export interface UntouchedRow {
  item: Item;
  /** Days since it was last worn; null when it never was. */
  daysSince: number | null;
}

export interface ColourRow {
  name: ColorName;
  hex: string;
  count: number;
  /** Share of the closet, 0–100, rounded. */
  percent: number;
}

export interface CategoryRow {
  category: Category;
  count: number;
  percent: number;
}

export interface CostRow {
  item: Item;
  price: number;
  count: number;
  /** Price divided by wears; null when it has not been worn yet. */
  perWear: number | null;
}

export interface Stats {
  /** Items counted: everything not archived. */
  itemCount: number;
  hasWears: boolean;
  mostWorn: WornRow[];
  leastWorn: WornRow[];
  /** Every untouched item, longest-idle first. */
  untouched: UntouchedRow[];
  colours: ColourRow[];
  categories: CategoryRow[];
  /** Items with a price: cheapest per wear first, unworn ones last. */
  costPerWear: CostRow[];
}

const byName = (a: Item, b: Item): number =>
  (a.name ?? a.subcategory).localeCompare(b.name ?? b.subcategory) || a.id.localeCompare(b.id);

const pct = (n: number, total: number): number => (total === 0 ? 0 : Math.round((n / total) * 100));

/** Closet statistics for the Insights screen. `today` is `YYYY-MM-DD`, passed in by the caller. */
export function computeStats(
  items: readonly Item[],
  logs: readonly WearLog[],
  today: string,
): Stats {
  const live = items.filter((i) => i.status !== 'archived' && !i.deletedAt);
  const wears = wearSummaries(logs);
  const rows: WornRow[] = live.map((item) => ({
    item,
    count: wears.get(item.id)?.count ?? 0,
    last: wears.get(item.id)?.last,
  }));

  const mostWorn = rows
    .filter((r) => r.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count || (b.last ?? '').localeCompare(a.last ?? '') || byName(a.item, b.item),
    )
    .slice(0, LIST_SIZE);
  const mostIds = new Set(mostWorn.map((r) => r.item.id));
  // Least worn never repeats a most-worn row, so a tiny closet does not list one piece twice.
  const leastWorn = rows
    .filter((r) => !mostIds.has(r.item.id))
    .sort(
      (a, b) =>
        a.count - b.count ||
        a.item.createdAt.localeCompare(b.item.createdAt) ||
        byName(a.item, b.item),
    )
    .slice(0, LIST_SIZE);

  const untouched: UntouchedRow[] = [];
  for (const r of rows) {
    const age = daysBetween(r.item.createdAt, today);
    const since = r.last === undefined ? null : daysBetween(r.last, today);
    if (age >= UNTOUCHED_DAYS && (since === null || since >= UNTOUCHED_DAYS)) {
      untouched.push({ item: r.item, daysSince: since });
    }
  }
  untouched.sort(
    (a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity) || byName(a.item, b.item),
  );

  const colourCounts = new Map<ColorName, { hex: string; count: number }>();
  const categoryCounts = new Map<Category, number>();
  for (const item of live) {
    const c = item.colors[0];
    if (c) {
      const prev = colourCounts.get(c.name);
      colourCounts.set(c.name, { hex: prev?.hex ?? c.hex, count: (prev?.count ?? 0) + 1 });
    }
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }
  const colourTotal = [...colourCounts.values()].reduce((s, c) => s + c.count, 0);
  const colours = [...colourCounts.entries()]
    .map(([name, v]) => ({ name, hex: v.hex, count: v.count, percent: pct(v.count, colourTotal) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const categories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count, percent: pct(count, live.length) }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const costPerWear: CostRow[] = [];
  for (const r of rows) {
    const price = r.item.pricePaid;
    if (price === undefined || !(price > 0)) continue;
    costPerWear.push({
      item: r.item,
      price,
      count: r.count,
      perWear: r.count > 0 ? price / r.count : null,
    });
  }
  costPerWear.sort(
    (a, b) => (a.perWear ?? Infinity) - (b.perWear ?? Infinity) || byName(a.item, b.item),
  );

  return {
    itemCount: live.length,
    hasWears: mostWorn.length > 0,
    mostWorn,
    leastWorn,
    untouched,
    colours,
    categories,
    costPerWear,
  };
}

/** `12.5` → `12.50`; whole numbers lose the decimals (`12`). No currency: the app stores none. */
export function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
