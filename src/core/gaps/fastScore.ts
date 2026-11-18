import { isNeutral } from '../color/classify';
import { entriesOf, harmonyOfEntries } from '../color/harmony';
import type { ColourEntry } from '../color/harmony';
import { hexToRgb, hueDistance, rgbToHsl } from '../color/hsl';
import { slotOf } from '../model/slots';
import type { Item, Metal, Pattern, Slot } from '../model/types';
import {
  BROWN_LEATHER_FAMILY,
  COMPONENT_WEIGHTS,
  COORDINATION_SCORES,
  FORMALITY_HIGH_LOW_SCORE,
  FORMALITY_HIGH_LOW_SPREAD,
  FORMALITY_SLOTS,
  FORMALITY_SPREAD_SCORES,
  HUE_FAMILY_DEGREES,
  PATTERN_SCORES,
  PATTERN_SLOTS,
} from '../engine/weights';
import { primaryColour } from '../engine/score/types';

/**
 * Fast path for gap analysis: `scoreOutfit(items, {occasion: 'any'}, {no wear logs, no taste})`.
 * With no weather, no history and occasion `any`, only the colour, formality, pattern and
 * coordination components can apply, so those are all that is computed. Each item's derived data
 * is computed once (`prepItem`); `fastTotal` then only combines it. Equality with `scoreOutfit` is
 * asserted by property tests (fastScore.test.ts), so keep the two in step.
 */
export interface Prep {
  item: Item;
  slot: Slot;
  formality: number;
  /** Counts toward the formality comparison. */
  inFormality: boolean;
  /** Patterned (not solid) item in a pattern slot; else undefined. */
  pattern: Pattern | undefined;
  patternBold: boolean;
  leather: boolean;
  metal: Metal | undefined;
  entries: readonly ColourEntry[];
  /** Primary colour name, or undefined when the item has no colour. */
  colourName: string | undefined;
  colourNeutral: boolean;
  colourHue: number;
}

export function prepItem(item: Item): Prep {
  const slot = slotOf(item);
  const primary = primaryColour(item);
  return {
    item,
    slot,
    formality: item.formality,
    inFormality: FORMALITY_SLOTS.includes(slot),
    pattern: PATTERN_SLOTS.includes(slot) && item.pattern !== 'solid' ? item.pattern : undefined,
    patternBold: item.patternBold,
    leather: item.material === 'leather' || item.material === 'suede',
    metal: item.metal,
    entries: entriesOf(item),
    colourName: primary?.name,
    colourNeutral: primary ? isNeutral(primary, item.material) : false,
    colourHue: primary ? rgbToHsl(hexToRgb(primary.hex)).h : 0,
  };
}

const sameLeatherFamily = (a: string, b: string): boolean =>
  a === b || (BROWN_LEATHER_FAMILY.includes(a) && BROWN_LEATHER_FAMILY.includes(b));

/** Mirror of the (private) `sameColourFamily` in score/coordination.ts. */
function sameFamily(a: Prep, b: Prep): boolean {
  if (a.colourName === undefined || b.colourName === undefined) return false;
  if (sameLeatherFamily(a.colourName, b.colourName)) return true;
  if (a.colourNeutral || b.colourNeutral) return false;
  return hueDistance(a.colourHue, b.colourHue) <= HUE_FAMILY_DEGREES;
}

const spreadOf = (values: readonly number[], skip = -1): number => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (i === skip) continue;
    const v = values[i] as number;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
};

function formalityValue(list: readonly Prep[]): number | null {
  const values: number[] = [];
  for (const p of list) if (p.inFormality) values.push(p.formality);
  if (values.length < 2) return null;
  const spread = spreadOf(values);
  if (spread === FORMALITY_HIGH_LOW_SPREAD) {
    let outliers = 0;
    for (let i = 0; i < values.length; i++) if (spreadOf(values, i) === 0) outliers++;
    if (outliers === 1) return FORMALITY_HIGH_LOW_SCORE;
  }
  return FORMALITY_SPREAD_SCORES[Math.min(spread, FORMALITY_SPREAD_SCORES.length - 1)] as number;
}

