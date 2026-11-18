import { slotOf } from '../../model/slots';
import type { Item } from '../../model/types';
import {
  FORMALITY_COHESIVE_MAX_SPREAD,
  FORMALITY_HIGH_LOW_SCORE,
  FORMALITY_HIGH_LOW_SPREAD,
  FORMALITY_SLOTS,
  FORMALITY_SPREAD_SCORES,
} from '../weights';
import { itemsInSlots } from './types';
import type { ComponentResult } from './types';

const spreadOf = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);

/**
 * Formality cohesion (OUTFIT_ENGINE §4.2).
 *
 * Interpretations:
 * - Fewer than two garments in the compared slots → `null` (nothing to compare).
 * - "Exactly one outlier" = removing exactly one item brings the spread to 0 (e.g. 4,2,2 or
 *   2,4,4). With only two items both qualify, so two-item outfits are never high-low.
 */
export function scoreFormality(items: readonly Item[]): ComponentResult | null {
  const pieces = itemsInSlots(items, FORMALITY_SLOTS);
  if (pieces.length < 2) return null;
  const values = pieces.map((i) => i.formality);
  const spread = spreadOf(values);

  if (spread === FORMALITY_HIGH_LOW_SPREAD) {
    const outliers = values.filter((_, idx) => spreadOf(values.filter((__, j) => j !== idx)) === 0);
    if (outliers.length === 1) {
      const outlier = pieces.find((_, idx) => spreadOf(values.filter((__, j) => j !== idx)) === 0);
      return {
        value: FORMALITY_HIGH_LOW_SCORE,
        reasons: [
          {
            code: 'FORMALITY_HIGH_LOW',
            params: { slot: outlier ? slotOf(outlier) : '', spread },
          },
        ],
      };
    }
  }

  const index = Math.min(spread, FORMALITY_SPREAD_SCORES.length - 1);
  const value = FORMALITY_SPREAD_SCORES[index];
  return {
    value,
    reasons: [
      {
        code: spread <= FORMALITY_COHESIVE_MAX_SPREAD ? 'FORMALITY_COHESIVE' : 'FORMALITY_MISMATCH',
        params: { spread },
      },
    ],
  };
}
