import type { FitAdjust, Placement } from '@/core/model/types';

/** A garment drawn warped to the body: an image covering `bounds` (mannequin units). */
export interface FittedLayer {
  uri: string;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Where a fitted garment's image goes: its own bounds, with the item's `fitAdjust` applied on top
 * the same way as for rigid placement (scale about the top centre, then nudge and rotate). `z`
 * comes from the rigid placement, so layer order and the tucked shirt keep working.
 */
export function fittedPlacement(
  itemId: Placement['itemId'],
  layer: FittedLayer,
  adjust: FitAdjust,
  z: number,
): Placement {
  const { x, y, width, height } = layer.bounds;
  const w = width * adjust.scale;
  const h = height * adjust.scale;
  return {
    itemId,
    x: x + width / 2 - w / 2 + adjust.dx,
    y: y + adjust.dy,
    width: w,
    height: h,
    rotation: adjust.rotation,
    z,
  };
}
