import { BODY_A } from '@/core/tryon/bodies';
import * as pose from '@/core/tryon/pose';
import { createFakeBodyPhotoCropper, createFakePoseDetector } from '@/services/testing';
import { analysePhoto, placeByHand, wholePhotoWindow } from './bodyPhotoPipeline';

jest.mock('@/core/tryon/pose', () => ({
  BLOCKING_POSE_PROBLEMS: ['no-person', 'landmarks-out-of-order'],
  fromBlazePose: jest.fn(),
  bodyCropWindow: jest.fn(),
  toCanvas: jest.fn(),
  defaultPhotoLandmarks: jest.fn(),
}));
const mocked = jest.mocked(pose);

const PICKED = { uri: 'blob:photo', width: 3000, height: 4000 };
const DETECTION = { keypoints: [], width: 3000, height: 4000 };
const WINDOW = { x: 100, y: 200, width: 1500, height: 3000 };
const IN_IMAGE = { ...BODY_A.landmarks, chin: { x: 1, y: 2 } };

beforeEach(() => {
  jest.resetAllMocks();
  mocked.defaultPhotoLandmarks.mockReturnValue(BODY_A.landmarks);
  mocked.bodyCropWindow.mockReturnValue(WINDOW);
  mocked.toCanvas.mockReturnValue(BODY_A.landmarks);
});

describe('wholePhotoWindow', () => {
  it('is a centred 1:2 window that contains a landscape photo (the rest is filled)', () => {
    const w = wholePhotoWindow(4000, 3000);
    expect(w.height / w.width).toBeCloseTo(2);
    expect(w.height).toBeCloseTo(8000);
    expect(w.x + w.width / 2).toBeCloseTo(2000);
    expect(w.y + w.height / 2).toBeCloseTo(1500);
  });

  it('covers a tall photo by width', () => {
    const w = wholePhotoWindow(1000, 3000);
    expect(w.height / w.width).toBeCloseTo(2);
    expect(w.height).toBeGreaterThanOrEqual(3000);
    expect(w.width).toBeGreaterThanOrEqual(1000);
  });
});

describe('analysePhoto', () => {
  it('goes straight to manual placement when no detector is available', async () => {
    const detector = { ...createFakePoseDetector(), available: false };
    const prepare = jest.spyOn(detector, 'prepare');
    const r = await analysePhoto(PICKED, {
      pose: detector,
      bodyCrop: createFakeBodyPhotoCropper(),
    });
    expect(prepare).not.toHaveBeenCalled();
    expect(r).toMatchObject({ kind: 'ready', warnings: [] });
    if (r.kind === 'ready') {
      expect(r.photo.landmarks).toBe(BODY_A.landmarks);
      expect(r.photo.detected).toBeUndefined();
    }
  });

  it('reports no-person when nobody is found', async () => {
    const r = await analysePhoto(PICKED, {
      pose: createFakePoseDetector(undefined),
      bodyCrop: createFakeBodyPhotoCropper(),
    });
    expect(r).toEqual({ kind: 'problems', problems: ['no-person'] });
  });

  it('reports blocking problems without cropping', async () => {
    mocked.fromBlazePose.mockReturnValue({
      landmarks: IN_IMAGE,
      problems: ['landmarks-out-of-order', 'too-small'],
    });
    const bodyCrop = createFakeBodyPhotoCropper();
    const crop = jest.spyOn(bodyCrop, 'crop');
    const r = await analysePhoto(PICKED, { pose: createFakePoseDetector(DETECTION), bodyCrop });
    expect(r).toEqual({ kind: 'problems', problems: ['landmarks-out-of-order', 'too-small'] });
    expect(crop).not.toHaveBeenCalled();
  });

  it('crops, transforms and keeps warnings when the photo is usable', async () => {
    mocked.fromBlazePose.mockReturnValue({ landmarks: IN_IMAGE, problems: ['arms-too-close'] });
    const bodyCrop = createFakeBodyPhotoCropper();
    const crop = jest.spyOn(bodyCrop, 'crop');
    const progress = jest.fn();
    const r = await analysePhoto(
      PICKED,
      { pose: createFakePoseDetector(DETECTION), bodyCrop },
      progress,
    );
    expect(mocked.fromBlazePose).toHaveBeenCalledWith([], 3000, 4000);
    expect(crop).toHaveBeenCalledWith(
      'blob:photo',
      WINDOW,
      expect.objectContaining({ width: 1000, height: 2000 }),
    );
    expect(mocked.toCanvas).toHaveBeenCalledWith(IN_IMAGE, WINDOW);
    expect(progress).toHaveBeenCalledWith(1);
    expect(r).toMatchObject({ kind: 'ready', warnings: ['arms-too-close'] });
    if (r.kind === 'ready') {
      expect(r.photo.landmarks).toBe(BODY_A.landmarks);
      expect(r.photo.detected).toBe(BODY_A.landmarks);
      expect(r.photo.uri).toBe('fake://body-photo');
    }
  });

  it('reports a failed detector instead of throwing', async () => {
    const detector = createFakePoseDetector(DETECTION);
    jest.spyOn(detector, 'prepare').mockRejectedValue(new Error('offline'));
    const r = await analysePhoto(PICKED, {
      pose: detector,
      bodyCrop: createFakeBodyPhotoCropper(),
    });
    expect(r).toEqual({ kind: 'failed' });
  });
});

describe('placeByHand', () => {
  it('crops the whole photo and starts from the default landmarks', async () => {
    const bodyCrop = createFakeBodyPhotoCropper();
    const crop = jest.spyOn(bodyCrop, 'crop');
    const photo = await placeByHand(PICKED, { bodyCrop });
    expect(crop).toHaveBeenCalledWith(
      'blob:photo',
      wholePhotoWindow(3000, 4000),
      expect.anything(),
    );
    expect(photo.landmarks).toBe(BODY_A.landmarks);
    expect(photo.detected).toBeUndefined();
  });
});
