import { slotOf } from '../model/slots';
import type { BodyTemplate, FitAdjust, Item, Outfit, Placement } from '../model/types';
import { anchorFor, TUCKED_BASE_Z } from './anchors';
import { POSE_RULES } from './pose';

export const FIT_LIMITS = {
  scale: { min: 0.5, max: 2.0 },
  offset: 400,
  rotation: 30,
} as const;

/** Horizontal spacing between stacked jewellery items, in mannequin units. */
export const JEWELRY_SPACING = 40;

export const IDENTITY_FIT: Readonly<FitAdjust> = { dx: 0, dy: 0, scale: 1, rotation: 0 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Enforce the TRY_ON §6 limits. */
export function clampFit(adj: FitAdjust): FitAdjust {
  return {
    dx: clamp(adj.dx, -FIT_LIMITS.offset, FIT_LIMITS.offset),
    dy: clamp(adj.dy, -FIT_LIMITS.offset, FIT_LIMITS.offset),
    scale: clamp(adj.scale, FIT_LIMITS.scale.min, FIT_LIMITS.scale.max),
    rotation: clamp(adj.rotation, -FIT_LIMITS.rotation, FIT_LIMITS.rotation),
  };
}

interface PlaceOptions {
  /** Z override (tucked base). */
  z?: number;
  /** Extra horizontal shift added after fit adjustment (jewellery spacing). */
  extraDx?: number;
}

function place(
  item: Item,
  body: BodyTemplate,
  override: FitAdjust | undefined,
  o: PlaceOptions,
): Placement {
  const a = anchorFor(slotOf(item), body);
  const adj = clampFit(override ?? item.fitAdjust ?? IDENTITY_FIT);
  const width = a.width * adj.scale;
  const height = width / item.cutout.aspectRatio;
  let x = a.centerX - width / 2 + adj.dx + (o.extraDx ?? 0);
  let y = a.topY + adj.dy;
  if (slotOf(item) === 'shoes') {
    // Shoes stay on the canvas even when the photo cut the feet off (ankles near the bottom).
    x = clamp(x, 0, Math.max(0, POSE_RULES.canvasWidth - width));
    y = clamp(y, 0, Math.max(0, POSE_RULES.canvasHeight - height));
  }
  return {
    itemId: item.id,
    x,
    y,
    width,
    height,
    rotation: adj.rotation,
    z: o.z ?? a.z,
  };
}

/** Placement of one item: override, else the item's saved fit, else identity (TRY_ON §5). */
export function placeItem(item: Item, body: BodyTemplate, override?: FitAdjust): Placement {
  return place(item, body, override, {});
}

/** Horizontal offsets for n jewellery items, centred on 0. */
function jewelryOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * JEWELRY_SPACING;
}

/**
 * Placements for all items of an outfit, sorted by z (stable: ties keep input order).
 * Applies `outfit.tucked` and `outfit.fitOverrides`.
 */
export function placeOutfit(
  items: readonly Item[],
  body: BodyTemplate,
  outfit?: Outfit,
): Placement[] {
  const jewelry = items.filter((i) => slotOf(i) === 'jewelry');
  const placements = items.map((item) => {
    const slot = slotOf(item);
    const opts: PlaceOptions = {};
    if (slot === 'base' && outfit?.tucked) opts.z = TUCKED_BASE_Z;
    if (slot === 'jewelry') opts.extraDx = jewelryOffset(jewelry.indexOf(item), jewelry.length);
    return place(item, body, outfit?.fitOverrides?.[item.id], opts);
  });
  return placements
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.z - b.p.z || a.i - b.i)
    .map(({ p }) => p);
}
