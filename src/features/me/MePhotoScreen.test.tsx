import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BODY_A } from '@/core/tryon/bodies';
import * as poseModule from '@/core/tryon/pose';
import { createTestServices } from '@/services';
import { createFakeBodyPhotoCropper, createFakePoseDetector } from '@/services/testing';
import { getStores, resetStores } from '@/state';
import { MePhotoScreen } from './MePhotoScreen';

const mockServices = createTestServices();
const mockBack = jest.fn();
const mockPick = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, testID }: { children: React.ReactNode; testID?: string }) => {
    const { View } = jest.requireActual('react-native');
    return <View testID={testID}>{children}</View>;
  },
}));
jest.mock('./pickPhoto', () => ({ pickBodyPhoto: (...a: unknown[]) => mockPick(...a) }));
jest.mock('@/core/tryon/pose', () => {
  const landmarks = () => jest.requireActual('@/core/tryon/bodies').BODY_A.landmarks;
  return {
    BLOCKING_POSE_PROBLEMS: ['no-person', 'landmarks-out-of-order'],
    fromBlazePose: jest.fn(),
    checkLandmarks: jest.fn(() => []),
    bodyCropWindow: jest.fn(() => ({ x: 0, y: 0, width: 500, height: 1000 })),
    toCanvas: jest.fn(() => landmarks()),
    defaultPhotoLandmarks: jest.fn(() => landmarks()),
  };
});
const pose = jest.mocked(poseModule);

const PICKED = { kind: 'picked', photo: { uri: 'blob:p', width: 1000, height: 2000 } };

function useDetector(result: Parameters<typeof createFakePoseDetector>[0], available = true): void {
  mockServices.pose = { ...createFakePoseDetector(result), available };
  mockServices.bodyCrop = createFakeBodyPhotoCropper();
}

beforeEach(() => {
  resetStores();
  mockBack.mockReset();
  mockPick.mockReset();
  mockParams = {};
  pose.fromBlazePose.mockReset();
  pose.checkLandmarks.mockReset().mockReturnValue([]);
});

async function start() {
  await getStores().profile.getState().hydrate();
  await render(<MePhotoScreen />);
}

describe('MePhotoScreen', () => {
  it('starts on the guide with the privacy line and both ways to add a photo', async () => {
    useDetector(undefined);
    await start();
    expect(screen.getByTestId('screen-me-photo')).toBeTruthy();
    expect(screen.getByTestId('me-guide')).toBeTruthy();
    expect(screen.getByTestId('me-privacy')).toHaveTextContent(/never uploaded/);
    expect(screen.getByTestId('me-take-photo')).toBeTruthy();
    expect(screen.getByTestId('me-choose-photo')).toBeTruthy();
  });

  it('does not move on when the picker is cancelled', async () => {
    useDetector(undefined);
    mockPick.mockResolvedValue({ kind: 'cancelled' });
    await start();
    await fireEvent.press(screen.getByTestId('me-choose-photo'));
    expect(screen.getByTestId('me-guide')).toBeTruthy();
  });

  it('explains when nobody is found and offers retake or placing by hand', async () => {
    useDetector(undefined);
    mockPick.mockResolvedValue(PICKED);
    await start();
    await fireEvent.press(screen.getByTestId('me-choose-photo'));
    await waitFor(() => expect(screen.getByTestId('me-problem-no-person')).toBeTruthy());
    expect(screen.getByText(/couldn’t find you/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('me-retake'));
    expect(screen.getByTestId('me-guide')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('me-choose-photo'));
    await waitFor(() => expect(screen.getByTestId('me-by-hand')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('me-by-hand'));
    await waitFor(() => expect(screen.getByTestId('me-correct')).toBeTruthy());
    await fireEvent(screen.getByTestId('me-canvas'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 600, x: 0, y: 0 } },
    });
    expect(screen.getByTestId('me-handle-shoulderL')).toBeTruthy();
  });

  it('detects, shows warnings, lets you save, and stores the photo', async () => {
    useDetector({ keypoints: [], width: 1000, height: 2000 });
    pose.fromBlazePose.mockReturnValue({
      landmarks: BODY_A.landmarks,
      problems: ['arms-too-close'],
    });
    mockPick.mockResolvedValue(PICKED);
    await start();
    await fireEvent.press(screen.getByTestId('me-choose-photo'));
    await waitFor(() => expect(screen.getByTestId('me-correct')).toBeTruthy());
    expect(screen.getByTestId('me-problem-arms-too-close')).toBeTruthy();
    expect(screen.getByTestId('me-reset')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('me-save'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const photo = getStores().profile.getState().profile?.bodyPhoto;
    expect(photo?.landmarks).toEqual(BODY_A.landmarks);
    expect(photo?.detected).toEqual(BODY_A.landmarks);
    expect(getStores().profile.getState().profile?.tryOnMode).toBe('photo');
    await expect(mockServices.images.read(photo?.imageId ?? '')).resolves.toBeDefined();
  });

  it('blocks saving while the points are out of order', async () => {
    useDetector({ keypoints: [], width: 1000, height: 2000 });
    pose.fromBlazePose.mockReturnValue({ landmarks: BODY_A.landmarks, problems: [] });
    pose.checkLandmarks.mockReturnValue(['landmarks-out-of-order']);
    mockPick.mockResolvedValue(PICKED);
    await start();
    await fireEvent.press(screen.getByTestId('me-choose-photo'));
    await waitFor(() =>
      expect(screen.getByTestId('me-problem-landmarks-out-of-order')).toBeTruthy(),
    );
    expect(screen.getByTestId('me-save')).toBeDisabled();
  });

  it('skips detection when the detector is not available on this device', async () => {
    useDetector({ keypoints: [], width: 1000, height: 2000 }, false);
    mockPick.mockResolvedValue(PICKED);
    await start();
    await fireEvent.press(screen.getByTestId('me-choose-photo'));
    await waitFor(() => expect(screen.getByTestId('me-correct')).toBeTruthy());
    expect(pose.fromBlazePose).not.toHaveBeenCalled();
  });

  it('adjust mode opens the existing photo for correction', async () => {
    useDetector(undefined);
    await mockServices.images.save(new Blob(['x'], { type: 'image/png' }), { id: 'me' });
    mockParams = { step: 'adjust' };
    await getStores().profile.getState().hydrate();
    getStores()
      .profile.getState()
      .update({ bodyPhoto: { imageId: 'me', landmarks: BODY_A.landmarks } });
    await getStores().profile.getState().flush();
    await render(<MePhotoScreen />);
    await waitFor(() => expect(screen.getByTestId('me-correct')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('me-save'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(getStores().profile.getState().profile?.bodyPhoto?.imageId).toBe('me');
  });
});
