import type { CutoutCrop } from '../model/types';
import type { CropRect } from './trim';

/**
 * Maths for `Item.cutout.crop`: the rectangle of the original photo a cutout covers and the
 * factor from original pixels to cutout pixels. Pure.
 */

export interface Size {
  width: number;
  height: number;
}

/**
 * Crop for a cutout made by trimming `rect` out of a working copy of the photo (`work` pixels,
 * itself a scaled copy of the `original`) and scaling the trim to `outWidth` pixels wide.
 */
export function cropFromTrim(
  rect: CropRect,
  work: Size,
  original: Size,
  outWidth: number,
): CutoutCrop {
  const kx = original.width / work.width;
  const ky = original.height / work.height;
  const width = rect.width * kx;
  return {
    x: rect.x * kx,
    y: rect.y * ky,
    width,
    height: rect.height * ky,
    scale: outWidth / width,
  };
}

/** The crop of a cutout that is the whole photo, `cutoutWidth` pixels wide ("Use original"). */
export function wholePhotoCrop(original: Size, cutoutWidth: number = original.width): CutoutCrop {
  return {
    x: 0,
    y: 0,
    width: original.width,
    height: original.height,
    scale: cutoutWidth / original.width,
  };
}

/** The crop rectangle in a copy of the photo `work` pixels in size (the touch-up canvas). */
export function cropToWork(crop: CutoutCrop, original: Size, work: Size): CropRect {
  const kx = work.width / original.width;
  const ky = work.height / original.height;
  return { x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky };
}

/** A point in original-photo pixels, expressed in cutout pixels. */
export function originalToCutout(crop: CutoutCrop, p: { x: number; y: number }) {
  return { x: (p.x - crop.x) * crop.scale, y: (p.y - crop.y) * crop.scale };
}

/** A point in cutout pixels, expressed in original-photo pixels. */
export function cutoutToOriginal(crop: CutoutCrop, p: { x: number; y: number }) {
  return { x: p.x / crop.scale + crop.x, y: p.y / crop.scale + crop.y };
}
