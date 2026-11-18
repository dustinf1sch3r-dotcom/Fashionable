import { slotOf } from '../model/slots';
import type { Item, Slot } from '../model/types';
import { createRng } from '../engine/rng';
import { scoreOutfit } from '../engine/scoreOutfit';
import { buildTasteModel } from '../engine/taste';
import type { ScoreContext, ScoreHistory } from '../engine/scoreOutfit';
import { GAP_SCORE_DATE } from './weights';

export type CoreSlot = 'base' | 'bottom' | 'onepiece' | 'shoes';

const TEMPLATES: readonly (readonly CoreSlot[])[] = [
  ['base', 'bottom', 'shoes'],
  ['onepiece', 'shoes'],
];

export type CorePools = Record<CoreSlot, Item[]>;

export const SCORE_CONTEXT: ScoreContext = { date: GAP_SCORE_DATE, occasion: 'any' };
export const SCORE_HISTORY: ScoreHistory = { wearLogs: [], taste: buildTasteModel([], []) };

export const isCoreSlot = (s: Slot): s is CoreSlot =>
  s === 'base' || s === 'bottom' || s === 'onepiece' || s === 'shoes';

const byId = (a: Item, b: Item): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Active items grouped by core slot, sorted by id so enumeration order never depends on input order. */
export function corePools(items: readonly Item[]): CorePools {
  const pools: CorePools = { base: [], bottom: [], onepiece: [], shoes: [] };
  for (const item of items) {
    if (item.status !== 'active') continue;
    const slot = slotOf(item);
    if (isCoreSlot(slot)) pools[slot].push(item);
  }
  for (const k of Object.keys(pools) as CoreSlot[]) pools[k].sort(byId);
  return pools;
}

export interface Combos {
  /** Each combo in template slot order (base, bottom, shoes) or (onepiece, shoes). */
  combos: Item[][];
  /** Size of the full combo space. */
  total: number;
}

/** Distinct integers in [0,total), seeded. */
function sampleIndices(total: number, n: number, seed: number): number[] {
  const rng = createRng(seed);
  const seen = new Set<number>();
  while (seen.size < n) seen.add(rng.int(0, total - 1));
  return [...seen].sort((a, b) => a - b);
}

/**
 * Core combos of the pools; `fixed` pins a slot to given items (e.g. one archetype). Above `cap`
 * combos, `cap` of them are sampled with `seed`.
 */
export function enumerateCombos(
  pools: CorePools,
  fixed: Partial<Record<CoreSlot, readonly Item[]>>,
  cap: number,
  seed: number,
): Combos {
  const plans = TEMPLATES.filter((t) =>
    (Object.keys(fixed) as CoreSlot[]).every((s) => t.includes(s)),
  ).map((t) => ({
    slots: t,
    lists: t.map((s) => fixed[s] ?? pools[s]),
  }));
  const sizes = plans.map((p) => p.lists.reduce((n, l) => n * l.length, 1));
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total === 0) return { combos: [], total: 0 };
  const indices =
    total > cap ? sampleIndices(total, cap, seed) : Array.from({ length: total }, (_, i) => i);
  const combos: Item[][] = [];
  for (const index of indices) {
    let rest = index;
    for (let t = 0; t < plans.length; t++) {
      const size = sizes[t] as number;
      if (rest < size) {
        const lists = (plans[t] as (typeof plans)[number]).lists;
        const combo: Item[] = [];
        for (let k = lists.length - 1; k >= 0; k--) {
          const list = lists[k] as Item[];
          combo[k] = list[rest % list.length] as Item;
          rest = Math.floor(rest / list.length);
        }
        combos.push(combo);
        break;
      }
      rest -= size;
    }
  }
  return { combos, total };
}

/** Score of a core combo: `scoreOutfit` on the core pieces only, occasion `any`, no weather. */
export function scoreCore(combo: readonly Item[]): number {
  return scoreOutfit(combo, SCORE_CONTEXT, SCORE_HISTORY).total;
}
