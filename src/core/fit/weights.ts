/**
 * Every tunable number of garment fitting (docs/TRY_ON.md §12) in one table. Detection numbers
 * are fractions of the garment's own size; target numbers are fractions of body measurements.
 */
export const FIT_RULES = {
  detect: {
    /** Alpha at or above this counts as opaque. */
    alphaThreshold: 128,
    /** Masks are box-downsampled so the longer side is at most this many cells. */
    maxGridSide: 128,
    /** A cell is opaque when at least this fraction of its pixels is. */
    cellFill: 0.5,
    /** Components smaller than this fraction of the largest are stray noise. */
    strayComponent: 0.05,
    /** Holes smaller than this fraction of the garment area are filled. */
    smallHole: 0.015,
    /** Masks with fewer opaque cells than this are "empty". */
    minCells: 24,
    /** Deskew resampling: sub-samples per cell side. */
    skewSamples: 3,
    /** Deskew by the top edge: columns whose top lies within this fraction of the height. */
    topEdgeBand: 0.12,
    /** Deskew: tilt search step (radians). */
    skewStep: 0.0087,
    /** Deskew only for tilts between these (radians). */
    skewMin: 0.01,
    skewMax: 0.2,
    /** Sleeve: the outline must reach this far (× torso width) beyond the torso. */
    sleeveReach: 0.08,
    /** Sleeve: a jump of the left edge of at least this (× width) marks the cuff bottom. */
    cuffJump: 0.04,
    /** Sleeve end: points within this fraction of the upper height of the farthest form the end. */
    cuffSlab: 0.025,
    /** A cuff jump needs at least this fraction of the height of body rows below it. */
    minAfterCuff: 0.04,
    /** Neck: the collar dip must be at least this fraction of the upper part's height. */
    neckDip: 0.03,
    /** Neck points are where the top edge is within this fraction of the dip of the top row. */
    neckEdge: 0.1,
    /** Fallback neck half-width when there is no visible collar dip (× torso width). */
    neckFallback: 0.12,
    /** Dress/jumpsuit waist: narrowest row between these fractions of the height. */
    waistBand: [0.25, 0.6],
    /** A row counts as the full edge when at least this wide compared with the widest nearby. */
    edgeFill: 0.9,
    /** Edge rows are looked for within this many rows. */
    edgeBand: 4,
    /** Sleeve/leg gaps: the apex is extrapolated from rows narrower than this fraction of the widest. */
    apexFill: 0.8,
    /** The gap must open at least this fast (cells of width per row) to extrapolate its apex. */
    apexMinSlope: 0.1,
    /** A gap narrower than this many cells is a slit: its first row is the apex. */
    apexMinGap: 3,
    /** The apex lies at most this fraction of the height above the first visible gap row. */
    apexBack: 0.2,
    /** A slit between an open-ended sleeve and the torso spans at least this fraction of the height. */
    openSleeveSlit: 0.2,
    /** A sleeve gap may be bridged by noise for this many rows. */
    gapMisses: 2,
    /** A sleeve gap lies at least this fraction of the width left of the centre (not the collar). */
    gapFromCentre: 0.15,
    /** Trousers: hips lie this fraction of the way from the waist to the crotch. */
    hipAlongRise: 0.7,
    /** Skirt/dress: hips lie this fraction of the way from the waist to the hem. */
    hipAlongSkirt: 0.2,
    /** Each leg must be at least this wide next to a gap (× width). */
    minLeg: 0.06,
    /** The gap between the legs lies within this fraction of the width of the centre. */
    legGapCentre: 0.2,
    /** A leg gap must be at least this wide (cells). */
    minGap: 1,
    /** Armhole scan: the armpit lies within this fraction of the upper part. */
    armholeMax: 0.45,
  },
  confidence: {
    /** Penalty per stray component and per fraction of noisy cells. */
    perStray: 0.04,
    perNoise: 8,
    perJitter: 1.5,
    maxNoisePenalty: 0.3,
    /** Multipliers for structural problems. */
    noNeck: 0.45,
    badOrder: 0.25,
    badRatio: 0.5,
    notKind: 0.4,
    /** Weight of left/right asymmetry. */
    asymmetry: 0.6,
    /** Vertical difference between mirrored points that counts as fully asymmetric (× height). */
    asymmetryY: 0.15,
    /** Horizontal asymmetry (|dl−dr|/(dl+dr)) that counts as fully asymmetric. */
    asymmetryX: 0.35,
  },
  target: {
    /** Garment shoulder width → body shoulder width ease, per slot. */
    shoulderEase: { base: 0.06, mid: 0.1, outer: 0.16 },
    /** Armpits lie this fraction of shoulder-to-hip distance below the shoulders. */
    armpitDrop: 0.22,
    /** Neck separation: garment neck ÷ shoulder width × body shoulder width, clamped (× S). */
    neckSeparation: [0.25, 0.6],
    /** Cuff width bounds (× body shoulder width); outerwear may be a little wider. */
    cuffWidth: [0.18, 0.32],
    cuffWidthOuter: [0.18, 0.36],
    /** Body chest width (sleeveless scale reference) as a fraction of the shoulder width. */
    chestWidth: 0.85,
    /**
     * Sleeve length = garment sleeve length × scale, clamped to these fractions of the body's arm
     * length (shoulder → elbow → wrist; above 1 is past the wrist).
     */
    sleeveMin: 0.25,
    sleeveMax: 1.02,
    /**
     * Hem bounds (physical lengths are clamped to them). Positions are fractions of hip→knee
     * (so 1 is the knee) unless noted; "toAnkle" is a fraction of knee→ankle below the knee.
     */
    hem: {
      /** Base and mid layers: from the waist down to just below the hip. */
      base: { hi: 0.15 },
      /** Outerwear: from the hip to 60% of the way from knee to ankle. */
      outer: { lo: 0, hiToAnkle: 0.6 },
      /** Trousers whose length ÷ waist width is above this are long; others are shorts. */
      shortsMaxRatio: 1.5,
      shorts: { lo: 0.3, hi: 1.0 },
      /** Long trousers: hem within this fraction of the hip-to-ankle distance of the ankle. */
      long: { ankleTolerance: 0.02 },
      /** Skirts and dresses: from just above mid-thigh to the ankle. */
      skirt: { lo: 0.35 },
      dress: { lo: 0.35 },
    },
    /** Waist and hip ease for bottoms, one-pieces (× body width). */
    bottomEase: { waist: 0.04, hip: 0.06 },
    /** Crotch sits this fraction of hip-to-knee below the hips. */
    crotchDrop: 0.12,
    /** Trouser hem width: at most this × the body's hip width. */
    legHemMax: 0.9,
    /** Inner leg edges stay this fraction of the hip width off the centre line. */
    legGap: 0.004,
    /** Leg axis: x of the hip joint is this fraction from the hip landmark towards the centre. */
    hipJoint: 0.5,
  },
  /** Layering (`nestInside`): all numbers are fractions of the body shoulder width unless noted. */
  nest: {
    /** Inner shoulders and armpits stay this far inside the outer layer's. */
    inset: 0.03,
    /** Inner cuff width stays at least this much below the outer cuff width. */
    cuffMargin: 0.04,
    /** Inner sleeve is this much (fraction of arm length) shorter than a long outer sleeve. */
    sleeveMargin: 0.02,
  },
  mesh: {
    cols: 24,
    rows: 48,
    /** MLS weight exponent (w = 1 / d^(2α)). */
    alpha: 1,
    /** Extra handles along each outline segment: one per this fraction of the larger cutout side, at most `maxEdgeSamples` */
    edgeSpacing: 0.05,
    maxEdgeSamples: 16,
    /** A handle this close (garment units) to a vertex pins it exactly. */
    snap: 1e-9,
  },
} as const;
