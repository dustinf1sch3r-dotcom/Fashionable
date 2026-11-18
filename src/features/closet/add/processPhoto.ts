import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ColorSwatch, Item } from '@/core/model/types';
import type { ImageStore, PixelReader } from '@/services';
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
}

async function downscale(
  uri: string,
  size: { width: number; height: number },
  maxPx: number,
  compress: number,
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
  return ref.saveAsync({ format: SaveFormat.JPEG, compress });
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
 * Stores the processed photo. Background removal is a later ticket, so the cutout is the original
 * (saved under its own id, so replacing it later never touches the original).
 */
export async function saveProcessedPhoto(
  store: ImageStore,
  photo: ProcessedPhoto,
): Promise<{ images: Item['images']; cutout: Item['cutout'] }> {
  const [originalId, cutoutId, thumbId] = await Promise.all([
    store.save({ uri: photo.original.uri }),
    store.save({ uri: photo.original.uri }),
    store.save({ uri: photo.thumb.uri }),
  ]);
  return {
    images: { originalId, cutoutId, thumbId },
    cutout: { aspectRatio: photo.aspectRatio, hasAlpha: false },
  };
}
