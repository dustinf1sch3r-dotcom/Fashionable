/**
 * Body photo → mannequin landmarks (docs/TRY_ON.md §11). Pure: no I/O, no time, no randomness.
 */
import type { BodyLandmarks, Point } from '../model/types';
import { BODY_A } from './bodies';

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
  /** Elbows in image pixels (`L` = viewer's left); only when both were seen (§12.3). */
  elbows?: { elbowL: Point; elbowR: Point };
  problems: PoseProblem[];
}

/**
 * Every tunable number of §11.2–§11.3 in one place, so they can be adjusted against real photos.
 * Ratios are fractions of the quantity named in the comment.
 */
export const POSE_RULES = {
  /** Visibility below this counts as "not seen". */
  minVisibility: 0.5,
  /** neckBase is the shoulder midpoint raised by this × shoulder-to-hip distance. */
  neckRaise: 0.12,
  /** chin = eyeLine + this × (eyeLine-to-neckBase distance), downwards. */
  chinFromEyes: 0.45,
  /** headTop = eyeLine − this × ear-to-ear width, upwards. */
  headTopFromEars: 0.9,
  /** Without ears: headTop = eyeLine − this × (eyeLine-to-chin distance). */
  headTopFromChin: 0.55,
  /** Waist sits this far down the line shoulder → hip. */
  waistAlongTorso: 0.62,
  /** Waist width = this × hip width. */
  waistToHipWidth: 0.85,
  /** not-facing-camera: shoulder width below this × shoulder-to-hip height. */
  minShoulderToTorso: 0.35,
  /** arms-too-close: a wrist closer than this × shoulder width (sideways) to its hip. */
  armsCloseToHip: 0.15,
  /** too-small: person (headTop to lowest foot) shorter than this × image height. */
  minPersonHeight: 0.5,
  /** Crop: margin above headTop, × body height. */
  cropTopMargin: 0.06,
  /** Crop: margin below the lower foot, × body height. */
  cropBottomMargin: 0.04,
  /** Mannequin canvas (docs/TRY_ON.md §2). */
  canvasWidth: 1000,
  canvasHeight: 2000,
} as const;

/** BlazePose keypoint indices used here (person's own left / right). */
const KP = {
  nose: 0,
  eyeLeft: 2,
  eyeRight: 5,
  earLeft: 7,
  earRight: 8,
  shoulderLeft: 11,
  shoulderRight: 12,
  elbowLeft: 13,
  elbowRight: 14,
  wristLeft: 15,
  wristRight: 16,
  hipLeft: 23,
  hipRight: 24,
  kneeLeft: 25,
  kneeRight: 26,
  ankleLeft: 27,
  ankleRight: 28,
  heelLeft: 29,
  heelRight: 30,
  footIndexLeft: 31,
  footIndexRight: 32,
} as const;

