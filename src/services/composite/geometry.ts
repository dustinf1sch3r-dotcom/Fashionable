/** A layer in mannequin units, as `OutfitCompositor.compose` receives it. */
export interface UnitLayer {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the layer's centre. */
  rotation: number;
}

/** Where a layer lands on the output canvas, in whole pixels. */
export interface LayerBox {
  /** Top-left of the buffer on the output canvas (clipped to it). */
  x: number;
  y: number;
  /** Buffer size (the rotated rectangle's bounding box, clipped to the canvas). */
  width: number;
  height: number;
  /** Centre of the (unrotated) layer image inside the buffer, and its drawn size. */
  centerX: number;
  centerY: number;
  drawWidth: number;
  drawHeight: number;
  /** Radians, clockwise. */
  angle: number;
}

/**
 * The buffer a layer is drawn into: the bounding box of the rotated rectangle, in output pixels
 * and clipped to the canvas. `undefined` when nothing of it is visible.
 */
export function layerBox(
  layer: UnitLayer,
  pixelsPerUnit: number,
  outWidth: number,
  outHeight: number,
): LayerBox | undefined {
  const w = layer.width * pixelsPerUnit;
  const h = layer.height * pixelsPerUnit;
  if (!(w > 0) || !(h > 0)) return undefined;
  const cx = (layer.x + layer.width / 2) * pixelsPerUnit;
  const cy = (layer.y + layer.height / 2) * pixelsPerUnit;
  const angle = (layer.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const halfW = (w * cos + h * sin) / 2;
  const halfH = (w * sin + h * cos) / 2;
  const x0 = Math.max(0, Math.floor(cx - halfW));
  const y0 = Math.max(0, Math.floor(cy - halfH));
  const x1 = Math.min(outWidth, Math.ceil(cx + halfW));
  const y1 = Math.min(outHeight, Math.ceil(cy + halfH));
  if (x1 <= x0 || y1 <= y0) return undefined;
  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    centerX: cx - x0,
    centerY: cy - y0,
    drawWidth: w,
    drawHeight: h,
    angle,
  };
}

/** Output canvas size for a pixel density (the canvas is always 1000 × 2000 units). */
export function outputSize(pixelsPerUnit: number): { width: number; height: number } {
  const ppu = Math.max(0.1, Math.min(pixelsPerUnit, 2));
  return { width: Math.round(1000 * ppu), height: Math.round(2000 * ppu) };
}
