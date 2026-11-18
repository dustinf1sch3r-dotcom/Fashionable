import { hexToRgb, hueDistance, rgbToHsl } from './hsl';

describe('hexToRgb', () => {
  it('parses 6-digit hex with or without #, any case', () => {
    expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb('ff8000')).toEqual({ r: 255, g: 128, b: 0 });
  });

  it('expands 3-digit hex', () => {
    expect(hexToRgb('#f0a')).toEqual({ r: 255, g: 0, b: 170 });
    expect(hexToRgb('ABC')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('throws on invalid input', () => {
    expect(() => hexToRgb('')).toThrow(Error);
    expect(() => hexToRgb('#12')).toThrow(Error);
    expect(() => hexToRgb('#12345')).toThrow(Error);
    expect(() => hexToRgb('#gggggg')).toThrow(Error);
  });
});

describe('rgbToHsl', () => {
  it('black', () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
  });

  it('white', () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 1 });
  });

  it('pure red, green, blue', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, l: 0.5 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, l: 0.5 });
  });

  it('grey has zero saturation', () => {
    const grey = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(grey.s).toBe(0);
    expect(grey.l).toBeCloseTo(128 / 255, 10);
  });

  it('keeps hue in [0,360) for colors past magenta', () => {
    const { h } = rgbToHsl({ r: 255, g: 0, b: 128 });
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(h).toBeCloseTo(330.1, 0);
  });
});

describe('hueDistance', () => {
  it('wraps around 360', () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
  });

  it('is 0 for equal hues and 180 for opposites', () => {
    expect(hueDistance(90, 90)).toBe(0);
    expect(hueDistance(0, 180)).toBe(180);
  });

  it('handles non-wrapping cases', () => {
    expect(hueDistance(30, 100)).toBe(70);
  });
});
