import { createRng, type Rng } from '@/core/engine/rng';
import type { Item, Slot } from '@/core/model/types';
import {
  clearRow,
  itemsInRow,
  MIX_ACCESSORY_SLOTS,
  rowSelection,
  setRow,
  toggleItem,
  type RowKey,
} from './slotRows';
import { slotOf } from '@/core/model/slots';

/** Random candidates tried per row; the best-scoring one wins, so a shuffle is clever, not blind. */
export const SHUFFLE_CANDIDATES = 4;
/** Chance of trying a one-piece rather than top + bottom when both are possible. */
export const SHUFFLE_ONEPIECE_CHANCE = 0.3;
/** At most this many accessory slots are filled by one shuffle candidate. */
export const SHUFFLE_MAX_ACCESSORIES = 2;

/** Rows are filled core pieces first, so that add-ons are judged against them. */
const SHUFFLE_ORDER: readonly RowKey[] = [
  'onepiece',
  'base',
  'bottom',
  'shoes',
  'mid',
  'outer',
  'accessories',
];
/** Rows that may end up empty after a shuffle. */
const OPTIONAL_ROWS: readonly RowKey[] = ['mid', 'outer'];

export interface ShuffleInput {
  /** Everything that may be picked (active items). */
  pool: readonly Item[];
  selection: readonly Item[];
  locked: ReadonlySet<RowKey>;
  /** Rows to shuffle; locked ones are skipped. */
  rows: readonly RowKey[];
  seed: number;
  /** Harmony of a whole outfit, higher is better. */
  score: (items: readonly Item[]) => number;
}

function best(options: readonly (readonly Item[])[], score: ShuffleInput['score']): Item[] | null {
  let top: readonly Item[] | null = null;
  let topScore = -Infinity;
  for (const option of options) {
    const s = score(option);
    if (s > topScore) {
      top = option;
      topScore = s;
    }
  }
  return top ? [...top] : null;
}

function accessoryCandidate(
  selection: readonly Item[],
  pool: readonly Item[],
  rng: Rng,
): Item[] | null {
  const bySlot = new Map<Slot, Item[]>();
  for (const item of itemsInRow(pool, 'accessories')) {
    const slot = slotOf(item);
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), item]);
  }
  const slots = MIX_ACCESSORY_SLOTS.filter((s) => bySlot.has(s));
  if (slots.length === 0) return null;
  const count = rng.int(1, Math.min(SHUFFLE_MAX_ACCESSORIES, slots.length));
  let next = clearRow(selection, 'accessories');
  for (const slot of rng.shuffle(slots).slice(0, count)) {
    next = toggleItem(next, rng.pick(bySlot.get(slot) ?? []));
  }
  return next;
}

/**
 * Shuffle the unlocked rows. For each row a few random candidates are tried against the rest of
 * the outfit and the one with the best `score` is kept; the item already there is not offered
 * again (so the row visibly changes) and optional rows may come out empty. A one-piece only
 * competes with top + bottom when neither of those is locked with something in it. Same seed,
 * same inputs → same result; `selection` is not mutated.
 */
export function shuffleRows(input: ShuffleInput): Item[] {
  const { pool, locked, score } = input;
  const rng = createRng(input.seed);
  let current: Item[] = [...input.selection];
  const targets = new Set<RowKey>(input.rows.filter((r) => !locked.has(r)));
  const lockedFilled = (row: RowKey): boolean =>
    locked.has(row) && rowSelection(current, row).length > 0;
  const available = (row: RowKey): boolean => itemsInRow(pool, row).length > 0;

  const dressPossible =
    targets.has('onepiece') &&
    available('onepiece') &&
    !lockedFilled('base') &&
    !lockedFilled('bottom');
  const separatesPossible =
    !lockedFilled('onepiece') &&
    ((targets.has('base') && available('base')) || (targets.has('bottom') && available('bottom')));
  if (dressPossible && separatesPossible) {
    if (rng.next() < SHUFFLE_ONEPIECE_CHANCE) {
      targets.delete('base');
      targets.delete('bottom');
    } else {
      targets.delete('onepiece');
    }
  } else if (dressPossible) {
    targets.delete('base');
    targets.delete('bottom');
  } else {
    targets.delete('onepiece');
  }
  if (lockedFilled('onepiece')) {
    targets.delete('base');
    targets.delete('bottom');
  }

  for (const row of SHUFFLE_ORDER) {
    if (!targets.has(row)) continue;
    if (row === 'accessories') {
      const options: Item[][] = [];
      for (let i = 0; i < SHUFFLE_CANDIDATES; i++) {
        const c = accessoryCandidate(current, pool, rng);
        if (c) options.push(c);
      }
      const pick = best(options, score);
      if (pick) current = pick;
      continue;
    }
    const here = rowSelection(current, row)[0];
    const choices: (Item | null)[] = itemsInRow(pool, row).filter((i) => i.id !== here?.id);
    if (OPTIONAL_ROWS.includes(row) && here) choices.push(null);
    if (choices.length === 0) continue;
    const tried = rng.shuffle(choices).slice(0, SHUFFLE_CANDIDATES);
    const picked = best(
      tried.map((c) => setRow(current, row, c ? [c] : [])),
      score,
    );
    if (picked) current = picked;
  }
  return current;
}
