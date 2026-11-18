import { fixtureCloset } from '@/core/testing';
import { createMemoryImageStore } from '@/services/testing';
import { replaceCutoutImages } from './recut';

describe('replaceCutoutImages (touch-up save)', () => {
  const assets = {
    image: { uri: 'blob:touched', width: 200, height: 400 },
    thumb: { uri: 'blob:touched-thumb', width: 128, height: 256 },
  };

  it('saves under new ids, keeps the original and drops the old cutout only afterwards', async () => {
    const images = createMemoryImageStore();
    const originalId = await images.save({ uri: 'blob:original' });
    const oldCutout = await images.save({ uri: 'blob:cut' });
    const oldThumb = await images.save({ uri: 'blob:thumb' });
    const item = {
      ...fixtureCloset()[0],
      images: { originalId, cutoutId: oldCutout, thumbId: oldThumb },
    };
    const result = await replaceCutoutImages(images, item, assets);
    expect(result.cutout).toEqual({ aspectRatio: 0.5, hasAlpha: true });
    expect(result.images.originalId).toBe(originalId);
    expect(new Set([result.images.cutoutId, result.images.thumbId, oldCutout, oldThumb]).size).toBe(
      4,
    );
    await expect(images.uri(oldCutout)).rejects.toThrow();
    await expect(images.uri(oldThumb)).rejects.toThrow();
    await expect(images.uri(originalId)).resolves.toBeDefined();
    await expect(images.uri(result.images.cutoutId)).resolves.toBeDefined();
  });

  it('keeps the old images when saving fails', async () => {
    const images = createMemoryImageStore();
    const originalId = await images.save({ uri: 'blob:original' });
    const oldCutout = await images.save({ uri: 'blob:cut' });
    const item = {
      ...fixtureCloset()[0],
      images: { originalId, cutoutId: oldCutout, thumbId: oldCutout },
    };
    const failing = { ...images, save: () => Promise.reject(new Error('disk full')) };
    await expect(replaceCutoutImages(failing, item, assets)).rejects.toThrow('disk full');
    await expect(images.uri(oldCutout)).resolves.toBeDefined();
  });
});
