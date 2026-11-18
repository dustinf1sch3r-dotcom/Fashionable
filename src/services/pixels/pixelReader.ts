import type { PixelReader } from '../types';

export type { PixelData, PixelReader } from '../types';

/**
 * Platform dispatch: Metro/Expo resolve `./pixelReader` to `pixelReader.web.ts` or
 * `pixelReader.native.ts` first. This file is the fallback for environments with neither (plain
 * Node, Jest): it cannot decode images, so it reports "no pixels" like the native reader.
 */
export function createPixelReader(): PixelReader {
  return { read: async () => undefined };
}
