import { nameColor } from '@/core/color/classify';
import type { ColorSwatch } from '@/core/model/types';
import {
  COLOR_HEX,
  COLOR_NAMES,
  mergeSameNamed,
  summarizeColors,
  withPrimaryColor,
} from './colors';

function solid(r: number, g: number, b: number, n = 64): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) out.set([r, g, b, 255], i * 4);
  return out;
}

describe('colour palette options', () => {
  it('has 15 colours whose hex is named after itself', () => {
    expect(COLOR_NAMES).toHaveLength(15);
    for (const name of COLOR_NAMES) expect(nameColor(COLOR_HEX[name])).toBe(name);
  });
});

describe('summarizeColors', () => {
  it('returns [] without pixels', () => {
    expect(summarizeColors(undefined)).toEqual([]);
  });

  it('names a solid navy photo "navy" with the full share', () => {
    const result = summarizeColors({ width: 8, height: 8, rgba: solid(31, 42, 92) });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('navy');
    expect(result[0].share).toBeCloseTo(1);
  });

  it('is deterministic', () => {
    const px = { width: 8, height: 8, rgba: solid(200, 40, 40) };
    expect(summarizeColors(px)).toEqual(summarizeColors(px));
  });

  it('returns [] for a fully transparent image', () => {
    const rgba = new Uint8ClampedArray(64 * 4);
    expect(summarizeColors({ width: 8, height: 8, rgba })).toEqual([]);
  });
});

describe('mergeSameNamed', () => {
  it('sums shares of equally named swatches and sorts largest first', () => {
    const input: ColorSwatch[] = [
      { hex: '#111111', share: 0.2, name: 'black' },
      { hex: '#1f2a5c', share: 0.5, name: 'navy' },
      { hex: '#202a60', share: 0.3, name: 'navy' },
    ];
    const out = mergeSameNamed(input);
    expect(out.map((s) => s.name)).toEqual(['navy', 'black']);
    expect(out[0].share).toBeCloseTo(0.8);
    expect(out[0].hex).toBe('#1f2a5c');
  });
});

describe('withPrimaryColor', () => {
  it('replaces the first swatch and keeps its share', () => {
    const input: ColorSwatch[] = [
      { hex: '#1f2a5c', share: 0.7, name: 'navy' },
      { hex: '#fafafa', share: 0.3, name: 'white' },
    ];
    const out = withPrimaryColor(input, 'red');
    expect(out.map((s) => s.name)).toEqual(['red', 'white']);
    expect(out[0].share).toBeCloseTo(0.7);
  });

  it('creates the primary colour when nothing was detected', () => {
    expect(withPrimaryColor([], 'olive')).toEqual([
      { hex: COLOR_HEX.olive, name: 'olive', share: 1 },
    ]);
  });

  it('merges into an existing swatch of the same name', () => {
    const input: ColorSwatch[] = [
      { hex: '#1f2a5c', share: 0.6, name: 'navy' },
      { hex: '#fafafa', share: 0.4, name: 'white' },
    ];
    const out = withPrimaryColor(input, 'white');
    expect(out).toHaveLength(1);
    expect(out[0].share).toBeCloseTo(1);
  });
});
