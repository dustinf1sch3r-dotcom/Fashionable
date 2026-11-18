import { scoreOutfit } from '../engine/scoreOutfit';
import { ADD_ON_MIN_GAIN, GOOD_OUTFIT_THRESHOLD, MAX_CORE_COMBOS } from '../engine/weights';
import { subcategoryDefaults } from '../model/taxonomy';
import { slotOf } from '../model/slots';
import type { ID, Item } from '../model/types';
import { ARCHETYPES } from './archetypes';
import {
  SCORE_CONTEXT,
  SCORE_HISTORY,
  corePools,
  enumerateCombos,
  isCoreSlot,
  scoreCore,
} from './combos';
import type { CorePools, CoreSlot } from './combos';
import { isCovered } from './coverage';
import {
  DEFAULT_GAP_SEED,
  MAX_ADDON_BASELINE_COMBOS,
  MAX_ADDON_COMBOS,
  MAX_ADDON_SUGGESTIONS,
  MAX_ARCHETYPE_COMBOS,
  MAX_GAP_SUGGESTIONS,
  ORPHAN_HELP_MAX,
  ORPHAN_MIN_GOOD_OUTFITS,
} from './weights';

export interface GapSuggestion {
  archetypeId: string;
  /** `core`: a base, bottom, one-piece or shoes piece. `addon`: outer, mid, belt, bag or accessory. */
  kind: 'core' | 'addon';
  /** Core only (else 0): extra good core combos the archetype would make possible (scaled when sampled). */
  unlockedCount: number;
  /** Add-on only (else 0): good core combos whose score the add-on raises by at least `ADD_ON_MIN_GAIN`. */
  improvedCount: number;
  /** Best-scoring good combo with the archetype: closet item ids plus `archetype:<id>`. */
  exampleOutfitItemIds: ID[];
}

export interface GapOptions {
  /** Seeds the sampling of combo spaces larger than the caps. Default `DEFAULT_GAP_SEED`. */
  seed?: number;
}

export interface OrphanReport {
  itemId: ID;
  goodOutfitCount: number;
  /** Up to `ORPHAN_HELP_MAX` archetype ids that lift this item's good-outfit count the most. */
  wouldHelp: string[];
}

/**
 * Archetypes the closet lacks, ranked by how many good core combos each would add (OUTFIT_ENGINE
 * §8). Adding one item never removes combos, so `with − without` is exactly the number of good
 * combos containing the archetype. Only archetypes in a core slot (base, bottom, one-piece,
 * shoes) can form core combos; other archetypes never rank.
 */
export function findGaps(items: readonly Item[], opts: GapOptions = {}): GapSuggestion[] {
  const seed = opts.seed ?? DEFAULT_GAP_SEED;
  const pools = corePools(items);
  const out: (GapSuggestion & { meanGoodScore: number })[] = [];
  const addons = addonGaps(items, pools, seed);
  for (const archetype of ARCHETYPES) {
    const slot = slotOf(archetype.item);
    if (!isCoreSlot(slot) || isCovered(archetype, items)) continue;
    const { combos, total } = enumerateCombos(
      pools,
      { [slot]: [archetype.item] },
      MAX_ARCHETYPE_COMBOS,
      seed,
    );
    let good = 0;
    let goodSum = 0;
    let best: Item[] | undefined;
    let bestScore = -1;
    for (const combo of combos) {
      const score = scoreCore(combo);
      if (score < GOOD_OUTFIT_THRESHOLD) continue;
      good++;
      goodSum += score;
      if (score > bestScore) {
        bestScore = score;
        best = combo;
      }
    }
    if (!best) continue;
    out.push({
      archetypeId: archetype.archetypeId,
      kind: 'core',
      unlockedCount: Math.round((good * total) / combos.length),
      improvedCount: 0,
      exampleOutfitItemIds: best.map((i) => i.id),
      meanGoodScore: goodSum / good,
    });
  }
  // Ties on the count are common in small closets; prefer the archetype whose combos score
  // higher, then fall back to the id so the order is total.
  out.sort(
    (a, b) =>
      b.unlockedCount - a.unlockedCount ||
      b.meanGoodScore - a.meanGoodScore ||
      (a.archetypeId < b.archetypeId ? -1 : a.archetypeId > b.archetypeId ? 1 : 0),
  );
  const core = out
    .slice(0, MAX_GAP_SUGGESTIONS)
    .map(({ meanGoodScore: _m, ...suggestion }) => suggestion);
  return [...core, ...addons];
}

/**
 * Add-on archetypes (outer, mid, belt, bag, neck, head, eyes, wrist, jewelry, legs) ranked by the
 * number of good core combos they improve by at least `ADD_ON_MIN_GAIN`. Belts only go with
 * belt-compatible bottoms; no weather, occasion `any`.
 */
