import type { PoseKeypoint } from '@/core/tryon/pose';

import type { BodyPhotoCropper, PoseDetector } from '../types';

/** Detector that returns the keypoints it was given (or nobody), for tests. */
export function createFakePoseDetector(
  result: { keypoints: PoseKeypoint[]; width: number; height: number } | undefined = undefined,
): PoseDetector & { result: typeof result } {
  return {
    available: true,
    result,
    async prepare(onProgress) {
      onProgress?.(1);
    },
    async detect() {
      return this.result;
    },
  };
}

/** Cropper that returns a fixed placeholder image. */
export function createFakeBodyPhotoCropper(): BodyPhotoCropper {
  return {
    available: true,
    async crop() {
      return { uri: 'fake://body-photo', blob: new Blob(['body'], { type: 'image/png' }) };
    },
  };
}
