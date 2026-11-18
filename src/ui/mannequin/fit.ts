import type { FitAdjust, Item, Outfit } from '@/core/model/types';
import { clampFit, IDENTITY_FIT } from '@/core/tryon/place';
import { CANVAS } from './bodyA';

/** Size of one press of the on-screen fit controls. */
export const FIT_STEPS = { scale: 0.05, rotation: 5, nudge: 20 } as const;

/** Pointer travel (screen px) before a drag takes over from a tap. */
export const DRAG_SLOP_PX = 6;

/** The adjustment currently in force for an item: outfit override, else its saved fit, else none. */
export function effectiveFit(item: Pick<Item, 'id' | 'fitAdjust'>, outfit?: Outfit): FitAdjust {
  return clampFit(outfit?.fitOverrides?.[item.id] ?? item.fitAdjust ?? IDENTITY_FIT);
}

export function isIdentityFit(fit: FitAdjust): boolean {
  return (
    fit.dx === IDENTITY_FIT.dx &&
    fit.dy === IDENTITY_FIT.dy &&
    fit.scale === IDENTITY_FIT.scale &&
    fit.rotation === IDENTITY_FIT.rotation
  );
}

export function sameFit(a: FitAdjust, b: FitAdjust): boolean {
  return a.dx === b.dx && a.dy === b.dy && a.scale === b.scale && a.rotation === b.rotation;
}

/** Mannequin units covered by one screen pixel when the mannequin is `widthPx` wide. */
export function unitsPerPx(widthPx: number): number {
  return widthPx > 0 ? CANVAS.width / widthPx : 0;
}

/** Screen pixels to mannequin units. */
export function pxToUnits(px: number, widthPx: number): number {
  return px * unitsPerPx(widthPx);
}

/** Mannequin units to screen pixels. */
export function unitsToPx(units: number, widthPx: number): number {
  return widthPx > 0 ? (units * widthPx) / CANVAS.width : 0;
}

const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Tidy numbers (no 1.0500000000000003) and enforce the TRY_ON §6 limits. */
export function normalizeFit(fit: FitAdjust): FitAdjust {
  const c = clampFit(fit);
  return {
    dx: round(c.dx, 1),
    dy: round(c.dy, 1),
    scale: round(c.scale, 3),
    rotation: round(c.rotation, 1),
  };
}

export type FitStep = 'scale-up' | 'scale-down' | 'rotate-left' | 'rotate-right' | FitNudge;
export type FitNudge = 'up' | 'down' | 'left' | 'right';

/** One press of a control-bar button. */
export function stepFit(fit: FitAdjust, step: FitStep): FitAdjust {
  switch (step) {
    case 'scale-up':
      return normalizeFit({ ...fit, scale: fit.scale + FIT_STEPS.scale });
    case 'scale-down':
      return normalizeFit({ ...fit, scale: fit.scale - FIT_STEPS.scale });
    case 'rotate-left':
      return normalizeFit({ ...fit, rotation: fit.rotation - FIT_STEPS.rotation });
    case 'rotate-right':
      return normalizeFit({ ...fit, rotation: fit.rotation + FIT_STEPS.rotation });
    case 'up':
      return normalizeFit({ ...fit, dy: fit.dy - FIT_STEPS.nudge });
    case 'down':
      return normalizeFit({ ...fit, dy: fit.dy + FIT_STEPS.nudge });
    case 'left':
      return normalizeFit({ ...fit, dx: fit.dx - FIT_STEPS.nudge });
    case 'right':
      return normalizeFit({ ...fit, dx: fit.dx + FIT_STEPS.nudge });
  }
}

/** Whether a step would change anything (false once a limit is reached). */
export function canStep(fit: FitAdjust, step: FitStep): boolean {
  return !sameFit(fit, stepFit(fit, step));
}

/** Where a drag or pinch began; later pointer positions are measured against it. */
export interface GestureBase {
  fit: FitAdjust;
  /** Pan translation (screen px) when the base was taken. */
  panX: number;
  panY: number;
  /** Two-finger distance (px) and angle (degrees) when the base was taken; absent for one finger. */
  distance?: number;
  angle?: number;
}

export interface GestureNow {
  panX: number;
  panY: number;
  distance?: number;
  angle?: number;
}

/** Smallest signed difference between two angles in degrees, in (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Fit after a gesture: translation from the pan delta, scale from the change in finger distance,
 * rotation from the change in finger angle; always within the allowed limits.
 */
export function applyGesture(base: GestureBase, now: GestureNow, widthPx: number): FitAdjust {
  const pinching =
    base.distance !== undefined &&
    base.angle !== undefined &&
    now.distance !== undefined &&
    now.angle !== undefined &&
    base.distance > 0;
  return normalizeFit({
    dx: base.fit.dx + pxToUnits(now.panX - base.panX, widthPx),
    dy: base.fit.dy + pxToUnits(now.panY - base.panY, widthPx),
    scale:
      pinching && base.distance && now.distance
        ? base.fit.scale * (now.distance / base.distance)
        : base.fit.scale,
    rotation:
      pinching && base.angle !== undefined && now.angle !== undefined
        ? base.fit.rotation + angleDelta(base.angle, now.angle)
        : base.fit.rotation,
  });
}