function addonGaps(items: readonly Item[], pools: CorePools, seed: number): GapSuggestion[] {
  const { combos } = enumerateCombos(pools, {}, MAX_ADDON_BASELINE_COMBOS, seed);
  const scored = combos.map((combo) => ({ combo, score: scoreCore(combo) }));
  const goodCombos = scored.filter((c) => c.score >= GOOD_OUTFIT_THRESHOLD);
  if (goodCombos.length === 0) return [];
  const step = Math.max(1, goodCombos.length / MAX_ADDON_COMBOS);
  const tried: typeof goodCombos = [];
  for (let k = 0; k < goodCombos.length; k += step)
    tried.push(goodCombos[Math.floor(k)] as (typeof goodCombos)[number]);

  const out: (GapSuggestion & { meanGain: number })[] = [];
  for (const archetype of ARCHETYPES) {
    const slot = slotOf(archetype.item);
    if (isCoreSlot(slot) || isCovered(archetype, items)) continue;
    let improved = 0;
    let gainSum = 0;
    let best: Item[] | undefined;
    let bestGain = 0;
    for (const { combo, score } of tried) {
      if (slot === 'belt' && !beltCompatible(combo)) continue;
      const gain =
        scoreOutfit([...combo, archetype.item], SCORE_CONTEXT, SCORE_HISTORY).total - score;
      if (gain < ADD_ON_MIN_GAIN) continue;
      improved++;
      gainSum += gain;
      if (gain > bestGain) {
        bestGain = gain;
        best = combo;
      }
    }
    if (!best) continue;
    out.push({
      archetypeId: archetype.archetypeId,
      kind: 'addon',
      unlockedCount: 0,
      improvedCount: Math.round((improved * goodCombos.length) / tried.length),
      exampleOutfitItemIds: [...best.map((i) => i.id), archetype.item.id],
      meanGain: gainSum / improved,
    });
  }
  out.sort(
    (a, b) =>
      b.improvedCount - a.improvedCount ||
      b.meanGain - a.meanGain ||
      (a.archetypeId < b.archetypeId ? -1 : a.archetypeId > b.archetypeId ? 1 : 0),
  );
  return out.slice(0, MAX_ADDON_SUGGESTIONS).map(({ meanGain: _g, ...suggestion }) => suggestion);
}

function beltCompatible(combo: readonly Item[]): boolean {
  const bottom = combo.find((i) => slotOf(i) === 'bottom');
  return !!bottom && subcategoryDefaults('bottom', bottom.subcategory)?.beltCompatible === true;
}

/**
 * Active main-slot items in fewer than `ORPHAN_MIN_GOOD_OUTFITS` good core combos. Counts are
 * exact when the closet has at most `MAX_CORE_COMBOS` combos; otherwise sampled and scaled.
 */
export function findOrphans(items: readonly Item[], opts: GapOptions = {}): OrphanReport[] {
  const seed = opts.seed ?? DEFAULT_GAP_SEED;
  const pools = corePools(items);
  const { combos, total } = enumerateCombos(pools, {}, MAX_CORE_COMBOS, seed);
  const scale = combos.length === 0 ? 0 : total / combos.length;
  const good = new Map<ID, number>();
  for (const combo of combos) {
    if (scoreCore(combo) < GOOD_OUTFIT_THRESHOLD) continue;
    for (const i of combo) good.set(i.id, (good.get(i.id) ?? 0) + 1);
  }

  const orphans: OrphanReport[] = [];
  const candidates = [...pools.base, ...pools.bottom, ...pools.onepiece, ...pools.shoes];
  for (const item of candidates) {
    const count = Math.round((good.get(item.id) ?? 0) * scale);
    if (count >= ORPHAN_MIN_GOOD_OUTFITS) continue;
    orphans.push({
      itemId: item.id,
      goodOutfitCount: count,
      wouldHelp: wouldHelp(item, items, pools, seed),
    });
  }
  return orphans.sort(
    (a, b) =>
      a.goodOutfitCount - b.goodOutfitCount ||
      (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0),
  );
}

function wouldHelp(item: Item, items: readonly Item[], pools: CorePools, seed: number): string[] {
  const itemSlot = slotOf(item) as CoreSlot;
  const lifts: { id: string; count: number }[] = [];
  for (const archetype of ARCHETYPES) {
    const slot = slotOf(archetype.item);
    if (!isCoreSlot(slot) || slot === itemSlot || isCovered(archetype, items)) continue;
    const { combos, total } = enumerateCombos(
      pools,
      { [itemSlot]: [item], [slot]: [archetype.item] },
      MAX_ARCHETYPE_COMBOS,
      seed,
    );
    if (combos.length === 0) continue;
    const good = combos.filter((c) => scoreCore(c) >= GOOD_OUTFIT_THRESHOLD).length;
    if (good > 0)
      lifts.push({ id: archetype.archetypeId, count: Math.round((good * total) / combos.length) });
  }
  lifts.sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
  return lifts.slice(0, ORPHAN_HELP_MAX).map((l) => l.id);
}