const KEYPOINT_COUNT = 33;

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Map 33 BlazePose keypoints (person's left = viewer's right) to body landmarks in image px. */
export function fromBlazePose(
  keypoints: readonly PoseKeypoint[],
  imageWidth: number,
  imageHeight: number,
): PoseResult {
  const R = POSE_RULES;
  const usable =
    keypoints.length >= KEYPOINT_COUNT &&
    imageWidth > 0 &&
    imageHeight > 0 &&
    keypoints
      .slice(0, KEYPOINT_COUNT)
      .every((k) => Number.isFinite(k.x) && Number.isFinite(k.y) && Number.isFinite(k.visibility));
  const vis = (i: number): number => keypoints[i]?.visibility ?? 0;
  const torso = [KP.shoulderLeft, KP.shoulderRight, KP.hipLeft, KP.hipRight];
  if (!usable || torso.some((i) => vis(i) < R.minVisibility)) return { problems: ['no-person'] };

  const pt = (i: number): Point => ({
    x: keypoints[i].x * imageWidth,
    y: keypoints[i].y * imageHeight,
  });
  // BlazePose "left" is the person's left = the viewer's right, so left/right swap.
  const shoulderL = pt(KP.shoulderRight);
  const shoulderR = pt(KP.shoulderLeft);
  const hipL = pt(KP.hipRight);
  const hipR = pt(KP.hipLeft);
  const shoulderMid = mid(shoulderL, shoulderR);
  const hipMid = mid(hipL, hipR);

  const neckBase: Point = {
    x: shoulderMid.x,
    y: shoulderMid.y - R.neckRaise * dist(shoulderMid, hipMid),
  };
  const eyeLine = mid(pt(KP.eyeLeft), pt(KP.eyeRight));
  const chin: Point = {
    x: eyeLine.x,
    y: eyeLine.y + R.chinFromEyes * dist(eyeLine, neckBase),
  };
  const earsVisible = vis(KP.earLeft) >= R.minVisibility && vis(KP.earRight) >= R.minVisibility;
  const headHeightAbove = earsVisible
    ? R.headTopFromEars * dist(pt(KP.earLeft), pt(KP.earRight))
    : R.headTopFromChin * dist(eyeLine, chin);
  const headTop: Point = { x: eyeLine.x, y: eyeLine.y - headHeightAbove };

  // Waist: along shoulder → hip, then pulled in so waist width = waistToHipWidth × hip width.
  const waistRawL = lerp(shoulderL, hipL, R.waistAlongTorso);
  const waistRawR = lerp(shoulderR, hipR, R.waistAlongTorso);
  const waistHalf = (R.waistToHipWidth * Math.abs(hipR.x - hipL.x)) / 2;
  const waistCx = (waistRawL.x + waistRawR.x) / 2;
  const waistL: Point = { x: waistCx - waistHalf, y: waistRawL.y };
  const waistR: Point = { x: waistCx + waistHalf, y: waistRawR.y };

  const landmarks: BodyLandmarks = {
    headTop,
    chin,
    eyeLine,
    neckBase,
    shoulderL,
    shoulderR,
    waistL,
    waistR,
    hipL,
    hipR,
    kneeL: pt(KP.kneeRight),
    kneeR: pt(KP.kneeLeft),
    ankleL: pt(KP.ankleRight),
    ankleR: pt(KP.ankleLeft),
    wristL: pt(KP.wristRight),
    wristR: pt(KP.wristLeft),
    footL: mid(pt(KP.heelRight), pt(KP.footIndexRight)),
    footR: mid(pt(KP.heelLeft), pt(KP.footIndexLeft)),
  };

  const problems: PoseProblem[] = [];
  const headSeen = [KP.nose, KP.eyeLeft, KP.eyeRight].every((i) => vis(i) >= R.minVisibility);
  if (!headSeen || headTop.y < 0) problems.push('head-missing');
  const feetSeen = [KP.ankleLeft, KP.ankleRight].every((i) => vis(i) >= R.minVisibility);
  const eachFootSeen =
    Math.max(vis(KP.heelLeft), vis(KP.footIndexLeft)) >= R.minVisibility &&
    Math.max(vis(KP.heelRight), vis(KP.footIndexRight)) >= R.minVisibility;
  const lowestFoot = Math.max(landmarks.footL.y, landmarks.footR.y);
  if (!feetSeen || !eachFootSeen || lowestFoot > imageHeight) problems.push('feet-missing');
  for (const problem of checkLandmarks(landmarks)) problems.push(problem);
  if ((lowestFoot - headTop.y) / imageHeight < R.minPersonHeight) problems.push('too-small');
  // BlazePose 13 is the person's left elbow = the viewer's right.
  const elbowsSeen = vis(KP.elbowLeft) >= R.minVisibility && vis(KP.elbowRight) >= R.minVisibility;
  if (!elbowsSeen) return { landmarks, problems };
  return {
    landmarks,
    elbows: { elbowL: pt(KP.elbowRight), elbowR: pt(KP.elbowLeft) },
    problems,
  };
}

/**
 * Order and geometry checks for landmarks (e.g. after the user drags handles). Works in any
 * uniform scale (image pixels or mannequin units). Image-only checks (visibility, framing,
 * size) live in `fromBlazePose`.
 */
