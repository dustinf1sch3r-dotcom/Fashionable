import { createFixedClock } from './fixedClock';
import { createMemoryImageStore } from './memoryImageStore';
import { createMemoryKv } from './memoryKv';
import { createSequentialIds } from './sequentialIds';

describe('fakes', () => {
  it('memoryKv stores, overwrites, removes', async () => {
    const kv = createMemoryKv({ a: '1' });
    expect(await kv.get('a')).toBe('1');
    expect(await kv.get('b')).toBeNull();
    await kv.set('a', '2');
    expect(await kv.get('a')).toBe('2');
    await kv.remove('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('fixedClock stays put until moved and returns copies', () => {
    const clock = createFixedClock('2026-03-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-03-01T00:00:00.000Z');
    clock.now().setFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-03-01T00:00:00.000Z');
    clock.advance(1500);
    expect(clock.now().toISOString()).toBe('2026-03-01T00:00:01.500Z');
    clock.set('2030-01-01T00:00:00.000Z');
    expect(clock.now().getUTCFullYear()).toBe(2030);
  });

  it('sequentialIds are unique, ordered and UUID-shaped', () => {
    const ids = createSequentialIds();
    const a = ids.uuid();
    const b = ids.uuid();
    expect(a).toBe('00000000-0000-4000-8000-000000000001');
    expect(b).toBe('00000000-0000-4000-8000-000000000002');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('memoryImageStore saves, resolves and removes', async () => {
    const store = createMemoryImageStore(createSequentialIds());
    const id = await store.save({ uri: 'file:///x.jpg' });
    expect(await store.uri(id)).toBe(`memory://${id}`);
    expect(await store.save({ uri: 'file:///y.jpg' }, { id: 'custom' })).toBe('custom');
    await store.remove(id);
    await expect(store.uri(id)).rejects.toThrow();
    await store.remove(id);
  });

  it('memoryImageStore reads back saved blobs and rejects unknown ids or uri sources', async () => {
    const store = createMemoryImageStore(createSequentialIds());
    const blob = new Blob(['x']);
    const id = await store.save(blob);
    expect(await store.read(id)).toBe(blob);
    await expect(store.read('nope')).rejects.toThrow('Unknown image id');
    const fromUri = await store.save({ uri: 'file:///x.jpg' });
    await expect(store.read(fromUri)).rejects.toThrow('no bytes');
  });
});
