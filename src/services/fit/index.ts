import type { GarmentWarper } from '../types';

/**
 * Garment mesh renderer (docs/TRY_ON.md §12.5). CONTRACT ONLY until ticket G2: reports
 * `available: false`, so the Mannequin keeps rigid placement.
 */
export function createGarmentWarper(): GarmentWarper {
  return {
    available: false,
    async render() {
      throw new Error('Garment fitting is not available yet (ticket G2)');
    },
  };
}
