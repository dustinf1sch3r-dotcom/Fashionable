import type { Entity } from '@/core/model/types';
import { createFixedClock } from '../testing/fixedClock';
import { createMemoryKv } from '../testing/memoryKv';
import type { KeyValueStore } from '../types';
import { createRepository } from './createRepository';

interface Thing extends Entity {
  label: string;
}

const KEY = 'fashionable/v1/things';
const at = '2026-01-01T00:00:00.000Z';
const thing = (id: string, label = id): Thing => ({ id, label, createdAt: at, updatedAt: at });
const isThing = (v: unknown): v is Thing =>
  typeof v === 'object' && v !== null && typeof (v as Thing).id === 'string';

function setup(initial: Record<string, string> = {}) {
  const kv = createMemoryKv(initial);
  const clock = createFixedClock('2026-02-02T10:00:00.000Z');
  const errors: unknown[] = [];
  const repo = createRepository<Thing>(kv, 'things', {
    clock,
    validate: isThing,
    onError: (e) => errors.push(e),
  });
  return { kv, clock, errors, repo };
}

describe('createRepository', () => {
  it('starts empty', async () => {
    const { repo } = setup();
    expect(await repo.list()).toEqual([]);
    expect(await repo.get('x')).toBeUndefined();
  });

  it('puts, gets and lists, wrapped with a schema version', async () => {
    const { repo, kv } = setup();
    await repo.put(thing('a'));
    await repo.put(thing('b'));
    expect((await repo.list()).map((t) => t.id)).toEqual(['a', 'b']);
    expect(await repo.get('b')).toEqual(thing('b'));
    expect(JSON.parse(kv.data.get(KEY) ?? '')).toEqual({
      schemaVersion: 1,
      records: [thing('a'), thing('b')],
    });
  });

  it('replaces an existing record by id', async () => {
    const { repo } = setup();
    await repo.put(thing('a', 'one'));
    await repo.put(thing('a', 'two'));
    expect(await repo.list()).toEqual([thing('a', 'two')]);
  });

  it('soft deletes with the injected clock and hides the record', async () => {
    const { repo, kv } = setup();
    await repo.put(thing('a'));
    await repo.remove('a');
    expect(await repo.list()).toEqual([]);
    expect(await repo.get('a')).toBeUndefined();
    const stored = JSON.parse(kv.data.get(KEY) ?? '').records as Thing[];
    expect(stored).toEqual([
      {
        ...thing('a'),
        deletedAt: '2026-02-02T10:00:00.000Z',
        updatedAt: '2026-02-02T10:00:00.000Z',
      },
    ]);
  });

  it('remove is a no-op for unknown or already-deleted ids', async () => {
    const { repo, clock, kv } = setup();
    await repo.remove('nope');
    expect(kv.data.has(KEY)).toBe(false);
    await repo.put(thing('a'));
    await repo.remove('a');
    const first = kv.data.get(KEY);
    clock.advance(1000);
    await repo.remove('a');
    expect(kv.data.get(KEY)).toBe(first);
  });

  it('a put after a soft delete revives the record', async () => {
    const { repo } = setup();
    await repo.put(thing('a'));
    await repo.remove('a');
    await repo.put(thing('a', 'back'));
    expect(await repo.list()).toEqual([thing('a', 'back')]);
  });

  it('keeps every record when puts run concurrently', async () => {
    const { repo } = setup();
    const ids = Array.from({ length: 50 }, (_, i) => `id${i}`);
    await Promise.all(ids.map((id) => repo.put(thing(id))));
    expect((await repo.list()).map((t) => t.id).sort()).toEqual([...ids].sort());
  });

  it('serialises concurrent writes even when the store is slow', async () => {
    const inner = createMemoryKv();
    const slow: KeyValueStore = {
      ...inner,
      set: async (k, v) => {
        await new Promise((r) => setTimeout(r, 5));
        await inner.set(k, v);
      },
    };
    const repo = createRepository<Thing>(slow, 'things', { clock: createFixedClock() });
    await Promise.all([repo.put(thing('a')), repo.put(thing('b')), repo.remove('a')]);
    expect(await repo.list()).toEqual([thing('b')]);
  });

  it('a failed write rejects its caller but does not block later writes', async () => {
    const inner = createMemoryKv();
    let fail = true;
    const flaky: KeyValueStore = {
      ...inner,
      set: async (k, v) => {
        if (fail) throw new Error('disk full');
        await inner.set(k, v);
      },
    };
    const repo = createRepository<Thing>(flaky, 'things', { clock: createFixedClock() });
    await expect(repo.put(thing('a'))).rejects.toThrow('disk full');
    fail = false;
    await repo.put(thing('b'));
    expect(await repo.list()).toEqual([thing('b')]);
  });

  describe('corruption', () => {
    it('treats invalid JSON as empty, reports it and keeps a copy of the payload', async () => {
      const { repo, errors, kv } = setup({ [KEY]: '{not json' });
      expect(await repo.list()).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(kv.data.get(`${KEY}.corrupt`)).toBe('{not json');
      await repo.put(thing('a'));
      expect(await repo.list()).toEqual([thing('a')]);
    });

    it('treats a wrong shape as empty', async () => {
      const { repo, errors } = setup({ [KEY]: JSON.stringify({ hello: 1 }) });
      expect(await repo.list()).toEqual([]);
      expect(errors).toHaveLength(1);
    });

    it('drops records failing validation but keeps the rest', async () => {
      const { repo, errors } = setup({
        [KEY]: JSON.stringify({ schemaVersion: 1, records: [thing('a'), 42, null] }),
      });
      expect(await repo.list()).toEqual([thing('a')]);
      expect(errors).toHaveLength(2);
    });

    it('does not throw when the store read fails or onError is missing', async () => {
      const kv: KeyValueStore = {
        get: async () => {
          throw new Error('boom');
        },
        set: async () => undefined,
        remove: async () => undefined,
      };
      const repo = createRepository<Thing>(kv, 'things', { clock: createFixedClock() });
      expect(await repo.list()).toEqual([]);
    });

    it('refuses data from a newer schema instead of reading it', async () => {
      const { repo, errors } = setup({
        [KEY]: JSON.stringify({ schemaVersion: 99, records: [thing('a')] }),
      });
      expect(await repo.list()).toEqual([]);
      expect(errors).toHaveLength(1);
    });
  });

  it('reads a legacy bare array (version 0) and rewrites it wrapped on the next put', async () => {
    const { repo, kv } = setup({ [KEY]: JSON.stringify([thing('a')]) });
    expect(await repo.list()).toEqual([thing('a')]);
    await repo.put(thing('b'));
    expect(JSON.parse(kv.data.get(KEY) ?? '').schemaVersion).toBe(1);
  });
});
