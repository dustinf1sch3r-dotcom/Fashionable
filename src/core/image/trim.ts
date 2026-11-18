/** A crop rectangle in pixels. `x`/`y` are the top-left corner. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** docs/TRY_ON.md §7: pixels with alpha above this count as part of the garment. */
export const TRIM_ALPHA_THRESHOLD = 16;
/** Padding added around the garment, as a fraction of its longer side. */
export const TRIM_PADDING = 0.02;

/**
 * Bounding box of the pixels whose alpha is above `threshold`, grown by `padding` (a fraction of
 * the box's longer side) on every side and clamped to the image. `undefined` when nothing is
 * visible, which callers treat as "background removal found no garment".
 *
 * @param rgba row-major RGBA, 4 bytes per pixel, `width * height * 4` long.
 */
export function trimToAlpha(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number = TRIM_ALPHA_THRESHOLD,
  padding: number = TRIM_PADDING,
): CropRect | undefined {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (rgba[row + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        maxY = y;
      }
    }
  }
  if (maxX < 0) return undefined;
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const pad = Math.round(Math.max(boxW, boxH) * Math.max(0, padding));
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(width, maxX + 1 + pad);
  const y1 = Math.min(height, maxY + 1 + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Size that fits `width` x `height` inside a `maxSide` square without enlarging it, keeping the
 * aspect ratio. Both sides are at least 1.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
