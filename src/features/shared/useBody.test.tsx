import { act, renderHook, waitFor } from '@testing-library/react-native';
import { BODY_A } from '@/core/tryon/bodies';
import { createTestServices } from '@/services';
import { getStores, resetStores } from '@/state';
import { useBody } from './useBody';

const mockServices = createTestServices();
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));

const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

async function hydrateWithPhoto(imageId: string) {
  const stores = getStores();
  await stores.profile.getState().hydrate();
  stores.profile.getState().update({
    bodyPhoto: { imageId, landmarks: { ...BODY_A.landmarks, chin: { x: 500, y: 330 } } },
  });
}

beforeEach(() => {
  resetStores();
  jest.resetModules();
});

describe('useBody', () => {
  it('is the silhouette without a photo', async () => {
    await getStores().profile.getState().hydrate();
    const { result } = await renderHook(() => useBody());
    expect(result.current).toMatchObject({ mode: 'silhouette', hasPhoto: false });
    expect(result.current.body).toBe(BODY_A);
    expect(result.current.backdrop).toBeUndefined();
  });

  it('resolves the photo as the backdrop and toggles the mode into the profile', async () => {
    await mockServices.images.save(png(), { id: 'me-photo' });
    await hydrateWithPhoto('me-photo');
    const { result } = await renderHook(() => useBody());
    await waitFor(() => expect(result.current.backdrop).toBeDefined());
    expect(result.current).toMatchObject({ mode: 'photo', hasPhoto: true });
    expect(result.current.body.id).toBe('photo');

    await act(async () => result.current.setMode('silhouette'));
    expect(getStores().profile.getState().profile?.tryOnMode).toBe('silhouette');
    expect(result.current.body).toBe(BODY_A);
    expect(result.current.backdrop).toBeUndefined();
    expect(result.current.hasPhoto).toBe(true);

    await act(async () => result.current.setMode('photo'));
    expect(result.current.body.id).toBe('photo');
  });

  it('falls back to the silhouette when the stored image is missing', async () => {
    await hydrateWithPhoto('no-such-image');
    const { result } = await renderHook(() => useBody());
    await waitFor(() => expect(result.current.hasPhoto).toBe(false));
    expect(result.current.body).toBe(BODY_A);
    expect(result.current.mode).toBe('silhouette');
  });
});
