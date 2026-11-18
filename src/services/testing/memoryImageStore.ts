import type { ID } from '@/core/model/types';
import type { IdGenerator, ImageStore } from '../types';
import { createSequentialIds } from './sequentialIds';

export interface MemoryImageStore extends ImageStore {
  /** Ids currently stored. */
  ids(): ID[];
}

/** Stores nothing but the source; `uri(id)` returns `memory://<id>`. */
export function createMemoryImageStore(ids: IdGenerator = createSequentialIds()): MemoryImageStore {
  const saved = new Map<ID, { uri: string } | Blob>();
  return {
    ids: () => [...saved.keys()],
    save: async (source, opts) => {
      const id = opts?.id ?? ids.uuid();
      saved.set(id, source);
      return id;
    },
    uri: async (id) => {
      if (!saved.has(id)) throw new Error(`Unknown image id: ${id}`);
      return `memory://${id}`;
    },
    read: async (id) => {
      const source = saved.get(id);
      if (source === undefined) throw new Error(`Unknown image id: ${id}`);
      if (source instanceof Blob) return source;
      throw new Error(`Image ${id} was saved from a uri and has no bytes in the memory store`);
    },
    remove: async (id) => {
      saved.delete(id);
    },
  };
}
