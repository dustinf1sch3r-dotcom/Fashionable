import type { ID, Item } from '@/core/model/types';
import { slotOf } from '@/core/model/slots';
import { fixtureById } from '@/core/testing/fixtures';
import { garmentArtUri, withArtAspect } from '@/ui/mannequin';

export interface SampleOutfit {
  items: Item[];
  /** Drawn art for stand-in pieces, keyed by `images.cutoutId` (real pieces use the image store). */
  artUris: Record<ID, string>;
  /** True when the pieces come from the person's closet. */
  fromCloset: boolean;
}

const STAND_INS = ['tee-white', 'jeans-dark', 'sneakers-white'] as const;

/**
 * A top, a bottom and shoes for the live preview in the correction screen: the person's own
 * pieces when they have them, flat drawn stand-ins otherwise.
 */
export function sampleOutfit(closet: readonly Item[]): SampleOutfit {
  const usable = closet.filter((i) => i.status === 'active' && i.cutout.hasAlpha);
  const top = usable.find((i) => slotOf(i) === 'base');
  const bottom = usable.find((i) => slotOf(i) === 'bottom');
  const shoes = usable.find((i) => slotOf(i) === 'shoes');
  const own = [top, bottom, shoes].filter((i): i is Item => i !== undefined);
  if (own.length >= 2) return { items: own, artUris: {}, fromCloset: true };

  const items = STAND_INS.map((id) => withArtAspect(fixtureById(id)));
  const artUris: Record<ID, string> = {};
  for (const item of items) artUris[item.images.cutoutId] = garmentArtUri(item);
  return { items, artUris, fromCloset: false };
}
