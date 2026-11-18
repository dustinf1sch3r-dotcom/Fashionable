import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { wholePhotoCrop } from '@/core/image';
import type { ColorSwatch, CutoutCrop, Item } from '@/core/model/types';
import type { BackgroundRemover, ImageStore, PixelReader } from '@/services';
import { summarizeColors } from './colors';

/** Longest side of the stored original (docs/TRY_ON.md §7). */
export const ORIGINAL_MAX_PX = 1600;
/** Longest side of the thumbnail. */
export const THUMB_MAX_PX = 256;
/** Longest side of the pixels read for colour detection (docs/ARCHITECTURE.md). */
export const PALETTE_PX = 64;

const ORIGINAL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

export interface PickedPhoto {
  uri: string;
  /** Can be 0 when the system did not report a size. */
  width: number;
  height: number;
}

interface Rendered {
  uri: string;
  width: number;
  height: number;
}

/** A photo ready to tag: downscaled files in temporary storage plus what was detected. */
export interface ProcessedPhoto {
  original: Rendered;
  thumb: Rendered;
  /** Empty when this platform cannot read pixels; the user then picks the colour. */
  colors: ColorSwatch[];
  aspectRatio: number;
  /** Present when background removal worked: a transparent PNG trimmed to the garment. */
  cutout?: CutoutAssets;
}

/** A transparent PNG cutout and its thumbnail (also PNG, so the alpha survives). */
export interface CutoutAssets {
  image: Rendered;
  thumb: Rendered;
  /** Where the cutout sits in the original photo (`Item.cutout.crop`), when known. */
  crop?: CutoutCrop;
}

async function downscale(
  uri: string,
  size: { width: number; height: number },
  maxPx: number,
  compress: number,
  format: SaveFormat = SaveFormat.JPEG,
): Promise<Rendered> {
  let { width, height } = size;
  if (width <= 0 || height <= 0) {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    ({ width, height } = probe);
  }
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxPx) {
    context.resize(width >= height ? { width: maxPx } : { height: maxPx });
  }
  const ref = await context.renderAsync();
  return ref.saveAsync({ format, compress });
}

/**
 * Downscales the picked photo (original and thumbnail) and detects its colours. Nothing is stored
 * yet: `saveProcessedPhoto` does that when the user confirms, so abandoned photos leave no files.
 * A failed pixel read is not an error; the form just asks for the colour.
 */
export async function processPhoto(
  photo: PickedPhoto,
  pixels: PixelReader,
): Promise<ProcessedPhoto> {
  const original = await downscale(photo.uri, photo, ORIGINAL_MAX_PX, ORIGINAL_QUALITY);
  const thumb = await downscale(original.uri, original, THUMB_MAX_PX, THUMB_QUALITY);
  let colors: ColorSwatch[] = [];
  try {
    colors = summarizeColors(await pixels.read(thumb.uri, PALETTE_PX));
  } catch {
    colors = [];
  }
  return { original, thumb, colors, aspectRatio: original.width / original.height };
}

/**
 * Removes the background of the image at `uri` and makes the cutout thumbnail. Rejects when the
 * remover fails, finds no garment or is not available; callers fall back to the plain photo.
 */
export async function cutOutImage(
  remover: BackgroundRemover,
  uri: string,
  onProgress?: (fraction: number) => void,
): Promise<CutoutAssets> {
  if (!remover.available) throw new Error('Background removal is not available');
  const result = await remover.remove(uri, onProgress);
  if (!result.hasAlpha) throw new Error('The remover returned no transparency');
  const image: Rendered = { uri: result.uri, width: result.width, height: result.height };
  const thumb = await downscale(image.uri, image, THUMB_MAX_PX, 1, SaveFormat.PNG);
  return { image, thumb, crop: result.crop };
}

/**
 * Adds a cutout to a processed photo and re-detects the colours from it, so a white backdrop does
 * not count as the garment's colour. Any failure resolves to the photo unchanged (silent fallback
 * to the original with `hasAlpha: false`).
 */
export async function cutOutPhoto(
  photo: ProcessedPhoto,
  remover: BackgroundRemover,
  pixels: PixelReader,
  onProgress?: (fraction: number) => void,
): Promise<ProcessedPhoto> {
  try {
    const cutout = await cutOutImage(remover, photo.original.uri, onProgress);
    let colors = photo.colors;
    try {
      const fromCutout = summarizeColors(await pixels.read(cutout.thumb.uri, PALETTE_PX));
      if (fromCutout.length > 0) colors = fromCutout;
    } catch {
      // Keep the colours detected from the whole photo.
    }
    return { ...photo, colors, cutout };
  } catch {
    return photo;
  }
}

/**
 * Stores the processed photo. With a cutout (and `useOriginal` false) the cutout PNG and its
 * thumbnail are saved; otherwise the cutout is the original photo (saved under its own id, so
 * replacing it later never touches the original) with `hasAlpha: false`.
 */
export async function saveProcessedPhoto(
  store: ImageStore,
  photo: ProcessedPhoto,
  useOriginal = false,
): Promise<{ images: Item['images']; cutout: Item['cutout'] }> {
  const cut = useOriginal ? undefined : photo.cutout;
  const [originalId, cutoutId, thumbId] = await Promise.all([
    store.save({ uri: photo.original.uri }),
    store.save({ uri: (cut?.image ?? photo.original).uri }),
    store.save({ uri: (cut?.thumb ?? photo.thumb).uri }),
  ]);
  return {
    images: { originalId, cutoutId, thumbId },
    cutout: cut
      ? cutoutField(cut.image, true, cut.crop)
      : cutoutField(photo.original, false, wholePhotoCrop(photo.original)),
  };
}

/** The `Item.cutout` field for a stored cutout image; `crop` is left out when unknown. */
export function cutoutField(
  image: { width: number; height: number },
  hasAlpha: boolean,
  crop?: CutoutCrop,
): Item['cutout'] {
  return { aspectRatio: image.width / image.height, hasAlpha, ...(crop ? { crop } : {}) };
}
