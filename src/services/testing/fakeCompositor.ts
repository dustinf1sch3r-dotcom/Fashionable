import type { OutfitCompositor } from '../types';

/** Returns a placeholder merged image and counts calls. */
export function createFakeOutfitCompositor(): OutfitCompositor & { calls: number } {
  return {
    available: true,
    calls: 0,
    async compose(input) {
      this.calls += 1;
      return { uri: `fake-composite://${input.kind}/${input.layers.length}` };
    },
  };
}
