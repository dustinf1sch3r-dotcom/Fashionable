import type { KeyValueStore } from '../types';

export interface MemoryKv extends KeyValueStore {
  /** Direct view of the stored strings, for assertions and for seeding corrupt data. */
  readonly data: Map<string, string>;
}

export function createMemoryKv(initial: Record<string, string> = {}): MemoryKv {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}
