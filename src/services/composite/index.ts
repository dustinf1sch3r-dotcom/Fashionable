import type { OutfitCompositor } from '../types';

/** Outfit compositor (docs/TRY_ON.md §13.2). CONTRACT ONLY until ticket C2: unavailable. */
export function createOutfitCompositor(): OutfitCompositor {
  return {
    available: false,
    async compose() {
      throw new Error('Compositing is not available yet (ticket C2)');
    },
  };
}