function patternValue(list: readonly Prep[]): number {
  let n = 0;
  let a: Prep | undefined;
  let b: Prep | undefined;
  for (const p of list) {
    if (p.pattern === undefined) continue;
    if (n === 0) a = p;
    else if (n === 1) b = p;
    n++;
  }
  if (n === 0) return PATTERN_SCORES.none;
  if (n === 1) return PATTERN_SCORES.one; // smart bonus never applies for occasion `any`
  if (n === 2 && a && b) {
    return a.pattern === b.pattern || (a.patternBold && b.patternBold)
      ? PATTERN_SCORES.twoSameOrBold
      : PATTERN_SCORES.twoDifferent;
  }
  return PATTERN_SCORES.threePlus;
}

function coordinationValue(list: readonly Prep[]): number | null {
  let belt: Prep | undefined;
  let shoes: Prep | undefined;
  let bag: Prep | undefined;
  let metal: Metal | undefined;
  let metalCount = 0;
  let metalsMatch = true;
  for (const p of list) {
    if (p.slot === 'belt' && !belt) belt = p;
    else if (p.slot === 'shoes' && !shoes) shoes = p;
    else if (p.slot === 'bag' && !bag) bag = p;
    if (p.metal !== undefined) {
      if (metalCount === 0) metal = p.metal;
      else if (p.metal !== metal) metalsMatch = false;
      metalCount++;
    }
  }
  let sum = 0;
  let count = 0;
  if (belt && shoes && belt.leather && shoes.leather) {
    const match =
      belt.colourName !== undefined &&
      shoes.colourName !== undefined &&
      belt.colourNeutral &&
      shoes.colourNeutral &&
      sameLeatherFamily(belt.colourName, shoes.colourName);
    sum += match ? COORDINATION_SCORES.leathersMatch : COORDINATION_SCORES.leathersClash;
    count++;
  }
  if (metalCount >= 2) {
    sum += metalsMatch ? COORDINATION_SCORES.metalsMatch : COORDINATION_SCORES.metalsMixed;
    count++;
  }
  if (bag) {
    const ok =
      bag.colourName !== undefined &&
      (bag.colourNeutral ||
        (!!shoes && sameFamily(bag, shoes)) ||
        (!!belt && sameFamily(bag, belt)));
    sum += ok ? COORDINATION_SCORES.bagMatch : COORDINATION_SCORES.bagClash;
    count++;
  }
  return count === 0 ? null : sum / count;
}

/** Same total as `scoreOutfit(items, {occasion: 'any'}, {wearLogs: [], taste: empty}).total`. */
export function fastTotal(list: readonly Prep[]): number {
  if (list.length === 0) return 0;
  const entries: ColourEntry[] = [];
  for (const p of list) for (const e of p.entries) entries.push(e);
  const colour = harmonyOfEntries(entries).value;
  const formality = formalityValue(list);
  const pattern = patternValue(list);
  const coordination = coordinationValue(list);

  // Same weight renormalisation and summation order as scoreOutfit (colour, formality, pattern, coordination).
  let totalWeight = COMPONENT_WEIGHTS.colour;
  if (formality !== null) totalWeight += COMPONENT_WEIGHTS.formality;
  totalWeight += COMPONENT_WEIGHTS.pattern;
  if (coordination !== null) totalWeight += COMPONENT_WEIGHTS.coordination;
  let weighted = (COMPONENT_WEIGHTS.colour / totalWeight) * colour;
  if (formality !== null) weighted += (COMPONENT_WEIGHTS.formality / totalWeight) * formality;
  weighted += (COMPONENT_WEIGHTS.pattern / totalWeight) * pattern;
  if (coordination !== null)
    weighted += (COMPONENT_WEIGHTS.coordination / totalWeight) * coordination;
  return 100 * Math.min(1, Math.max(0, (100 * weighted + 0) / 100));
}
