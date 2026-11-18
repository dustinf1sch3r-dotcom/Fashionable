import type { Reason, ReasonCode } from '@/core/model/types';
import { reasonText, topReasons } from './reasonText';

/** Compile-time exhaustive: adding a ReasonCode to core breaks this until it is listed. */
const ALL: Record<ReasonCode, true> = {
  COLOR_NEUTRAL_BASE: true,
  COLOR_ACCENT_POP: true,
  COLOR_MONOCHROME: true,
  COLOR_COMPLEMENTARY: true,
  COLOR_ANALOGOUS: true,
  COLOR_TRIADIC: true,
  COLOR_CLASH: true,
  FORMALITY_COHESIVE: true,
  FORMALITY_HIGH_LOW: true,
  FORMALITY_MISMATCH: true,
  PATTERN_STATEMENT: true,
  PATTERN_BUSY: true,
  WEATHER_SUITED: true,
  WEATHER_RAIN_READY: true,
  WEATHER_UNSUITED: true,
  MISSING_LAYER: true,
  LEATHERS_MATCH: true,
  METALS_MATCH: true,
  FRESH_COMBINATION: true,
  TASTE_MATCH: true,
  PINNED_OVERRIDE: true,
};
const CODES = Object.keys(ALL) as ReasonCode[];

const ctx = { itemName: (id: string) => (id === 'x' ? 'Linen shirt' : undefined) };

describe('reasonText', () => {
  it.each(CODES)('%s has text with realistic params', (code) => {
    const full: Reason = {
      code,
      params: {
        a: 'navy',
        b: 'orange',
        c: 'red',
        accent: 'olive',
        neutral: 'white',
        colour: 'brown',
        metal: 'gold',
        pattern: 'stripe',
        count: 2,
        band: 'cold',
        itemId: 'x',
        slot: 'mid/outer',
        spread: 2,
      },
    };
    const text = reasonText(full, ctx);
    expect(text.length).toBeGreaterThan(5);
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });

  it.each(CODES)('%s still reads well with no params at all', (code) => {
    const text = reasonText({ code, params: {} }, {});
    expect(text.length).toBeGreaterThan(5);
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });

  it('uses colour labels and the spec wording', () => {
    expect(reasonText({ code: 'COLOR_COMPLEMENTARY', params: { a: 'navy', b: 'orange' } })).toBe(
      'Navy and orange are a classic opposite pair',
    );
    expect(reasonText({ code: 'MISSING_LAYER', params: { slot: 'mid/outer' } })).toBe(
      'Bring a layer — it’s cold out',
    );
    expect(reasonText({ code: 'FORMALITY_HIGH_LOW', params: {} })).toBe(
      'A smart piece dressed down — on purpose',
    );
  });

  it('names the item for weather and pin reasons, with the right direction', () => {
    expect(
      reasonText({ code: 'WEATHER_UNSUITED', params: { itemId: 'x', band: 'hot' } }, ctx),
    ).toBe('Linen shirt is too warm for today');
    expect(
      reasonText({ code: 'WEATHER_UNSUITED', params: { itemId: 'x', band: 'cold' } }, ctx),
    ).toBe('Linen shirt is too light for today');
    expect(reasonText({ code: 'PINNED_OVERRIDE', params: { itemId: 'x' } }, ctx)).toContain(
      'Linen shirt',
    );
  });
});

describe('topReasons', () => {
  const r = (code: ReasonCode, params: Reason['params'] = {}): Reason => ({ code, params });

  it('puts cautions first, then good news, and caps at three', () => {
    const lines = topReasons(
      [
        r('FRESH_COMBINATION'),
        r('COLOR_CLASH', { a: 'red', b: 'green' }),
        r('MISSING_LAYER'),
        r('WEATHER_SUITED', { band: 'mild' }),
        r('COLOR_NEUTRAL_BASE'),
      ],
      {},
    );
    expect(lines.map((l) => l.code)).toEqual([
      'MISSING_LAYER',
      'WEATHER_SUITED',
      'COLOR_NEUTRAL_BASE',
    ]);
    expect(lines[0]?.tone).toBe('note');
    expect(lines[1]?.tone).toBe('good');
  });

  it('keeps a soft negative when that is all there is, and de-duplicates', () => {
    const lines = topReasons([
      r('COLOR_CLASH', { a: 'red', b: 'green' }),
      r('COLOR_CLASH', { a: 'red', b: 'green' }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.tone).toBe('note');
  });

  it('returns nothing for no reasons', () => {
    expect(topReasons([])).toEqual([]);
  });
});
