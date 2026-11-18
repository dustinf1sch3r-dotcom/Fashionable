import type { ImageStore } from '../types';
import type { ImageStoreDeps } from './imageStoreShared';

export type { ImageStore } from '../types';
export type { ImageStoreDeps } from './imageStoreShared';

/**
 * Platform dispatch: Metro/Expo resolve `./imageStore` to `imageStore.web.ts` or
 * `imageStore.native.ts` first. This file is the type-level contract and the fallback for
 * environments with neither (e.g. plain Node), where no real store exists.
 */
export function createImageStore(_deps?: ImageStoreDeps): ImageStore {
  throw new Error('No ImageStore implementation for this platform; use createMemoryImageStore.');
}
