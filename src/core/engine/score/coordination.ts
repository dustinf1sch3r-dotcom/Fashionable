import { hexToRgb, hueDistance, rgbToHsl } from '../../color/hsl';
import { isNeutral } from '../../color/classify';
import { slotOf } from '../../model/slots';
import type { Item, Reason } from '../../model/types';
import { BROWN_LEATHER_FAMILY, COORDINATION_SCORES, HUE_FAMILY_DEGREES } from '../weights';
import { mean, primaryColour } from './types';
import type { ComponentResult } from './types';

const isLeather = (i: Item): boolean => i.material === 'leather' || i.material === 'suede';

function sameLeatherFamily(a: string, b: string): boolean {
  return a === b || (BROWN_LEATHER_FAMILY.includes(a) && BROWN_LEATHER_FAMILY.includes(b));
}

/** Same colour name, same brown family, or accents within one hue family. */
function sameColourFamily(a: Item, b: Item): boolean {
  const ca = primaryColour(a);
  const cb = primaryColour(b);
  if (!ca || !cb) return false;
  if (sameLeatherFamily(ca.name, cb.name)) return true;
  if (isNeutral(ca, a.material) || isNeutral(cb, b.material)) return false;
  return (
    hueDistance(rgbToHsl(hexToRgb(ca.hex)).h, rgbToHsl(hexToRgb(cb.hex)).h) <= HUE_FAMILY_DEGREES
  );
}

/**
 * Coordination of leathers, metals and bag (OUTFIT_ENGINE §4.4). Average of the applicable checks;
 * `null` when none apply.
 *
 * Interpretations:
 * - Leathers: need belt and shoes both leather/suede. "Same neutral family" = identical colour
 *   name or both in the brown family (brown/beige, since tan swatches are named brown or beige);
 *   a non-neutral pair (red with red) is not a neutral family → 0.3.
 * - Metals: applies only when at least two items carry a metal; `mixed` is its own value.
 * - Bag: applies when a bag exists. Matches if neutral, or same colour family as shoes or belt.
 */
export function scoreCoordination(items: readonly Item[]): ComponentResult | null {
  const bySlot = (s: string): Item | undefined => items.find((i) => slotOf(i) === s);
  const belt = bySlot('belt');
  const shoes = bySlot('shoes');
  const bag = bySlot('bag');
  const scores: number[] = [];
  const reasons: Reason[] = [];

  if (belt && shoes && isLeather(belt) && isLeather(shoes)) {
    const cb = primaryColour(belt);
    const cs = primaryColour(shoes);
    const match =
      !!cb &&
      !!cs &&
      isNeutral(cb, belt.material) &&
      isNeutral(cs, shoes.material) &&
      sameLeatherFamily(cb.name, cs.name);
    scores.push(match ? COORDINATION_SCORES.leathersMatch : COORDINATION_SCORES.leathersClash);
    if (match && cb) reasons.push({ code: 'LEATHERS_MATCH', params: { colour: cb.name } });
  }

  const metals = items.flatMap((i) => (i.metal ? [i.metal] : []));
  if (metals.length >= 2) {
    const match = metals.every((m) => m === metals[0]);
    scores.push(match ? COORDINATION_SCORES.metalsMatch : COORDINATION_SCORES.metalsMixed);
    if (match) reasons.push({ code: 'METALS_MATCH', params: { metal: metals[0] } });
  }

  if (bag) {
    const cbag = primaryColour(bag);
    const ok =
      !!cbag &&
      (isNeutral(cbag, bag.material) ||
        (!!shoes && sameColourFamily(bag, shoes)) ||
        (!!belt && sameColourFamily(bag, belt)));
    scores.push(ok ? COORDINATION_SCORES.bagMatch : COORDINATION_SCORES.bagClash);
  }

  if (scores.length === 0) return null;
  return { value: mean(scores), reasons };
}
