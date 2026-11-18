import { fitWithin, trimToAlpha } from './trim';

/** Transparent image with an opaque (alpha 255) rectangle. */
function image(w: number, h: number, box?: [number, number, number, number], alpha = 255) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  if (box) {
    const [x0, y0, x1, y1] = box;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rgba[(y * w + x) * 4 + 3] = alpha;
  }
  return rgba;
}

describe('trimToAlpha', () => {
  it('finds the bounding box with no padding', () => {
    expect(trimToAlpha(image(100, 100, [20, 30, 59, 79]), 100, 100, 16, 0)).toEqual({
      x: 20,
      y: 30,
      width: 40,
      height: 50,
    });
  });

  it('pads by 2% of the longer side by default', () => {
    // box 40 x 50 -> pad round(50 * 0.02) = 1
    expect(trimToAlpha(image(100, 100, [20, 30, 59, 79]), 100, 100)).toEqual({
      x: 19,
      y: 29,
      width: 42,
      height: 52,
    });
  });

  it('clamps padding to the image', () => {
    expect(trimToAlpha(image(50, 50, [0, 0, 49, 49]), 50, 50, 16, 0.2)).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it('ignores alpha at or below the threshold', () => {
    expect(trimToAlpha(image(10, 10, [2, 2, 5, 5], 16), 10, 10, 16, 0)).toBeUndefined();
    expect(trimToAlpha(image(10, 10, [2, 2, 5, 5], 17), 10, 10, 16, 0)).toEqual({
      x: 2,
      y: 2,
      width: 4,
      height: 4,
    });
  });

  it('returns undefined for a fully transparent image', () => {
    expect(trimToAlpha(image(8, 8), 8, 8)).toBeUndefined();
  });

  it('handles a single pixel', () => {
    expect(trimToAlpha(image(8, 8, [3, 4, 3, 4]), 8, 8, 16, 0)).toEqual({
      x: 3,
      y: 4,
      width: 1,
      height: 1,
    });
  });
});

describe('fitWithin', () => {
  it('scales the longest side down', () => {
    expect(fitWithin(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
    expect(fitWithin(600, 1200, 1000)).toEqual({ width: 500, height: 1000 });
  });

  it('never enlarges', () => {
    expect(fitWithin(300, 200, 1000)).toEqual({ width: 300, height: 200 });
  });

  it('keeps both sides at least 1', () => {
    expect(fitWithin(10000, 2, 100)).toEqual({ width: 100, height: 1 });
  });
});
