import { syntheticPerson } from '@/core/testing/poses';
import { bodyCropWindow, fromBlazePose, POSE_RULES, toCanvas } from '@/core/tryon/pose';
import { createFakeBodyPhotoCropper, createFakePoseDetector } from '../testing';
import { createBodyPhotoCropper, createPoseDetector } from './index';

describe('pose services without a platform implementation', () => {
  it('report unavailable and find nobody', async () => {
    const detector = createPoseDetector();
    expect(detector.available).toBe(false);
    await expect(detector.prepare()).resolves.toBeUndefined();
    await expect(detector.detect('x://photo')).resolves.toBeUndefined();
    const cropper = createBodyPhotoCropper();
    expect(cropper.available).toBe(false);
    await expect(
      cropper.crop(
        'x://photo',
        { x: 0, y: 0, width: 1, height: 2 },
        { width: 1, height: 2, fill: '#fff' },
      ),
    ).rejects.toThrow();
  });
});

describe('photo pipeline with the fakes', () => {
  it('detects, normalises and crops a synthetic person', async () => {
    const detector = createFakePoseDetector(syntheticPerson({ size: 0.7, cx: 0.4, top: 0.12 }));
    const progress: number[] = [];
    await detector.prepare((f) => progress.push(f));
    expect(progress).toEqual([1]);

    const detection = await detector.detect('x://photo');
    if (!detection) throw new Error('fake detector returned nothing');
    const result = fromBlazePose(detection.keypoints, detection.width, detection.height);
    expect(result.problems).toEqual([]);
    if (!result.landmarks) throw new Error('no landmarks');

    const window = bodyCropWindow(result.landmarks);
    const crop = await createFakeBodyPhotoCropper().crop('x://photo', window, {
      width: POSE_RULES.canvasWidth,
      height: POSE_RULES.canvasHeight,
      fill: '#FAF8F5',
    });
    expect(crop.uri).toBeTruthy();
    const canvas = toCanvas(result.landmarks, window);
    expect(canvas.headTop.y).toBeGreaterThan(0);
    expect(canvas.footL.y).toBeLessThan(POSE_RULES.canvasHeight);
  });

  it('reports nobody found', async () => {
    const detector = createFakePoseDetector(undefined);
    await expect(detector.detect('x://photo')).resolves.toBeUndefined();
  });
});
