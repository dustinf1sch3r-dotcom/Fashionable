/**
 * Merging garments into the picture (docs/TRY_ON.md §13). Pure: no I/O, no time, no randomness
 * (grain is seeded).
 */
export type { BackdropKind, CompositeInput, CompositeLayer, RGBAImage } from './types';
export { compositeOutfit } from './compose';
export { COMPOSITE_RULES } from './rules';
export { applyGains, colourGains } from './colour';
export { blurLarge, boxBlur, distanceTransform, featherAlpha, gaussianBlur } from './filters';
export type { Plane } from './filters';
export { addGrain, grainSigma, softnessSigma } from './grain';
export { photoShading, silhouetteShading } from './shading';
export { shadowMultiplier } from './shadow';
export {
  analysePhoto,
  estimateCast,
  estimateExposure,
  estimateNoise,
  estimateSharpness,
  luminancePlane,
} from './stats';
export type { PhotoStats } from './stats';
