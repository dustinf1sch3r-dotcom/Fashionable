/**
 * Silhouette of `body-a`, drawn on the 1000 × 2000 mannequin canvas to the landmark table in
 * `src/core/tryon/bodies.ts` (head 80–312, shoulders y 400, waist y 800, hips y 960, wrists
 * y 1040, knees y 1400, ankles y 1860, feet y 1940). Relaxed A-pose, single flat fill, no outline.
 *
 * The figure is symmetric about x = 500. Head and torso are written out in full; the arm and the
 * leg (with its foot) are drawn once, for the viewer's left side, and rendered a second time
 * mirrored (`mirrorTransform`). All parts overlap slightly so the union reads as one shape.
 *
 * Original artwork for this project; no third-party source.
 */

export const CANVAS = { width: 1000, height: 2000 } as const;

/** Head: slightly tapered towards the chin. Width 162, height 232. */
const head =
  'M500 80 C552 80 581 130 581 190 C581 252 546 312 500 312 C454 312 419 252 419 190 C419 130 448 80 500 80 Z';

/** Neck, trapezius slope, trunk and pelvis, closed across the crotch at y 1085. */
const torso =
  'M466 290 L464 352 C440 372 372 380 332 392 C326 430 342 500 346 540 ' +
  'C350 620 354 720 350 800 C346 860 332 910 330 960 C328 1010 334 1050 344 1085 L656 1085 ' +
  'C666 1050 672 1010 670 960 C668 910 654 860 650 800 C646 720 650 620 654 540 ' +
  'C658 500 674 430 668 392 C628 380 560 372 536 352 L534 290 Z';

/** Left arm from the shoulder cap to a mitten-like hand; the wrist is at (210, 1040). */
const armLeft =
  'M352 380 C330 380 308 400 306 440 C296 540 268 650 252 720 C232 810 206 930 187 1040 ' +
  'C176 1070 168 1100 170 1135 C172 1165 190 1182 207 1180 C226 1178 234 1160 238 1132 ' +
  'C242 1100 242 1070 233 1040 C262 930 296 810 322 720 C338 650 346 600 354 560 L380 450 Z';

/** Left leg, hip to ankle (knee centre x 420, ankle centre x 400), and its foot (centre 390). */
const legLeft =
  'M336 1000 C332 1120 352 1270 375 1400 C358 1480 354 1560 362 1640 C370 1740 372 1800 372 1860 ' +
  'L428 1860 C430 1800 440 1740 450 1640 C458 1560 464 1480 465 1400 C478 1280 494 1160 492 1085 L492 1000 Z';

const footLeft =
  'M370 1850 L430 1850 C436 1885 456 1915 456 1938 C456 1960 428 1968 392 1968 ' +
  'C352 1968 322 1962 322 1942 C322 1918 362 1895 370 1850 Z';

export interface SilhouetteParts {
  /** Drawn as is. */
  readonly whole: readonly string[];
  /** Drawn as is and again mirrored about the vertical centre line. */
  readonly pairedLeft: readonly string[];
}

export const BODY_A_PARTS: SilhouetteParts = {
  whole: [head, torso],
  pairedLeft: [armLeft, legLeft, footLeft],
};

/** SVG transform that mirrors left-side parts onto the right side (centre line x = 500). */
export const MIRROR_TRANSFORM = 'translate(1000 0) scale(-1 1)';
