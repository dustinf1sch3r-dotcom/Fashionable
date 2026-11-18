import { slotOf } from '../model/slots';
import type { ColorName, Item, Reason, Slot } from '../model/types';
import { isNeutral, meanHue, hueFamilies } from './classify';
import { hexToRgb, hueDistance, rgbToHsl } from './hsl';
import type { Hsl } from './hsl';

export interface ColourEntry extends Hsl {
  hex: string;
  name: ColorName;
  neutral: boolean;
  slot: Slot;
  primary: boolean;
  material: Item['material'];
}

const IGNORED_SLOTS: readonly Slot[] = ['jewelry', 'wrist', 'eyes'];
const LARGE_SLOTS: readonly Slot[] = ['base', 'bottom', 'onepiece', 'outer'];
const MAIN_PIECE_SLOTS: readonly Slot[] = ['base', 'mid', 'bottom', 'onepiece', 'outer'];
const ECHO_SLOTS: readonly Slot[] = ['shoes', 'belt', 'bag'];
const SECONDARY_MIN_SHARE = 0.25;

/** Visible colours of one item (primary, plus a secondary of at least 25% share); none for ignored slots. */
export function entriesOf(item: Item): ColourEntry[] {
  const slot = slotOf(item);
  if (IGNORED_SLOTS.includes(slot) || item.colors.length === 0) return [];
  // Largest share first regardless of the stored order (first wins ties).
  const sorted = item.colors
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.share - a.c.share || a.i - b.i)
    .map((x) => x.c);
  const chosen = [sorted[0]];
  if (sorted[1] && sorted[1].share >= SECONDARY_MIN_SHARE) chosen.push(sorted[1]);
  return chosen.map((c, idx) => ({
    ...rgbToHsl(hexToRgb(c.hex)),
    hex: c.hex,
    name: c.name,
    neutral: isNeutral(c, item.material),
    slot,
    primary: idx === 0,
    material: item.material,
  }));
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Colour harmony score (OUTFIT_ENGINE §4.1).
 *
 * Interpretations where the spec is open:
 * - No visible colours at all: treated as "only neutrals" (0.80, COLOR_NEUTRAL_BASE).
 * - Hue families are single-linkage (see `hueFamilies`); a family's hue is the circular mean.
 * - Two-family hue-distance bands are read as continuous: (30,60], [105,135], [150,180]; gaps
 *   fall into "anything else" (0.45).
 * - Table rows ignore neutrals when counting families; two families with neutrals use the same row.
 * - Lightness spread (monochrome) is max-min lightness over all accent colours counted.
 * - Adjustment 1 compares the primary colours of base/bottom/onepiece/outer pieces (needs >= 2).
 * - Adjustment 2 compares every pair of counted accent colours (max sat - min sat >= 0.5).
 * - Adjustment 3 uses primary colours of the `base` top and the `bottom`; both must be neutral
 *   with the same colour name and lightness < 0.08 apart. "Black-on-black" = name black; a
 *   "matching set" = identical hex, both exempt.
 * - Adjustment 4: main pieces = base/mid/bottom/onepiece/outer; an accent colour on shoes, belt or
 *   bag echoes if it shares a hue family with an accent colour on a main piece.
 */
export function colourHarmony(items: Item[]): { value: number; reason: Reason } {
  return harmonyOfEntries(items.flatMap(entriesOf));
}

/** The scoring half of `colourHarmony`, for callers that cache each item's `entriesOf`. */
export function harmonyOfEntries(entries: readonly ColourEntry[]): {
  value: number;
  reason: Reason;
} {
  const accents = entries.filter((e) => !e.neutral);
  const neutrals = entries.filter((e) => e.neutral);
  const families = hueFamilies(accents);
  const familyHues = families.map((f) => meanHue(f.map((a) => a.h)));

  let value: number;
  let reason: Reason;

  if (families.length === 0) {
    value = 0.8;
    reason = {
      code: 'COLOR_NEUTRAL_BASE',
      params: { neutral: neutrals[0]?.name ?? 'neutral' },
    };
  } else if (families.length === 1) {
    const accent = families[0][0].name;
    if (neutrals.length > 0) {
      value = 0.92;
      reason = { code: 'COLOR_ACCENT_POP', params: { accent, neutral: neutrals[0].name } };
    } else {
      const ls = accents.map((a) => a.l);
      value = Math.max(...ls) - Math.min(...ls) >= 0.15 ? 0.9 : 0.7;
      reason = { code: 'COLOR_MONOCHROME', params: { accent } };
    }
  } else if (families.length === 2) {
    const d = hueDistance(familyHues[0], familyHues[1]);
    const params = { a: families[0][0].name, b: families[1][0].name };
    if (d >= 150) {
      value = 0.82;
      reason = { code: 'COLOR_COMPLEMENTARY', params };
    } else if (d >= 105 && d <= 135) {
      value = 0.68;
      reason = { code: 'COLOR_TRIADIC', params };
    } else if (d > 30 && d <= 60) {
      value = 0.75;
      reason = { code: 'COLOR_ANALOGOUS', params };
    } else {
      value = 0.45;
      reason = { code: 'COLOR_CLASH', params };
    }
  } else {
    value = 0.2;
    reason = {
      code: 'COLOR_CLASH',
      params: {
        count: families.length,
        a: families[0][0].name,
        b: families[1][0].name,
        c: families[2][0].name,
      },
    };
  }

  // 1. Contrast between lightest and darkest large piece.
  const large = entries.filter((e) => e.primary && LARGE_SLOTS.includes(e.slot));
  if (large.length >= 2) {
    const ls = large.map((e) => e.l);
    if (Math.max(...ls) - Math.min(...ls) >= 0.35) value += 0.05;
  }

  // 2. Neon next to pastel.
  if (accents.length >= 2) {
    const ss = accents.map((e) => e.s);
    if (Math.max(...ss) - Math.min(...ss) >= 0.5) value -= 0.15;
  }

  // 3. Near-miss neutral top and bottom.
  const top = entries.find((e) => e.primary && e.slot === 'base');
  const bottom = entries.find((e) => e.primary && e.slot === 'bottom');
  if (
    top &&
    bottom &&
    top.neutral &&
    bottom.neutral &&
    top.name === bottom.name &&
    top.name !== 'black' &&
    top.hex !== bottom.hex &&
    Math.abs(top.l - bottom.l) < 0.08
  ) {
    value -= 0.1;
  }

  // 4. Colour echo from shoes / belt / bag.
  const echo = families.some(
    (f) =>
      f.some((a) => ECHO_SLOTS.includes(a.slot)) &&
      f.some((a) => MAIN_PIECE_SLOTS.includes(a.slot)),
  );
  if (echo) value += 0.05;

  return { value: clamp01(value), reason };
}
