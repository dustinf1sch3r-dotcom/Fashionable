import { useMemo } from 'react';
import type { ID, Item, WearLog } from '@/core/model/types';
import { useCloset, useOutfits, useWear } from '@/state';
import { useClosetHydration } from '../closet/list/useClosetHydration';

interface CalendarData {
  loading: boolean;
  logs: WearLog[];
  byId: ReadonlyMap<ID, Item>;
}

/** Loads the stores on first use and returns what the calendar screens read. */
export function useCalendarData(): CalendarData {
  const { status: closetStatus } = useClosetHydration();
  const wearStatus = useWear((s) => s.status);
  const outfitStatus = useOutfits((s) => s.status);
  const logs = useWear((s) => s.logs);
  const items = useCloset((s) => s.items);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const pendingStatus = (s: string) => s === 'idle' || s === 'loading';
  return {
    loading:
      pendingStatus(closetStatus) || pendingStatus(wearStatus) || pendingStatus(outfitStatus),
    logs,
    byId,
  };
}
