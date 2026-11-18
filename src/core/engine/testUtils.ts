import { fixtureById } from '../testing/fixtures';
import type { Item } from '../model/types';

/** Build an outfit from fixture ids. */
export function outfit(...ids: string[]): Item[] {
  return ids.map((id) => fixtureById(id));
}

/** A fixture item with some fields overridden (the id is kept). */
export function tweak(id: string, overrides: Partial<Item>): Item {
  return { ...fixtureById(id), ...overrides };
}
