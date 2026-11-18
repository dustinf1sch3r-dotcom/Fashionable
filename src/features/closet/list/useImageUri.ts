import { useEffect, useState } from 'react';
import type { ID } from '@/core/model/types';
import { getSharedUriCache, type UriCache } from '@/features/shared/imageUris';

export type ImageUriState =
  | { status: 'loading'; uri: undefined }
  | { status: 'ready'; uri: string }
  | { status: 'missing'; uri: undefined };

/** Displayable URI for an image id. `undefined` id means "no image" and reports `missing`. */
export function useImageUri(id: ID | undefined, cache?: UriCache): ImageUriState {
  const source = cache ?? getSharedUriCache();
  // The outcome of the last lookup, tagged with the id it belongs to (`null` = not found).
  const [found, setFound] = useState<{ id: ID; uri: string | null } | undefined>();

  useEffect(() => {
    if (id === undefined || source.peek(id) !== undefined) return;
    let live = true;
    void source.load(id).then((uri) => {
      if (live) setFound({ id, uri: uri ?? null });
    });
    return () => {
      live = false;
    };
  }, [id, source]);

  if (id === undefined) return { status: 'missing', uri: undefined };
  const hit = source.peek(id) ?? (found?.id === id ? found.uri : undefined);
  if (hit) return { status: 'ready', uri: hit };
  if (found?.id === id) return { status: 'missing', uri: undefined };
  return { status: 'loading', uri: undefined };
}
