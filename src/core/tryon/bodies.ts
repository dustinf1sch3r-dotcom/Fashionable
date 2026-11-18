import type { BodyLandmarks, BodyTemplate, Point } from '../model/types';

/**
 * Body templates for the mannequin (docs/TRY_ON.md §3). Canvas is 1000 × 2000 units, origin top
 * left, y down. "L" is the VIEWER's left (smaller x).
 *
 * Proportions for SVG artists (ticket M4-1) — draw the silhouette to these numbers:
 *  - Figure is about 8 heads tall: head top y=80, chin y=312 (head height 232), feet y=1940.
 *  - Centred on x=500; every landmark pair is mirrored about it.
 *  - Head is ~162 wide (0.7 × head height). Eye line y=196, neck base y=372.
 *  - Shoulders y=400, x=310/690 (380 wide). Waist y=800, x=350/650 (300 wide).
 *    Hips y=960, x=330/670 (340 wide, the widest part of the lower body).
 *  - Relaxed A-pose: arms hang slightly away from the body, wrists y=1040 at x=210/790, so the
 *    hand is clear of the hip and sleeves have room.
 *  - Knees y=1400, x=420/580. Ankles y=1860, x=400/600. Feet are centred at x=390/610, y=1940,
 *    toes pointing slightly outwards; each foot is about 130 wide.
 * Silhouette fill is the flat grey #C9CCD1, no outline.
 */
const p = (x: number, y: number): Point => ({ x, y });

export const BODY_A: BodyTemplate = {
  id: 'body-a',
  landmarks: {
    headTop: p(500, 80),
    chin: p(500, 312),
    eyeLine: p(500, 196),
    neckBase: p(500, 372),
    shoulderL: p(310, 400),
    shoulderR: p(690, 400),
    waistL: p(350, 800),
    waistR: p(650, 800),
    hipL: p(330, 960),
    hipR: p(670, 960),
    kneeL: p(420, 1400),
    kneeR: p(580, 1400),
    ankleL: p(400, 1860),
    ankleR: p(600, 1860),
    wristL: p(210, 1040),
    wristR: p(790, 1040),
    footL: p(390, 1940),
    footR: p(610, 1940),
  },
};

/**
 * Explicit elbows for BODY_A (docs/TRY_ON.md §12.3): halfway down the relaxed A-pose arm, a little
 * inside the shoulder–wrist line so the forearm angles outwards.
 */
export const BODY_A_ELBOWS: { elbowL: Point; elbowR: Point } = {
  elbowL: p(240, 720),
  elbowR: p(760, 720),
};

export const BODIES: Readonly<Record<string, BodyTemplate>> = { [BODY_A.id]: BODY_A };

/** Template by id, or undefined when unknown. */
export function getBody(id: string): BodyTemplate | undefined {
  return BODIES[id];
}

/** `S` in TRY_ON §4. */
export function shoulderWidth(l: BodyLandmarks): number {
  return l.shoulderR.x - l.shoulderL.x;
}

/** `H` in TRY_ON §4. */
export function hipWidth(l: BodyLandmarks): number {
  return l.hipR.x - l.hipL.x;
}

/** `W` in TRY_ON §4. */
export function waistWidth(l: BodyLandmarks): number {
  return l.waistR.x - l.waistL.x;
}

/** Head width is not a landmark; approximated as 0.7 × head height (headTop to chin). */
export const HEAD_WIDTH_RATIO = 0.7;
export function headWidth(l: BodyLandmarks): number {
  return (l.chin.y - l.headTop.y) * HEAD_WIDTH_RATIO;
}

/** Vertical axis of the body: midpoint of the shoulders. */
export function bodyCenterX(l: BodyLandmarks): number {
  return (l.shoulderL.x + l.shoulderR.x) / 2;
}
