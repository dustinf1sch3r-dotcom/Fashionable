import { hexToRgb, rgbToHsl } from '../color/hsl';
import { NEUTRAL_COLOR_NAMES } from '../color/classify';
import { slotOf } from '../model/slots';
import type { Feedback, ID, Item } from '../model/types';
import type { ComponentResult } from './score/types';
import { primaryColour } from './score/types';
import {
  TASTE_ATTR_PAIR_MIX,
  TASTE_HUE_BUCKET_DEGREES,
  TASTE_ITEM_PAIR_MIX,
  TASTE_MATCH_MIN,
  TASTE_SIGMOID_SLOPE,
} from './weights';

/**
 * Affinity tables learnt from feedback (OUTFIT_ENGINE §7). Opaque to callers: build it with
 * `buildTasteModel`, read it with `scoreTaste` / `isDislikedSet`.
 */
export interface TasteModel {
  /** Number of distinct item sets with a verdict (0 → taste is skipped). */
  readonly feedbackCount: number;
  /** Unordered item-id pair → summed +1 (like) / −1 (dislike). */
  readonly itemPairs: ReadonlyMap<string, number>;
  /** Unordered `slot:colourFamily` pair → summed +1 / −1. */
  readonly attrPairs: ReadonlyMap<string, number>;
  /** Exact item-set key → latest verdict. */
  readonly setVerdicts: ReadonlyMap<string, Feedback['verdict']>;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SEP = '|';

/** Order-independent key for an item set (de-duplicated, sorted). */
function setKey(ids: readonly ID[]): string {
  return [...new Set(ids)].sort(cmp).join(SEP);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}${SEP}${b}` : `${b}${SEP}${a}`;
}

function* pairsOf<T>(list: readonly T[]): Generator<[T, T]> {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) yield [list[i] as T, list[j] as T];
  }
}

/**
 * Stable colour-family key of an item, from its largest-share colour:
 * - denim items → `denim`;
 * - neutral colour names (black, white, grey, navy, beige, brown, olive) → the name;
 * - any other colour → `hue<N>` where N is the start of its 30° hue bucket (`hue0` … `hue330`),
 *   from the swatch hex (a red at 356° is `hue330`, a green at 140° is `hue120`);
 * - no colours → `none`.
 */
export function colourFamily(item: Item): string {
  if (item.material === 'denim') return 'denim';
  const c = primaryColour(item);
  if (!c) return 'none';
  if (NEUTRAL_COLOR_NAMES.includes(c.name)) return c.name;
  const { h } = rgbToHsl(hexToRgb(c.hex));
  const bucket = Math.floor((((h % 360) + 360) % 360) / TASTE_HUE_BUCKET_DEGREES);
  return `hue${bucket * TASTE_HUE_BUCKET_DEGREES}`;
}

function attrKey(item: Item): string {
  return `${slotOf(item)}:${colourFamily(item)}`;
}

/**
 * Build the affinity tables. `items` supplies attributes for the attribute-pair table (feedback
 * ids not found in it only feed the item-pair table). Soft-deleted feedback is ignored. For each
 * exact item set the latest verdict (by `updatedAt`, then `id`) is the only one counted.
 */
export function buildTasteModel(feedback: readonly Feedback[], items: readonly Item[]): TasteModel {
  const ordered = feedback
    .filter((f) => f.deletedAt === undefined && f.itemIds.length > 0)
    .sort((a, b) => cmp(a.updatedAt, b.updatedAt) || cmp(a.id, b.id));

  const latest = new Map<string, { ids: ID[]; verdict: Feedback['verdict'] }>();
  for (const f of ordered) {
    const key = setKey(f.itemIds);
    latest.set(key, { ids: key.split(SEP), verdict: f.verdict });
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const itemPairs = new Map<string, number>();
  const attrPairs = new Map<string, number>();
  const setVerdicts = new Map<string, Feedback['verdict']>();
  const bump = (m: Map<string, number>, k: string, d: number): void => {
    m.set(k, (m.get(k) ?? 0) + d);
  };

  for (const [key, { ids, verdict }] of latest) {
    setVerdicts.set(key, verdict);
    const delta = verdict === 'like' ? 1 : -1;
    for (const [a, b] of pairsOf(ids)) bump(itemPairs, pairKey(a, b), delta);
    const known = ids.flatMap((id) => {
      const it = byId.get(id);
      return it ? [attrKey(it)] : [];
    });
    for (const [a, b] of pairsOf(known)) bump(attrPairs, pairKey(a, b), delta);
  }
  return { feedbackCount: latest.size, itemPairs, attrPairs, setVerdicts };
}

/** True when the exact item set (any order) was last judged a dislike. */
export function isDislikedSet(itemIds: readonly ID[], model: TasteModel): boolean {
  return model.setVerdicts.get(setKey(itemIds)) === 'dislike';
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-TASTE_SIGMOID_SLOPE * x));

function meanOver<T>(pairs: readonly [T, T][], f: (a: T, b: T) => number): number {
  return pairs.reduce((s, [a, b]) => s + f(a, b), 0) / pairs.length;
}

/**
 * Taste component: `sigmoid(0.6 · meanItemPair + 0.4 · meanAttrPair)` over the outfit's unordered
 * pairs. `null` (skipped) when there is no feedback, or the outfit has fewer than two items
 * (no pair to judge). Emits `TASTE_MATCH` at ≥ 0.6.
 */
export function scoreTaste(items: readonly Item[], model: TasteModel): ComponentResult | null {
  if (model.feedbackCount === 0 || items.length < 2) return null;
  const itemPairs = [...pairsOf(items)];
  const attrs = items.map(attrKey);
  const attrPairs = [...pairsOf(attrs)];
  const itemMean = meanOver(itemPairs, (a, b) => model.itemPairs.get(pairKey(a.id, b.id)) ?? 0);
  const attrMean = meanOver(attrPairs, (a, b) => model.attrPairs.get(pairKey(a, b)) ?? 0);
  const value = sigmoid(TASTE_ITEM_PAIR_MIX * itemMean + TASTE_ATTR_PAIR_MIX * attrMean);
  return { value, reasons: value >= TASTE_MATCH_MIN ? [{ code: 'TASTE_MATCH', params: {} }] : [] };
}
