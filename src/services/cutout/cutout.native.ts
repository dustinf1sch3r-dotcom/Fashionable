import type { BackgroundRemover } from '../types';

/**
 * Native builds have no remover yet: items keep the original photo with `hasAlpha: false`.
 * Planned (docs/ARCHITECTURE.md, "Background removal - decision"): Apple Vision subject lifting
 * on iOS and ML Kit Subject Segmentation on Android, each behind a small Expo native module.
 */
export function createBackgroundRemover(): BackgroundRemover {
  const unavailable = () => Promise.reject(new Error('Background removal is not available here'));
  return { available: false, prepare: unavailable, remove: unavailable };
}
