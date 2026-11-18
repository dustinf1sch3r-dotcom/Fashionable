import { useEffect, useState } from 'react';
import { useProfile } from '@/state';
import { resolveBodyView, templateBody, type BodyView, type TryOnMode } from './bodyView';
import { getSharedUriCache } from './imageUris';

export type { BodyView, TryOnMode } from './bodyView';

export interface UseBody extends BodyView {
  setMode(mode: TryOnMode): void;
}

/**
 * The body every full-size mannequin is drawn on: the person's photo when they have added one and
 * the mode is "photo", otherwise the silhouette (docs/TRY_ON.md §11.5). `setMode` is the
 * Me / Silhouette toggle and is stored in the profile.
 */
export function useBody(): UseBody {
  const profile = useProfile((s) => s.profile);
  const update = useProfile((s) => s.update);
  const imageId = profile?.bodyPhoto?.imageId;
  const cache = getSharedUriCache();
  const [loaded, setLoaded] = useState<{ id: string; uri: string | null } | undefined>();

  useEffect(() => {
    if (!imageId) return;
    let live = true;
    void cache.load(imageId).then((uri) => {
      if (live) setLoaded({ id: imageId, uri: uri ?? null });
    });
    return () => {
      live = false;
    };
  }, [imageId, cache]);

  const photoUri = imageId
    ? (cache.peek(imageId) ?? (loaded?.id === imageId ? loaded.uri : undefined))
    : undefined;
  const view = resolveBodyView(profile, photoUri);
  return { ...view, setMode: (mode) => update({ tryOnMode: mode }) };
}

/** The silhouette template only, for screens that draw archetype art rather than the person. */
export function useSilhouetteBody() {
  return useProfile((s) => templateBody(s.profile));
}
