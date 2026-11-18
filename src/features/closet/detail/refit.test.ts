import type { GarmentRig } from '@/core/model/types';
import { fixtureById } from '@/core/testing/fixtures';
import { refitAfterCutout } from './refit';

const found: GarmentRig = {
  kind: 'top',
  version: 1,
  points: {},
  confidence: 0.9,
  edited: false,
};
jest.mock('@/core/fit', () => ({
  RIG_VERSION: 1,
  rigKindOf: () => 'top',
  detectRig: () => found,
}));

const tee = fixtureById('tee-white');
const result = {
  images: { ...tee.images, cutoutId: 'new-cutout' },
  cutout: { aspectRatio: 0.8, hasAlpha: true },
};
const pixels = {
  read: async () => ({ width: 1, height: 1, rgba: new Uint8ClampedArray([0, 0, 0, 255]) }),
};
const images = { uri: jest.fn(async (id: string) => `blob:${id}`) };

describe('refitAfterCutout', () => {
  it('detects a fresh, unedited rig from the new cutout', async () => {
    const out = await refitAfterCutout({ images, pixels }, tee, result);
    expect(out).toEqual({ fit: found, replacedEdited: false });
    expect(images.uri).toHaveBeenCalledWith('new-cutout');
  });

  it('says so when it replaces points the user had edited', async () => {
    const edited = { ...tee, fit: { ...found, edited: true } };
    expect((await refitAfterCutout({ images, pixels }, edited, result)).replacedEdited).toBe(true);
  });

  it('gives no rig for a plain photo or an unreadable image', async () => {
    const plain = { ...result, cutout: { ...result.cutout, hasAlpha: false } };
    expect((await refitAfterCutout({ images, pixels }, tee, plain)).fit).toBeUndefined();
    const broken = { uri: async () => Promise.reject(new Error('gone')) };
    expect((await refitAfterCutout({ images: broken, pixels }, tee, result)).fit).toBeUndefined();
  });
});
