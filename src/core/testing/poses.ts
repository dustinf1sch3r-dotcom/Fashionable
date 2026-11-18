import { BODY_A } from '../tryon/bodies';
import type { PoseKeypoint } from '../tryon/pose';

/** A detector-shaped result: keypoints, in the image of this size. */
export interface SyntheticPose {
  keypoints: PoseKeypoint[];
  width: number;
  height: number;
}

export interface PersonOptions {
  /** Image size in px. */
  width?: number;
  height?: number;
  /** Person height (headTop to feet) as a fraction of the image height. */
  size?: number;
  /** Horizontal centre as a fraction of the image width. */
  cx?: number;
  /** Top of the head as a fraction of the image height. */
  top?: number;
  /** 1 = facing the camera, near 0 = turned sideways. */
  turn?: number;
  /** Wrist distance from the hips as a fraction of the A-pose (0 = hands at the hips). */
  armSpread?: number;
  hide?: readonly number[];
}

/** A front-facing BlazePose keypoint set built from BODY_A, mirrored (person's left = image right). */
export function syntheticPerson(o: PersonOptions = {}): SyntheticPose {
  const width = o.width ?? 800;
  const height = o.height ?? 1200;
  const scale = ((o.size ?? 0.8) * height) / (1940 - 80);
  const cx = (o.cx ?? 0.5) * width;
  const top = (o.top ?? 0.08) * height;
  const turn = o.turn ?? 1;
  const arms = o.armSpread ?? 1;
  const L = BODY_A.landmarks;
  const at = (x: number, y: number): PoseKeypoint => ({
    x: (cx + (x - 500) * scale * turn) / width,
    y: (top + (y - 80) * scale) / height,
    visibility: 0.99,
  });
  const k: PoseKeypoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.99,
  }));
  const wristX = (hipX: number, wristX0: number): number => hipX + (wristX0 - hipX) * arms;
  // BlazePose index i is the person's side: left = viewer's right (larger x).
  k[0] = at(500, 230);
  k[2] = at(530, 196); // left eye (viewer's right)
  k[5] = at(470, 196);
  k[7] = at(580, 205);
  k[8] = at(420, 205);
  k[11] = at(L.shoulderR.x, L.shoulderR.y);
  k[12] = at(L.shoulderL.x, L.shoulderL.y);
  k[13] = at(760, 720);
  k[14] = at(240, 720);
  k[15] = at(wristX(L.hipR.x, L.wristR.x), L.wristR.y);
  k[16] = at(wristX(L.hipL.x, L.wristL.x), L.wristL.y);
  k[23] = at(L.hipR.x, L.hipR.y);
  k[24] = at(L.hipL.x, L.hipL.y);
  k[25] = at(L.kneeR.x, L.kneeR.y);
  k[26] = at(L.kneeL.x, L.kneeL.y);
  k[27] = at(L.ankleR.x, L.ankleR.y);
  k[28] = at(L.ankleL.x, L.ankleL.y);
  k[29] = at(L.footR.x, L.footR.y - 30); // left heel
  k[30] = at(L.footL.x, L.footL.y - 30);
  k[31] = at(L.footR.x, L.footR.y + 30); // left foot index
  k[32] = at(L.footL.x, L.footL.y + 30);
  for (const i of o.hide ?? []) k[i] = { ...k[i], visibility: 0.05 };
  return { keypoints: k, width, height };
}
