import { slotOf } from '../model/slots';
import { subcategoryDefaults } from '../model/taxonomy';
import type {
  Feedback,
  ID,
  ISODate,
  Item,
  Occasion,
  OutfitSuggestion,
  Reason,
  ScoreBreakdown,
  Slot,
  Weather,
  WearLog,
} from '../model/types';
import { createRng } from './rng';
import type { Rng } from './rng';
import { scoreOutfit } from './scoreOutfit';
import { buildTasteModel, isDislikedSet } from './taste';
import { scoreCoordination } from './score/coordination';
import { daysBetween } from './score/freshness';
import { scoreFormality } from './score/formality';
import { scorePattern } from './score/pattern';
import { isItemAllowedForOccasion, occasionSkipsSlot, scoreOccasion } from './score/occasion';
import { isItemAllowedInWeather, missingLayers, scoreWeather, weatherBand } from './score/weather';
import {
  ACCESSORY_SLOTS,
  ADD_ON_MIN_GAIN,
  CORE_PRESCORE_KEEP,
  CORE_PRESCORE_THRESHOLD,
  DRESS_UP_CANDIDATES_PER_SLOT,
  DRESS_UP_EVAL_BUDGET,
  DRESS_UP_MIN_COMBOS,
  MAX_ACCESSORY_SLOTS,
  WARM_WEATHER_MIN_FEELS_LIKE_C,
  BEAM_WIDTH,
  COMPONENT_WEIGHTS,
  DEFAULT_OUTFIT_COUNT,
  DRESS_UP_SLOT_ORDER,
  FRESHNESS_WINDOW_DAYS,
  MAX_CORE_COMBOS,
  MMR_LAMBDA,
} from './weights';

/** Input of `generateOutfits` (OUTFIT_ENGINE §1). */
export interface GenerateInput {
  /** The whole closet; inactive items are filtered here. */
  items: readonly Item[];
  wearLogs: readonly WearLog[];
  feedback: readonly Feedback[];
  context: {
    date: ISODate;
    occasion: Occasion;
    /** Omitted → weather component and weather rules are skipped. */
    weather?: Weather;
    /** Must appear in every result; never filtered out. */
    pinnedItemIds?: readonly ID[];
    excludeItemIds?: readonly ID[];
  };
  /** How many outfits to return (default `DEFAULT_OUTFIT_COUNT`). */
  count?: number;
  seed: number;
}

export interface GenerateDiagnostics {
  /** Set when no core template could be filled (`ClosetTooSmall`): the slots to add items for. */
  missingSlots?: Slot[];
  /** Number of core combos that were scored. */
  consideredCombos: number;
  /** True when the core product exceeded `MAX_CORE_COMBOS` and was sampled. */
  sampled: boolean;
}

export interface GenerateResult {
  suggestions: OutfitSuggestion[];
  diagnostics: GenerateDiagnostics;
}

const SEPARATES: readonly Slot[] = ['base', 'bottom', 'shoes'];
const ONEPIECE: readonly Slot[] = ['onepiece', 'shoes'];
const JEWELRY_CAPACITY = 3;

const setKey = (items: readonly Item[]): string =>
  items
    .map((i) => i.id)
    .sort()
    .join('|');

