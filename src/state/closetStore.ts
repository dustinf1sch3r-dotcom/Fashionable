import { createStore, type StoreApi } from 'zustand/vanilla';
import { newItem, touch, type NewItemInit } from '@/core/model/factories';
import { CATEGORIES } from '@/core/model/taxonomy';
import type { Category, Entity, ID, Item } from '@/core/model/types';
import type { Services } from '@/services';
import { createPersister, errorMessage } from './persist';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ItemPatch = Partial<Omit<Item, keyof Entity>>;

export interface ClosetState {
  items: Item[];
  status: LoadStatus;
  error: string | null;
  hydrate(): Promise<void>;
  addItem(init: NewItemInit): Item;
  updateItem(id: ID, patch: ItemPatch): void;
  setStatus(id: ID, status: Item['status']): void;
  toggleFavorite(id: ID): void;
  /** Soft delete. Undo with `restoreItem` (works until the store is recreated). */
  removeItem(id: ID): void;
  restoreItem(id: ID): void;
  flush(): Promise<void>;
}

export type ClosetStore = StoreApi<ClosetState>;

export const selectActiveItems = (s: ClosetState): Item[] =>
  s.items.filter((i) => i.status === 'active');

/** All non-deleted items (any status) grouped by category; every category has an entry. */
export const selectItemsByCategory = (s: ClosetState): Record<Category, Item[]> => {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, [] as Item[]])) as Record<
    Category,
    Item[]
  >;
  for (const item of s.items) out[item.category].push(item);
  return out;
};

export function createClosetStore(services: Services): ClosetStore {
  const { clock, ids } = services;
  const trash = new Map<ID, Item>();
  const persister = createPersister(
    services.items,
    (e) => store.setState({ error: errorMessage(e) }),
    () => store.setState({ error: null }),
  );

  const store: ClosetStore = createStore<ClosetState>((set, get) => {
    const replace = (id: ID, fn: (item: Item) => Item): void => {
      const current = get().items.find((i) => i.id === id);
      if (!current) return;
      const next = fn(current);
      set({ items: get().items.map((i) => (i.id === id ? next : i)) });
      persister.put(next);
    };
    return {
      items: [],
      status: 'idle',
      error: null,
      async hydrate() {
        set({ status: 'loading' });
        try {
          set({ items: await services.items.list(), status: 'ready', error: null });
        } catch (e) {
          set({ status: 'error', error: errorMessage(e) });
        }
      },
      addItem(init) {
        const item = newItem(init, clock, ids);
        set({ items: [...get().items, item] });
        persister.put(item);
        return item;
      },
      updateItem: (id, patch) => replace(id, (i) => touch({ ...i, ...patch }, clock)),
      setStatus: (id, status) => replace(id, (i) => touch({ ...i, status }, clock)),
      toggleFavorite: (id) => replace(id, (i) => touch({ ...i, favorite: !i.favorite }, clock)),
      removeItem(id) {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        trash.set(id, item);
        set({ items: get().items.filter((i) => i.id !== id) });
        persister.remove(id);
      },
      restoreItem(id) {
        const item = trash.get(id);
        if (!item) return;
        trash.delete(id);
        const restored = touch(item, clock);
        set({ items: [...get().items, restored] });
        persister.put(restored);
      },
      flush: () => persister.flush(),
    };
  });
  return store;
}
