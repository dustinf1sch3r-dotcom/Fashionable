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