function jaccard(a: ReadonlySet<ID>, b: ReadonlySet<ID>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Freshness only looks at worn logs up to `date`, and only logs inside the window can change the
 * score (older ones give the same factor as "never worn"). Pruning once keeps every outfit
 * evaluation cheap for users with long histories; one older log stays so "has history" holds.
 */
function relevantLogs(logs: readonly WearLog[], date: ISODate): WearLog[] {
  const worn = logs.filter((l) => !l.planned && daysBetween(l.date, date) >= 0);
  const inWindow = worn.filter((l) => daysBetween(l.date, date) <= FRESHNESS_WINDOW_DAYS);
  if (inWindow.length > 0 || worn.length === 0) return inWindow;
  return [worn.reduce((a, b) => (a.date >= b.date ? a : b))];
}

/** Picks `n` distinct integers in `[0, total)` uniformly, in ascending order of draw. */
function sampleIndices(total: number, n: number, rng: Rng): number[] {
  if (total <= 4 * n) {
    const all = Array.from({ length: total }, (_, i) => i);
    for (let i = 0; i < n; i++) {
      const j = rng.int(i, total - 1);
      [all[i], all[j]] = [all[j] as number, all[i] as number];
    }
    return all.slice(0, n);
  }
  const seen = new Set<number>();
  const out: number[] = [];
  while (out.length < n) {
    const k = rng.int(0, total - 1);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/**
 * Generate ranked outfit suggestions (OUTFIT_ENGINE §3): eligibility → core combos (sampled
 * above `MAX_CORE_COMBOS`) → beam → dress-up → re-score → MMR diversification. Pure and
 * deterministic: the seed shuffles the candidate pools once, which resolves every tie, and
 * drives the sampling of oversized products.
 *
 * Decisions where the spec is silent: an excluded id wins over a pin; pins that are unknown ids
 * are ignored; pins that cannot coexist (two in one single-capacity slot, more than 3 jewelry,
 * a onepiece with a base/bottom) yield no outfits and no `missingSlots`; a pinned item is kept
 * whatever its status, and is placed even in a slot the occasion or weather would skip.
 */
export function generateOutfits(input: GenerateInput): GenerateResult {
  const { context } = input;
  const count = input.count ?? DEFAULT_OUTFIT_COUNT;
  const rng = createRng(input.seed);
  const weather = context.weather;
  const scoreContext = { date: context.date, occasion: context.occasion, weather };
  const taste = buildTasteModel(input.feedback, input.items);
  const history = {
    wearLogs: relevantLogs(input.wearLogs, context.date),
    feedback: input.feedback,
    taste,
  };

  const slotCache = new Map<ID, Slot>();
  const slotFor = (item: Item): Slot => {
    let s = slotCache.get(item.id);
    if (!s) {
      s = slotOf(item);
      slotCache.set(item.id, s);
    }
    return s;
  };

  const scoreCache = new Map<string, ScoreBreakdown>();
  let evaluations = 0;
  const scoreOf = (items: readonly Item[]): ScoreBreakdown => {
    const key = setKey(items);
    let b = scoreCache.get(key);
    if (!b) {
      evaluations++;
      b = scoreOutfit(items, scoreContext, history);
      scoreCache.set(key, b);
    }
    return b;
  };

  // ── 1. Eligibility ────────────────────────────────────────────────────────────────────────
  const excluded = new Set(context.excludeItemIds ?? []);
  const pinnedIds = new Set((context.pinnedItemIds ?? []).filter((id) => !excluded.has(id)));
  const pinned = input.items.filter((i) => pinnedIds.has(i.id));
  const pinnedOverrides: Reason[] = [];
  for (const item of pinned) {
    if (
      !isItemAllowedForOccasion(item, context.occasion) ||
      !isItemAllowedInWeather(item, weather)
    ) {
      pinnedOverrides.push({ code: 'PINNED_OVERRIDE', params: { itemId: item.id } });
    }
  }

  const pools = new Map<Slot, Item[]>();
  const pinnedBySlot = new Map<Slot, Item[]>();
  for (const item of pinned) {
    const s = slotFor(item);
    pinnedBySlot.set(s, [...(pinnedBySlot.get(s) ?? []), item]);
  }
  for (const item of input.items) {
    if (pinnedIds.has(item.id)) continue;
    if (
      item.status !== 'active' ||
      excluded.has(item.id) ||
      !isItemAllowedForOccasion(item, context.occasion) ||
      !isItemAllowedInWeather(item, weather)
    ) {
      continue;
    }
    const s = slotFor(item);
    const pool = pools.get(s);
    if (pool) pool.push(item);
    else pools.set(s, [item]);
  }
  // Seeded shuffle: pool order decides every tie later on.
  for (const [s, pool] of pools) pools.set(s, rng.shuffle(pool));
  const poolOf = (slot: Slot): readonly Item[] => pinnedBySlot.get(slot) ?? pools.get(slot) ?? [];

  const finish = (
    suggestions: OutfitSuggestion[],
    consideredCombos: number,
    sampled: boolean,
    missingSlots?: Slot[],
  ): GenerateResult => ({
    suggestions,
    diagnostics: { ...(missingSlots ? { missingSlots } : {}), consideredCombos, sampled },
  });

  const pinConflict =
    [...pinnedBySlot].some(([s, list]) => list.length > (s === 'jewelry' ? JEWELRY_CAPACITY : 1)) ||
    (pinnedBySlot.has('onepiece') && (pinnedBySlot.has('base') || pinnedBySlot.has('bottom')));
  if (pinConflict) return finish([], 0, false);

  // ── 2. Core combos ────────────────────────────────────────────────────────────────────────
  const templates = [SEPARATES, ONEPIECE].filter((t) =>
    t === ONEPIECE
      ? !pinnedBySlot.has('base') && !pinnedBySlot.has('bottom')
      : !pinnedBySlot.has('onepiece'),
  );
  const sizes = templates.map((t) => t.reduce((n, s) => n * poolOf(s).length, 1));
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const missing = templates
      .map((t) => t.filter((s) => poolOf(s).length === 0))
      .reduce((best, m) => (m.length < best.length ? m : best));
    return finish([], 0, false, [...missing]);
  }

  const sampled = total > MAX_CORE_COMBOS;
  const indices = sampled
    ? sampleIndices(total, MAX_CORE_COMBOS, rng)
    : Array.from({ length: total }, (_, i) => i);
  const coreAt = (index: number): Item[] => {
    let rest = index;
    for (let t = 0; t < templates.length; t++) {
      const size = sizes[t] as number;
      if (rest < size) {
        const slots = templates[t] as readonly Slot[];
        const out: Item[] = [];
        for (let k = slots.length - 1; k >= 0; k--) {
          const pool = poolOf(slots[k] as Slot);
          out[k] = pool[rest % pool.length] as Item;
          rest = Math.floor(rest / pool.length);
        }
        return out;
      }
      rest -= size;
    }
    return [];
  };

  // ── 3. Score cores, keep the beam ─────────────────────────────────────────────────────────
  // Colour is the expensive component; on big products rank cheaply without it first.
  const cheapScore = (core: readonly Item[]): number => {
    const parts: [number, number | undefined][] = [
      [COMPONENT_WEIGHTS.formality, scoreFormality(core)?.value],
      [COMPONENT_WEIGHTS.weather, scoreWeather(core, weather)?.value],
      [COMPONENT_WEIGHTS.pattern, scorePattern(core, context.occasion)?.value],
      [COMPONENT_WEIGHTS.occasion, scoreOccasion(core, context.occasion)?.value],
      [COMPONENT_WEIGHTS.coordination, scoreCoordination(core)?.value],
    ];
    let w = 0;
    let v = 0;
    for (const [weight, value] of parts) {
      if (value === undefined) continue;
      w += weight;
      v += weight * value;
    }
    return w === 0 ? 0 : v / w;
  };
  let cores = indices.map(coreAt);
  if (cores.length > CORE_PRESCORE_THRESHOLD) {
    cores = cores
      .map((core) => ({ core, cheap: cheapScore(core) }))
      .sort((a, b) => b.cheap - a.cheap)
      .slice(0, CORE_PRESCORE_KEEP)
      .map((x) => x.core);
  }
  const scored = cores.map((core) => ({ core, score: scoreOf(core).total }));
  scored.sort((a, b) => b.score - a.score); // stable: ties keep seeded enumeration order
  const beam = scored.slice(0, BEAM_WIDTH);

  // ── 4. Dress up ───────────────────────────────────────────────────────────────────────────
  const band = weather ? weatherBand(weather) : undefined;
  const slotsWithCandidates = new Set<Slot>(DRESS_UP_SLOT_ORDER.filter((s) => poolOf(s).length));

  const best = (
    items: readonly Item[],
    candidates: readonly Item[],
  ): { item: Item; score: number } | undefined => {
    let top: { item: Item; score: number } | undefined;
    for (const c of candidates) {
      const score = scoreOf([...items, c]).total;
      if (!top || score > top.score) top = { item: c, score };
    }
    return top;
  };

  const windowOf = (list: readonly Item[], rank: number): readonly Item[] =>
    list.length <= DRESS_UP_CANDIDATES_PER_SLOT
      ? list
      : Array.from(
          { length: DRESS_UP_CANDIDATES_PER_SLOT },
          (_, k) => list[(rank * DRESS_UP_CANDIDATES_PER_SLOT + k) % list.length] as Item,
        );

  const dressUp = (core: readonly Item[], rank: number): Item[] => {
    let items: Item[] = [...core];
    const bottom = items.find((i) => slotFor(i) === 'bottom');
    const beltOk =
      bottom !== undefined &&
      subcategoryDefaults(bottom.category, bottom.subcategory)?.beltCompatible === true;

    // Optional accessory slots in use; pinned ones count towards the cap.
    const accessorySlots = new Set<Slot>(ACCESSORY_SLOTS.filter((a) => pinnedBySlot.has(a)));

    DRESS_UP_SLOT_ORDER.forEach((slot, order) => {
      const forced = pinnedBySlot.get(slot);
      if (forced) {
        items = [...items, ...forced];
        if (slot !== 'jewelry') return;
      } else if (occasionSkipsSlot(context.occasion, slot)) {
        return;
      }
      if (slot === 'belt' && !beltOk) return;
      const isAccessory = ACCESSORY_SLOTS.includes(slot);
      if (isAccessory && !accessorySlots.has(slot) && accessorySlots.size >= MAX_ACCESSORY_SLOTS) {
        return;
      }
      const pool = slot === 'jewelry' ? (pools.get(slot) ?? []) : poolOf(slot);
      if (pool.length === 0) return;

      if (slot === 'jewelry') {
        while (items.filter((i) => slotFor(i) === 'jewelry').length < JEWELRY_CAPACITY) {
          const candidates = pool.filter((c) => !items.includes(c));
          const pick = best(items, windowOf(candidates, rank));
          if (!pick || pick.score - scoreOf(items).total < ADD_ON_MIN_GAIN) break;
          items = [...items, pick.item];
          accessorySlots.add(slot);
        }
        return;
      }

      // Required by weather: an unmet group containing this slot, and no later slot of the
      // group has candidates (so "mid or outer" prefers outer by gain, then falls back to mid).
      let required = false;
      if (weather && band) {
        required = missingLayers(items, weather).some(
          (g) =>
            g.includes(slot) &&
            !g.some((s) => DRESS_UP_SLOT_ORDER.indexOf(s) > order && slotsWithCandidates.has(s)),
        );
      }
      if (required) {
        const minWarmth = slot === 'outer' ? band?.requiredOuterMinWarmth : undefined;
        const reqPool = minWarmth === undefined ? pool : pool.filter((c) => c.warmth >= minWarmth);
        const pick = best(items, windowOf(reqPool, rank));
        if (pick) {
          items = [...items, pick.item];
          return;
        }
      }
      // Warm weather never gets an optional mid.
      if (slot === 'mid' && weather && weather.feelsLikeC >= WARM_WEATHER_MIN_FEELS_LIKE_C) return;
      const pick = best(items, windowOf(pool, rank));
      if (pick && pick.score - scoreOf(items).total >= ADD_ON_MIN_GAIN) {
        items = [...items, pick.item];
        if (isAccessory) accessorySlots.add(slot);
      }
    });
    return items;
  };

  // ── 5. Re-score ──────────────────────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const candidates: { items: Item[]; ids: ReadonlySet<ID>; score: number }[] = [];
  const evaluationsBeforeDressUp = evaluations;
  for (const [rank, { core }] of beam.entries()) {
    if (
      candidates.length >= DRESS_UP_MIN_COMBOS &&
      evaluations - evaluationsBeforeDressUp >= DRESS_UP_EVAL_BUDGET
    ) {
      break;
    }
    const items = dressUp(core, rank);
    const key = setKey(items);
    if (
      seen.has(key) ||
      isDislikedSet(
        items.map((i) => i.id),
        taste,
      )
    )
      continue;
    seen.add(key);
    candidates.push({ items, ids: new Set(items.map((i) => i.id)), score: scoreOf(items).total });
  }
  candidates.sort((a, b) => b.score - a.score);

  // ── 6. Diversify (MMR) ────────────────────────────────────────────────────────────────────
  const picked: typeof candidates = [];
  const remaining = [...candidates];
  while (picked.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestValue = -Infinity;
    remaining.forEach((c, idx) => {
      let maxSim = 0;
      for (const p of picked) maxSim = Math.max(maxSim, jaccard(c.ids, p.ids));
      const value = MMR_LAMBDA * c.score - (1 - MMR_LAMBDA) * 100 * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = idx;
      }
    });
    picked.push(remaining.splice(bestIdx, 1)[0] as (typeof candidates)[number]);
  }

  const suggestions = picked.map((c): OutfitSuggestion => {
    const breakdown = scoreOf(c.items);
    const overrides = pinnedOverrides.filter((r) => c.ids.has(String(r.params.itemId)));
    return {
      itemIds: c.items.map((i) => i.id),
      score: breakdown.total,
      breakdown,
      reasons: [...breakdown.reasons, ...overrides],
    };
  });
  return finish(suggestions, indices.length, sampled);
}
