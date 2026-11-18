import type { Category, Item, Material } from '../model/types';
import { nameColor } from './classify';
import { colourHarmony } from './harmony';

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const BLACK = '#000000';
const WHITE = '#ffffff';
const NAVY = '#1f2a44';
const GREY = '#808080';

type Color = string | [string, number][];

function item(
  category: Category,
  color: Color,
  extra: { layer?: 'base' | 'mid'; material?: Material } = {},
): Item {
  const swatches = (typeof color === 'string' ? [[color, 1]] : color) as [string, number][];
  return {
    id: 'item-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category,
    subcategory: 'x',
    layer: extra.layer,
    colors: swatches.map(([hex, share]) => ({ hex, share, name: nameColor(hex) })),
    pattern: 'solid',
    patternBold: false,
    formality: 3,
    warmth: 3,
    material: extra.material,
    rainOk: false,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: 'a', cutoutId: 'b', thumbId: 'c' },
    cutout: { aspectRatio: 1, hasAlpha: true },
  };
}

const top = (c: Color) => item('top', c, { layer: 'base' });
const bottom = (c: Color) => item('bottom', c);

describe('colourHarmony table', () => {
  it('only neutrals -> 0.80', () => {
    const r = colourHarmony([top(GREY), bottom(NAVY)]);
    expect(r.value).toBeCloseTo(0.8);
    expect(r.reason.code).toBe('COLOR_NEUTRAL_BASE');
  });

  it('no items -> 0.80 neutral base', () => {
    expect(colourHarmony([]).value).toBeCloseTo(0.8);
  });

  it('neutrals + one accent family -> 0.92', () => {
    const r = colourHarmony([top(hslHex(0, 0.6, 0.5)), bottom(NAVY)]);
    expect(r.value).toBeCloseTo(0.92);
    expect(r.reason).toEqual({
      code: 'COLOR_ACCENT_POP',
      params: { accent: 'red', neutral: 'navy' },
    });
  });

  it('one accent family, no neutrals, lightness spread >= 0.15 -> 0.90', () => {
    const r = colourHarmony([top(hslHex(210, 0.6, 0.3)), bottom(hslHex(210, 0.6, 0.55))]);
    expect(r.value).toBeCloseTo(0.9);
    expect(r.reason.code).toBe('COLOR_MONOCHROME');
  });

  it('one accent family, flat lightness -> 0.70', () => {
    const r = colourHarmony([top(hslHex(210, 0.6, 0.5)), bottom(hslHex(215, 0.6, 0.5))]);
    expect(r.value).toBeCloseTo(0.7);
    expect(r.reason.code).toBe('COLOR_MONOCHROME');
  });

  it('two families 150-180 apart -> 0.82 complementary', () => {
    const r = colourHarmony([top(hslHex(0, 0.6, 0.5)), bottom(hslHex(180, 0.6, 0.5))]);
    expect(r.value).toBeCloseTo(0.82);
    expect(r.reason.code).toBe('COLOR_COMPLEMENTARY');
    expect(r.reason.params).toEqual({ a: 'red', b: 'teal' });
  });

  it('two families 105-135 apart -> 0.68 triadic', () => {
    const r = colourHarmony([top(hslHex(0, 0.6, 0.5)), bottom(hslHex(120, 0.6, 0.5))]);
    expect(r.value).toBeCloseTo(0.68);
    expect(r.reason.code).toBe('COLOR_TRIADIC');
  });

  it('two families 31-60 apart -> 0.75 analogous', () => {
    const r = colourHarmony([top(hslHex(0, 0.6, 0.5)), bottom(hslHex(45, 0.6, 0.5))]);
    expect(r.value).toBeCloseTo(0.75);
    expect(r.reason.code).toBe('COLOR_ANALOGOUS');
  });

  it('two families anything else -> 0.45 clash', () => {
    const r = colourHarmony([top(hslHex(0, 0.6, 0.5)), bottom(hslHex(90, 0.6, 0.5))]);
    expect(r.value).toBeCloseTo(0.45);
    expect(r.reason.code).toBe('COLOR_CLASH');
  });

  it('three or more families -> 0.20 clash', () => {
    const r = colourHarmony([
      top(hslHex(0, 0.6, 0.5)),
      bottom(hslHex(120, 0.6, 0.5)),
      item('outerwear', hslHex(240, 0.6, 0.5)),
    ]);
    expect(r.value).toBeCloseTo(0.2);
    expect(r.reason.code).toBe('COLOR_CLASH');
    expect(r.reason.params.count).toBe(3);
  });
});

