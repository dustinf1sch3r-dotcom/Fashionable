import { newItem, newWearLog } from '@/core/model/factories';
import type { NewItemInit } from '@/core/model/factories';
import type { Item, WearLog } from '@/core/model/types';
import { fixedClock } from '@/core/testing/clock';

/** Test helper: a closet item created at `createdAt` (default 2026-01-01). */
export function testItem(
  id: string,
  init: Partial<NewItemInit> & Pick<NewItemInit, 'category' | 'subcategory'>,
  createdAt = '2026-01-01T10:00:00.000Z',
): Item {
  return newItem(
    {
      colors: [{ hex: '#1b1b1d', share: 1, name: 'black' }],
      images: { originalId: `${id}-o`, cutoutId: `${id}-c`, thumbId: `${id}-t` },
      cutout: { aspectRatio: 1, hasAlpha: true },
      ...init,
    },
    fixedClock(createdAt),
    { uuid: () => id },
  );
}

export function testLog(id: string, date: string, itemIds: string[], planned = false): WearLog {
  return newWearLog({ date, itemIds, planned }, fixedClock(`${date}T08:00:00.000Z`), {
    uuid: () => id,
  });
}
