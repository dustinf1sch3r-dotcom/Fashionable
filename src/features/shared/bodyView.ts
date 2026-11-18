import { BODY_A, getBody } from '@/core/tryon/bodies';
import type { BodyTemplate, Profile } from '@/core/model/types';

export type TryOnMode = 'photo' | 'silhouette';

export interface BodyView {
  /** What garments are placed on: the person's own landmarks or a silhouette template. */
  body: BodyTemplate;
  /** The person's photo to draw instead of the silhouette (only in photo mode). */
  backdrop?: string;
  mode: TryOnMode;
  /** A usable body photo exists (the toggle is only offered then). */
  hasPhoto: boolean;
}

/** The silhouette template chosen in the profile (default body until the profile has loaded). */
export function templateBody(profile: Pick<Profile, 'bodyTemplateId'> | null | undefined) {
  const id = profile?.bodyTemplateId;
  return (id ? getBody(id) : undefined) ?? BODY_A;
}

/**
 * Which body and backdrop to draw (docs/TRY_ON.md §11.5).
 *
 * `photoUri`: the resolved URI of the body photo; `undefined` while it is still loading, `null`
 * once it is known to be missing. A missing image falls back to the silhouette and hides the
 * toggle, so a damaged profile never shows a blank figure. While loading, the photo's landmarks
 * are already used (no backdrop yet) so garments do not jump when the picture arrives.
 */
export function resolveBodyView(
  profile: Pick<Profile, 'bodyTemplateId' | 'bodyPhoto' | 'tryOnMode'> | null | undefined,
  photoUri: string | null | undefined,
): BodyView {
  const photo = profile?.bodyPhoto;
  if (!photo || photoUri === null) {
    return { body: templateBody(profile), mode: 'silhouette', hasPhoto: false };
  }
  const mode: TryOnMode = profile.tryOnMode ?? 'photo';
  if (mode === 'silhouette') {
    return { body: templateBody(profile), mode, hasPhoto: true };
  }
  return {
    body: { id: 'photo', landmarks: photo.landmarks },
    ...(photoUri ? { backdrop: photoUri } : {}),
    mode,
    hasPhoto: true,
  };
}
