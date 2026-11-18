import { createAsyncStorageKv } from './asyncStorageKv';
import { createFixedClock } from '../testing/fixedClock';
import { createRepository } from './createRepository';

describe('createAsyncStorageKv', () => {
  it('round-trips values', async () => {
    const kv = createAsyncStorageKv();
    expect(await kv.get('k')).toBeNull();
    await kv.set('k', 'v');
    expect(await kv.get('k')).toBe('v');
    await kv.remove('k');
    expect(await kv.get('k')).toBeNull();
  });

  it('backs a repository', async () => {
    const repo = createRepository(createAsyncStorageKv(), 'things', { clock: createFixedClock() });
    const at = '2026-01-01T00:00:00.000Z';
    await repo.put({ id: 'a', createdAt: at, updatedAt: at });
    expect(await repo.list()).toHaveLength(1);
  });
});
