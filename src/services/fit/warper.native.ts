import type { GarmentWarper } from '../types';

/** Native rendering needs a mesh-capable drawing library (later); until then garments stay rigid. */
export function createGarmentWarper(): GarmentWarper {
  return {
    available: false,
    async render() {
      throw new Error('Garment fitting is not available on this platform');
    },
  };
}
