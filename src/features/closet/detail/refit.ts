import type { GarmentRig, Item } from '@/core/model/types';
import type { ImageStore, PixelReader } from '@/services';
import { detectItemRig } from '../../shared/fit/rigLifecycle';
import type { RecutResult } from './recut';

export interface RefitResult {
  /** The re-detected rig, or `undefined` when none could be found (the item then draws rigidly). */
  fit: GarmentRig | undefined;
  /** The user had adjusted the old points by hand; they were replaced because the outline changed. */
  replacedEdited: boolean;
}

/**
 * A new cutout changes the outline, so the garment points are detected again from it. Points the
 * user adjusted by hand are replaced too (they no longer match the picture); the caller tells the
 * user via `replacedEdited`.
 */
export async function refitAfterCutout(
  services: { images: Pick<ImageStore, 'uri'>; pixels: PixelReader },
  item: Item,
  result: RecutResult,
): Promise<RefitResult> {
  const replacedEdited = item.fit?.edited === true;
  if (!result.cutout.hasAlpha) return { fit: undefined, replacedEdited };
  try {
    const uri = await services.images.uri(result.images.cutoutId);
    const fit = await detectItemRig(services.pixels, item, uri);
    return { fit, replacedEdited };
  } catch {
    return { fit: undefined, replacedEdited };
  }
}
