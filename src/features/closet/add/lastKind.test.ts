import { createAsyncStorageKv } from '@/services/storage';
import { LAST_KIND_KEY, loadLastKind, saveLastKind } from './lastKind';

describe('last capture category', () => {
  it('remembers the category between visits', async () => {
    expect(await loadLastKind()).toBeUndefined();
    await saveLastKind('shoes');
    expect(await loadLastKind()).toBe('shoes');
  });

  it('ignores a stored value that is not a category', async () => {
    await createAsyncStorageKv().set(LAST_KIND_KEY, 'spaceship');
    expect(await loadLastKind()).toBeUndefined();
  });
});
