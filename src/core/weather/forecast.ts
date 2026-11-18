import type { ISODate, Weather } from '../model/types';
import { isSunnyCode } from './wmo';

/**
 * Weight of the day's maximum apparent temperature in `feelsLikeC`. The daytime "feels like" is
 * `0.7 * apparentMax + 0.3 * apparentMin`: outfits are worn mostly during the warm part of the
 * day, but the cold morning and evening still pull the value down.
 */
export const FEELS_LIKE_MAX_WEIGHT = 0.7;

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function series(daily: Rec, key: string): unknown[] {
  const v = daily[key];
  return Array.isArray(v) ? v : [];
}

/**
 * Maps an Open-Meteo `daily` forecast response (metric units, `timezone=auto`) to one `Weather` per
 * date. Days without a usable max and min temperature are skipped. Missing apparent temperature
 * falls back to the real one, missing rain chance or wind to 0 (Open-Meteo returns `null` there for
 * far-off days).
 */
export function parseForecast(json: unknown): Record<ISODate, Weather> {
  const out: Record<ISODate, Weather> = {};
  if (!isRec(json) || !isRec(json.daily)) return out;
  const d = json.daily;
  const time = series(d, 'time');
  const tMax = series(d, 'temperature_2m_max');
  const tMin = series(d, 'temperature_2m_min');
  const aMax = series(d, 'apparent_temperature_max');
  const aMin = series(d, 'apparent_temperature_min');
  const prob = series(d, 'precipitation_probability_max');
  const wind = series(d, 'wind_speed_10m_max');
  const code = series(d, 'weather_code');
  time.forEach((date, i) => {
    if (typeof date !== 'string') return;
    const max = tMax[i];
    const min = tMin[i];
    if (!isNum(max) || !isNum(min)) return;
    const am = aMax[i];
    const an = aMin[i];
    const p = prob[i];
    const w = wind[i];
    const c = code[i];
    out[date] = {
      tempMinC: min,
      tempMaxC: max,
      feelsLikeC:
        FEELS_LIKE_MAX_WEIGHT * (isNum(am) ? am : max) +
        (1 - FEELS_LIKE_MAX_WEIGHT) * (isNum(an) ? an : min),
      precipProbability: isNum(p) ? Math.min(1, Math.max(0, p / 100)) : 0,
      windKph: isNum(w) ? Math.max(0, w) : 0,
      isSunny: isSunnyCode(isNum(c) ? c : null),
    };
  });
  return out;
}

/** Maps an Open-Meteo geocoding `search` response to labelled coordinates. */
export function parseGeocode(json: unknown): GeocodeResult[] {
  if (!isRec(json) || !Array.isArray(json.results)) return [];
  const out: GeocodeResult[] = [];
  for (const r of json.results) {
    if (!isRec(r) || typeof r.name !== 'string' || !isNum(r.latitude) || !isNum(r.longitude)) {
      continue;
    }
    const parts = [r.name, r.admin1, r.country].filter(
      (p, i, all): p is string => typeof p === 'string' && p !== '' && all.indexOf(p) === i,
    );
    out.push({ label: parts.join(', '), lat: r.latitude, lon: r.longitude });
  }
  return out;
}
