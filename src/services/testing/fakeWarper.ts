import type { GarmentWarper } from '../types';

/** Returns a placeholder image covering the mesh bounds, and records each call. */
export function createFakeGarmentWarper(): GarmentWarper & { calls: number } {
  return {
    available: true,
    calls: 0,
    async render(cutoutUri, mesh) {
      this.calls += 1;
      return { uri: `fake-warp://${cutoutUri}`, bounds: mesh.bounds };
    },
  };
}
