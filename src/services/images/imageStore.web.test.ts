/** @jest-environment node */
import 'fake-indexeddb/auto';
import { createSequentialIds } from '../testing/sequentialIds';
import { createImageStore } from './imageStore.web';

const blob = (text: string) => new Blob([text], { type: 'image/png' });

describe('web image store', () => {
  let counter = 0;
  const created: string[] = [];
  const revoked: string[] = [];

  beforeEach(() => {
    counter = 0;
    created.length = 0;
    revoked.length = 0;
    URL.createObjectURL = () => {
      const url = `blob:test/${++counter}`;
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
    };
  });

  it('saves a blob under a generated id and returns a cached object URL', async () => {
    const store = createImageStore({ ids: createSequentialIds() });
    const id = await store.save(blob('abc'));
    expect(id).toBe('00000000-0000-4000-8000-000000000001');
    const url = await store.uri(id);
    expect(url).toBe('blob:test/1');
    expect(await store.uri(id)).toBe(url);
    expect(created).toHaveLength(1);
  });

  it('honours a supplied id', async () => {
    const store = createImageStore();
    expect(await store.save(blob('x'), { id: 'mine' })).toBe('mine');
    await expect(store.uri('mine')).resolves.toMatch(/^blob:/);
  });

  it('persists across store instances (same database)', async () => {
    await createImageStore().save(blob('x'), { id: 'persist' });
    await expect(createImageStore().uri('persist')).resolves.toMatch(/^blob:/);
  });

  it('remove revokes the URL and deletes the blob', async () => {
    const store = createImageStore();
    await store.save(blob('x'), { id: 'gone' });
    const url = await store.uri('gone');
    await store.remove('gone');
    expect(revoked).toEqual([url]);
    await expect(store.uri('gone')).rejects.toThrow('Unknown image id');
    await store.remove('gone');
  });

  it('overwriting an id revokes the stale URL', async () => {
    const store = createImageStore();
    await store.save(blob('one'), { id: 'o' });
    const first = await store.uri('o');
    await store.save(blob('two'), { id: 'o' });
    expect(revoked).toEqual([first]);
    expect(await store.uri('o')).not.toBe(first);
  });

  it('rejects for unknown ids', async () => {
    await expect(createImageStore().uri('missing')).rejects.toThrow('Unknown image id');
  });

  it('saves from a uri by fetching it', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(blob('remote'))) as typeof fetch;
    try {
      const store = createImageStore();
      const id = await store.save({ uri: 'blob:somewhere' }, { id: 'fromuri' });
      await expect(store.uri(id)).resolves.toMatch(/^blob:/);
    } finally {
      globalThis.fetch = original;
    }
  });
});
