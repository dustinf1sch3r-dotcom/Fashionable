import {
  archetypeById,
  findDuplicates,
  findGaps,
  findOrphans,
  type DuplicateGroup,
  type GapSuggestion,
  type OrphanReport,
} from '@/core/gaps';
import { slotOf } from '@/core/model/slots';
import type { Item } from '@/core/model/types';

/** Friendly name of an archetype, e.g. "White sneakers". Unknown ids fall back to the id. */
export function archetypeTitle(archetypeId: string): string {
  return archetypeById(archetypeId)?.item.name ?? archetypeId;
}

/** "Black pumps, Black flats" for an orphan's `wouldHelp` list. */
export function wouldHelpText(archetypeIds: readonly string[]): string {
  return archetypeIds.map(archetypeTitle).join(', ');
}

export const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

export const unlockedLabel = (n: number): string => `+${plural(n, 'outfit', 'outfits')}`;
export const improvedLabel = (n: number): string => `Improves ${plural(n, 'outfit', 'outfits')}`;
export const goesWithLabel = (n: number): string =>
  n === 0 ? 'Goes with nothing yet' : `Goes with ${plural(n, 'outfit', 'outfits')}`;

export interface Insights {
  core: GapSuggestion[];
  addons: GapSuggestion[];
  orphans: OrphanReport[];
  duplicates: DuplicateGroup[];
}

/** What a closet needs before gap analysis says anything useful. */
export interface Readiness {
  ready: boolean;
  tops: number;
  bottoms: number;
  shoes: number;
}

/**
 * Needs at least one top (or a dress), one bottom (or a dress) and one pair of shoes, and a few
 * pieces overall: with less, every suggestion would just be "anything".
 */
export function closetReadiness(items: readonly Item[]): Readiness {
  let tops = 0;
  let bottoms = 0;
  let dresses = 0;
  let shoes = 0;
  for (const item of items) {
    if (item.status !== 'active') continue;
    const slot = slotOf(item);
    if (slot === 'base') tops++;
    else if (slot === 'bottom') bottoms++;
    else if (slot === 'onepiece') dresses++;
    else if (slot === 'shoes') shoes++;
  }
  const covered = shoes > 0 && (dresses > 0 || (tops > 0 && bottoms > 0));
  return { ready: covered && tops + bottoms + dresses + shoes >= 4, tops, bottoms, shoes };
}

/** Everything the gap analysis finds. Pure but takes ~100–200 ms on a big closet. */
export function computeInsights(items: readonly Item[]): Insights {
  const gaps = findGaps(items);
  return {
    core: gaps.filter((g) => g.kind === 'core'),
    addons: gaps.filter((g) => g.kind === 'addon'),
    orphans: findOrphans(items),
    duplicates: findDuplicates(items),
  };
}

/** Changes whenever something the analysis reads changes; used to memoise `computeInsights`. */
export function closetSignature(items: readonly Item[]): string {
  return items
    .filter((i) => i.status === 'active')
    .map((i) => `${i.id}@${i.updatedAt}`)
    .sort()
    .join('|');
}
