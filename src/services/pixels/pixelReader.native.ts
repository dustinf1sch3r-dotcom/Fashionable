import type { PixelReader } from '../types';

export type { PixelData, PixelReader } from '../types';

/**
 * TODO(M3-1): decode a small PNG in JavaScript (ARCHITECTURE.md, "Image pipeline") so native
 * builds get colour detection too. Until then it reports "no pixels" and callers fall back to
 * letting the user pick the colour by hand.
 */
export function createPixelReader(): PixelReader {
  return { read: async () => undefined };
}
