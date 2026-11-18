import type { ColorName, Pattern, Reason, ReasonCode } from '@/core/model/types';
import { COLOR_LABELS, PATTERN_LABELS } from '../closet/labels';

/** What the wording needs to know about the world; keeps this file free of stores. */
export interface ReasonContext {
  /** Display name of an item in the outfit, if known. */
  itemName?: (itemId: string) => string | undefined;
}

type Params = Reason['params'];
type Writer = (p: Params, ctx: ReasonContext) => string;

const str = (v: string | number | undefined): string | undefined =>
  v === undefined || v === '' ? undefined : String(v);

const colourWord = (v: string | number | undefined): string => {
  const s = str(v);
  if (!s) return 'colour';
  return (COLOR_LABELS[s as ColorName] ?? s).toLowerCase();
};

const upperFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const patternWord = (v: string | number | undefined): string => {
  const s = str(v);
  return s ? (PATTERN_LABELS[s as Pattern] ?? s).toLowerCase() : 'pattern';
};

const nameOf = (p: Params, ctx: ReasonContext): string =>
  (str(p.itemId) ? ctx.itemName?.(String(p.itemId)) : undefined) ?? 'One piece';

const SUITED_BY_BAND: Record<string, string> = {
  hot: 'Light and airy for a hot day',
  warm: 'Comfortable for a warm day',
  mild: 'Just right for a mild day',
  cool: 'Warm enough for a cool day',
  cold: 'Properly wrapped up for the cold',
};

const TOO_WARM_BANDS = ['hot', 'warm'];
const TOO_LIGHT_BANDS = ['cool', 'cold'];

/** Plain-language sentence for every reason code (OUTFIT_ENGINE §1: wording lives in the UI). */
const WRITERS: Record<ReasonCode, Writer> = {
  COLOR_NEUTRAL_BASE: () => 'Easy neutrals that go with everything',
  COLOR_ACCENT_POP: (p) => `A pop of ${colourWord(p.accent)} against ${colourWord(p.neutral)}`,
  COLOR_MONOCHROME: (p) => `A tonal ${colourWord(p.accent)} look`,
  COLOR_COMPLEMENTARY: (p) =>
    `${upperFirst(colourWord(p.a))} and ${colourWord(p.b)} are a classic opposite pair`,
  COLOR_ANALOGOUS: (p) =>
    `${upperFirst(colourWord(p.a))} and ${colourWord(p.b)} sit side by side on the colour wheel`,
  COLOR_TRIADIC: (p) =>
    `${upperFirst(colourWord(p.a))} and ${colourWord(p.b)} make a lively, balanced mix`,
  COLOR_CLASH: (p) =>
    str(p.a) && str(p.b)
      ? `${upperFirst(colourWord(p.a))} and ${colourWord(p.b)} are a bold, clashing mix`
      : 'A bold colour mix that may clash',
  FORMALITY_COHESIVE: () => 'Every piece is dressed to the same level',
  FORMALITY_HIGH_LOW: () => 'A smart piece dressed down — on purpose',
  FORMALITY_MISMATCH: () => 'The pieces sit at quite different dress levels',
  PATTERN_STATEMENT: (p) =>
    `One bold pattern (${patternWord(p.pattern)}) leads, the rest stays plain`,
  PATTERN_BUSY: (p) =>
    Number(p.count) > 1
      ? `${Number(p.count)} patterns at once make a busy look`
      : 'A busy pattern mix',
  WEATHER_SUITED: (p) => SUITED_BY_BAND[String(p.band)] ?? 'Suits today’s weather',
  WEATHER_RAIN_READY: () => 'Ready for rain — nothing here minds a shower',
  WEATHER_UNSUITED: (p, ctx) => {
    const name = nameOf(p, ctx);
    const band = String(p.band);
    if (TOO_WARM_BANDS.includes(band)) return `${name} is too warm for today`;
    if (TOO_LIGHT_BANDS.includes(band)) return `${name} is too light for today`;
    return `${name} isn’t ideal for today’s weather`;
  },
  MISSING_LAYER: () => 'Bring a layer — it’s cold out',
  LEATHERS_MATCH: (p) => `Belt and shoes match in ${colourWord(p.colour)}`,
  METALS_MATCH: (p) =>
    str(p.metal) && p.metal !== 'mixed'
      ? `Matching ${String(p.metal)} metals`
      : 'Your metals match',
  FRESH_COMBINATION: () => 'A fresh combination you haven’t worn lately',
  TASTE_MATCH: () => 'Close to outfits you’ve liked before',
  PINNED_OVERRIDE: (p, ctx) =>
    `${nameOf(p, ctx)} stays in because you picked it, even if it’s not today’s usual choice`,
};

export function reasonText(reason: Reason, ctx: ReasonContext = {}): string {
  return WRITERS[reason.code](reason.params, ctx);
}

/** `note` reasons are cautions the user should read; they carry an icon, never colour alone. */
export type ReasonTone = 'good' | 'note';

export interface ReasonLine {
  code: ReasonCode;
  text: string;
  tone: ReasonTone;
}

/** Display order: cautions first (they change what you wear), then the good news, then soft negatives. */
const PRIORITY: readonly ReasonCode[] = [
  'MISSING_LAYER',
  'WEATHER_UNSUITED',
  'PINNED_OVERRIDE',
  'WEATHER_SUITED',
  'WEATHER_RAIN_READY',
  'COLOR_COMPLEMENTARY',
  'COLOR_ACCENT_POP',
  'COLOR_MONOCHROME',
  'COLOR_ANALOGOUS',
  'COLOR_TRIADIC',
  'COLOR_NEUTRAL_BASE',
  'FORMALITY_HIGH_LOW',
  'FORMALITY_COHESIVE',
  'TASTE_MATCH',
  'FRESH_COMBINATION',
  'LEATHERS_MATCH',
  'METALS_MATCH',
  'PATTERN_STATEMENT',
  'COLOR_CLASH',
  'FORMALITY_MISMATCH',
  'PATTERN_BUSY',
];

const NOTES: ReadonlySet<ReasonCode> = new Set([
  'MISSING_LAYER',
  'WEATHER_UNSUITED',
  'PINNED_OVERRIDE',
  'COLOR_CLASH',
  'FORMALITY_MISMATCH',
  'PATTERN_BUSY',
]);

export const MAX_REASONS = 3;

/** The few reasons worth showing, in display order, de-duplicated by wording. */
export function topReasons(
  reasons: readonly Reason[],
  ctx: ReasonContext = {},
  max: number = MAX_REASONS,
): ReasonLine[] {
  const rank = (c: ReasonCode) => PRIORITY.indexOf(c);
  const seen = new Set<string>();
  const out: ReasonLine[] = [];
  for (const r of [...reasons].sort((a, b) => rank(a.code) - rank(b.code))) {
    const text = reasonText(r, ctx);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push({ code: r.code, text, tone: NOTES.has(r.code) ? 'note' : 'good' });
    if (out.length === max) break;
  }
  return out;
}
