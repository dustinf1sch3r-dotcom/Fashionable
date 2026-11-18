import type { PoseDetector } from '../types';

/**
 * Native builds have no detector yet. Planned (docs/TRY_ON.md §11.1): Apple Vision body pose on
 * iOS and ML Kit pose detection on Android, each behind a small Expo native module that returns
 * the same 33 BlazePose-ordered keypoints.
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
