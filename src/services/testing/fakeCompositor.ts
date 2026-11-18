import type { OutfitCompositor } from '../types';

type ComposeInput = Parameters<OutfitCompositor['compose']>[0];

/** Returns a unique placeholder merged image per call; records the calls and what was released. */
export function createFakeOutfitCompositor(): OutfitCompositor & {
  calls: number;
  inputs: ComposeInput[];
  released: string[];
} {
  return {
    available: true,
    calls: 0,
    inputs: [],
    released: [],
    async compose(input) {
      this.calls += 1;
      this.inputs.push(input);
      return { uri: `fake-composite://${input.kind}/${input.layers.length}/${this.calls}` };
    },
    release(uri) {
      this.released.push(uri);
    },
  };
}
