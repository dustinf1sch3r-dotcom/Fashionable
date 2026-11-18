import type { TouchupOpener } from '../types';

/**
 * Platform dispatch: Metro/Expo resolve `./touchup` to `touchup.web.ts` on the web. This is the
 * fallback for native and for Jest: there is no touch-up editor there yet, so the entry points
 * are hidden.
 */
export function createTouchupOpener(): TouchupOpener {
  return {
    available: false,
    open: () => Promise.reject(new Error('Touch-up is not available on this platform yet')),
  };
}
