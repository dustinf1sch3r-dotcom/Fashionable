import { createStore, type StoreApi } from 'zustand/vanilla';
import { newWearLog } from '@/core/model/factories';
import type { ID, WearLog } from '@/core/model/types';
import type { Services } from '@/services';
import type { LoadStatus } from './closetStore';
import { createPersister, errorMessage } from './persist';

export interface WearState {
  logs: WearLog[];
  status: LoadStatus;
  error: string | null;
  hydrate(): Promise<void>;
  /** Record that these items were worn on `date` (YYYY-MM-DD). */
  logWorn(date: string, itemIds: ID[], outfitId?: ID): WearLog;
  /** Plan an outfit for `date`. */
  plan(date: string, itemIds: ID[], outfitId?: ID): WearLog;
  remove(id: ID): void;
  flush(): Promise<void>;
}

export type WearStore = StoreApi<WearState>;

export const selectLogsForDate = (s: WearState, date: string): WearLog[] =>
  s.logs.filter((l) => l.date === date);

/** Latest date on which the item was actually worn (planned logs do not count). */
export const selectLastWornDate = (s: WearState, itemId: ID): string | undefined => {
  let last: string | undefined;
  for (const l of s.logs) {
    if (!l.planned && l.itemIds.includes(itemId) && (last === undefined || l.date > last)) {
      last = l.date;
    }
  }
  return last;
};

export function createWearStore(services: Services): WearStore {
  const { clock, ids } = services;
  const persister = createPersister(
    services.wearLogs,
    (e) => store.setState({ error: errorMessage(e) }),
    () => store.setState({ error: null }),
  );

  const store: WearStore = createStore<WearState>((set, get) => {
    const add = (date: string, itemIds: ID[], outfitId: ID | undefined, planned: boolean) => {
      const log = newWearLog(
        { date, itemIds, planned, ...(outfitId !== undefined ? { outfitId } : {}) },
        clock,
        ids,
      );
      set({ logs: [...get().logs, log] });
      persister.put(log);
      return log;
    };
    return {
      logs: [],
      status: 'idle',
      error: null,
      async hydrate() {
        set({ status: 'loading' });
        try {
          set({ logs: await services.wearLogs.list(), status: 'ready', error: null });
        } catch (e) {
          set({ status: 'error', error: errorMessage(e) });
        }
      },
      logWorn: (date, itemIds, outfitId) => add(date, itemIds, outfitId, false),
      plan: (date, itemIds, outfitId) => add(date, itemIds, outfitId, true),
      remove(id) {
        if (!get().logs.some((l) => l.id === id)) return;
        set({ logs: get().logs.filter((l) => l.id !== id) });
        persister.remove(id);
      },
      flush: () => persister.flush(),
    };
  });
  return store;
}
