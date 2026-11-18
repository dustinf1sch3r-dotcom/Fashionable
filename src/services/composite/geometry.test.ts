import { layerBox, outputSize } from './geometry';

describe('layerBox', () => {
  it('maps an unrotated layer to its pixel rectangle', () => {
    const box = layerBox({ x: 100, y: 200, width: 400, height: 600, rotation: 0 }, 0.5, 500, 1000);
    expect(box).toMatchObject({ x: 50, y: 100, width: 200, height: 300 });
    expect(box?.centerX).toBeCloseTo(100);
    expect(box?.centerY).toBeCloseTo(150);
  });

  it('grows the buffer for a rotated layer, keeping the centre', () => {
    const flat = layerBox({ x: 300, y: 300, width: 200, height: 100, rotation: 0 }, 1, 1000, 2000);
    const turned = layerBox(
      { x: 300, y: 300, width: 200, height: 100, rotation: 90 },
      1,
      1000,
      2000,
    );
    expect(flat).toMatchObject({ width: 200, height: 100 });
    expect(turned).toMatchObject({ width: 100, height: 200 });
    const tilted = layerBox(
      { x: 300, y: 300, width: 200, height: 100, rotation: 45 },
      1,
      1000,
      2000,
    );
    expect(tilted?.width).toBeGreaterThanOrEqual(212);
    expect(tilted?.angle).toBeCloseTo(Math.PI / 4);
  });

  it('clips to the canvas and drops layers that are outside it', () => {
    const clipped = layerBox(
      { x: -100, y: 1900, width: 300, height: 300, rotation: 0 },
      1,
      1000,
      2000,
    );
    expect(clipped).toMatchObject({ x: 0, y: 1900, width: 200, height: 100 });
    // The centre stays relative to the clipped buffer so the picture is not shifted.
    expect(clipped?.centerX).toBeCloseTo(50);
    expect(
      layerBox({ x: 2000, y: 0, width: 10, height: 10, rotation: 0 }, 1, 1000, 2000),
    ).toBeUndefined();
    expect(
      layerBox({ x: 0, y: 0, width: 0, height: 10, rotation: 0 }, 1, 1000, 2000),
    ).toBeUndefined();
  });
});

describe('outputSize', () => {
  it('is 1000 × 2000 units times the density, within sane limits', () => {
    expect(outputSize(0.5)).toEqual({ width: 500, height: 1000 });
    expect(outputSize(1)).toEqual({ width: 1000, height: 2000 });
    expect(outputSize(10)).toEqual({ width: 2000, height: 4000 });
  });
});
