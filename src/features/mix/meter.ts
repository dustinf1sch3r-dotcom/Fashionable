import type { ScoreBreakdown, ScoreComponent } from '@/core/model/types';

/** Harmony bands (same cut-offs as the generator's "good outfit" bar): ≥ min gets the label. */
export const MATCH_BANDS = [
  { min: 90, label: 'Great match', tone: 'great' },
  { min: 85, label: 'Good match', tone: 'good' },
] as const;

export const FALLBACK_BAND = { label: 'Worth a try', tone: 'try' } as const;

export type MatchTone = 'great' | 'good' | 'try';

export function matchBand(total: number): { label: string; tone: MatchTone } {
  for (const band of MATCH_BANDS) if (total >= band.min) return band;
  return FALLBACK_BAND;
}

/** A component scoring below this counts as a weak spot worth naming. */
export const WEAK_BELOW = 0.8;
/** How many weak spots the meter names at most. */
export const MAX_WEAK_SPOTS = 3;

/** Plain-words complaint for each score component when it comes out low. */
export const WEAK_TEXT: Readonly<Record<ScoreComponent, string>> = {
  colour: 'Colours clash a bit',
  formality: 'Mixed dress levels',
  weather: "Not ideal for today's weather",
  pattern: 'Patterns compete',
  occasion: 'A stretch for the occasion',
  coordination: "Leathers, metals or bag don't match",
  freshness: 'Worn very recently',
  taste: 'Not quite your style',
};

export interface WeakSpot {
  component: ScoreComponent;
  text: string;
  value: number;
}

/** The weakest components (lowest first), only those actually low, at most `MAX_WEAK_SPOTS`. */
export function weakSpots(breakdown: ScoreBreakdown): WeakSpot[] {
  return (Object.entries(breakdown.components) as [ScoreComponent, { value: number }][])
    .filter(([, c]) => c.value < WEAK_BELOW)
    .sort((a, b) => a[1].value - b[1].value || a[0].localeCompare(b[0]))
    .slice(0, MAX_WEAK_SPOTS)
    .map(([component, c]) => ({ component, text: WEAK_TEXT[component], value: c.value }));
}
