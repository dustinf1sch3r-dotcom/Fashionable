import type { BackgroundRemover } from '../types';

/**
 * Platform dispatch: Metro/Expo resolve `./cutout` to `cutout.web.ts` or `cutout.native.ts`
 * first. This file is the fallback for environments with neither (plain Node, Jest): no remover.
 */
export function createBackgroundRemover(): BackgroundRemover {
  return {
    available: false,
    prepare: () => Promise.reject(new Error('Background removal is not available here')),
    remove: () => Promise.reject(new Error('Background removal is not available here')),
  };
}
