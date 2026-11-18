import type { BackgroundRemover, CutoutResult } from '../types';

/** Resolves `result` for every image, or reports "unavailable" when none is given. */
export function createFakeBackgroundRemover(result?: CutoutResult): BackgroundRemover {
  return {
    available: result !== undefined,
    prepare: async () => undefined,
    remove: async () => {
      if (!result) throw new Error('fake background remover: no result configured');
      return result;
    },
  };
}
