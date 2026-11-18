import { createStore, type StoreApi } from 'zustand/vanilla';
import { newWearLog, touch } from '@/core/model/factories';
import type { ID, Weather, WearLog } from '@/core/model/types';
import type { Services } from '@/services';
import type { LoadStatus } from './closetStore';
import { createPersister, errorMessage } from './persist';

export interface WearState {
  logs: WearLog[];
  status: LoadStatus;
  error: string | null;
  hydrate(): Promise<void>;
  /** Record that these items were worn on `date` (YYYY-MM-DD), with that day's weather if known. */
  logWorn(date: string, itemIds: ID[], outfitId?: ID, weather?: Weather): WearLog;
  /** Plan an outfit for `date`. */
  plan(date: string, itemIds: ID[], outfitId?: ID): WearLog;
  /** A plan turned out to be worn: clears `planned`, optionally recording the weather. */
  markWorn(id: ID, weather?: Weather): void;
  remove(id: ID): void;
  /** Put back a log that `remove` deleted (the undo of a delete). */
  restore(log: WearLog): void;
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
    const add = (
      date: string,
      itemIds: ID[],
      outfitId: ID | undefined,
      planned: boolean,
      weather?: Weather,
    ) => {
      const log = newWearLog(
        {
          date,
          itemIds,
          planned,
          ...(outfitId !== undefined ? { outfitId } : {}),
          ...(weather !== undefined ? { weather } : {}),
        },
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
      logWorn: (date, itemIds, outfitId, weather) => add(date, itemIds, outfitId, false, weather),
      plan: (date, itemIds, outfitId) => add(date, itemIds, outfitId, true),
      markWorn(id, weather) {
        const current = get().logs.find((l) => l.id === id);
        if (!current?.planned) return;
        const next = touch(
          { ...current, planned: false, ...(weather !== undefined ? { weather } : {}) },
          clock,
        );
        set({ logs: get().logs.map((l) => (l.id === id ? next : l)) });
        persister.put(next);
      },
      restore(log) {
        if (get().logs.some((l) => l.id === log.id)) return;
        const next = touch(log, clock);
        set({ logs: [...get().logs, next] });
        persister.put(next);
      },
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
