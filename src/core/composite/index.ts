/**
 * Merging garments into the picture (docs/TRY_ON.md §13). CONTRACT ONLY: types and signatures are
 * fixed; implementations land in ticket C1. Pure: no I/O, no time, no randomness (seeded).
 */

/** Straight (non-premultiplied) RGBA pixels, row-major, 4 bytes per pixel. */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** One garment image placed on the output canvas (output pixels, top-left origin). */
export interface CompositeLayer {
  image: RGBAImage;
  x: number;
  y: number;
}

export type BackdropKind = 'photo' | 'silhouette';

export interface CompositeInput {
  /** The body photo or rendered silhouette, already at output size. */
  backdrop: RGBAImage;
  kind: BackdropKind;
  /** Bottom to top. */
  layers: readonly CompositeLayer[];
  /** Output pixels per mannequin unit (scales blur radii and feathering). */
  density: number;
  /** Seed for grain; same seed → same pixels. */
  seed: number;
}

const pending = (name: string): never => {
  throw new Error(`${name} is not implemented yet (ticket C1)`);
};

/** The merged image: backdrop with every layer colour-matched, shaded, softened and shadowed. */
export function compositeOutfit(input: CompositeInput): RGBAImage {
  void input;
  return pending('compositeOutfit');
}
