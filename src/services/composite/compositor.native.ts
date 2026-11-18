import type { OutfitCompositor } from '../types';

/** Native compositing needs a pixel-capable drawing library (later); until then outfits stay layered. */
export function createOutfitCompositor(): OutfitCompositor {
  return {
    available: false,
    async compose() {
      throw new Error('Compositing is not available on this platform');
    },
  };
}
