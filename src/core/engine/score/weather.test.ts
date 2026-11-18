import {
  WEATHER_COLD,
  WEATHER_COOL_RAIN,
  WEATHER_FREEZING,
  WEATHER_HOT,
  WEATHER_MILD,
} from '../../testing/fixtures';
import type { Weather } from '../../model/types';
import { outfit, tweak } from '../testUtils';
import {
  isItemAllowedInWeather,
  missingLayers,
  requiredSlots,
  scoreWeather,
  sunBonusPoints,
  weatherBand,
} from './weather';

const wx = (feelsLikeC: number, extra: Partial<Weather> = {}): Weather => ({
  ...WEATHER_MILD,
  feelsLikeC,
  precipProbability: 0,
  isSunny: false,
  ...extra,
});

describe('weatherBand (§6 table)', () => {
  const cases: [number, string, number][] = [
    [40, 'hot', 1.5],
    [27, 'hot', 1.5],
    [26.9, 'warm', 2],
    [20, 'warm', 2],
    [19.9, 'mild', 3],
    [13, 'mild', 3],
    [12.9, 'cool', 3.5],
    [5, 'cool', 3.5],
    [4.9, 'cold', 4.5],
    [-30, 'cold', 4.5],
  ];
  for (const [t, id, target] of cases) {
    it(`${t}°C → ${id}, target ${target}`, () => {
      const b = weatherBand(wx(t));
      expect(b.id).toBe(id);
      expect(b.targetWarmth).toBe(target);
    });
  }
  it('fixture presets land in their bands', () => {
    expect(weatherBand(WEATHER_HOT).id).toBe('hot');
    expect(weatherBand(WEATHER_MILD).id).toBe('warm');
    expect(weatherBand(WEATHER_COOL_RAIN).id).toBe('mild');
    expect(weatherBand(WEATHER_COLD).id).toBe('cool');
    expect(weatherBand(WEATHER_FREEZING).id).toBe('cold');
  });
});

describe('requiredSlots', () => {
  it('per band', () => {
    expect(requiredSlots(wx(30))).toEqual([]);
    expect(requiredSlots(wx(22))).toEqual([]);
    expect(requiredSlots(wx(15))).toEqual([['mid', 'outer']]);
    expect(requiredSlots(wx(8))).toEqual([['outer']]);
    expect(requiredSlots(wx(0))).toEqual([['outer'], ['mid']]);
  });
});

