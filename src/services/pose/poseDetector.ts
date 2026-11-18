import type { PoseDetector } from '../types';

/**
 * Platform dispatch: Metro/Expo resolve `./poseDetector` to `.web.ts` or `.native.ts` first. This
 * file is the fallback for environments with neither (plain Node): no detector.
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
