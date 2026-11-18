import { createAsyncStorageKv } from '@/services/storage';

/** The Outfits hint is shown until dismissed; a plain preference, not part of the data model. */
export const HINT_KEY = 'fashionable/ui/tryon-hint-dismissed';

const kv = createAsyncStorageKv();

export async function loadHintDismissed(): Promise<boolean> {
  try {
    return (await kv.get(HINT_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveHintDismissed(): Promise<void> {
  try {
    await kv.set(HINT_KEY, '1');
  } catch {
    // Showing the hint again is fine.
  }
}
