import type { PixelData, PixelReader } from '../types';

/** Returns `data` for every image (or `undefined`, like the native reader). */
export function createFakePixelReader(data?: PixelData): PixelReader {
  return { read: async () => data };
}
