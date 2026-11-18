import { CATEGORIES } from '@/core/model/taxonomy';
import type { Category } from '@/core/model/types';
import { createAsyncStorageKv } from '@/services/storage';

/** The capture step remembers what you added last; a plain preference, not part of the data model. */
export const LAST_KIND_KEY = 'fashionable/ui/add-item-kind';

const kv = createAsyncStorageKv();

function isCategory(value: string | null): value is Category {
  return value !== null && (CATEGORIES as readonly string[]).includes(value);
}

/** The remembered category, or `undefined` when none is stored or storage is unavailable. */
export async function loadLastKind(): Promise<Category | undefined> {
  try {
    const value = await kv.get(LAST_KIND_KEY);
    return isCategory(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers `category`; failures are ignored (it is only a convenience). */
export async function saveLastKind(category: Category): Promise<void> {
  try {
    await kv.set(LAST_KIND_KEY, category);
  } catch {
    // Not remembering is fine.
  }
}
