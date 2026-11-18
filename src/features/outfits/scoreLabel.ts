/** Score bands (0–100) shown to the user instead of a number. Highest band first. */
export const SCORE_BANDS: readonly { min: number; label: string }[] = [
  { min: 90, label: 'Great match' },
  { min: 85, label: 'Good match' },
];

export const SCORE_FALLBACK_LABEL = 'Worth a try';

export function scoreLabel(score: number): string {
  return SCORE_BANDS.find((b) => score >= b.min)?.label ?? SCORE_FALLBACK_LABEL;
}
