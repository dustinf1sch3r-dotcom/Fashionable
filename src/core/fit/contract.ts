import type { Point } from '../model/types';

/** An alpha mask of a cutout (one byte per pixel, 0 = transparent). */
export interface AlphaMask {
  width: number;
  height: number;
  alpha: Uint8Array | Uint8ClampedArray;
}

/** A triangle mesh mapping cutout pixels (source, 0–1) to mannequin units (target). */
export interface FitMesh {
  /** Source vertices, normalised 0–1 in the cutout. */
  source: Point[];
  /** Target vertices in mannequin units (1000 × 2000 canvas). */
  target: Point[];
  /** Vertex index triples. */
  triangles: [number, number, number][];
  /** Bounding box of `target`, mannequin units. */
  bounds: { x: number; y: number; width: number; height: number };
}

/** Rule-set version stored on rigs produced by `detectRig`; bump when detection changes. */
export const RIG_VERSION = 2;

/** Below this detection confidence the UI offers "Check garment points". */
export const FIT_MIN_CONFIDENCE = 0.6;
