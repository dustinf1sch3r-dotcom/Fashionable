import type { GarmentWarper } from '../types';

/**
 * Platform dispatch: Metro/Expo resolve `./warper` to `warper.web.ts` or `warper.native.ts` first.
 * This file is the fallback for environments with neither (plain Node, Jest): no renderer, so the
 * Mannequin keeps rigid placement (docs/TRY_ON.md §12.5).
 */
export function createGarmentWarper(): GarmentWarper {
  return {
    available: false,
    async render() {
      throw new Error('Garment fitting is not available on this platform');
    },
  };
}
