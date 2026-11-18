import { planCrop } from './cropPlan';

const out = { width: 1000, height: 2000 };

describe('planCrop', () => {
  it('maps a window inside the image to the whole output', () => {
    expect(
      planCrop({ x: 100, y: 50, width: 400, height: 800 }, { width: 1000, height: 1000 }, out),
    ).toEqual({ sx: 100, sy: 50, sw: 400, sh: 800, dx: 0, dy: 0, dw: 1000, dh: 2000 });
  });

  it('leaves a fill margin where the window extends past the edges', () => {
    const plan = planCrop(
      { x: -100, y: -200, width: 500, height: 1000 },
      { width: 400, height: 600 },
      out,
    );
    expect(plan).toEqual({ sx: 0, sy: 0, sw: 400, sh: 600, dx: 200, dy: 400, dw: 800, dh: 1200 });
  });

  it('clips the far edges too', () => {
    const plan = planCrop(
      { x: 300, y: 500, width: 200, height: 400 },
      { width: 400, height: 600 },
      out,
    );
    expect(plan).toEqual({ sx: 300, sy: 500, sw: 100, sh: 100, dx: 0, dy: 0, dw: 500, dh: 500 });
  });

  it('is undefined for a window outside the image or an empty window', () => {
    expect(
      planCrop({ x: 500, y: 0, width: 100, height: 200 }, { width: 400, height: 600 }, out),
    ).toBeUndefined();
    expect(
      planCrop({ x: 0, y: 0, width: 0, height: 0 }, { width: 400, height: 600 }, out),
    ).toBeUndefined();
  });
});
