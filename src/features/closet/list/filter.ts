import type { Category, ColorName, Item, ItemStatus } from '@/core/model/types';
import { subcategoryLabel } from '../labels';

export type SortKey = 'newest' | 'name';

export interface ClosetFilter {
  status: ItemStatus;
  category: Category | 'all';
  color: ColorName | null;
  query: string;
}

export const DEFAULT_FILTER: ClosetFilter = {
  status: 'active',
  category: 'all',
  color: null,
  query: '',
};

/** The name shown for an item: its own name, else its subcategory. */
export function itemDisplayName(item: Item): string {
  const name = item.name?.trim();
  return name ? name : subcategoryLabel(item.subcategory);
}

function matchesQuery(item: Item, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = [
    item.name ?? '',
    item.subcategory,
    subcategoryLabel(item.subcategory),
    item.brand ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

/** Every whitespace-separated word of the query must appear in the name, subcategory or brand. */
export function filterItems(items: readonly Item[], filter: ClosetFilter): Item[] {
  const tokens = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(
    (i) =>
      i.status === filter.status &&
      (filter.category === 'all' || i.category === filter.category) &&
      (filter.color === null || i.colors.some((c) => c.name === filter.color)) &&
      matchesQuery(i, tokens),
  );
}

export function sortItems(items: readonly Item[], sort: SortKey): Item[] {
  const out = [...items];
  if (sort === 'name') {
    out.sort(
      (a, b) =>
        itemDisplayName(a).localeCompare(itemDisplayName(b), 'en', { sensitivity: 'base' }) ||
        a.id.localeCompare(b.id),
    );
  } else {
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }
  return out;
}

export interface PresentColor {
  name: ColorName;
  hex: string;
}

/** Distinct colours across the items, most frequent first (ties by name). */
export function presentColors(items: readonly Item[]): PresentColor[] {
  const counts = new Map<ColorName, { hex: string; n: number }>();
  for (const item of items) {
    for (const c of item.colors) {
      const seen = counts.get(c.name);
      if (seen) seen.n += 1;
      else counts.set(c.name, { hex: c.hex, n: 1 });
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .map(([name, v]) => ({ name, hex: v.hex }));
}

export function countByStatus(items: readonly Item[]): Record<ItemStatus, number> {
  const out: Record<ItemStatus, number> = { active: 0, laundry: 0, archived: 0 };
  for (const i of items) out[i.status] += 1;
  return out;
}

export function hasActiveFilters(filter: ClosetFilter): boolean {
  return filter.category !== 'all' || filter.color !== null || filter.query.trim() !== '';
}
