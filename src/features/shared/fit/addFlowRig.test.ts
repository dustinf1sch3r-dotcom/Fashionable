import { FIXTURE_KIND, fixturePixels } from '@/core/fit/fixtureGarments';
import { boxDownsample, keyBackground, SCORE_RULES, scoreCutout, trimToAlpha } from '@/core/image';
import type { Item } from '@/core/model/types';
import type { PixelData, PixelReader } from '@/services';
import { detectItemRig, RIG_PIXELS } from './rigLifecycle';

/**
 * The add-item path on the real garment fixtures, end to end in Jest: a photo (the fixture
 * flattened onto a floor, as a phone photo is) -> plain-background keying -> trim to the garment
 * (what `applyMaskToImage` does) -> read the cutout's alpha at `RIG_PIXELS` (what `detectItemRig`
 * does in the app) -> `detectRig`. Every fittable fixture must come out with a rig.
 *
 * Why it exists: the browser trial found no rig for the jeans and the dress after the add flow
 * although `detectRig` succeeds on the raw fixture PNGs (src/core/fit/fixtures.test.ts). The cause
 * was the cutout, not the detector: the U-2-Netp mask of a dark garment on the black the
 * transparent PNG is flattened to kept 14% (jeans) and 4% (dress) of the garment.
 */

type Rgb = [number, number, number];

const SUBJECTS: Record<string, Pick<Item, 'category' | 'subcategory'>> = {
  'tee-navy': { category: 'top', subcategory: 'tshirt' },
  'tee-white': { category: 'top', subcategory: 'tshirt' },
  'shirt-blue': { category: 'top', subcategory: 'shirt' },
  'jacket-denim': { category: 'outerwear', subcategory: 'denim-jacket' },
  'jeans-dark': { category: 'bottom', subcategory: 'jeans' },
  'trousers-grey': { category: 'bottom', subcategory: 'trousers' },
  'skirt-olive': { category: 'bottom', subcategory: 'skirt' },
  'dress-green': { category: 'onepiece', subcategory: 'day-dress' },
};

/** Deterministic noise in -1..1. */
function noise(x: number, y: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

interface Floor {
  name: string;
  /** Floor colour at a pixel. */
  at: (x: number, y: number) => Rgb;
}

const FLOORS: Floor[] = [
  // What the browser trial really did: a transparent PNG flattened to JPEG is black.
  { name: 'black (flattened PNG)', at: () => [0, 0, 0] },
  { name: 'off-white', at: () => [245, 243, 238] },
  {
    name: 'textured grey',
    at: (x, y) => {
      const n = noise(x, y) * 8;
      return [150 + n, 150 + n, 152 + n];
    },
  },
  {
    name: 'wood',
    at: (x, y) => {
      const grain = Math.sin(y * 0.35 + noise(x >> 3, 0) * 2) * 6 + noise(x, y) * 4;
      return [150 + grain, 108 + grain, 70 + grain];
    },
  },
];

/** The fixture composited over `floor`, as a photo: opaque RGBA with a little sensor noise. */
function photoOf(name: string, floor: Floor): PixelData {
  const { width, height, rgba } = fixturePixels(name);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = (rgba[i + 3] as number) / 255;
      const bg = floor.at(x, y);
      const n = noise(x + 7, y + 3) * 2;
      for (let c = 0; c < 3; c++) {
        out[i + c] = (rgba[i + c] as number) * a + bg[c] * (1 - a) + n;
      }
      out[i + 3] = 255;
    }
  }
  return { width, height, rgba: out };
}

/** Keys the photo and trims to the garment: the cutout PNG the add flow stores. */
function cutoutOf(photo: PixelData): { data: PixelData; score: number } | undefined {
  const keyed = keyBackground(photo.rgba, photo.width, photo.height);
  if (!keyed) return undefined;
  const score = scoreCutout(keyed.alpha, photo.width, photo.height).score;
  const rgba = new Uint8ClampedArray(photo.rgba);
  for (let i = 0; i < keyed.alpha.length; i++) rgba[i * 4 + 3] = Math.round(keyed.alpha[i] * 255);
  const rect = trimToAlpha(rgba, photo.width, photo.height);
  if (!rect) return undefined;
  const out = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    const from = ((rect.y + y) * photo.width + rect.x) * 4;
    out.set(rgba.subarray(from, from + rect.width * 4), y * rect.width * 4);
  }
  return { data: { width: rect.width, height: rect.height, rgba: out }, score };
}

/** A PixelReader over in-memory cutouts that scales like the web reader (longest side `max`). */
function readerOf(cutout: PixelData): PixelReader {
  return {
    async read(_uri, max) {
      const scale = Math.min(1, max / Math.max(cutout.width, cutout.height));
      const w = Math.max(1, Math.round(cutout.width * scale));
      const h = Math.max(1, Math.round(cutout.height * scale));
      return {
        width: w,
        height: h,
        rgba: boxDownsample(cutout.rgba, cutout.width, cutout.height, w, h),
      };
    },
  };
}

const names = Object.keys(FIXTURE_KIND);

describe('add flow: mask preparation to rig, on every fittable fixture', () => {
  for (const floor of FLOORS) {
    describe(`on a ${floor.name} floor`, () => {
      it.each(names)('%s gets a rig', async (name) => {
        const cut = cutoutOf(photoOf(name, floor));
        expect(cut).toBeDefined();
        const { data, score } = cut as NonNullable<typeof cut>;
        expect(score).toBeGreaterThanOrEqual(SCORE_RULES.accept);
        const rig = await detectItemRig(
          readerOf(data),
          SUBJECTS[name] as NonNullable<(typeof SUBJECTS)[string]>,
          'blob:cutout',
        );
        expect(rig).toBeDefined();
        expect(rig?.kind).toBeDefined();
        expect(rig?.confidence).toBeGreaterThan(0.6);
      });
    });
  }

  it('a blotchy model mask (the old failure) has no rig and is rejected by the score', async () => {
    const { data } = cutoutOf(photoOf('jeans-dark', FLOORS[0] as Floor)) as NonNullable<
      ReturnType<typeof cutoutOf>
    >;
    // Keep ~15% of the garment in soft patches, like U-2-Netp did on dark cloth on black.
    const alpha = new Float32Array(data.width * data.height);
    const rgba = new Uint8ClampedArray(data.rgba);
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const i = y * data.width + x;
        const patch = Math.sin(x / 5) * Math.sin(y / 7);
        const keep = patch > 0.55 ? 0.6 : 0;
        alpha[i] = ((data.rgba[i * 4 + 3] as number) / 255) * keep;
        rgba[i * 4 + 3] = Math.round(alpha[i] * 255);
      }
    }
    expect(scoreCutout(alpha, data.width, data.height).score).toBeLessThan(SCORE_RULES.accept);
    const rig = await detectItemRig(
      readerOf({ width: data.width, height: data.height, rgba }),
      SUBJECTS['jeans-dark'] as NonNullable<(typeof SUBJECTS)[string]>,
      'blob:blotchy',
    );
    expect(rig).toBeUndefined();
  });

  it('reads the cutout alpha at RIG_PIXELS, however large the cutout is', async () => {
    const cut = cutoutOf(photoOf('jeans-dark', FLOORS[0] as Floor)) as NonNullable<
      ReturnType<typeof cutoutOf>
    >;
    const read = await readerOf(cut.data).read('x', RIG_PIXELS);
    expect(Math.max(read?.width ?? 0, read?.height ?? 0)).toBeLessThanOrEqual(RIG_PIXELS);
  });
});