describe('isItemAllowedInWeather hard rules', () => {
  it('no weather → everything allowed', () => {
    expect(isItemAllowedInWeather(tweak('puffer-black', {}), undefined)).toBe(true);
  });
  describe('>= 27°C', () => {
    const w = wx(30);
    it('no mid, no outer', () => {
      expect(isItemAllowedInWeather(tweak('sweater-red', { warmth: 1 }), w)).toBe(false);
      expect(isItemAllowedInWeather(tweak('jacket-denim', { warmth: 1 }), w)).toBe(false);
    });
    it('excludes warmth >= 4 but allows 3', () => {
      expect(isItemAllowedInWeather(tweak('tee-white', { warmth: 4 }), w)).toBe(false);
      expect(isItemAllowedInWeather(tweak('tee-white', { warmth: 3 }), w)).toBe(true);
      expect(isItemAllowedInWeather(tweak('beanie-grey', { warmth: 4 }), w)).toBe(false);
    });
  });
  describe('20–26°C', () => {
    const w = wx(22);
    it('outer allowed only with warmth <= 2', () => {
      expect(isItemAllowedInWeather(tweak('jacket-denim', { warmth: 2 }), w)).toBe(true);
      expect(isItemAllowedInWeather(tweak('jacket-denim', { warmth: 3 }), w)).toBe(false);
    });
    it('excludes warmth 5, allows 4 for non-outer', () => {
      expect(isItemAllowedInWeather(tweak('sweater-red', { warmth: 5 }), w)).toBe(false);
      expect(isItemAllowedInWeather(tweak('sweater-red', { warmth: 4 }), w)).toBe(true);
    });
  });
  describe('13–19°C', () => {
    const w = wx(15);
    it('excludes warmth-1 bottoms only', () => {
      expect(isItemAllowedInWeather(tweak('shorts-denim', {}), w)).toBe(false);
      expect(isItemAllowedInWeather(tweak('jeans-dark', { warmth: 2 }), w)).toBe(true);
      expect(isItemAllowedInWeather(tweak('tee-white', { warmth: 1 }), w)).toBe(true);
      expect(isItemAllowedInWeather(tweak('sandals-tan', {}), w)).toBe(true);
    });
  });
  describe('5–12°C and < 5°C', () => {
    for (const t of [8, -3]) {
      it(`${t}°C: no open shoes, no shorts (warmth irrelevant)`, () => {
        const w = wx(t);
        expect(isItemAllowedInWeather(tweak('sandals-tan', { warmth: 4 }), w)).toBe(false);
        expect(isItemAllowedInWeather(tweak('shorts-denim', { warmth: 4 }), w)).toBe(false);
        expect(isItemAllowedInWeather(tweak('boots-black-chelsea', {}), w)).toBe(true);
        expect(isItemAllowedInWeather(tweak('jeans-dark', {}), w)).toBe(true);
      });
    }
  });
  describe('rain', () => {
    it('excludes rainOk:false shoes, outer, bag at >= 0.5', () => {
      const w = wx(22, { precipProbability: 0.5 });
      expect(isItemAllowedInWeather(tweak('loafers-brown', { rainOk: false }), w)).toBe(false);
      expect(isItemAllowedInWeather(tweak('jacket-denim', { warmth: 2, rainOk: false }), w)).toBe(
        false,
      );
      expect(isItemAllowedInWeather(tweak('bag-shoulder-brown', { rainOk: false }), w)).toBe(false);
      expect(isItemAllowedInWeather(tweak('tee-white', { rainOk: false }), w)).toBe(true);
      expect(isItemAllowedInWeather(tweak('loafers-brown', { rainOk: true }), w)).toBe(true);
    });
    it('does not apply below 0.5', () => {
      const w = wx(22, { precipProbability: 0.49 });
      expect(isItemAllowedInWeather(tweak('loafers-brown', { rainOk: false }), w)).toBe(true);
    });
  });
});

describe('sunBonusPoints', () => {
  const sun = wx(22, { isSunny: true });
  it('+1 each for eyes and head when sunny and >= 20°C', () => {
    expect(sunBonusPoints(outfit('sunglasses-black'), sun)).toBe(1);
    expect(sunBonusPoints(outfit('sunglasses-black', 'beanie-grey'), sun)).toBe(2);
    expect(sunBonusPoints(outfit('tee-white'), sun)).toBe(0);
  });
  it('none when cloudy, cool or no weather', () => {
    expect(sunBonusPoints(outfit('sunglasses-black'), wx(22))).toBe(0);
    expect(sunBonusPoints(outfit('sunglasses-black'), wx(19, { isSunny: true }))).toBe(0);
    expect(sunBonusPoints(outfit('sunglasses-black'), undefined)).toBe(0);
  });
});

