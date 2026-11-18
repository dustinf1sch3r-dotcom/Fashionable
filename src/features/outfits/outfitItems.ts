import type { ID, Item } from '@/core/model/types';

export interface ResolvedOutfitItems {
  /** Items still in the closet (any status), in the outfit's order. */
  items: Item[];
  /** Ids no longer in the closet (deleted). */
  missingIds: ID[];
  /** Items that exist but are archived. */
  archived: Item[];
}

export function resolveOutfitItems(
  itemIds: readonly ID[],
  byId: ReadonlyMap<ID, Item>,
): ResolvedOutfitItems {
  const items: Item[] = [];
  const missingIds: ID[] = [];
  for (const id of itemIds) {
    const item = byId.get(id);
    if (item) items.push(item);
    else missingIds.push(id);
  }
  return { items, missingIds, archived: items.filter((i) => i.status === 'archived') };
}

/** A gentle sentence about pieces that are gone or archived, or undefined when all is well. */
export function outfitNote(resolved: ResolvedOutfitItems): string | undefined {
  const gone = resolved.missingIds.length;
  const archived = resolved.archived.length;
  if (gone > 0 && archived > 0) return 'Some pieces were deleted or archived.';
  if (gone > 0) {
    return gone === 1
      ? 'One piece is no longer in your closet.'
      : `${gone} pieces are no longer in your closet.`;
  }
  if (archived > 0) {
    return archived === 1 ? 'One piece is archived.' : `${archived} pieces are archived.`;
  }
  return undefined;
}
