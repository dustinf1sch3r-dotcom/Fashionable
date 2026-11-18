import type { BodyLandmarks, Point } from '@/core/model/types';

/** Mannequin canvas in units (docs/TRY_ON.md §2); the body photo is cropped to exactly this. */
export const CANVAS_UNITS = { width: 1000, height: 2000 } as const;

/** Landmarks the person can drag (docs/TRY_ON.md §11.4), top of the body first. */
export const HANDLE_KEYS = [
  'headTop',
  'chin',
  'shoulderL',
  'shoulderR',
  'wristL',
  'wristR',
  'waistL',
  'waistR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
  'footL',
  'footR',
] as const satisfies readonly (keyof BodyLandmarks)[];

export type HandleKey = (typeof HANDLE_KEYS)[number];

/**
 * Names from the PERSON's point of view. `L` landmarks are the viewer's left, which is the
 * person's right in a front-facing photo, so `shoulderL` reads "Your right shoulder".
 */
export const HANDLE_LABELS: Record<HandleKey, string> = {
  headTop: 'Top of your head',
  chin: 'Your chin',
  shoulderL: 'Your right shoulder',
  shoulderR: 'Your left shoulder',
  wristL: 'Your right wrist',
  wristR: 'Your left wrist',
  waistL: 'Your right waist',
  waistR: 'Your left waist',
  hipL: 'Your right hip',
  hipR: 'Your left hip',
  kneeL: 'Your right knee',
  kneeR: 'Your left knee',
  ankleL: 'Your right ankle',
  ankleR: 'Your left ankle',
  footL: 'Your right foot',
  footR: 'Your left foot',
};

/** Pixels of pointer travel to mannequin units, for a canvas drawn `canvasWidthPx` wide. */
export function pxToUnits(px: number, canvasWidthPx: number): number {
  return canvasWidthPx > 0 ? (px * CANVAS_UNITS.width) / canvasWidthPx : 0;
}

/** Mannequin units to pixels on a canvas drawn `canvasWidthPx` wide. */
export function unitsToPx(units: number, canvasWidthPx: number): number {
  return (units * canvasWidthPx) / CANVAS_UNITS.width;
}

/** Keep a point inside the canvas. */
export function clampToCanvas(p: Point): Point {
  return {
    x: Math.min(CANVAS_UNITS.width, Math.max(0, p.x)),
    y: Math.min(CANVAS_UNITS.height, Math.max(0, p.y)),
  };
}

/** Where a handle that started at `start` is after the pointer travelled (dx, dy) pixels. */
export function dragPoint(start: Point, dxPx: number, dyPx: number, canvasWidthPx: number): Point {
  return clampToCanvas({
    x: start.x + pxToUnits(dxPx, canvasWidthPx),
    y: start.y + pxToUnits(dyPx, canvasWidthPx),
  });
}

/**
 * Landmarks the person does not drag follow the ones they do: the neck base sits just above the
 * shoulder midpoint (12% of the way down to the hips, as in §11.2) and the eye line halfway
 * between the top of the head and the chin.
 */
export function withDerivedPoints(l: BodyLandmarks): BodyLandmarks {
  const shoulderMid = {
    x: (l.shoulderL.x + l.shoulderR.x) / 2,
    y: (l.shoulderL.y + l.shoulderR.y) / 2,
  };
  const hipY = (l.hipL.y + l.hipR.y) / 2;
  return {
    ...l,
    neckBase: { x: shoulderMid.x, y: shoulderMid.y - 0.12 * (hipY - shoulderMid.y) },
    eyeLine: { x: (l.headTop.x + l.chin.x) / 2, y: (l.headTop.y + l.chin.y) / 2 },
  };
}

/** The landmarks after one handle moved to `to` (clamped into the canvas). */
export function moveLandmark(l: BodyLandmarks, key: HandleKey, to: Point): BodyLandmarks {
  return withDerivedPoints({ ...l, [key]: clampToCanvas(to) });
}

/** Where to draw the magnifier over a canvas so it stays on screen, in px. */
export function loupePosition(
  pointPx: Point,
  canvas: { width: number; height: number },
  size: number,
  gap: number,
): Point {
  const above = pointPx.y - gap - size;
  const y = above >= 0 ? above : Math.min(canvas.height - size, pointPx.y + gap);
  const x = Math.min(canvas.width - size, Math.max(0, pointPx.x - size / 2));
  return { x, y };
}
