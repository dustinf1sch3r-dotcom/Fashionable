import type { BodyPhotoCropper, PoseDetector } from '../types';

/**
 * Pose detection and body-photo cropping (docs/TRY_ON.md §11). CONTRACT ONLY until ticket T1:
 * these report `available: false`; the web implementations replace them.
 */
export function createPoseDetector(): PoseDetector {
  return {
    available: false,
    async prepare() {},
    async detect() {
      return undefined;
    },
  };
}

export function createBodyPhotoCropper(): BodyPhotoCropper {
  return {
    available: false,
    async crop() {
      throw new Error('Body photo cropping is not available yet (ticket T1)');
    },
  };
}