describe('scoreWeather', () => {
  it('is null without weather or garments', () => {
    expect(scoreWeather(outfit('tee-white'), undefined)).toBeNull();
    expect(scoreWeather(outfit('watch-silver'), WEATHER_MILD)).toBeNull();
  });
  it('1 − |mean − target| / 2', () => {
    // tee 1, jeans 3, sneakers 2 → mean 2; target 2 (22°C) → 1
    const items = outfit('tee-white', 'jeans-dark', 'sneakers-white');
    expect(scoreWeather(items, WEATHER_MILD)?.value).toBe(1);
    expect(scoreWeather(items, WEATHER_MILD)?.reasons[0].code).toBe('WEATHER_SUITED');
    // hot target 1.5 → 1 − 0.5/2
    expect(scoreWeather(items, WEATHER_HOT)?.value).toBe(0.75);
  });
  it('clamps at 0', () => {
    const items = [tweak('tee-white', { warmth: 1 }), tweak('jeans-dark', { warmth: 1 })];
    expect(scoreWeather(items, wx(-10, { precipProbability: 0 }))?.value).toBe(0);
  });
  it('halves the score when a required layer is missing, with MISSING_LAYER', () => {
    // 15°C: target 3. tee 1, jeans 3, sneakers 2... use warmth 3 pieces to hit mean 3.
    const items = [
      tweak('tee-white', { warmth: 3 }),
      tweak('jeans-dark', { warmth: 3 }),
      tweak('sneakers-white', { warmth: 3 }),
    ];
    const r = scoreWeather(items, wx(15));
    expect(r?.value).toBe(0.5);
    expect(r?.reasons).toContainEqual({ code: 'MISSING_LAYER', params: { slot: 'mid/outer' } });
    // adding a mid satisfies it
    const ok = scoreWeather([...items, tweak('hoodie-grey', { warmth: 3 })], wx(15));
    expect(ok?.value).toBe(1);
  });
  it('< 5°C needs an outer with warmth >= 4 and a mid', () => {
    const base = outfit('tee-white', 'jeans-dark', 'boots-black-chelsea');
    expect(missingLayers(base, WEATHER_FREEZING)).toEqual([['outer'], ['mid']]);
    const weak = [...base, tweak('trench-beige', { warmth: 3 }), ...outfit('sweater-red')];
    expect(missingLayers(weak, WEATHER_FREEZING)).toEqual([['outer']]);
    const full = [...base, ...outfit('puffer-black', 'sweater-red')];
    expect(missingLayers(full, WEATHER_FREEZING)).toEqual([]);
  });
  it('5–12°C requires an outer; mid alone is not enough', () => {
    const base = outfit('tee-white', 'jeans-dark', 'boots-black-chelsea', 'sweater-red');
    expect(missingLayers(base, WEATHER_COLD)).toEqual([['outer']]);
  });
  it('WEATHER_RAIN_READY when raining and exposed slots are rainOk', () => {
    const items = outfit('tee-white', 'jeans-dark', 'boots-black-chelsea', 'trench-beige');
    const r = scoreWeather(items, WEATHER_COOL_RAIN);
    expect(r?.reasons.map((x) => x.code)).toContain('WEATHER_RAIN_READY');
    const bad = scoreWeather(
      [
        ...outfit('tee-white', 'jeans-dark', 'trench-beige'),
        tweak('loafers-brown', { rainOk: false }),
      ],
      WEATHER_COOL_RAIN,
    );
    expect(bad?.reasons.map((x) => x.code)).not.toContain('WEATHER_RAIN_READY');
  });
});

describe('items that break a hard rule (manual outfits)', () => {
  it('cuts the weather score and names each unsuited item', () => {
    const suited = scoreWeather(outfit('tee-white', 'jeans-dark', 'sneakers-white'), WEATHER_MILD);
    const puffer = scoreWeather(
      outfit('blouse-floral', 'puffer-black', 'sandals-tan'),
      WEATHER_MILD,
    );
    expect(suited?.reasons.some((r) => r.code === 'WEATHER_UNSUITED')).toBe(false);
    expect(puffer?.reasons).toContainEqual({
      code: 'WEATHER_UNSUITED',
      params: { itemId: 'puffer-black', band: expect.any(String) },
    });
    expect(puffer?.reasons.some((r) => r.code === 'WEATHER_SUITED')).toBe(false);
    expect(puffer!.value).toBeLessThan(0.3); // safe: scoreWeather returns a result for garments
  });
});
