import { useEffect, useMemo, useState } from 'react';

import type { ID } from '@/core/model/types';

import { getSharedUriCache, type UriCache } from './imageUris';

/**
 * Displayable URIs for several images at once, keyed by image id; ids still loading or missing
 * map to `undefined`. Shaped for `<Mannequin imageUris={…} />`.
 */
export function useImageUris(
  ids: readonly ID[],
  cache?: UriCache,
): Readonly<Record<ID, string | undefined>> {
  const source = cache ?? getSharedUriCache();
  const key = [...new Set(ids)].sort().join('|');
  const unique = useMemo(() => (key ? key.split('|') : []), [key]);
  const [loaded, setLoaded] = useState<Readonly<Record<ID, string | undefined>>>({});

  useEffect(() => {
    let live = true;
    const pending = unique.filter((id) => source.peek(id) === undefined);
    if (pending.length === 0) return;
    void Promise.all(pending.map(async (id) => [id, await source.load(id)] as const)).then(
      (pairs) => {
        if (live) setLoaded((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
      },
    );
    return () => {
      live = false;
    };
  }, [unique, source]);

  return useMemo(() => {
    const out: Record<ID, string | undefined> = {};
    for (const id of unique) out[id] = source.peek(id) ?? loaded[id];
    return out;
  }, [unique, source, loaded]);
}
