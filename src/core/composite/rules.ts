/** Every tunable number of the compositing pipeline (docs/TRY_ON.md §13). Nothing is inline elsewhere. */
export const COMPOSITE_RULES = {
  stats: {
    /** Grey-world ignores near-black, near-white and strongly saturated pixels. */
    nearBlack: 15,
    nearWhite: 235,
    maxSaturation: 0.6,
    /** Per-channel illuminant gain is clamped to 1 ± this. */
    castClamp: 0.08,
    /** Pixels with alpha below this are not part of the photo. */
    minAlpha: 128,
    /** Statistics look at roughly this many pixels at most (strided). */
    sampleTarget: 150_000,
    /** Noise: a pixel is flat if the 3x3-mean gradient over a 6 px span is below this (levels). */
    flatGradient: 8,
    minFlatPixels: 200,
    /** Sharpness: gradient energy vs a copy blurred by this sigma. */
    sharpnessBlurSigma: 1,
  },
  colour: {
    /** How much of the illuminant cast (exponent on the gain) reaches the garment. */
    castStrength: 0.4,
    /** Fraction of the exposure difference applied (exponent on the exposure ratio). */
    exposureStrength: 0.5,
    /** Photo median luminance (0..1) that leaves the garment unchanged. */
    exposureReference: 0.5,
    exposureGainMin: 0.9,
    exposureGainMax: 1.05,
  },
  // Only broad light and shadow carries over: finer detail would show the body (or the person's own
  // clothes) through the garment, which reads as see-through fabric (seen on real photos).
  photoShading: {
    strength: 0.5,
    min: 0.85,
    max: 1.1,
    /** Low-pass sigma as a fraction of canvas width. */
    lowPassSigmaFrac: 0.1,
    /** Fine sigma (fold detail) as a fraction of canvas width. */
    detailSigmaFrac: 0.004,
    foldGain: 0,
    foldMax: 0,
  },
  silhouetteShading: {
    strength: 0.35,
    min: 0.6,
    max: 1.25,
    /** Rounded rim width as a fraction of canvas width. */
    rimFrac: 0.06,
    edgeDarkening: 0.5,
    /** Top-left light, 0..1 of the rim. */
    lightGain: 0.3,
    /** Regions with more pixels than this get their distance transform at half resolution. */
    halfResolutionAbove: 40_000,
  },
  softness: {
    /** Largest garment blur sigma (px at density 1). */
    maxBlurSigma: 1.5,
    /** Gradient ratio at or above which the photo counts as fully sharp (no blur). */
    sharpRatio: 1.6,
    /** Grain sigma = photo noise × this, capped. */
    grainStrength: 1,
    grainMax: 8,
  },
  feather: {
    /** Alpha feather sigma in output px at density 1 (about one pixel of softness). */
    sigma: 0.5,
  },
  shadow: {
    /** Blur radius as a fraction of the output canvas width (already in output pixels). */
    radiusFrac: 0.015,
    /** Gaussian sigma = radius × this. */
    sigmaPerRadius: 0.6,
    opacityPhoto: 0.25,
    opacitySilhouette: 0.2,
  },
  /** Density is clamped to this range before it scales radii. */
  densityMin: 0.25,
  densityMax: 4,
} as const;
