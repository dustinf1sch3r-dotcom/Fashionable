/**
 * Capture checks (docs/TRY_ON.md §8): what in a fresh cutout suggests the photo will not fit well,
 * so the add form can say so while the garment is still in front of the user. Pure: codes only,
 * the words live in the UI.
 *
 * - `cut-off`: the garment reaches the photo's edge (the cutout service pads the garment, so an
 *   opaque border can only be the photo's own edge).
 * - `several-pieces`: more than one large separate piece (another garment, a second shoe of a
 *   different pair), or a clothes rail: a bar above the garment that is much wider than the
 *   hooks that hang from it.
 * - `folded`: trousers or a jumpsuit with no gap between the legs, or a top or dress with neither
 *   sleeves nor a neck dip: folded, or hung in half.
 * - `unclear`: nothing above, but detection could not read the outline with confidence.
 */
import type { RigKind } from '../model/types';
import { FIT_MIN_CONFIDENCE, type AlphaMask } from './contract';
import { edgeContact } from './contact';
import { detectStructure } from './detect';
import { labelComponents } from './prep';

export type CaptureProblem = 'cut-off' | 'several-pieces' | 'folded' | 'unclear';

export const CAPTURE_RULES = {
  alphaThreshold: 128,
  /** The analysis grid has at most this many cells on its longer side. */
  maxGridSide: 128,
  cellFill: 0.5,
  /** A piece counts as a separate garment when it is at least this share of the biggest one … */
  pieceShare: 0.15,
  /** … and at least this share of the frame. */
  pieceFrame: 0.01,
  /** Rail: the top bar is at least this wide (share of the garment's width) … */
  railBarWidth: 0.2,
  /** … at most this tall (share of the height), starting within the top `railTop` of it … */
  railBarHeight: 0.1,
  railTop: 0.1,
  /** … and below it, within `railSearch` of the height, the silhouette narrows to under this share of the bar. */
  railNarrow: 0.5,
  railSearch: 0.25,
  /** … before it widens again to at least this many times that narrowest width. */
  railRegrow: 2,
} as const;

const R = CAPTURE_RULES;

interface Grid {
  w: number;
  h: number;
  px: Uint8Array;
}

function toGrid(mask: AlphaMask): Grid | undefined {
  const { width: W, height: H, alpha } = mask;
  if (!(W > 0 && H > 0) || alpha.length < W * H) return undefined;
  const k = Math.max(1, Math.ceil(Math.max(W, H) / R.maxGridSide));
  const w = Math.ceil(W / k);
  const h = Math.ceil(H / k);
  const px = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      let on = 0;
      let total = 0;
      for (let y = gy * k; y < Math.min(H, (gy + 1) * k); y++) {
        for (let x = gx * k; x < Math.min(W, (gx + 1) * k); x++) {
          total++;
          if ((alpha[y * W + x] as number) >= R.alphaThreshold) on++;
        }
      }
      if (total > 0 && on / total >= R.cellFill) px[gy * w + gx] = 1;
    }
  }
  return { w, h, px };
}

/** Number of separate large pieces (see `pieceShare`). */
export function countPieces(mask: AlphaMask): number {
  const g = toGrid(mask);
  if (!g) return 0;
  const { sizes } = labelComponents(g.px, g.w, g.h);
  const biggest = Math.max(0, ...sizes);
  if (biggest === 0) return 0;
  return sizes.filter((s) => s >= R.pieceShare * biggest && s >= R.pieceFrame * g.w * g.h).length;
}

/**
 * Is there a bar above the garment, such as a clothes rail? From the top: a band of rows that is
 * wide (at least `railBarWidth` of the garment) and short, then a waist (the hooks and hangers
 * it holds the garment by) that is much narrower than the bar, then the garment itself, wide again.
 * A hook or a hanger's neck is never that wide; a hood or a collar widens steadily instead.
 */
export function hasTopBar(mask: AlphaMask): boolean {
  const g = toGrid(mask);
  if (!g) return false;
  const { w, h, px } = g;
  const count: number[] = [];
  let y0 = -1;
  let y1 = -1;
  let x0 = w;
  let x1 = -1;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) {
      if (px[y * w + x]) {
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
    count.push(n);
    if (n > 0) {
      if (y0 < 0) y0 = y;
      y1 = y;
    }
  }
  if (y0 < 0) return false;
  const bodyH = y1 - y0 + 1;
  const bodyW = x1 - x0 + 1;
  // Smooth over three rows so a stray cell does not make or break a band.
  const at = (y: number): number => {
    const a = count[y - 1] ?? count[y] ?? 0;
    const b = count[y] ?? 0;
    const c = count[y + 1] ?? count[y] ?? 0;
    return (a + b + c) / 3;
  };
  const bar = R.railBarWidth * bodyW;
  // The bar: rows from the top that are at least `bar` wide, within the first part of the height.
  let barStart = -1;
  for (let y = y0; y <= y0 + R.railTop * bodyH; y++) {
    if (at(y) >= bar) {
      barStart = y;
      break;
    }
  }
  if (barStart < 0) return false;
  let barEnd = barStart;
  let barMax = 0;
  while (barEnd + 1 <= y1 && at(barEnd + 1) >= bar) {
    barEnd++;
    barMax = Math.max(barMax, at(barEnd));
  }
  barMax = Math.max(barMax, at(barStart));
  if (barEnd - barStart + 1 > R.railBarHeight * bodyH) return false;
  // The waist below it, then the garment widening again.
  let narrow = Infinity;
  let narrowAt = -1;
  for (let y = barEnd + 1; y <= Math.min(y1, barEnd + R.railSearch * bodyH); y++) {
    if (at(y) < narrow) {
      narrow = at(y);
      narrowAt = y;
    }
  }
  if (narrowAt < 0 || narrow > R.railNarrow * barMax) return false;
  for (let y = narrowAt + 1; y <= y1; y++) {
    if (at(y) >= Math.max(R.railRegrow * narrow, bar)) return true;
  }
  return false;
}

/**
 * Problems with how a garment was photographed, most important first. `kind` is the rig kind the
 * garment will be fitted with (`undefined` for shoes, bags … which only get the edge check).
 */
export function assessCapture(mask: AlphaMask, kind: RigKind | undefined): CaptureProblem[] {
  const problems: CaptureProblem[] = [];
  if (edgeContact(mask).sides > 0) problems.push('cut-off');
  if (!kind) return problems;
  if (countPieces(mask) > 1 || hasTopBar(mask)) problems.push('several-pieces');
  const found = detectStructure(mask, kind);
  const folded =
    found.legGap === false ||
    (found.sleeves !== undefined && found.sleeves === 0 && found.neck === false);
  if (folded) problems.push('folded');
  else if (
    !problems.includes('several-pieces') &&
    (!found.rig || found.rig.confidence < FIT_MIN_CONFIDENCE)
  ) {
    problems.push('unclear');
  }
  return problems;
}
