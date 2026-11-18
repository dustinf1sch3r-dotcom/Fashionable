import { assessCapture, rigKindOf, type AlphaMask, type CaptureProblem } from '@/core/fit';
import type { Category } from '@/core/model/types';

/** Friendly advice per capture problem (docs/TRY_ON.md §8). Never blocking: the photo is kept. */
export const CAPTURE_HINTS: Record<CaptureProblem, string> = {
  'cut-off': 'The garment looks cut off — for the best fit, photograph the whole piece laid flat.',
  'several-pieces':
    'There seem to be other clothes (or a rail) in this photo — for the best fit, photograph one piece on its own.',
  folded:
    'This looks folded or hung in half — for the best fit, lay it flat and opened out, with the whole piece in view.',
  unclear:
    'We could not read this garment’s outline well, so it will keep a simple fit. A plain background and the whole piece laid flat work best.',
};

/** Trousers have their own wording for "folded": the legs have to show. */
export const BOTTOM_FOLDED_HINT =
  'The legs are not showing apart — for the best fit, lay the trousers flat with the legs a little apart.';

/**
 * The hint to show for a fresh cutout, or `undefined` when it looks fine (or cannot be judged).
 * `category` and `subcategory` are what the form says now, so changing them updates the advice.
 */
export function captureHintFor(
  mask: AlphaMask | undefined,
  category: Category,
  subcategory: string,
): string | undefined {
  if (!mask) return undefined;
  let kind;
  try {
    kind = rigKindOf({ category, subcategory });
  } catch {
    kind = undefined;
  }
  const [first] = assessCapture(mask, kind);
  if (!first) return undefined;
  if (first === 'folded' && (kind === 'trousers' || kind === 'jumpsuit')) {
    return BOTTOM_FOLDED_HINT;
  }
  return CAPTURE_HINTS[first];
}
