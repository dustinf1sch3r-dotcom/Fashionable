import { BODY_A } from '@/core/tryon/bodies';
import { createTestServices } from '@/services';
import { createProfileStore } from '@/state';
import { deleteBodyPhoto, saveBodyPhoto } from './saveBodyPhoto';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const blob = (s: string) => new Blob([s], { type: 'image/png' });
const MOVED = { ...BODY_A.landmarks, chin: { x: 500, y: 330 } };

async function setup() {
  const services = createTestServices();
  const profile = createProfileStore(services);
  await profile.getState().hydrate();
  return { services, profile };
}

describe('saveBodyPhoto', () => {
  it('stores the image, sets the profile field and switches to photo mode', async () => {
    const { services, profile } = await setup();
    await saveBodyPhoto(
      { blob: blob('a'), landmarks: MOVED, detected: BODY_A.landmarks },
      services,
      profile,
    );
    const p = profile.getState().profile;
    expect(p?.tryOnMode).toBe('photo');
    expect(p?.bodyPhoto).toMatchObject({ landmarks: MOVED, detected: BODY_A.landmarks });
    expect(p?.bodyPhoto?.takenAt).toBe('2026-01-01T00:00:00.000Z');
    const stored = await services.profile.list();
    expect(stored[0].bodyPhoto?.imageId).toBe(p?.bodyPhoto?.imageId);
    await expect(services.images.read(p?.bodyPhoto?.imageId ?? '')).resolves.toBeDefined();
  });

  it('a retake saves the new image and then deletes the old one', async () => {
    const { services, profile } = await setup();
    await saveBodyPhoto({ blob: blob('one'), landmarks: BODY_A.landmarks }, services, profile);
    const first = profile.getState().profile?.bodyPhoto?.imageId ?? '';
    await saveBodyPhoto({ blob: blob('two'), landmarks: MOVED }, services, profile);
    const second = profile.getState().profile?.bodyPhoto?.imageId ?? '';
    expect(second).not.toBe(first);
    await expect(services.images.read(second)).resolves.toBeDefined();
    await expect(services.images.read(first)).rejects.toBeDefined();
  });

  it('adjusting points keeps the image, the detected points and the date', async () => {
    const { services, profile } = await setup();
    await saveBodyPhoto(
      { blob: blob('one'), landmarks: BODY_A.landmarks, detected: BODY_A.landmarks },
      services,
      profile,
    );
    const before = profile.getState().profile?.bodyPhoto;
    await saveBodyPhoto({ landmarks: MOVED }, services, profile);
    const after = profile.getState().profile?.bodyPhoto;
    expect(after?.imageId).toBe(before?.imageId);
    expect(after?.landmarks).toEqual(MOVED);
    expect(after?.detected).toEqual(BODY_A.landmarks);
    expect(after?.takenAt).toBe(before?.takenAt);
    await expect(services.images.read(before?.imageId ?? '')).resolves.toBeDefined();
  });

  it('refuses to adjust when there is no photo', async () => {
    const { services, profile } = await setup();
    await expect(saveBodyPhoto({ landmarks: MOVED }, services, profile)).rejects.toThrow();
  });

  it('keeps the old image when saving the new one fails', async () => {
    const { services, profile } = await setup();
    await saveBodyPhoto({ blob: blob('one'), landmarks: BODY_A.landmarks }, services, profile);
    const first = profile.getState().profile?.bodyPhoto?.imageId ?? '';
    const failing = {
      ...services,
      images: { ...services.images, save: () => Promise.reject(new Error('full')) },
    };
    await expect(
      saveBodyPhoto({ blob: blob('two'), landmarks: MOVED }, failing, profile),
    ).rejects.toThrow('full');
    expect(profile.getState().profile?.bodyPhoto?.imageId).toBe(first);
    await expect(services.images.read(first)).resolves.toBeDefined();
  });
});

describe('deleteBodyPhoto', () => {
  it('removes the image and the profile field', async () => {
    const { services, profile } = await setup();
    await saveBodyPhoto({ blob: blob('one'), landmarks: BODY_A.landmarks }, services, profile);
    const id = profile.getState().profile?.bodyPhoto?.imageId ?? '';
    await deleteBodyPhoto(services, profile);
    expect(profile.getState().profile?.bodyPhoto).toBeUndefined();
    expect(profile.getState().profile?.tryOnMode).toBeUndefined();
    await expect(services.images.read(id)).rejects.toBeDefined();
    expect((await services.profile.list())[0].bodyPhoto).toBeUndefined();
  });

  it('is harmless without a photo', async () => {
    const { services, profile } = await setup();
    await expect(deleteBodyPhoto(services, profile)).resolves.toBeUndefined();
  });
});
