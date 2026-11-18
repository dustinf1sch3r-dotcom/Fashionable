import { createMemoryImageStore } from '@/services/testing';
import { cutoutField, saveProcessedPhoto, type ProcessedPhoto } from './processPhoto';

const rendered = (uri: string, width: number, height: number) => ({ uri, width, height });

function photo(withCut: boolean): ProcessedPhoto {
  return {
    original: rendered('blob:o', 1200, 1600),
    thumb: rendered('blob:t', 192, 256),
    colors: [],
    aspectRatio: 0.75,
    cutout: withCut
      ? {
          image: rendered('blob:c', 300, 600),
          thumb: rendered('blob:ct', 128, 256),
          crop: { x: 100, y: 200, width: 600, height: 1200, scale: 0.5 },
        }
      : undefined,
  };
}

describe('saveProcessedPhoto crop', () => {
  it('stores the crop of a cutout', async () => {
    const { cutout } = await saveProcessedPhoto(createMemoryImageStore(), photo(true));
    expect(cutout).toEqual({
      aspectRatio: 0.5,
      hasAlpha: true,
      crop: { x: 100, y: 200, width: 600, height: 1200, scale: 0.5 },
    });
  });

  it('uses the whole photo as the crop for "use original"', async () => {
    const { cutout } = await saveProcessedPhoto(createMemoryImageStore(), photo(true), true);
    expect(cutout).toEqual({
      aspectRatio: 0.75,
      hasAlpha: false,
      crop: { x: 0, y: 0, width: 1200, height: 1600, scale: 1 },
    });
  });

  it('cutoutField leaves the crop out when unknown', () => {
    expect(cutoutField({ width: 10, height: 20 }, true)).toEqual({
      aspectRatio: 0.5,
      hasAlpha: true,
    });
  });
});
