import { hexToRgb } from './hsl';
import { extractPalette } from './palette';

function fill(
  width: number,
  height: number,
  pick: (i: number) => string | null,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const hex = pick(i);
    const { r, g, b } = hexToRgb(hex ?? '#000000');
    data.set([r, g, b, hex === null ? 0 : 255], i * 4);
  }
  return data;
}

describe('extractPalette', () => {
  it('returns one swatch with share 1 for a solid colour', () => {
    const p = extractPalette(
      fill(8, 8, () => '#c83232'),
      8,
      8,
      1,
    );
    expect(p).toEqual([{ hex: '#c83232', share: 1, name: 'red' }]);
  });

  it('returns two swatches ~70/30 for two-colour stripes', () => {
    // 10 columns: 7 navy, 3 white
    const p = extractPalette(
      fill(10, 10, (i) => (i % 10 < 7 ? '#1f2a44' : '#ffffff')),
      10,
      10,
      7,
    );
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ hex: '#1f2a44', name: 'navy' });
    expect(p[0].share).toBeCloseTo(0.7, 5);
    expect(p[1]).toMatchObject({ hex: '#ffffff', name: 'white' });
    expect(p[1].share).toBeCloseTo(0.3, 5);
  });

  it('ignores pixels with alpha <= 128', () => {
    const p = extractPalette(
      fill(10, 10, (i) => (i % 2 === 0 ? '#2255cc' : null)),
      10,
      10,
      3,
    );
    expect(p).toHaveLength(1);
    expect(p[0].hex).toBe('#2255cc');
    expect(p[0].share).toBe(1);
  });

  it('returns nothing for a fully transparent image', () => {
    expect(
      extractPalette(
        fill(4, 4, () => null),
        4,
        4,
        1,
      ),
    ).toEqual([]);
  });

  it('is deterministic for a given seed', () => {
    const data = fill(
      12,
      12,
      (i) => ['#aa2222', '#22aa22', '#2222aa', '#dddd22', '#444444'][i % 5],
    );
    expect(extractPalette(data, 12, 12, 42)).toEqual(extractPalette(data, 12, 12, 42));
  });

  it('returns at most 3 swatches summing to share 1', () => {
    const data = fill(12, 12, (i) => ['#aa2222', '#22aa22', '#2222aa', '#dddd22'][i % 4]);
    const p = extractPalette(data, 12, 12, 5);
    expect(p.length).toBeLessThanOrEqual(3);
    expect(p.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 9);
  });

  it('drops clusters with share below 0.08', () => {
    // 95 navy, 5 red -> red is 5%.
    const p = extractPalette(
      fill(10, 10, (i) => (i < 5 ? '#cc2222' : '#1f2a44')),
      10,
      10,
      2,
    );
    expect(p).toHaveLength(1);
    expect(p[0].name).toBe('navy');
  });

  it('collapses a noisy single colour into one swatch', () => {
    let s = 12345;
    const noise = (): number => {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return (s >>> 16) % 17;
    };
    const data = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < 256; i++) data.set([100 + noise(), 60 + noise(), 40 + noise(), 255], i * 4);
    const p = extractPalette(data, 16, 16, 9);
    expect(p).toHaveLength(1);
    expect(p[0].share).toBe(1);
    expect(p[0].name).toBe('brown');
  });
});
