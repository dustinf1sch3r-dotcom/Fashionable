import type { OutfitCompositor } from '../types';

/**
 * Platform dispatch: Metro/Expo resolve `./compositor` to `compositor.web.ts` or
 * `compositor.native.ts` first. This file is the fallback for environments with neither (plain
 * Node, Jest): no compositor, so the Mannequin keeps showing the layered picture.
 */
export function createOutfitCompositor(): OutfitCompositor {
  return {
    available: false,
    async compose() {
      throw new Error('Compositing is not available on this platform');
    },
  };
}
