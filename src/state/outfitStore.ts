import { createStore, type StoreApi } from 'zustand/vanilla';
import { newFeedback, newOutfit, touch, type NewOutfitInit } from '@/core/model/factories';
import type { Entity, Feedback, ID, Outfit } from '@/core/model/types';
import type { Services } from '@/services';
import type { LoadStatus } from './closetStore';
import { createPersister, errorMessage } from './persist';

export type OutfitPatch = Partial<Omit<Outfit, keyof Entity>>;

export interface OutfitState {
  outfits: Outfit[];
  feedback: Feedback[];
  status: LoadStatus;
  error: string | null;
  hydrate(): Promise<void>;
  addOutfit(init: NewOutfitInit): Outfit;
  updateOutfit(id: ID, patch: OutfitPatch): void;
  renameOutfit(id: ID, name: string): void;
  toggleFavorite(id: ID): void;
  removeOutfit(id: ID): void;
  restoreOutfit(id: ID): void;
  /** Records a like/dislike for this exact set of items; re-rating the same set replaces it. */
  rate(itemIds: ID[], verdict: Feedback['verdict']): Feedback;
  flush(): Promise<void>;
}

export type OutfitStore = StoreApi<OutfitState>;

const sameSet = (a: ID[], b: ID[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function createOutfitStore(services: Services): OutfitStore {
  const { clock, ids } = services;
  const trash = new Map<ID, Outfit>();
  const onError = (e: unknown) => store.setState({ error: errorMessage(e) });
  const onSuccess = () => store.setState({ error: null });
  const outfitWrites = createPersister(services.outfits, onError, onSuccess);
  const feedbackWrites = createPersister(services.feedback, onError, onSuccess);

  const store: OutfitStore = createStore<OutfitState>((set, get) => {
    const replace = (id: ID, fn: (o: Outfit) => Outfit): void => {
      const current = get().outfits.find((o) => o.id === id);
      if (!current) return;
      const next = fn(current);
      set({ outfits: get().outfits.map((o) => (o.id === id ? next : o)) });
      outfitWrites.put(next);
    };
    return {
      outfits: [],
      feedback: [],
      status: 'idle',
      error: null,
      async hydrate() {
        set({ status: 'loading' });
        try {
          const [outfits, feedback] = await Promise.all([
            services.outfits.list(),
            services.feedback.list(),
          ]);
          set({ outfits, feedback, status: 'ready', error: null });
        } catch (e) {
          set({ status: 'error', error: errorMessage(e) });
        }
      },
      addOutfit(init) {
        const outfit = newOutfit(init, clock, ids);
        set({ outfits: [...get().outfits, outfit] });
        outfitWrites.put(outfit);
        return outfit;
      },
      updateOutfit: (id, patch) => replace(id, (o) => touch({ ...o, ...patch }, clock)),
      renameOutfit: (id, name) => replace(id, (o) => touch({ ...o, name }, clock)),
      toggleFavorite: (id) => replace(id, (o) => touch({ ...o, favorite: !o.favorite }, clock)),
      removeOutfit(id) {
        const outfit = get().outfits.find((o) => o.id === id);
        if (!outfit) return;
        trash.set(id, outfit);
        set({ outfits: get().outfits.filter((o) => o.id !== id) });
        outfitWrites.remove(id);
      },
      restoreOutfit(id) {
        const outfit = trash.get(id);
        if (!outfit) return;
        trash.delete(id);
        const restored = touch(outfit, clock);
        set({ outfits: [...get().outfits, restored] });
        outfitWrites.put(restored);
      },
      rate(itemIds, verdict) {
        const fresh = newFeedback({ itemIds, verdict }, clock, ids);
        const existing = get().feedback.find((f) => sameSet(f.itemIds, fresh.itemIds));
        const next = existing ? touch({ ...existing, verdict }, clock) : fresh;
        set({
          feedback: existing
            ? get().feedback.map((f) => (f.id === existing.id ? next : f))
            : [...get().feedback, next],
        });
        feedbackWrites.put(next);
        return next;
      },
      async flush() {
        await Promise.all([outfitWrites.flush(), feedbackWrites.flush()]);
      },
    };
  });
  return store;
}
