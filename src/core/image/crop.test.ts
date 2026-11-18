import {
  cropFromTrim,
  cropToWork,
  cutoutToOriginal,
  originalToCutout,
  wholePhotoCrop,
} from './crop';

describe('cutout crop maths', () => {
  it('maps a trim of the working copy back to original pixels', () => {
    // Original 1600 x 1200, worked on at 800 x 600 (half size); trim 100,50 of 200 x 300.
    const crop = cropFromTrim(
      { x: 100, y: 50, width: 200, height: 300 },
      { width: 800, height: 600 },
      { width: 1600, height: 1200 },
      100,
    );
    expect(crop).toEqual({ x: 200, y: 100, width: 400, height: 600, scale: 0.25 });
  });

  it('is the identity trim when the working copy is the original', () => {
    const crop = cropFromTrim(
      { x: 10, y: 20, width: 30, height: 40 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      30,
    );
    expect(crop).toEqual({ x: 10, y: 20, width: 30, height: 40, scale: 1 });
  });

  it('describes the whole photo for "use original"', () => {
    expect(wholePhotoCrop({ width: 1200, height: 1600 })).toEqual({
      x: 0,
      y: 0,
      width: 1200,
      height: 1600,
      scale: 1,
    });
    expect(wholePhotoCrop({ width: 1200, height: 1600 }, 600).scale).toBe(0.5);
  });

  it('places the crop on a differently sized copy of the photo', () => {
    const crop = { x: 200, y: 100, width: 400, height: 600, scale: 0.25 };
    expect(cropToWork(crop, { width: 1600, height: 1200 }, { width: 800, height: 600 })).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 300,
    });
  });

  it('round-trips points between original and cutout space', () => {
    const crop = { x: 200.5, y: 100.25, width: 400, height: 600, scale: 0.25 };
    const p = { x: 333, y: 444 };
    const back = cutoutToOriginal(crop, originalToCutout(crop, p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    expect(originalToCutout(crop, { x: 200.5, y: 100.25 })).toEqual({ x: 0, y: 0 });
    expect(originalToCutout(crop, { x: 600.5, y: 700.25 })).toEqual({ x: 100, y: 150 });
  });
});
