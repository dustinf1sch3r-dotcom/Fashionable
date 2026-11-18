import type { GarmentRig, Item } from '@/core/model/types';
import { fixtureById } from '@/core/testing/fixtures';
import type { PixelReader } from '@/services';
import { createLazyRigDetector, detectItemRig, isFittable, rigIsCurrent } from './rigLifecycle';

const mockDetect = jest.fn();
jest.mock('@/core/fit', () => ({
  RIG_VERSION: 2,
  rigKindOf: (i: { category: string }) =>
    i.category === 'top' ? 'top' : i.category === 'bottom' ? 'trousers' : undefined,
  detectRig: (...args: unknown[]) => mockDetect(...args),
}));

const rig = (over: Partial<GarmentRig> = {}): GarmentRig => ({
  kind: 'top',
  version: 2,
  points: {},
  confidence: 0.9,
  edited: false,
  ...over,
});
const tee = fixtureById('tee-white');
const shoes = fixtureById('sneakers-white');

/** A 2×2 reader whose alpha is 0, 255, 255, 0. */
const reader = (): PixelReader => ({
  read: jest.fn(async () => ({
    width: 2,
    height: 2,
    rgba: new Uint8ClampedArray([1, 1, 1, 0, 1, 1, 1, 255, 1, 1, 1, 255, 1, 1, 1, 0]),
  })),
});

beforeEach(() => mockDetect.mockReset().mockReturnValue(rig()));

describe('detectItemRig', () => {
  it('feeds the cutout alpha to detectRig with the item kind', async () => {
    const out = await detectItemRig(reader(), tee, 'blob:c');
    expect(out).toEqual(rig());
    const [mask, kind] = mockDetect.mock.calls[0] as [
      { width: number; height: number; alpha: Uint8Array },
      string,
    ];
    expect(kind).toBe('top');
    expect([mask.width, mask.height]).toEqual([2, 2]);
    expect([...mask.alpha]).toEqual([0, 255, 255, 0]);
  });

  it('skips unsupported kinds and platforms that cannot read pixels', async () => {
    expect(await detectItemRig(reader(), shoes, 'blob:c')).toBeUndefined();
    expect(await detectItemRig({ read: async () => undefined }, tee, 'blob:c')).toBeUndefined();
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('never rejects', async () => {
    const bad: PixelReader = { read: () => Promise.reject(new Error('decode')) };
    expect(await detectItemRig(bad, tee, 'blob:c')).toBeUndefined();
  });
});

describe('isFittable / rigIsCurrent', () => {
  it('needs a supported kind and a real cutout', () => {
    expect(isFittable(tee)).toBe(true);
    expect(isFittable(shoes)).toBe(false);
    expect(isFittable({ ...tee, cutout: { ...tee.cutout, hasAlpha: false } })).toBe(false);
  });

  it('accepts current and edited rigs, rejects other kinds and old unedited ones', () => {
    expect(rigIsCurrent(tee, rig())).toBe(true);
    expect(rigIsCurrent(tee, undefined)).toBe(false);
    expect(rigIsCurrent(tee, rig({ kind: 'trousers' }))).toBe(false);
    expect(rigIsCurrent(tee, rig({ version: 1 }))).toBe(false);
    expect(rigIsCurrent(tee, rig({ version: 1, edited: true }))).toBe(true);
  });
});

describe('createLazyRigDetector', () => {
  it('detects once per item and cutout, remembers it and saves after a pause', async () => {
    jest.useFakeTimers();
    try {
      const save = jest.fn();
      const pixels = reader();
      const d = createLazyRigDetector({ pixels, save, debounceMs: 300 });
      const item: Item = tee;
      expect(d.peek(item)).toBeUndefined();
      await d.ensure(item, 'blob:c');
      await d.ensure(item, 'blob:c');
      expect(pixels.read).toHaveBeenCalledTimes(1);
      expect(d.peek(item)).toEqual(rig());
      expect(save).not.toHaveBeenCalled();
      jest.advanceTimersByTime(299);
      expect(save).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2);
      expect(save).toHaveBeenCalledWith(item.id, rig());
    } finally {
      jest.useRealTimers();
    }
  });

  it('tries a new cutout of the same item again and does not retry failures', async () => {
    const save = jest.fn();
    const pixels = reader();
    const d = createLazyRigDetector({ pixels, save });
    mockDetect.mockReturnValue(undefined);
    await d.ensure(tee, 'blob:c');
    await d.ensure(tee, 'blob:c');
    expect(pixels.read).toHaveBeenCalledTimes(1);
    await d.ensure({ ...tee, images: { ...tee.images, cutoutId: 'new' } }, 'blob:n');
    expect(pixels.read).toHaveBeenCalledTimes(2);
    d.flush();
    expect(save).not.toHaveBeenCalled();
  });
});
