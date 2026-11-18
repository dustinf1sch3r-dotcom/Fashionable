import type { PixelReader } from '../types';

export type { PixelData, PixelReader } from '../types';

/**
 * Native stays "no pixels" for now (cutouts there come later via Apple Vision / ML Kit). Later: decode a small PNG in JavaScript (ARCHITECTURE.md, "Image pipeline") so native
 * builds get colour detection too. Until then it reports "no pixels" and callers fall back to
 * letting the user pick the colour by hand.
 */
export function createPixelReader(): PixelReader {
  return { read: async () => undefined };
}
