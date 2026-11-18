import type { BodyTemplate, ID, Item, Outfit } from '@/core/model/types';
import { placeOutfit } from '@/core/tryon/place';
import { effectiveFit, fittedPlacement, type FittedLayer } from '@/ui/mannequin';
import { hashString } from '../fit/fitKey';

/** One garment image to merge: where it goes (mannequin units) and what identifies its pixels. */
export interface MergeLayer {
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise about the centre. */
  rotation: number;
  /** Identifies the picture and its place; part of the merged image's cache key. */
  identity: string;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * The garment layers of an outfit, bottom to top, exactly where the Mannequin draws them: warped
 * images at their own bounds (with the item's fit on top), everything else at its rigid
 * placement. A rigid cutout is drawn "contain" inside its box, so the box is shrunk to the
 * picture's aspect ratio here. `undefined` while any item has no picture yet.
 */
export function mergeLayers(
  items: readonly Item[],
  body: BodyTemplate,
  outfit: Outfit | undefined,
  imageUris: Readonly<Record<ID, string | undefined>>,
  fitted: Readonly<Record<ID, FittedLayer>> | undefined,
): MergeLayer[] | undefined {
  const byId = new Map(items.map((i) => [i.id, i]));
  const placements = placeOutfit(items, body, outfit)
    .map((p, order) => ({ p, order }))
    .sort((a, b) => a.p.z - b.p.z || a.order - b.order);
  const out: MergeLayer[] = [];
  for (const { p } of placements) {
    const item = byId.get(p.itemId);
    if (!item) continue;
    const layer = fitted?.[item.id];
    const rigidUri = imageUris[item.images.cutoutId];
    if (layer) {
      const box = fittedPlacement(item.id, layer, effectiveFit(item, outfit), p.z);
      out.push({
        uri: layer.uri,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: box.rotation,
        identity: `f:${item.id}:${layer.uri}:${box.x},${box.y},${box.width},${box.height},${box.rotation}`,
      });
      continue;
    }
    if (!rigidUri) return undefined;
    const aspect = item.cutout.aspectRatio;
    const boxAspect = p.width / p.height;
    const width = aspect > 0 && boxAspect < aspect ? p.width : p.height * (aspect || boxAspect);
    const height = aspect > 0 && boxAspect < aspect ? p.width / aspect : p.height;
    const x = p.x + (p.width - width) / 2;
    const y = p.y + (p.height - height) / 2;
    out.push({
      uri: rigidUri,
      x,
      y,
      width,
      height,
      rotation: p.rotation,
      identity: `r:${item.id}:${item.images.cutoutId}:${r1(x)},${r1(y)},${r1(width)},${r1(height)},${r1(p.rotation)}`,
    });
  }
  return out;
}

export interface CompositeKeyParts {
  /** `photo:<uri>` or `silhouette:<body id>`; anything that changes the backdrop's pixels. */
  backdrop: string;
  /** Hash of the body's landmarks (`bodySignature`). */
  bodySig: string;
  layers: readonly Pick<MergeLayer, 'identity'>[];
  /** Output pixels per mannequin unit. */
  density: number;
}

/**
 * Cache key of one merged image: the backdrop, the body, every layer's identity in z order (the
 * warped image or the rigid cutout, with its fit) and the density. Same parts, same picture.
 */
export function compositeKey(p: CompositeKeyParts): string {
  return [p.backdrop, p.bodySig, p.density, ...p.layers.map((l) => l.identity)].join('|');
}

/** A stable grain seed for a key (same picture → same grain). */
export function seedFor(key: string): number {
  return parseInt(hashString(key), 16);
}
