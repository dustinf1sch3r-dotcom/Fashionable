/**
 * Body photo → mannequin landmarks (docs/TRY_ON.md §11). CONTRACT ONLY: types and signatures are
 * fixed; implementations land in ticket T1. Pure: no I/O, no time, no randomness.
 */
import type { BodyLandmarks } from '../model/types';

/** One BlazePose keypoint, normalised to the image (0–1, origin top-left). */
export interface PoseKeypoint {
  x: number;
  y: number;
  /** 0–1 likelihood that the point is visible. */
  visibility: number;
}

/** Rectangle in image pixels (may extend beyond the image; the outside is filled). */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PoseProblem =
  | 'no-person'
  | 'head-missing'
  | 'feet-missing'
  | 'not-facing-camera'
  | 'arms-too-close'
  | 'too-small'
  | 'landmarks-out-of-order';

/** Problems that stop the photo being saved; the rest are warnings. */
export const BLOCKING_POSE_PROBLEMS: readonly PoseProblem[] = [
  'no-person',
  'landmarks-out-of-order',
];

export interface PoseResult {
  /** In image pixels, `L` = viewer's left. Undefined when no person was found. */
  landmarks?: BodyLandmarks;
  problems: PoseProblem[];
}

const pending = (name: string): never => {
  throw new Error(`${name} is not implemented yet (ticket T1)`);
};

/** Map 33 BlazePose keypoints (person's left = viewer's right) to body landmarks in image px. */
export function fromBlazePose(
  keypoints: readonly PoseKeypoint[],
  imageWidth: number,
  imageHeight: number,
): PoseResult {
  void keypoints;
  void imageWidth;
  void imageHeight;
  return pending('fromBlazePose');
}

/** Order and geometry checks for landmarks (e.g. after the user drags handles). */
export function checkLandmarks(landmarks: BodyLandmarks): PoseProblem[] {
  void landmarks;
  return pending('checkLandmarks');
}

/** The 1:2 window around the person, in image pixels (§11.3). */
export function bodyCropWindow(landmarks: BodyLandmarks): PixelRect {
  void landmarks;
  return pending('bodyCropWindow');
}

/** Transform image-pixel landmarks into mannequin units (1000 × 2000) for a crop window. */
export function toCanvas(landmarks: BodyLandmarks, window: PixelRect): BodyLandmarks {
  void landmarks;
  void window;
  return pending('toCanvas');
}

/** A starting point for manual placement: BODY_A's landmarks (already mannequin units). */
export function defaultPhotoLandmarks(): BodyLandmarks {
  return pending('defaultPhotoLandmarks');
}
