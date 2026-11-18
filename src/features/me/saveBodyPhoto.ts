import type { BodyLandmarks, ID, Profile } from '@/core/model/types';
import type { Services } from '@/services';
import type { ProfileStore } from '@/state';

type SaveServices = Pick<Services, 'images' | 'clock'>;

export interface BodyPhotoSave {
  /** A newly cropped photo to store; omit to keep the current image and only move the points. */
  blob?: Blob;
  landmarks: BodyLandmarks;
  detected?: BodyLandmarks;
}

/**
 * Store the body photo and make it the default backdrop. A retake saves the new image first and
 * only then deletes the old one, so a failure never leaves the profile pointing at nothing.
 */
export async function saveBodyPhoto(
  save: BodyPhotoSave,
  services: SaveServices,
  profile: ProfileStore,
): Promise<void> {
  const current: Profile['bodyPhoto'] = profile.getState().profile?.bodyPhoto;
  let imageId: ID | undefined = current?.imageId;
  if (save.blob) imageId = await services.images.save(save.blob);
  if (!imageId) throw new Error('No body photo to save');
  const keepDetected = save.blob ? save.detected : (save.detected ?? current?.detected);
  profile.getState().update({
    bodyPhoto: {
      imageId,
      landmarks: save.landmarks,
      ...(keepDetected ? { detected: keepDetected } : {}),
      takenAt:
        save.blob || !current?.takenAt ? services.clock.now().toISOString() : current.takenAt,
    },
    tryOnMode: 'photo',
  });
  await profile.getState().flush();
  if (save.blob && current && current.imageId !== imageId) {
    await services.images.remove(current.imageId).catch(() => undefined);
  }
}

/** Delete the photo's image and forget it in the profile. */
export async function deleteBodyPhoto(
  services: Pick<Services, 'images'>,
  profile: ProfileStore,
): Promise<void> {
  const current = profile.getState().profile?.bodyPhoto;
  profile.getState().removeBodyPhoto();
  await profile.getState().flush();
  if (current) await services.images.remove(current.imageId).catch(() => undefined);
}
