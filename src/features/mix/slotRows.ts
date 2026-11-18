import { SLOT_CAPACITY, slotOf } from '@/core/model/slots';
import type { ID, Item, Slot } from '@/core/model/types';

/** One swipeable row on the Mix screen. */
export type RowKey = 'base' | 'mid' | 'bottom' | 'onepiece' | 'outer' | 'shoes' | 'accessories';

export interface RowDef {
  key: RowKey;
  /** Heading shown on the row. */
  label: string;
  /** Singular noun for prompts such as "No tops yet". */
  empty: string;
  slots: readonly Slot[];
  /** Rows an outfit normally needs; they get an "add one" prompt when the closet has none. */
  core: boolean;
}

/** Accessory slots, in drawing order of the row (legs = socks and tights). */
export const MIX_ACCESSORY_SLOTS: readonly Slot[] = [
  'belt',
  'bag',
  'head',
  'neck',
  'eyes',
  'wrist',
  'jewelry',
  'legs',
];

export const ROWS: readonly RowDef[] = [
  { key: 'base', label: 'Tops', empty: 'tops', slots: ['base'], core: true },
  { key: 'mid', label: 'Layers', empty: 'layers', slots: ['mid'], core: false },
  { key: 'bottom', label: 'Bottoms', empty: 'bottoms', slots: ['bottom'], core: true },
  { key: 'onepiece', label: 'One-pieces', empty: 'dresses', slots: ['onepiece'], core: false },
  { key: 'outer', label: 'Outerwear', empty: 'outerwear', slots: ['outer'], core: false },
  { key: 'shoes', label: 'Shoes', empty: 'shoes', slots: ['shoes'], core: true },
  {
    key: 'accessories',
    label: 'Accessories',
    empty: 'accessories',
    slots: MIX_ACCESSORY_SLOTS,
    core: false,
  },
];

export const ROW_KEYS: readonly RowKey[] = ROWS.map((r) => r.key);

const ROW_BY_KEY = new Map<RowKey, RowDef>(ROWS.map((r) => [r.key, r]));

export function rowDef(key: RowKey): RowDef {
  const def = ROW_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown row: ${key}`);
  return def;
}

export function rowOfSlot(slot: Slot): RowKey {
  const row = ROWS.find((r) => r.slots.includes(slot));
  if (!row) throw new Error(`Slot without a row: ${slot}`);
  return row.key;
}

export const rowOfItem = (item: Item): RowKey => rowOfSlot(slotOf(item));

/** Items belonging in a row. */
export function itemsInRow(items: readonly Item[], row: RowKey): Item[] {
  const { slots } = rowDef(row);
  return items.filter((i) => slots.includes(slotOf(i)));
}

/** The picked items of a row, in pick order. */
export const rowSelection = itemsInRow;

/** A dress or jumpsuit replaces the top and the bottom, and the other way round. */
const EXCLUDES: Readonly<Partial<Record<Slot, readonly Slot[]>>> = {
  onepiece: ['base', 'bottom'],
  base: ['onepiece'],
  bottom: ['onepiece'],
};

const withoutSlots = (selection: readonly Item[], slots: readonly Slot[]): Item[] =>
  selection.filter((i) => !slots.includes(slotOf(i)));

/**
 * Tap on an item in a row. A slot with room for one item takes the new item in place of the old;
 * tapping the picked item again takes it off. Slots with room for several (jewellery) toggle, and
 * when full the oldest piece makes room. A one-piece clears top and bottom; a top or bottom clears
 * the one-piece. Never mutates `selection`.
 */
export function toggleItem(selection: readonly Item[], item: Item): Item[] {
  const slot = slotOf(item);
  if (selection.some((i) => i.id === item.id)) {
    return selection.filter((i) => i.id !== item.id);
  }
  const capacity = SLOT_CAPACITY[slot];
  const base = withoutSlots(selection, EXCLUDES[slot] ?? []);
  const sameSlot = base.filter((i) => slotOf(i) === slot);
  if (sameSlot.length < capacity) return [...base, item];
  const drop = new Set(sameSlot.slice(0, sameSlot.length - capacity + 1).map((i) => i.id));
  return [...base.filter((i) => !drop.has(i.id)), item];
}

/** "None" on a row: remove everything the row holds. */
export function clearRow(selection: readonly Item[], row: RowKey): Item[] {
  return withoutSlots(selection, rowDef(row).slots);
}

/** Replace the contents of a row with exactly these items (shuffle uses it). */
export function setRow(selection: readonly Item[], row: RowKey, picks: readonly Item[]): Item[] {
  let next = clearRow(selection, row);
  for (const pick of picks) next = toggleItem(next, pick);
  return next;
}

export function selectionIds(selection: readonly Item[]): ID[] {
  return selection.map((i) => i.id);
}
