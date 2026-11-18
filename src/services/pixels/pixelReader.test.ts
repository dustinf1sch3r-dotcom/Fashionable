import { createFakePixelReader } from '../testing';
import { createPixelReader } from './pixelReader';

describe('PixelReader', () => {
  it('the fallback reader reports no pixels', async () => {
    expect(await createPixelReader().read('file:///x.png', 64)).toBeUndefined();
  });

  it('the fake returns the data it was given', async () => {
    const data = { width: 1, height: 1, rgba: new Uint8ClampedArray([1, 2, 3, 255]) };
    expect(await createFakePixelReader(data).read('x', 64)).toBe(data);
  });
});
