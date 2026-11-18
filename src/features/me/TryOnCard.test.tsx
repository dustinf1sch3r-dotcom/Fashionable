import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BODY_A } from '@/core/tryon/bodies';
import { createTestServices } from '@/services';
import { getStores, resetStores } from '@/state';
import { TryOnCard } from './TryOnCard';

const mockServices = createTestServices();
const mockPush = jest.fn();
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => {
  resetStores();
  mockPush.mockReset();
});

async function withPhoto() {
  await mockServices.images.save(new Blob(['x'], { type: 'image/png' }), { id: 'me' });
  const profile = getStores().profile.getState();
  await profile.hydrate();
  profile.update({ bodyPhoto: { imageId: 'me', landmarks: BODY_A.landmarks }, tryOnMode: 'photo' });
}

describe('TryOnCard', () => {
  it('invites you to add a photo and states the privacy promise', async () => {
    await getStores().profile.getState().hydrate();
    await render(<TryOnCard />);
    expect(screen.getByTestId('profile-tryon-card')).toBeTruthy();
    expect(screen.getByText(/stays on this phone/)).toBeTruthy();
    expect(screen.queryByTestId('profile-tryon-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('profile-tryon-add'));
    expect(mockPush).toHaveBeenCalledWith('/me/photo');
  });

  it('with a photo offers retake, adjust and delete', async () => {
    await withPhoto();
    await render(<TryOnCard />);
    await waitFor(() => expect(screen.getByTestId('profile-tryon-thumb')).toBeTruthy());
    expect(screen.queryByTestId('profile-tryon-add')).toBeNull();
    await fireEvent.press(screen.getByTestId('profile-tryon-retake'));
    expect(mockPush).toHaveBeenLastCalledWith('/me/photo');
    await fireEvent.press(screen.getByTestId('profile-tryon-adjust'));
    expect(mockPush).toHaveBeenLastCalledWith('/me/photo?step=adjust');
  });

  it('deleting asks first, then removes the image and the profile field', async () => {
    await withPhoto();
    await render(<TryOnCard />);
    await fireEvent.press(screen.getByTestId('profile-tryon-delete'));
    expect(getStores().profile.getState().profile?.bodyPhoto).toBeDefined();
    await fireEvent.press(screen.getByTestId('me-delete'));
    await waitFor(() => expect(getStores().profile.getState().profile?.bodyPhoto).toBeUndefined());
    await expect(mockServices.images.read('me')).rejects.toBeDefined();
    await act(async () => {});
    expect(screen.getByTestId('profile-tryon-add')).toBeTruthy();
  });

  it('can be dismissed without deleting', async () => {
    await withPhoto();
    await render(<TryOnCard />);
    await fireEvent.press(screen.getByTestId('profile-tryon-delete'));
    await fireEvent.press(screen.getByTestId('me-delete-cancel'));
    expect(getStores().profile.getState().profile?.bodyPhoto).toBeDefined();
  });
});
