import { CutoutRejectedError, type BackgroundRemover } from '@/services';
import { createFakePixelReader, createMemoryImageStore } from '@/services/testing';
import { cutOutPhoto, cutoutField, saveProcessedPhoto, type ProcessedPhoto } from './processPhoto';

// The thumbnail of a cutout is made with expo-image-manipulator; here it just reports a file.
jest.mock('expo-image-manipulator', () => {
  const context = {
    resize: () => context,
    renderAsync: async () => ({
      width: 128,
      height: 256,
      saveAsync: async () => ({ uri: 'blob:cut-thumb', width: 128, height: 256 }),
    }),
  };
  return {
    ImageManipulator: { manipulate: () => context },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  };
});

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

describe('cutOutPhoto when the background cannot be separated', () => {
  const remover = (error: Error): BackgroundRemover => ({
    available: true,
    prepare: async () => undefined,
    remove: async () => {
      throw error;
    },
  });

  it('keeps the photo and flags the rejection so the form can say so', async () => {
    const out = await cutOutPhoto(
      photo(false),
      remover(new CutoutRejectedError(0.2)),
      createFakePixelReader(),
    );
    expect(out.cutout).toBeUndefined();
    expect(out.cutoutRejected).toBe(true);
  });

  it('stays silent for other failures', async () => {
    const out = await cutOutPhoto(
      photo(false),
      remover(new Error('worker died')),
      createFakePixelReader(),
    );
    expect(out.cutoutRejected).toBeUndefined();
  });
});

describe('cutOutPhoto keeps the cutout alpha for the capture check', () => {
  const working: BackgroundRemover = {
    available: true,
    prepare: async () => undefined,
    remove: async () => ({
      uri: 'blob:cut',
      hasAlpha: true,
      width: 300,
      height: 600,
      method: 'u2net',
      score: 0.9,
      crop: { x: 0, y: 0, width: 600, height: 1200, scale: 0.5 },
    }),
  };
  // 2 x 1 pixels: opaque, transparent.
  const pixels = {
    width: 2,
    height: 1,
    rgba: new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]),
  };

  it('reads the alpha of the cutout thumbnail', async () => {
    const out = await cutOutPhoto(photo(false), working, createFakePixelReader(pixels));
    expect(out.cutout?.image.uri).toBe('blob:cut');
    expect(out.cutoutMask?.width).toBe(2);
    expect(out.cutoutMask?.height).toBe(1);
    expect(Array.from(out.cutoutMask?.alpha ?? [])).toEqual([255, 0]);
  });

  it('leaves the mask out where pixels cannot be read', async () => {
    const out = await cutOutPhoto(photo(false), working, createFakePixelReader());
    expect(out.cutout).toBeDefined();
    expect(out.cutoutMask).toBeUndefined();
  });
});
