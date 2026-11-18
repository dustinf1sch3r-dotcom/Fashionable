import { fixtureCloset } from '@/core/testing';
import { createFakeBackgroundRemover, createMemoryImageStore } from '@/services/testing';
import { recutItem } from './recut';

describe('recutItem', () => {
  const remover = createFakeBackgroundRemover({
    uri: 'blob:cut',
    hasAlpha: true,
    width: 300,
    height: 400,
  });
  const assets = {
    image: { uri: 'blob:cut', width: 300, height: 400 },
    thumb: { uri: 'blob:thumb', width: 192, height: 256 },
  };

  it('stores a new cutout and thumbnail, keeps the original and removes the old ones', async () => {
    const images = createMemoryImageStore();
    const originalId = await images.save({ uri: 'blob:original' });
    const oldCutout = await images.save({ uri: 'blob:original' });
    const oldThumb = await images.save({ uri: 'blob:thumb-old' });
    const item = {
      ...fixtureCloset()[0],
      images: { originalId, cutoutId: oldCutout, thumbId: oldThumb },
    };

    const result = await recutItem({ images, cutout: remover }, item, async () => assets);

    expect(result.images.originalId).toBe(originalId);
    expect(result.images.cutoutId).not.toBe(oldCutout);
    expect(result.images.thumbId).not.toBe(oldThumb);
    expect(result.cutout).toEqual({ aspectRatio: 0.75, hasAlpha: true });
    await expect(images.uri(originalId)).resolves.toBeDefined();
    await expect(images.uri(oldCutout)).rejects.toThrow();
    await expect(images.uri(result.images.cutoutId)).resolves.toBeDefined();
  });

  it('leaves everything untouched when removal fails', async () => {
    const images = createMemoryImageStore();
    const originalId = await images.save({ uri: 'blob:original' });
    const item = {
      ...fixtureCloset()[0],
      images: { originalId, cutoutId: originalId, thumbId: originalId },
    };
    await expect(
      recutItem({ images, cutout: remover }, item, async () => {
        throw new Error('no garment');
      }),
    ).rejects.toThrow('no garment');
    await expect(images.uri(originalId)).resolves.toBeDefined();
  });
});
