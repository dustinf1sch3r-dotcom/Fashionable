import { hexToRgb, hueDistance, rgbToHsl } from '../color/hsl';
import { isNeutral } from '../color/classify';
import { primaryColour } from '../engine/score/types';
import { HUE_FAMILY_DEGREES } from '../engine/weights';
import type { Item } from '../model/types';
import type { Archetype } from './archetypes';

/** Same neutral colour name, or both accents with hues within `HUE_FAMILY_DEGREES`. */
export function sameColourFamily(a: Item, b: Item): boolean {
  const ca = primaryColour(a);
  const cb = primaryColour(b);
  if (!ca || !cb) return false;
  const na = isNeutral(ca, a.material);
  const nb = isNeutral(cb, b.material);
  if (na !== nb) return false;
  if (na) return ca.name === cb.name;
  return (
    hueDistance(rgbToHsl(hexToRgb(ca.hex)).h, rgbToHsl(hexToRgb(cb.hex)).h) <= HUE_FAMILY_DEGREES
  );
}

/** Covered: an active closet item with the archetype's subcategory and colour family. */
export function isCovered(archetype: Archetype, items: readonly Item[]): boolean {
  const a = archetype.item;
  return items.some(
    (i) =>
      i.status === 'active' &&
      i.category === a.category &&
      i.subcategory === a.subcategory &&
      sameColourFamily(i, a),
  );
}
