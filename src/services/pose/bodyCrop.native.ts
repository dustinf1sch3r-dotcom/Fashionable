import type { BodyPhotoCropper } from '../types';

/** Native builds: not implemented yet (the web build crops with a canvas). */
export function createBodyPhotoCropper(): BodyPhotoCropper {
  return {
    available: false,
    crop: () => Promise.reject(new Error('Body photo cropping is not available here')),
  };
}
