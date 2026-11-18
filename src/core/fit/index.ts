/**
 * Fitting garments to the body (docs/TRY_ON.md §12). Pure: no I/O, no time, no randomness.
 * This file is the public surface; the work is split into rigs, detect, targets, mls and mesh.
 */
export { FIT_MIN_CONFIDENCE, RIG_VERSION } from './contract';
export type { AlphaMask, FitMesh } from './contract';
export { detectRig } from './detect';
export { buildFitMesh } from './mesh';
export { nestInside } from './nest';
export { rigKindOf, rigPointNames } from './rigs';
export { rigTargets } from './targets';
export { FIT_RULES } from './weights';
export { layeredTargets, type LayerInput, type LayerTargets, type LayerSlot } from './layers';