describe('colourHarmony inputs', () => {
  it('ignores jewellery, watches and eyewear', () => {
    const r = colourHarmony([
      top(GREY),
      bottom(NAVY),
      item('jewelry', hslHex(0, 0.6, 0.5)),
      item('watch', hslHex(120, 0.6, 0.5)),
      item('eyewear', hslHex(240, 0.6, 0.5)),
    ]);
    expect(r.value).toBeCloseTo(0.8);
    expect(r.reason.code).toBe('COLOR_NEUTRAL_BASE');
  });

  it('counts a secondary colour only when its share >= 0.25', () => {
    const red = hslHex(0, 0.6, 0.5);
    const small = colourHarmony([
      top([
        [GREY, 0.8],
        [red, 0.2],
      ]),
      bottom(NAVY),
    ]);
    expect(small.reason.code).toBe('COLOR_NEUTRAL_BASE');
    const big = colourHarmony([
      top([
        [GREY, 0.7],
        [red, 0.3],
      ]),
      bottom(NAVY),
    ]);
    expect(big.reason.code).toBe('COLOR_ACCENT_POP');
  });

  it('uses the largest share as primary even if listed later', () => {
    const red = hslHex(0, 0.6, 0.5);
    const r = colourHarmony([
      top([
        [red, 0.1],
        [GREY, 0.9],
      ]),
      bottom(NAVY),
    ]);
    expect(r.reason.code).toBe('COLOR_NEUTRAL_BASE');
  });

  it('treats denim as neutral whatever its hue', () => {
    const r = colourHarmony(
      [top(GREY), bottom(hslHex(220, 0.6, 0.5))].map((i, n) =>
        n === 1 ? { ...i, material: 'denim' as const } : i,
      ),
    );
    expect(r.reason.code).toBe('COLOR_NEUTRAL_BASE');
    expect(r.value).toBeCloseTo(0.8);
  });
});

describe('colourHarmony adjustments', () => {
  it('+0.05 for large-piece lightness contrast >= 0.35', () => {
    expect(colourHarmony([top(WHITE), bottom(BLACK)]).value).toBeCloseTo(0.85);
    expect(colourHarmony([top(GREY), bottom(NAVY)]).value).toBeCloseTo(0.8);
  });

  it('-0.15 for neon next to pastel', () => {
    const r = colourHarmony([top(hslHex(0, 1, 0.5)), bottom(hslHex(180, 0.4, 0.7))]);
    expect(r.value).toBeCloseTo(0.82 - 0.15);
  });

  it('-0.10 for same neutral at nearly the same lightness', () => {
    expect(colourHarmony([top('#808080'), bottom('#8c8c8c')]).value).toBeCloseTo(0.7);
  });

  it('does not apply the near-miss penalty to black-on-black or a matching set', () => {
    expect(colourHarmony([top('#000000'), bottom('#050505')]).value).toBeCloseTo(0.8);
    expect(colourHarmony([top('#808080'), bottom('#808080')]).value).toBeCloseTo(0.8);
    expect(colourHarmony([top('#808080'), bottom('#b0b0b0')]).value).toBeCloseTo(0.8);
  });

  it('+0.05 when shoes echo an accent family of a main piece', () => {
    const red = hslHex(0, 0.6, 0.5);
    const without = colourHarmony([top(red), bottom(NAVY), item('shoes', WHITE)]);
    const echo = colourHarmony([top(red), bottom(NAVY), item('shoes', hslHex(10, 0.6, 0.4))]);
    expect(without.value).toBeCloseTo(0.92);
    expect(echo.value).toBeCloseTo(0.97);
    expect(colourHarmony([top(red), bottom(NAVY), item('bag', red)]).value).toBeCloseTo(0.97);
    expect(colourHarmony([top(red), bottom(NAVY), item('belt', red)]).value).toBeCloseTo(0.97);
  });

  it('clamps to [0, 1]', () => {
    const red = hslHex(0, 0.6, 0.5);
    const r = colourHarmony([top(red), bottom(NAVY), item('outerwear', WHITE), item('shoes', red)]);
    expect(r.value).toBe(1);
  });
});
