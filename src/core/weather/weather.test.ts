import type { ForecastCacheEntry } from './cache';
import {
  TODAY_STALE_MS,
  forecastCacheKey,
  isCacheFresh,
  localISODate,
  parseCacheEntry,
} from './cache';
import { parseForecast, parseGeocode } from './forecast';
import { cToF, displayTemp, fToC, formatTemp, percent, weatherGlyph } from './units';
import { isSunnyCode } from './wmo';

const base = {
  tempMinC: 5,
  tempMaxC: 15,
  feelsLikeC: 10,
  precipProbability: 0,
  windKph: 10,
  isSunny: true,
};

describe('isSunnyCode', () => {
  it.each([0, 1, 2])('code %i is sunny', (c) => expect(isSunnyCode(c)).toBe(true));
  it.each([3, 45, 51, 61, 71, 80, 95, 99])('code %i is not sunny', (c) =>
    expect(isSunnyCode(c)).toBe(false),
  );
  it('treats missing codes as not sunny', () => {
    expect(isSunnyCode(null)).toBe(false);
    expect(isSunnyCode(undefined)).toBe(false);
    expect(isSunnyCode(Number.NaN)).toBe(false);
  });
});

describe('parseForecast', () => {
  const response = {
    daily: {
      time: ['2026-11-18', '2026-11-19'],
      temperature_2m_max: [18, 12],
      temperature_2m_min: [8, 4],
      apparent_temperature_max: [16, 9],
      apparent_temperature_min: [6, 1],
      precipitation_probability_max: [35, null],
      wind_speed_10m_max: [22.5, null],
      weather_code: [1, 63],
    },
  };

  it('maps each day to a Weather', () => {
    const days = parseForecast(response);
    expect(days['2026-11-18']).toEqual({
      tempMinC: 8,
      tempMaxC: 18,
      feelsLikeC: 0.7 * 16 + 0.3 * 6,
      precipProbability: 0.35,
      windKph: 22.5,
      isSunny: true,
    });
    expect(days['2026-11-19']).toMatchObject({
      precipProbability: 0,
      windKph: 0,
      isSunny: false,
      feelsLikeC: 0.7 * 9 + 0.3 * 1,
    });
  });

  it('falls back to the real temperature when apparent values are missing', () => {
    const days = parseForecast({
      daily: { time: ['d'], temperature_2m_max: [20], temperature_2m_min: [10] },
    });
    expect(days.d?.feelsLikeC).toBeCloseTo(17);
    expect(days.d?.isSunny).toBe(false);
  });

  it('skips days without temperatures and tolerates junk', () => {
    expect(
      parseForecast({
        daily: { time: ['a'], temperature_2m_max: [null], temperature_2m_min: [1] },
      }),
    ).toEqual({});
    expect(parseForecast(null)).toEqual({});
    expect(parseForecast({ daily: 5 })).toEqual({});
    expect(parseForecast({ error: true, reason: 'x' })).toEqual({});
  });

  it('clamps rain chance to 0-1', () => {
    const days = parseForecast({
      daily: {
        time: ['d'],
        temperature_2m_max: [1],
        temperature_2m_min: [0],
        precipitation_probability_max: [140],
      },
    });
    expect(days.d?.precipProbability).toBe(1);
  });
});

describe('parseGeocode', () => {
  it('builds labels without duplicates and skips malformed rows', () => {
    const out = parseGeocode({
      results: [
        { name: 'Berlin', admin1: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.4 },
        {
          name: 'Paris',
          admin1: 'Texas',
          country: 'United States',
          latitude: 33.6,
          longitude: -95.5,
        },
        { name: 'Broken', latitude: 'x', longitude: 1 },
        'junk',
      ],
    });
    expect(out).toEqual([
      { label: 'Berlin, Germany', lat: 52.52, lon: 13.4 },
      { label: 'Paris, Texas, United States', lat: 33.6, lon: -95.5 },
    ]);
  });

  it('returns [] when there are no results', () => {
    expect(parseGeocode({ generationtime_ms: 0.3 })).toEqual([]);
    expect(parseGeocode(undefined)).toEqual([]);
  });
});

describe('units', () => {
  it('converts both ways', () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
    expect(fToC(212)).toBeCloseTo(100);
    expect(fToC(cToF(21.5))).toBeCloseTo(21.5);
  });
  it('formats in the chosen unit and never shows -0', () => {
    expect(formatTemp(18, 'metric')).toBe('18°');
    expect(formatTemp(18, 'imperial')).toBe('64°');
    expect(displayTemp(-0.2, 'metric')).toBe(0);
    expect(Object.is(displayTemp(-0.2, 'metric'), 0)).toBe(true);
    expect(formatTemp(-3.6, 'metric')).toBe('-4°');
  });
  it('rounds percent', () => {
    expect(percent(0.346)).toBe(35);
    expect(percent(2)).toBe(100);
  });
  it('picks a glyph', () => {
    expect(weatherGlyph({ ...base, precipProbability: 0.5 })).toBe('rain');
    expect(weatherGlyph({ ...base, precipProbability: 0.49 })).toBe('sunny');
    expect(weatherGlyph({ ...base, isSunny: false })).toBe('cloudy');
  });
});

describe('cache', () => {
  const noon = new Date(2026, 10, 18, 12, 0, 0);
  const entry = (fetchedAt: Date): ForecastCacheEntry => ({
    fetchedAt: fetchedAt.toISOString(),
    days: { '2026-11-18': base, '2026-11-20': base },
  });

  it('formats local dates', () => {
    expect(localISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('keys by location rounded to 2 decimals', () => {
    expect(forecastCacheKey(52.5201, 13.4049)).toBe(forecastCacheKey(52.5249, 13.4001));
    expect(forecastCacheKey(52.52, 13.4)).not.toBe(forecastCacheKey(52.55, 13.4));
  });
  it('today is fresh for under 3 hours', () => {
    const justUnder = new Date(noon.getTime() - TODAY_STALE_MS + 1000);
    expect(isCacheFresh(entry(justUnder), '2026-11-18', noon)).toBe(true);
    const exactly = new Date(noon.getTime() - TODAY_STALE_MS);
    expect(isCacheFresh(entry(exactly), '2026-11-18', noon)).toBe(false);
  });
  it('other days are fresh until the local day changes', () => {
    const morning = new Date(2026, 10, 18, 0, 5);
    expect(isCacheFresh(entry(morning), '2026-11-20', noon)).toBe(true);
    const yesterday = new Date(2026, 10, 17, 23, 55);
    expect(isCacheFresh(entry(yesterday), '2026-11-20', noon)).toBe(false);
  });
  it('is stale for missing dates and future fetch times', () => {
    expect(isCacheFresh(entry(noon), '2026-11-19', noon)).toBe(false);
    expect(isCacheFresh(entry(new Date(noon.getTime() + 60_000)), '2026-11-18', noon)).toBe(false);
  });
  it('parses stored entries defensively', () => {
    expect(parseCacheEntry(null)).toBeUndefined();
    expect(parseCacheEntry('not json')).toBeUndefined();
    expect(parseCacheEntry('{"fetchedAt":1}')).toBeUndefined();
    const e = entry(noon);
    expect(parseCacheEntry(JSON.stringify(e))).toEqual(e);
  });
});
