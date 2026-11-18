import type { TouchupOpener } from '../types';

/** A touch-up opener for tests: unavailable, like native. */
export function createFakeTouchupOpener(): TouchupOpener {
  return {
    available: false,
    open: () => Promise.reject(new Error('Touch-up is not available in tests')),
  };
}
