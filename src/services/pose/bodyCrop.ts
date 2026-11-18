import type { BodyPhotoCropper } from '../types';

/** Fallback for environments with neither `.web.ts` nor `.native.ts` (plain Node): unavailable. */
export function createBodyPhotoCropper(): BodyPhotoCropper {
  return {
    available: false,
    crop: () => Promise.reject(new Error('Body photo cropping is not available here')),
  };
}
