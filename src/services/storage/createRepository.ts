import type { Entity, ID } from '@/core/model/types';
import type { Clock, KeyValueStore, Repository } from '../types';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';

export const STORAGE_PREFIX = 'fashionable/v1/';

export interface RepositoryOptions<T> {
  /** Used by `remove()` to stamp `deletedAt` / `updatedAt`. */
  clock: Clock;
  /** Records that fail this guard are dropped on load and reported through `onError`. */
  validate?: (value: unknown) => value is T;
  /** Called for corrupt, unreadable or unmigratable data. Never throws into the repository. */
  onError?: (error: unknown, context: { collection: string; key: string }) => void;
}

export function createRepository<T extends Entity>(
  kv: KeyValueStore,
  collection: string,
  options: RepositoryOptions<T>,
): Repository<T> {
  const key = `${STORAGE_PREFIX}${collection}`;
  const { clock, validate, onError } = options;
  const report = (error: unknown) => {
    try {
      onError?.(error, { collection, key });
    } catch {
      // A failing error handler must not break storage.
    }
  };

  async function load(): Promise<T[]> {
    let raw: string | null;
    try {
      raw = await kv.get(key);
    } catch (error) {
      report(error);
      return [];
    }
    if (raw === null) return [];
    try {
      const { records } = migrate(collection, JSON.parse(raw));
      if (!validate) return records as T[];
      const valid: T[] = [];
      for (const r of records) {
        if (validate(r)) valid.push(r);
        else report(new Error(`Dropped invalid record in "${collection}"`));
      }
      return valid;
    } catch (error) {
      report(error);
      // Keep the unreadable payload so a later write does not destroy it irrecoverably.
      try {
        await kv.set(`${key}.corrupt`, raw);
      } catch {
        // best effort
      }
      return [];
    }
  }

  async function save(records: T[]): Promise<void> {
    await kv.set(key, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, records }));
  }

  // All operations run one after another so read-modify-write cycles never interleave.
  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  }

  return {
    list: () => enqueue(async () => (await load()).filter((r) => r.deletedAt === undefined)),
    get: (id: ID) =>
      enqueue(async () => (await load()).find((r) => r.id === id && r.deletedAt === undefined)),
    put: (entity: T) =>
      enqueue(async () => {
        const all = await load();
        const i = all.findIndex((r) => r.id === entity.id);
        if (i >= 0) all[i] = entity;
        else all.push(entity);
        await save(all);
      }),
    remove: (id: ID) =>
      enqueue(async () => {
        const all = await load();
        const i = all.findIndex((r) => r.id === id);
        const existing = all[i];
        if (!existing || existing.deletedAt !== undefined) return;
        const stamp = clock.now().toISOString();
        all[i] = { ...existing, deletedAt: stamp, updatedAt: stamp };
        await save(all);
      }),
  };
}
