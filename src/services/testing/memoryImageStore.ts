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
    remove: async (id) => {
      saved.delete(id);
    },
  };
}
