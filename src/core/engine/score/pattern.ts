import type { Item, Occasion } from '../../model/types';
import { PATTERN_SCORES, PATTERN_SLOTS, PATTERN_SMART_BONUS } from '../weights';
import { clamp01, itemsInSlots } from './types';
import type { ComponentResult } from './types';

/**
 * Pattern balance (OUTFIT_ENGINE §4.3). Always applies.
 *
 * Interpretations:
 * - "2, different types, at most one bold" → 0.70; two bold pieces are 0.35 even if the types differ.
 * - The `smart` +0.05 bonus is added to the 1-patterned-piece score and then clamped to 1, so
 *   with the default table it cannot raise the value (the spec's 1.00 is already the ceiling).
 */
export function scorePattern(items: readonly Item[], occasion: Occasion = 'any'): ComponentResult {
  const patterned = itemsInSlots(items, PATTERN_SLOTS).filter((i) => i.pattern !== 'solid');
  const n = patterned.length;

  if (n === 0) return { value: PATTERN_SCORES.none, reasons: [] };

  if (n === 1) {
    const bonus = occasion === 'smart' ? PATTERN_SMART_BONUS : 0;
    return {
      value: clamp01(PATTERN_SCORES.one + bonus),
      reasons: [{ code: 'PATTERN_STATEMENT', params: { pattern: patterned[0].pattern } }],
    };
  }

  if (n === 2) {
    const [a, b] = patterned;
    const sameType = a.pattern === b.pattern;
    const bothBold = a.patternBold && b.patternBold;
    if (sameType || bothBold) {
      return {
        value: PATTERN_SCORES.twoSameOrBold,
        reasons: [{ code: 'PATTERN_BUSY', params: { count: 2 } }],
      };
    }
    return { value: PATTERN_SCORES.twoDifferent, reasons: [] };
  }

  return {
    value: PATTERN_SCORES.threePlus,
    reasons: [{ code: 'PATTERN_BUSY', params: { count: n } }],
  };
}
