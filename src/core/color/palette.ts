import type { ColorSwatch } from '../model/types';
import { deltaE, nameColor, rgbToLab } from './classify';
import type { Lab } from './classify';
import { mulberry32 } from './rng';

const K = 4;
const MAX_ITERATIONS = 24;
const MERGE_DELTA_E = 12;
const MIN_SHARE = 0.08;
const MAX_SWATCHES = 3;

interface Cluster {
  count: number;
  r: number;
  g: number;
  b: number;
}

const hex2 = (v: number): string => Math.round(v).toString(16).padStart(2, '0');

function clusterLab(c: Cluster): Lab {
  return rgbToLab({ r: c.r / c.count, g: c.g / c.count, b: c.b / c.count });
}

/**
 * Dominant colours of an RGBA image: seeded k-means (k = 4, k-means++ init, in Lab) over pixels
 * with alpha > 128; clusters closer than dE 12 are merged, shares < 0.08 dropped, at most 3
 * swatches returned (largest first) with shares renormalised to sum to 1.
 */
export function extractPalette(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  seed: number,
): ColorSwatch[] {
  const total = Math.min(width * height, Math.floor(rgba.length / 4));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const labs: Lab[] = [];
  for (let i = 0; i < total; i++) {
    if (rgba[i * 4 + 3] <= 128) continue;
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    rs.push(r);
    gs.push(g);
    bs.push(b);
    labs.push(rgbToLab({ r, g, b }));
  }
  const n = labs.length;
  if (n === 0) return [];

  const rng = mulberry32(seed);

  // k-means++ initialisation.
  const centers: Lab[] = [labs[Math.floor(rng() * n)]];
  while (centers.length < Math.min(K, n)) {
    const dist = labs.map((p) => Math.min(...centers.map((c) => deltaE(p, c))) ** 2);
    const sum = dist.reduce((a, d) => a + d, 0);
    if (sum === 0) break; // every pixel already coincides with a centre
    let target = rng() * sum;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      target -= dist[i];
      if (target <= 0) {
        pick = i;
        break;
      }
    }
    centers.push(labs[pick]);
  }

  const assign = new Int32Array(n).fill(-1);
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = deltaE(labs[i], centers[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }
    if (!changed) break;
    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < n; i++) {
      const s = sums[assign[i]];
      s.L += labs[i].L;
      s.a += labs[i].a;
      s.b += labs[i].b;
      s.n++;
    }
    sums.forEach((s, c) => {
      if (s.n > 0) centers[c] = { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n };
    });
  }

  let clusters: Cluster[] = centers.map(() => ({ count: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < n; i++) {
    const c = clusters[assign[i]];
    c.count++;
    c.r += rs[i];
    c.g += gs[i];
    c.b += bs[i];
  }
  clusters = clusters.filter((c) => c.count > 0);

  // Merge clusters closer than dE 12 (closest pair first) until none remain.
  for (;;) {
    let bi = -1;
    let bj = -1;
    let bd = MERGE_DELTA_E;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = deltaE(clusterLab(clusters[i]), clusterLab(clusters[j]));
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0) break;
    const a = clusters[bi];
    const b = clusters[bj];
    clusters[bi] = { count: a.count + b.count, r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
    clusters.splice(bj, 1);
  }

  clusters.sort((a, b) => b.count - a.count);
  let kept = clusters.filter((c) => c.count / n >= MIN_SHARE);
  if (kept.length === 0) kept = [clusters[0]];
  kept = kept.slice(0, MAX_SWATCHES);
  const keptTotal = kept.reduce((a, c) => a + c.count, 0);

  return kept.map((c) => {
    const hex = `#${hex2(c.r / c.count)}${hex2(c.g / c.count)}${hex2(c.b / c.count)}`;
    return { hex, share: c.count / keptTotal, name: nameColor(hex) };
  });
}
