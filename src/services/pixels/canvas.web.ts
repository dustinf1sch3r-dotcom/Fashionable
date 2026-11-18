import { applyMaskAlpha, cropFromTrim, fitWithin, resizeMask, trimToAlpha } from '@/core/image';
import type { CutoutCrop } from '@/core/model/types';

const RAW_SVG_PREFIX = 'data:image/svg+xml;utf8,';

/**
 * The URI as a browser can load it. The app's flat garment art is raw SVG markup after the prefix
 * (react-native-web encodes it for `<Image>` itself); loaded by hand, a `#` in a colour would start
 * a URL fragment, so the markup is encoded here.
 */
function loadableUri(uri: string): string {
  return uri.startsWith(RAW_SVG_PREFIX)
    ? `data:image/svg+xml,${encodeURIComponent(uri.slice(RAW_SVG_PREFIX.length))}`
    : uri;
}

/** Decodes an image URI (object URL, data URL or http URL) into an element. */
export function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = loadableUri(uri);
  });
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** PNG encoding of a canvas; rejects where the browser cannot encode it. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the PNG'))),
      'image/png',
    );
  });
}

/** JPEG encoding of a canvas (quality 0–1); rejects where the browser cannot encode it. */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the JPEG'))),
      'image/jpeg',
      quality,
    );
  });
}

/** RGBA pixels of the image squashed to `width` x `height` (aspect ratio not kept). */
export function readSquashed(
  img: HTMLImageElement,
  width: number,
  height: number,
): Uint8ClampedArray {
  const ctx = context2d(makeCanvas(width, height));
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

/** Longest side of the cutout PNG (docs/TRY_ON.md §7). */
export const CUTOUT_MAX_PX = 1024;
/** Longest side of the photo the mask is applied to, to bound memory on phones. */
const WORK_MAX_PX = 2048;

export interface MaskedCutout {
  blob: Blob;
  width: number;
  height: number;
  /** The part of the photo the cutout covers, in the photo's own pixels. */
  crop: CutoutCrop;
}

/**
 * Applies a float mask (0..1, `maskW` x `maskH`, upscaled to the photo's size) as the image's
 * alpha channel, trims to the visible pixels (alpha > 16, 2% padding), scales the result down to
 * at most `CUTOUT_MAX_PX` and encodes a PNG. `undefined` when the mask leaves nothing visible.
 */
export async function applyMaskToImage(
  img: HTMLImageElement,
  mask: Float32Array,
  maskW: number,
  maskH: number,
): Promise<MaskedCutout | undefined> {
  const work = fitWithin(img.naturalWidth, img.naturalHeight, WORK_MAX_PX);
  const canvas = makeCanvas(work.width, work.height);
  const ctx = context2d(canvas);
  ctx.drawImage(img, 0, 0, work.width, work.height);
  const pixels = ctx.getImageData(0, 0, work.width, work.height);
  applyMaskAlpha(pixels.data, resizeMask(mask, maskW, maskH, work.width, work.height));
  const rect = trimToAlpha(pixels.data, work.width, work.height);
  if (!rect) return undefined;
  ctx.putImageData(pixels, 0, 0);
  const size = fitWithin(rect.width, rect.height, CUTOUT_MAX_PX);
  const out = makeCanvas(size.width, size.height);
  const outCtx = context2d(out);
  outCtx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, size.width, size.height);
  return {
    blob: await canvasToPng(out),
    width: size.width,
    height: size.height,
    crop: cropFromTrim(
      rect,
      work,
      { width: img.naturalWidth, height: img.naturalHeight },
      size.width,
    ),
  };
}
