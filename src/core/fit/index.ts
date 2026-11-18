/**
 * Fitting garments to the body (docs/TRY_ON.md §12). CONTRACT ONLY: types and signatures are
 * fixed; implementations land in ticket G1. Pure: no I/O, no time, no randomness.
 */
import type { FitBody, GarmentRig, Item, Point, RigKind } from '../model/types';

/** Rule-set version stored on rigs produced by `detectRig`; bump when detection changes. */
export const RIG_VERSION = 1;

/** Below this detection confidence the UI offers "Check garment points". */
export const FIT_MIN_CONFIDENCE = 0.6;

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

const pending = (name: string): never => {
  throw new Error(`${name} is not implemented yet (ticket G1)`);
};

/** Which rig kind an item uses, or `undefined` if it keeps rigid placement. */
export function rigKindOf(item: Pick<Item, 'category' | 'subcategory'>): RigKind | undefined {
  void item;
  return pending('rigKindOf');
}

/** Point names a rig of this kind has (sleeve points may be absent on sleeveless garments). */
export function rigPointNames(kind: RigKind): readonly string[] {
  void kind;
  return pending('rigPointNames');
}

/** Automatic rig detection from the cutout's alpha mask (§12.2). */
export function detectRig(mask: AlphaMask, kind: RigKind): GarmentRig | undefined {
  void mask;
  void kind;
  return pending('detectRig');
}

/** Where each rig point should land on this body, in mannequin units (§12.3). */
export function rigTargets(
  rig: GarmentRig,
  cutoutAspectRatio: number,
  body: FitBody,
  slot: 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece',
): Record<string, Point> {
  void rig;
  void cutoutAspectRatio;
  void body;
  void slot;
  return pending('rigTargets');
}

/** MLS similarity deformation of a grid over the cutout into a mesh (§12.4). */
export function buildFitMesh(
  rig: GarmentRig,
  targets: Record<string, Point>,
  cutoutAspectRatio: number,
  grid?: { cols: number; rows: number },
): FitMesh {
  void rig;
  void targets;
  void cutoutAspectRatio;
  void grid;
  return pending('buildFitMesh');
}
