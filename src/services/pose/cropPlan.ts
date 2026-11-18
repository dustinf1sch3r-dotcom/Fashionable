import type { PixelRect } from '@/core/tryon/pose';

/** Source and destination rectangles for one `drawImage` call. */
export interface CropPlan {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Where the part of `window` that lies inside the image goes in the output. The rest of the
 * output stays the fill colour. `undefined` when the window misses the image entirely.
 * Pure so it can be tested without a canvas.
 */
export function planCrop(
  window: PixelRect,
  image: { width: number; height: number },
  output: { width: number; height: number },
): CropPlan | undefined {
  if (window.width <= 0 || window.height <= 0) return undefined;
  const x0 = Math.max(0, window.x);
  const y0 = Math.max(0, window.y);
  const x1 = Math.min(image.width, window.x + window.width);
  const y1 = Math.min(image.height, window.y + window.height);
  if (x1 <= x0 || y1 <= y0) return undefined;
  const kx = output.width / window.width;
  const ky = output.height / window.height;
  return {
    sx: x0,
    sy: y0,
    sw: x1 - x0,
    sh: y1 - y0,
    dx: (x0 - window.x) * kx,
    dy: (y0 - window.y) * ky,
    dw: (x1 - x0) * kx,
    dh: (y1 - y0) * ky,
  };
}
