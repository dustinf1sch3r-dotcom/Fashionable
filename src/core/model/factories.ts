import type { Clock, IdGenerator } from './ports';
import { subcategoryDefaults } from './taxonomy';
import type { Entity, Feedback, Item, Outfit, Profile, WearLog } from './types';

function stamp(clock: Clock, ids: IdGenerator): Entity {
  const now = clock.now().toISOString();
  return { id: ids.uuid(), createdAt: now, updatedAt: now };
}

export type NewItemInit = Pick<Item, 'category' | 'subcategory' | 'colors' | 'images' | 'cutout'> &
  Partial<Omit<Item, keyof Entity | 'category' | 'subcategory' | 'colors' | 'images' | 'cutout'>>;

/**
 * Builds an item, filling unset tags from the taxonomy defaults. Throws if the subcategory is not
 * listed for the category. `layer` is only kept for tops.
 */
export function newItem(init: NewItemInit, clock: Clock, ids: IdGenerator): Item {
  const defaults = subcategoryDefaults(init.category, init.subcategory);
  if (!defaults) {
    throw new Error(`Unknown subcategory "${init.subcategory}" for category "${init.category}"`);
  }
  const { layer, ...rest } = init;
  const item: Item = {
    ...stamp(clock, ids),
    pattern: 'solid',
    patternBold: false,
    formality: defaults.formality,
    warmth: defaults.warmth,
    rainOk: defaults.rainOk,
    sporty: defaults.sporty,
    status: 'active',
    favorite: false,
    ...rest,
  };
  const resolvedLayer = layer ?? defaults.layer;
  if (init.category === 'top' && resolvedLayer) item.layer = resolvedLayer;
  return item;
}

export type NewOutfitInit = Pick<Outfit, 'itemIds'> &
  Partial<Omit<Outfit, keyof Entity | 'itemIds'>>;

export function newOutfit(init: NewOutfitInit, clock: Clock, ids: IdGenerator): Outfit {
  return {
    ...stamp(clock, ids),
    source: 'manual',
    favorite: false,
    ...init,
    itemIds: [...init.itemIds],
  };
}

export type NewWearLogInit = Pick<WearLog, 'date' | 'itemIds'> &
  Partial<Omit<WearLog, keyof Entity | 'date' | 'itemIds'>>;

export function newWearLog(init: NewWearLogInit, clock: Clock, ids: IdGenerator): WearLog {
  return {
    ...stamp(clock, ids),
    planned: false,
    ...init,
    itemIds: [...init.itemIds],
  };
}

/** Item IDs are stored sorted ascending (and de-duplicated) so equal sets share a key. */
export function newFeedback(
  init: Pick<Feedback, 'itemIds' | 'verdict'>,
  clock: Clock,
  ids: IdGenerator,
): Feedback {
  const itemIds = [...new Set(init.itemIds)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { ...stamp(clock, ids), itemIds, verdict: init.verdict };
}

export type NewProfileInit = Partial<Omit<Profile, keyof Entity>>;

export function newProfile(init: NewProfileInit, clock: Clock, ids: IdGenerator): Profile {
  return {
    ...stamp(clock, ids),
    bodyTemplateId: 'body-a',
    units: 'metric',
    ...init,
  };
}

/** Returns a copy with `updatedAt` set to now. */
export function touch<T extends Entity>(entity: T, clock: Clock): T {
  return { ...entity, updatedAt: clock.now().toISOString() };
}

/** Returns a copy marked deleted (and updated) now. */
export function softDelete<T extends Entity>(entity: T, clock: Clock): T {
  const now = clock.now().toISOString();
  return { ...entity, deletedAt: now, updatedAt: now };
}
