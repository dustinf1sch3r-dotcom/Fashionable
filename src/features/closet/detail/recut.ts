import type { Item } from '@/core/model/types';
import type { BackgroundRemover, ImageStore } from '@/services';
import { cutOutImage, cutoutField, type CutoutAssets } from '../add/processPhoto';

export interface RecutResult {
  images: Item['images'];
  cutout: Item['cutout'];
}

type CutOut = (remover: BackgroundRemover, uri: string) => Promise<CutoutAssets>;

/**
 * Runs background removal again on an item's stored original and saves the new cutout and
 * thumbnail under new image ids (so cached URIs for the old ones cannot go stale). The old
 * cutout and thumbnail are deleted only after the new ones are stored. The caller applies the
 * returned fields to the item. Rejects, leaving the item untouched, when removal fails.
 */
export async function recutItem(
  services: { images: ImageStore; cutout: BackgroundRemover },
  item: Item,
  cutOut: CutOut = cutOutImage,
): Promise<RecutResult> {
  const originalUri = await services.images.uri(item.images.originalId);
  const assets = await cutOut(services.cutout, originalUri);
  return replaceCutoutImages(services.images, item, assets);
}

/**
 * Stores `assets` as the item's cutout and thumbnail under new image ids and deletes the old ones
 * afterwards (never the original, and never failing over clean-up). Returns the fields to apply
 * to the item; rejects, with nothing deleted, when saving fails.
 */
export async function replaceCutoutImages(
  images: ImageStore,
  item: Item,
  assets: CutoutAssets,
): Promise<RecutResult> {
  const [cutoutId, thumbId] = await Promise.all([
    images.save({ uri: assets.image.uri }),
    images.save({ uri: assets.thumb.uri }),
  ]);
  // Never delete an image another item may share (the cutout of a no-alpha item is a copy, but
  // stay defensive) and never fail over clean-up.
  const stale = [item.images.cutoutId, item.images.thumbId].filter(
    (id) => id !== item.images.originalId,
  );
  await Promise.all(stale.map((id) => images.remove(id).catch(() => undefined)));
  return {
    images: { originalId: item.images.originalId, cutoutId, thumbId },
    cutout: cutoutField(assets.image, true, assets.crop),
  };
}
