import { useEffect } from 'react';
import { getStores, hydrateAll, useCloset, type LoadStatus } from '@/state';

/** Loads the stores the first time any closet screen mounts; returns the closet load status. */
export function useClosetHydration(): { status: LoadStatus; retry: () => void } {
  const status = useCloset((s) => s.status);
  useEffect(() => {
    if (getStores().closet.getState().status === 'idle') void hydrateAll();
  }, []);
  return { status, retry: () => void getStores().closet.getState().hydrate() };
}
