import type { Item } from '@/core/model/types';

/**
 * The parts of the closet the outfit engine reads (what an item is, its colours, dress level,
 * warmth, status…), as one string. Changes that do not affect outfit choice — garment points
 * (`fit`), placement tweaks, photos, timestamps — keep the same signature, so saving them never
 * reshuffles the ideas on screen.
 */
export function styleSignature(items: readonly Item[]): string {
  return items
    .map((i) =>
      JSON.stringify([
        i.id,
        i.category,
        i.subcategory,
        i.layer ?? null,
        i.colors.map((c) => [c.hex, c.name, Math.round(c.share * 100)]),
        i.pattern,
        i.patternBold,
        i.formality,
        i.warmth,
        i.material ?? null,
        i.rainOk,
        i.sporty,
        i.metal ?? null,
        i.status,
        i.deletedAt ?? null,
        i.favorite,
        i.name ?? null,
      ]),
    )
    .join('\n');
}
