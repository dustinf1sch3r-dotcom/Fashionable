import { deltaE, rgbToLab } from '../color/classify';
import { hexToRgb } from '../color/hsl';
import { primaryColour } from '../engine/score/types';
import type { ID, Item } from '../model/types';
import { DUPLICATE_MAX_DELTA_E } from './weights';

export interface DuplicateGroup {
  itemIds: ID[];
}

/**
 * Groups of active items with the same subcategory, primary colour name and pattern whose primary
 * hexes differ by less than `DUPLICATE_MAX_DELTA_E` (single linkage). Groups and ids are sorted.
 */
export function findDuplicates(items: readonly Item[]): DuplicateGroup[] {
  const buckets = new Map<string, { item: Item; lab: ReturnType<typeof rgbToLab> }[]>();
  for (const item of items) {
    if (item.status !== 'active') continue;
    const c = primaryColour(item);
    if (!c) continue;
    const key = [item.category, item.subcategory, c.name, item.pattern].join('/');
    const list = buckets.get(key) ?? [];
    list.push({ item, lab: rgbToLab(hexToRgb(c.hex)) });
    buckets.set(key, list);
  }
  const groups: DuplicateGroup[] = [];
  for (const list of buckets.values()) {
    const parent = list.map((_, i) => i);
    const find = (i: number): number => {
      let r = i;
      while (parent[r] !== r) r = parent[r] as number;
      return r;
    };
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a && b && deltaE(a.lab, b.lab) < DUPLICATE_MAX_DELTA_E) parent[find(j)] = find(i);
      }
    }
    const byRoot = new Map<number, ID[]>();
    list.forEach((e, i) => {
      const r = find(i);
      byRoot.set(r, [...(byRoot.get(r) ?? []), e.item.id]);
    });
    for (const ids of byRoot.values()) {
      if (ids.length > 1) groups.push({ itemIds: ids.sort() });
    }
  }
  return groups.sort((a, b) => ((a.itemIds[0] as string) < (b.itemIds[0] as string) ? -1 : 1));
}