export function checkLandmarks(landmarks: BodyLandmarks): PoseProblem[] {
  const R = POSE_RULES;
  const l = landmarks;
  const problems: PoseProblem[] = [];
  const meanY = (a: Point, b: Point): number => (a.y + b.y) / 2;

  // Vertical order, head → feet.
  const chain = [
    l.headTop.y,
    l.eyeLine.y,
    l.chin.y,
    l.neckBase.y,
    meanY(l.shoulderL, l.shoulderR),
    meanY(l.waistL, l.waistR),
    meanY(l.hipL, l.hipR),
    meanY(l.kneeL, l.kneeR),
    meanY(l.ankleL, l.ankleR),
  ];
  // The neck base sits just above the shoulder line, and the feet may be level with the ankles.
  let ordered = chain.every((y, i) => i === 0 || y > chain[i - 1]);
  if (meanY(l.footL, l.footR) < meanY(l.ankleL, l.ankleR)) ordered = false;
  if (!ordered) problems.push('landmarks-out-of-order');

  const torsoHeight = Math.abs(meanY(l.hipL, l.hipR) - meanY(l.shoulderL, l.shoulderR));
  // Signed: a person facing away puts "left" on the viewer's right and fails as well.
  const shoulderSpan = l.shoulderR.x - l.shoulderL.x;
  if (shoulderSpan < R.minShoulderToTorso * torsoHeight) problems.push('not-facing-camera');

  const closeLimit = R.armsCloseToHip * Math.abs(shoulderSpan);
  const shoulderY = meanY(l.shoulderL, l.shoulderR);
  const close = (wrist: Point, hip: Point): boolean =>
    wrist.y > shoulderY && Math.abs(wrist.x - hip.x) < closeLimit;
  if (close(l.wristL, l.hipL) || close(l.wristR, l.hipR)) problems.push('arms-too-close');
  return problems;
}

/** The 1:2 window around the person, in image pixels (§11.3). */
export function bodyCropWindow(landmarks: BodyLandmarks): PixelRect {
  const R = POSE_RULES;
  const top = landmarks.headTop.y;
  const lowFoot = Math.max(landmarks.footL.y, landmarks.footR.y);
  const bodyHeight = Math.max(1, lowFoot - top);
  const y = top - R.cropTopMargin * bodyHeight;
  const height = bodyHeight * (1 + R.cropTopMargin + R.cropBottomMargin);
  const width = height * (R.canvasWidth / R.canvasHeight);
  const centreX = (landmarks.hipL.x + landmarks.hipR.x) / 2;
  return { x: centreX - width / 2, y, width, height };
}

/** Transform image-pixel landmarks into mannequin units (1000 × 2000) for a crop window. */
export function toCanvas(landmarks: BodyLandmarks, window: PixelRect): BodyLandmarks {
  const sx = POSE_RULES.canvasWidth / window.width;
  const sy = POSE_RULES.canvasHeight / window.height;
  const map = (p: Point): Point => ({ x: (p.x - window.x) * sx, y: (p.y - window.y) * sy });
  const entries = Object.entries(landmarks) as [keyof BodyLandmarks, Point][];
  const out = {} as BodyLandmarks;
  for (const [key, point] of entries) out[key] = map(point);
  return out;
}

/** Transform image-pixel elbows into mannequin units for a crop window (same map as `toCanvas`). */
export function elbowsToCanvas(
  elbows: { elbowL: Point; elbowR: Point },
  window: PixelRect,
): { elbowL: Point; elbowR: Point } {
  const sx = POSE_RULES.canvasWidth / window.width;
  const sy = POSE_RULES.canvasHeight / window.height;
  const map = (q: Point): Point => ({ x: (q.x - window.x) * sx, y: (q.y - window.y) * sy });
  return { elbowL: map(elbows.elbowL), elbowR: map(elbows.elbowR) };
}

/** A starting point for manual placement: BODY_A's landmarks (already mannequin units). */
export function defaultPhotoLandmarks(): BodyLandmarks {
  const entries = Object.entries(BODY_A.landmarks) as [keyof BodyLandmarks, Point][];
  const out = {} as BodyLandmarks;
  for (const [key, point] of entries) out[key] = { x: point.x, y: point.y };
  return out;
}
