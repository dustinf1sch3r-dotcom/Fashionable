import type { GarmentRig, Point } from '@/core/model/types';

/**
 * Names for the rig points, as the person sees the picture: `L` is the viewer's left
 * (docs/TRY_ON.md §12.1), so "Left" here is the left side of the cutout on screen.
 */
export const POINT_LABELS: Readonly<Record<string, string>> = {
  neckL: 'Left collar',
  neckR: 'Right collar',
  shoulderL: 'Left shoulder',
  shoulderR: 'Right shoulder',
  armpitL: 'Left armpit',
  armpitR: 'Right armpit',
  cuffOuterL: 'Left cuff, outer edge',
  cuffInnerL: 'Left cuff, inner edge',
  cuffOuterR: 'Right cuff, outer edge',
  cuffInnerR: 'Right cuff, inner edge',
  hemL: 'Left hem',
  hemR: 'Right hem',
  waistL: 'Left waist',
  waistR: 'Right waist',
  hipL: 'Left hip',
  hipR: 'Right hip',
  crotch: 'Crotch',
  hemOuterL: 'Left leg hem, outer edge',
  hemInnerL: 'Left leg hem, inner edge',
  hemOuterR: 'Right leg hem, outer edge',
  hemInnerR: 'Right leg hem, inner edge',
};

export function pointLabel(name: string): string {
  return POINT_LABELS[name] ?? name;
}

/** The names present in `rig`: those of its kind in their natural order, then any others. */
export function orderedPointNames(rig: GarmentRig, known: readonly string[]): string[] {
  const present = Object.keys(rig.points);
  const first = known.filter((n) => present.includes(n));
  return [...first, ...present.filter((n) => !first.includes(n)).sort()];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The largest box of the given aspect ratio (width ÷ height) that fits and is centred in w × h. */
export function containBox(width: number, height: number, aspect: number): Box {
  if (width <= 0 || height <= 0 || !(aspect > 0)) return { x: 0, y: 0, width: 0, height: 0 };
  const w = Math.min(width, height * aspect);
  const h = w / aspect;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

/** A normalised point to pixels inside `box` (relative to the box's own top-left). */
export function toBoxPx(p: Point, box: Box): Point {
  return { x: p.x * box.width, y: p.y * box.height };
}

/** Pixels inside `box` (relative to its top-left) to a normalised point, kept within the picture. */
export function fromBoxPx(px: Point, box: Box): Point {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  return { x: round4(clamp01(px.x / box.width)), y: round4(clamp01(px.y / box.height)) };
}

/** The rig with one point moved to `to` (normalised, clamped to the picture). */
export function movePoint(rig: GarmentRig, name: string, to: Point): GarmentRig {
  if (!(name in rig.points)) return rig;
  return {
    ...rig,
    points: { ...rig.points, [name]: { x: round4(clamp01(to.x)), y: round4(clamp01(to.y)) } },
  };
}

/** Whether two rigs have the same points (confidence and flags are ignored). */
export function samePoints(a: GarmentRig, b: GarmentRig): boolean {
  const ka = Object.keys(a.points);
  if (ka.length !== Object.keys(b.points).length) return false;
  return ka.every((k) => {
    const p = a.points[k];
    const q = b.points[k];
    return p !== undefined && q !== undefined && p.x === q.x && p.y === q.y;
  });
}

/** The rig as the user leaves it: points as dragged, marked as hand-edited. */
export function asEdited(rig: GarmentRig): GarmentRig {
  return { ...rig, edited: true };
}
