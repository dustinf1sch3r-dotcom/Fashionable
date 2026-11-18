import { createStore, type StoreApi } from 'zustand/vanilla';
import { newProfile, touch } from '@/core/model/factories';
import type { Entity, Profile } from '@/core/model/types';
import type { Services } from '@/services';
import type { LoadStatus } from './closetStore';
import { createPersister, errorMessage } from './persist';

export type ProfilePatch = Partial<Omit<Profile, keyof Entity>>;

export interface ProfileState {
  profile: Profile | null;
  status: LoadStatus;
  error: string | null;
  /** Loads the profile; creates and saves a default one on first run. */
  hydrate(): Promise<void>;
  update(patch: ProfilePatch): void;
  flush(): Promise<void>;
}

export type ProfileStore = StoreApi<ProfileState>;

export function createProfileStore(services: Services): ProfileStore {
  const { clock, ids } = services;
  const persister = createPersister(
    services.profile,
    (e) => store.setState({ error: errorMessage(e) }),
    () => store.setState({ error: null }),
  );

  const store: ProfileStore = createStore<ProfileState>((set, get) => ({
    profile: null,
    status: 'idle',
    error: null,
    async hydrate() {
      set({ status: 'loading' });
      try {
        const [existing] = await services.profile.list();
        const profile = existing ?? newProfile({}, clock, ids);
        set({ profile, status: 'ready', error: null });
        if (!existing) persister.put(profile);
      } catch (e) {
        set({ status: 'error', error: errorMessage(e) });
      }
    },
    update(patch) {
      const current = get().profile;
      if (!current) return;
      const next = touch({ ...current, ...patch }, clock);
      set({ profile: next });
      persister.put(next);
    },
    flush: () => persister.flush(),
  }));
  return store;
}
