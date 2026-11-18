import type { NewItemInit } from '@/core/model/factories';
import type { Repository } from '@/services';
import type { Entity } from '@/core/model/types';

export const tee = (over: Partial<NewItemInit> = {}): NewItemInit => ({
  category: 'top',
  subcategory: 'tshirt',
  colors: [{ hex: '#112233', name: 'navy', share: 1 }],
  images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
  cutout: { aspectRatio: 1, hasAlpha: true },
  ...over,
});

export const jeans = (): NewItemInit => tee({ category: 'bottom', subcategory: 'jeans' });

/** Wraps a repository, counting writes and optionally failing them. */
export function spyRepo<T extends Entity>(repo: Repository<T>) {
  const calls = { put: 0, remove: 0 };
  const state = { fail: false };
  const wrapped: Repository<T> = {
    list: () => repo.list(),
    get: (id) => repo.get(id),
    listAll: () => repo.listAll(),
    replaceAll: (records) => repo.replaceAll(records),
    put: async (e) => {
      calls.put++;
      if (state.fail) throw new Error('disk full');
      return repo.put(e);
    },
    remove: async (id) => {
      calls.remove++;
      if (state.fail) throw new Error('disk full');
      return repo.remove(id);
    },
  };
  return { wrapped, calls, state };
}
