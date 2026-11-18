/**
 * The fit mesh (docs/TRY_ON.md §12.4): a grid over the whole cutout deformed by MLS with the rig
 * points (plus points sampled along the outline between them) as handles. No cells are dropped:
 * culling by the coarse rig outline cut real garment edges. Pure and deterministic.
 */
import type { GarmentRig, Point, RigKind } from '../model/types';
import type { FitMesh } from './contract';
import { mlsSimilarity, type Handle } from './mls';
import { FIT_RULES } from './weights';

/** Outline order of the rig points, going round the garment clockwise from the left neck. */
const OUTLINE: Readonly<Record<RigKind, readonly string[]>> = {
  top: [
    'neckL',
    'shoulderL',
    'cuffOuterL',
    'cuffInnerL',
    'armpitL',
    'hemL',
    'hemR',
    'armpitR',
    'cuffInnerR',
    'cuffOuterR',
    'shoulderR',
    'neckR',
  ],
  trousers: [
    'waistL',
    'hipL',
    'hemOuterL',
    'hemInnerL',
    'crotch',
    'hemInnerR',
    'hemOuterR',
    'hipR',
    'waistR',
  ],
  skirt: ['waistL', 'hipL', 'hemL', 'hemR', 'hipR', 'waistR'],
  dress: [
    'neckL',
    'shoulderL',
    'cuffOuterL',
    'cuffInnerL',
    'armpitL',
    'waistL',
    'hipL',
    'hemL',
    'hemR',
    'hipR',
    'waistR',
    'armpitR',
    'cuffInnerR',
    'cuffOuterR',
    'shoulderR',
    'neckR',
  ],
  jumpsuit: [
    'neckL',
    'shoulderL',
    'cuffOuterL',
    'cuffInnerL',
    'armpitL',
    'waistL',
    'hipL',
    'hemOuterL',
    'hemInnerL',
    'crotch',
    'hemInnerR',
    'hemOuterR',
    'hipR',
    'waistR',
    'armpitR',
    'cuffInnerR',
    'cuffOuterR',
    'shoulderR',
    'neckR',
  ],
};

/** Kinds whose closing edge (neckR → neckL) is a collar curve, so it gets no edge handles. */
const OPEN_NECK: ReadonlySet<RigKind> = new Set<RigKind>(['top', 'dress', 'jumpsuit']);

/** MLS similarity deformation of a grid over the cutout into a mesh (§12.4). */
export function buildFitMesh(
  rig: GarmentRig,
  targets: Record<string, Point>,
  cutoutAspectRatio: number,
  grid?: { cols: number; rows: number },
): FitMesh {
  const M = FIT_RULES.mesh;
  const cols = Math.max(1, Math.floor(grid?.cols ?? M.cols));
  const rows = Math.max(1, Math.floor(grid?.rows ?? M.rows));
  const aspect = cutoutAspectRatio > 0 ? cutoutAspectRatio : 1;
  const maxDim = Math.max(aspect, 1);
  // Garment units: x is scaled by the aspect so distances are isotropic.
  const src = (q: Point): Point => ({ x: q.x * aspect, y: q.y });

  const order = OUTLINE[rig.kind].filter(
    (n) => rig.points[n] !== undefined && targets[n] !== undefined,
  );
  const handles: Handle[] = [];
  const closed = !OPEN_NECK.has(rig.kind);
  order.forEach((name, i) => {
    const p = src(rig.points[name] as Point);
    const q = targets[name] as Point;
    handles.push({ p, q });
    const nextName = order[i + 1] ?? (closed ? order[0] : undefined);
    if (nextName === undefined || nextName === name) return;
    const p2 = src(rig.points[nextName] as Point);
    const q2 = targets[nextName] as Point;
    const len = Math.hypot(p2.x - p.x, p2.y - p.y);
    const n = Math.min(M.maxEdgeSamples, Math.floor(len / (M.edgeSpacing * maxDim)));
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      handles.push({
        p: { x: p.x + (p2.x - p.x) * t, y: p.y + (p2.y - p.y) * t },
        q: { x: q.x + (q2.x - q.x) * t, y: q.y + (q2.y - q.y) * t },
      });
    }
  });
  // Rig points that are not on the outline (none today) still pin the mesh.
  for (const name of Object.keys(rig.points)) {
    if (order.includes(name) || targets[name] === undefined) continue;
    handles.push({ p: src(rig.points[name] as Point), q: targets[name] as Point });
  }
  const deform = mlsSimilarity(handles, M.alpha);

  const index = new Int32Array((cols + 1) * (rows + 1)).fill(-1);
  const source: Point[] = [];
  const target: Point[] = [];
  const vertex = (i: number, j: number): number => {
    const key = j * (cols + 1) + i;
    const existing = index[key] as number;
    if (existing >= 0) return existing;
    const s = { x: i / cols, y: j / rows };
    index[key] = source.length;
    source.push(s);
    target.push(deform(src(s)));
    return source.length - 1;
  };
  const triangles: [number, number, number][] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = vertex(i, j);
      const b = vertex(i + 1, j);
      const c = vertex(i + 1, j + 1);
      const d = vertex(i, j + 1);
      triangles.push([a, b, c], [a, c, d]);
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of target) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x);
    maxY = Math.max(maxY, t.y);
  }
  const bounds =
    target.length > 0
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : { x: 0, y: 0, width: 0, height: 0 };
  return { source, target, triangles, bounds };
}
