import type { BodyLandmarks, BodyTemplate, Slot } from '../model/types';
import { bodyCenterX, headWidth, hipWidth, shoulderWidth, waistWidth } from './bodies';

export interface Anchor {
  centerX: number;
  topY: number;
  width: number;
  z: number;
}

/**
 * Numeric parts of the TRY_ON §4 table. Starting values to be tuned against real photos; any
 * change must update the snapshot test deliberately.
 *
 * `topOffset` is added to the reference y; `widthMul` multiplies the reference width (S, H, W or
 * head width); `widthAdd` is added after; `widthFixed` replaces the width entirely.
 */
export const ANCHOR_RULES = {
  legs: { z: 10, topOffset: 0, widthMul: 1.0 }, // knee.y, H
  shoes: { z: 20, topOffset: -40, widthMul: 1, widthAdd: 220 }, // ankle.y, foot gap + 220
  bottom: { z: 30, topOffset: -20, widthMul: 1.25 }, // waist.y, H
  base: { z: 40, topOffset: -10, widthMul: 1.55 }, // neckBase.y, S
  onepiece: { z: 40, topOffset: -10, widthMul: 1.55 }, // neckBase.y, S
  belt: { z: 45, topOffset: -15, widthMul: 1.15 }, // waist.y, W
  mid: { z: 50, topOffset: -20, widthMul: 1.65 }, // neckBase.y, S
  outer: { z: 60, topOffset: -30, widthMul: 1.8 }, // neckBase.y, S
  neck: { z: 70, topOffset: 0, widthMul: 0.6 }, // chin.y, S
  jewelry: { z: 72, topOffset: 0, widthMul: 0.35 }, // neckBase.y, S
  wrist: { z: 75, topOffset: -30, widthFixed: 70 }, // wristL.x / wristL.y
  bag: { z: 80, topOffset: -60, widthFixed: 260, xOffset: 60 }, // wristR.x + 60 / wristR.y
  head: { z: 90, topOffset: -60, widthMul: 1.3 }, // headTop.x / headTop.y, head width
  eyes: { z: 92, topOffset: -25, widthMul: 0.9 }, // eyeLine.x / eyeLine.y, head width
} as const;

/** Z of the `base` layer when the outfit is tucked: under `bottom` (TRY_ON §4). */
export const TUCKED_BASE_Z = 25;

const avg = (a: number, b: number): number => (a + b) / 2;

function anchorFromLandmarks(slot: Slot, l: BodyLandmarks): Anchor {
  const cx = bodyCenterX(l);
  const S = shoulderWidth(l);
  const H = hipWidth(l);
  const W = waistWidth(l);
  const R = ANCHOR_RULES;
  switch (slot) {
    case 'legs':
      return {
        centerX: cx,
        topY: avg(l.kneeL.y, l.kneeR.y) + R.legs.topOffset,
        width: H * R.legs.widthMul,
        z: R.legs.z,
      };
    case 'shoes':
      return {
        centerX: cx,
        topY: avg(l.ankleL.y, l.ankleR.y) + R.shoes.topOffset,
        width: (l.footR.x - l.footL.x) * R.shoes.widthMul + R.shoes.widthAdd,
        z: R.shoes.z,
      };
    case 'bottom':
      return {
        centerX: cx,
        topY: avg(l.waistL.y, l.waistR.y) + R.bottom.topOffset,
        width: H * R.bottom.widthMul,
        z: R.bottom.z,
      };
    case 'base':
    case 'onepiece':
    case 'mid':
    case 'outer':
      return {
        centerX: cx,
        topY: l.neckBase.y + R[slot].topOffset,
        width: S * R[slot].widthMul,
        z: R[slot].z,
      };
    case 'belt':
      return {
        centerX: cx,
        topY: avg(l.waistL.y, l.waistR.y) + R.belt.topOffset,
        width: W * R.belt.widthMul,
        z: R.belt.z,
      };
    case 'neck':
      return {
        centerX: cx,
        topY: l.chin.y + R.neck.topOffset,
        width: S * R.neck.widthMul,
        z: R.neck.z,
      };
    case 'jewelry':
      return {
        centerX: cx,
        topY: l.neckBase.y + R.jewelry.topOffset,
        width: S * R.jewelry.widthMul,
        z: R.jewelry.z,
      };
    case 'wrist':
      return {
        centerX: l.wristL.x,
        topY: l.wristL.y + R.wrist.topOffset,
        width: R.wrist.widthFixed,
        z: R.wrist.z,
      };
    case 'bag':
      return {
        centerX: l.wristR.x + R.bag.xOffset,
        topY: l.wristR.y + R.bag.topOffset,
        width: R.bag.widthFixed,
        z: R.bag.z,
      };
    case 'head':
      return {
        centerX: l.headTop.x,
        topY: l.headTop.y + R.head.topOffset,
        width: headWidth(l) * R.head.widthMul,
        z: R.head.z,
      };
    case 'eyes':
      return {
        centerX: l.eyeLine.x,
        topY: l.eyeLine.y + R.eyes.topOffset,
        width: headWidth(l) * R.eyes.widthMul,
        z: R.eyes.z,
      };
  }
}

/** Anchor (where and how wide) for a slot on a body (docs/TRY_ON.md §4). */
export function anchorFor(slot: Slot, body: BodyTemplate): Anchor {
  return anchorFromLandmarks(slot, body.landmarks);
}
