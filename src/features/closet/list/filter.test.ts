import { newItem, type NewItemInit } from '@/core/model/factories';
import type { Item } from '@/core/model/types';
import { createFixedClock, createSequentialIds } from '@/services/testing';
import {
  DEFAULT_FILTER,
  countByStatus,
  filterItems,
  hasActiveFilters,
  itemDisplayName,
  presentColors,
  sortItems,
} from './filter';

const ids = createSequentialIds();
let minute = 0;

function make(over: Partial<NewItemInit> & { createdAt?: string } = {}): Item {
  const { createdAt, ...init } = over;
  const item = newItem(
    {
      category: 'top',
      subcategory: 'tshirt',
      colors: [{ hex: '#1f2a44', name: 'navy', share: 1 }],
      images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
      cutout: { aspectRatio: 1, hasAlpha: true },
      ...init,
    },
    createFixedClock(),
    ids,
  );
  minute += 1;
  return {
    ...item,
    createdAt: createdAt ?? `2026-01-01T00:${String(minute).padStart(2, '0')}:00Z`,
  };
}

const white = [{ hex: '#f5f5f2', name: 'white' as const, share: 1 }];

describe('filterItems', () => {
  const tee = make({ name: 'Navy tee', brand: 'Uniqlo' });
  const jeans = make({ category: 'bottom', subcategory: 'jeans', colors: white });
  const boots = make({ category: 'shoes', subcategory: 'chelsea-boots', status: 'laundry' });
  const old = make({ status: 'archived' });
  const all = [tee, jeans, boots, old];

  it('defaults to active items only', () => {
    expect(filterItems(all, DEFAULT_FILTER)).toEqual([tee, jeans]);
  });

  it('filters by status', () => {
    expect(filterItems(all, { ...DEFAULT_FILTER, status: 'laundry' })).toEqual([boots]);
    expect(filterItems(all, { ...DEFAULT_FILTER, status: 'archived' })).toEqual([old]);
  });

  it('filters by category', () => {
    expect(filterItems(all, { ...DEFAULT_FILTER, category: 'bottom' })).toEqual([jeans]);
  });

  it('filters by colour on any swatch', () => {
    const two = make({
      colors: [
        { hex: '#f5f5f2', name: 'white', share: 0.6 },
        { hex: '#b3262e', name: 'red', share: 0.4 },
      ],
    });
    expect(filterItems([tee, jeans, two], { ...DEFAULT_FILTER, color: 'red' })).toEqual([two]);
    expect(filterItems([tee, jeans, two], { ...DEFAULT_FILTER, color: 'white' })).toEqual([
      jeans,
      two,
    ]);
  });

  it('searches name, subcategory label, subcategory code and brand, case-insensitively', () => {
    expect(filterItems(all, { ...DEFAULT_FILTER, query: 'NAVY' })).toEqual([tee]);
    expect(filterItems(all, { ...DEFAULT_FILTER, query: 'jean' })).toEqual([jeans]);
    expect(filterItems(all, { ...DEFAULT_FILTER, query: 'uniq' })).toEqual([tee]);
    expect(filterItems(all, { ...DEFAULT_FILTER, status: 'laundry', query: 'chelsea' })).toEqual([
      boots,
    ]);
    expect(filterItems(all, { ...DEFAULT_FILTER, query: 'zzz' })).toEqual([]);
  });

  it('requires every query word and ignores blank queries', () => {
    expect(filterItems(all, { ...DEFAULT_FILTER, query: 'navy uniqlo' })).toEqual([tee]);
    expect(filterItems(all, { ...DEFAULT_FILTER, query: 'navy jeans' })).toEqual([]);
    expect(filterItems(all, { ...DEFAULT_FILTER, query: '   ' })).toEqual([tee, jeans]);
  });

  it('combines filters', () => {
    expect(
      filterItems(all, { ...DEFAULT_FILTER, category: 'top', color: 'white', query: '' }),
    ).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = [...all];
    filterItems(all, DEFAULT_FILTER);
    expect(all).toEqual(copy);
  });
});

describe('sortItems', () => {
  const a = make({ name: 'banana', createdAt: '2026-01-01T00:00:00Z' });
  const b = make({ name: 'Apple', createdAt: '2026-03-01T00:00:00Z' });
  const c = make({ subcategory: 'polo', createdAt: '2026-02-01T00:00:00Z' });

  it('newest first', () => {
    expect(sortItems([a, b, c], 'newest')).toEqual([b, c, a]);
  });

  it('by display name, ignoring case', () => {
    expect(sortItems([a, b, c], 'name').map(itemDisplayName)).toEqual(['Apple', 'banana', 'Polo']);
  });

  it('returns a new array', () => {
    const input = [a, b];
    expect(sortItems(input, 'newest')).not.toBe(input);
    expect(input).toEqual([a, b]);
  });
});

describe('helpers', () => {
  it('itemDisplayName falls back to the subcategory label', () => {
    expect(itemDisplayName(make({ subcategory: 'polo' }))).toBe('Polo');
    expect(itemDisplayName(make({ name: '  ', subcategory: 'polo' }))).toBe('Polo');
    expect(itemDisplayName(make({ name: 'Work shirt' }))).toBe('Work shirt');
  });

  it('presentColors lists distinct colours, most common first', () => {
    const items = [make({ colors: white }), make({ colors: white }), make()];
    expect(presentColors(items).map((c) => c.name)).toEqual(['white', 'navy']);
    expect(presentColors([])).toEqual([]);
  });

  it('countByStatus and hasActiveFilters', () => {
    expect(countByStatus([make(), make({ status: 'laundry' })])).toEqual({
      active: 1,
      laundry: 1,
      archived: 0,
    });
    expect(hasActiveFilters(DEFAULT_FILTER)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTER, query: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTER, status: 'laundry' })).toBe(false);
  });
});
