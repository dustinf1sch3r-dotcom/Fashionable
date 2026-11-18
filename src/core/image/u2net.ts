/**
 * Pre- and post-processing for the U-2-Netp salient-object model (BritishWerewolf/U-2-Netp,
 * `onnx/model.onnx`, which is the `rembg` export of xuebinqin/U-2-Net's `u2netp`).
 *
 * Sources used for the maths:
 * - U-2-Net `data_loader.py` (`RescaleT(320)` squashes the photo to 320 x 320 without keeping the
 *   aspect ratio; `ToTensorLab(flag=0)` divides by the image's maximum value, then subtracts the
 *   ImageNet mean and divides by the ImageNet std per channel) and `u2net_test.py` (takes
 *   output `d1`, the first side output, then min-max normalises it).
 * - The model's `config.json` / `preprocessor_config.json` on Hugging Face: input `input.1`
 *   shaped [1, 3, 320, 320], `image_mean` [0.485, 0.456, 0.406], `image_std` [0.229, 0.224, 0.225],
 *   seven outputs of which the first (`1959`) is the fused map.
 * - rembg's `u2net.py` session, which does the same (squash to 320, divide by max, normalise).
 *
 * Pure code: pixels in, numbers out. The canvas and onnxruntime parts live in src/services.
 */

/** Square side the model expects. */
export const U2NET_SIZE = 320;
export const U2NET_MEAN = [0.485, 0.456, 0.406] as const;
export const U2NET_STD = [0.229, 0.224, 0.225] as const;

/** Mask values below `lo` become fully transparent and above `hi` fully opaque. */
export const MASK_SOFT_LO = 0.2;
export const MASK_SOFT_HI = 0.8;

/**
 * Converts RGBA pixels of an image already resized to `size` x `size` into the model's
 * channel-first float input (R plane, G plane, B plane). Alpha is ignored. Following the original
 * loader, the values are divided by the image's own maximum (at least 1e-6) rather than by 255.
 */
export function toModelInput(rgba: ArrayLike<number>, size: number = U2NET_SIZE): Float32Array {
  const count = size * size;
  if (rgba.length < count * 4) throw new Error('toModelInput: pixel buffer is too small');
  let max = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    if (rgba[o] > max) max = rgba[o];
    if (rgba[o + 1] > max) max = rgba[o + 1];
    if (rgba[o + 2] > max) max = rgba[o + 2];
  }
  const divisor = Math.max(max, 1e-6);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    for (let c = 0; c < 3; c++) {
      out[c * count + i] = (rgba[o + c] / divisor - U2NET_MEAN[c]) / U2NET_STD[c];
    }
  }
  return out;
}

/**
 * Min-max normalises to 0..1 (the model's raw output is not guaranteed to span the range). A flat
 * map, with no contrast to normalise, becomes all zeros: "no garment found".
 */
export function normalizeMinMax(values: ArrayLike<number>): Float32Array {
  const out = new Float32Array(values.length);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (!(range > 1e-6)) return out;
  for (let i = 0; i < values.length; i++) out[i] = (values[i] - min) / range;
  return out;
}

/** Smoothstep between `lo` and `hi`: a soft edge that removes faint haze and fills the core. */
export function softThreshold(
  mask: Float32Array,
  lo: number = MASK_SOFT_LO,
  hi: number = MASK_SOFT_HI,
): Float32Array {
  const out = new Float32Array(mask.length);
  const span = hi - lo;
  for (let i = 0; i < mask.length; i++) {
    const t = Math.min(1, Math.max(0, (mask[i] - lo) / span));
    out[i] = t * t * (3 - 2 * t);
  }
  return out;
}

/** Bilinear resize of a single-channel float map (pixel centres aligned, edges clamped). */
export function resizeMask(
  mask: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  if (mask.length !== srcW * srcH) throw new Error('resizeMask: size does not match the data');
  const out = new Float32Array(dstW * dstH);
  const sx = srcW / dstW;
  const sy = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const fy = Math.min(srcH - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < dstW; x++) {
      const fx = Math.min(srcW - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = fx - x0;
      const top = mask[y0 * srcW + x0] * (1 - wx) + mask[y0 * srcW + x1] * wx;
      const bottom = mask[y1 * srcW + x0] * (1 - wx) + mask[y1 * srcW + x1] * wx;
      out[y * dstW + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

/**
 * Multiplies each pixel's alpha by the matching mask value (0..1), in place. `rgba` and `mask`
 * must describe the same pixel grid.
 */
export function applyMaskAlpha(rgba: Uint8ClampedArray, mask: Float32Array): void {
  if (rgba.length !== mask.length * 4) throw new Error('applyMaskAlpha: size mismatch');
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4 + 3;
    rgba[o] = Math.round(rgba[o] * Math.min(1, Math.max(0, mask[i])));
  }
}

/** Fraction of mask values above 0.5; callers use it to reject empty or all-covering masks. */
export function coverage(mask: Float32Array): number {
  if (mask.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.5) n++;
  return n / mask.length;
}
