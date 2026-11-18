import type { ISODate, Weather } from '@/core/model/types';
import {
  forecastCacheKey,
  isCacheFresh,
  parseCacheEntry,
  parseForecast,
  parseGeocode,
  type ForecastCacheEntry,
} from '@/core/weather';
import type { Clock, KeyValueStore, WeatherProvider } from '../types';
import { DEFAULT_WEATHER_CONFIG, type WeatherConfig } from './config';

export interface OpenMeteoOptions {
  kv: KeyValueStore;
  clock: Clock;
  config?: Partial<WeatherConfig>;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
}

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'weather_code',
].join(',');

/** Open-Meteo `WeatherProvider` with a per-location, per-day cache in the key-value store. */
export function createOpenMeteoProvider(options: OpenMeteoOptions): WeatherProvider {
  const { kv, clock } = options;
  const cfg: WeatherConfig = { ...DEFAULT_WEATHER_CONFIG, ...options.config };
  const doFetch: typeof fetch = options.fetchFn ?? ((...args) => fetch(...args));

  async function getJson(base: string, params: Record<string, string>): Promise<unknown> {
    const search = new URLSearchParams(params);
    if (cfg.apiKey) search.set('apikey', cfg.apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await doFetch(`${base}?${search.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function readCache(key: string): Promise<ForecastCacheEntry | undefined> {
    try {
      return parseCacheEntry(await kv.get(key));
    } catch {
      return undefined;
    }
  }

  return {
    async forecast(lat, lon, date: ISODate): Promise<Weather | undefined> {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
      const key = forecastCacheKey(lat, lon);
      const cached = await readCache(key);
      if (cached && isCacheFresh(cached, date, clock.now())) return cached.days[date];
      try {
        const json = await getJson(cfg.forecastUrl, {
          latitude: String(lat),
          longitude: String(lon),
          daily: DAILY,
          timezone: 'auto',
          forecast_days: String(cfg.forecastDays),
        });
        const days = parseForecast(json);
        if (Object.keys(days).length === 0) return cached?.days[date];
        const entry: ForecastCacheEntry = { fetchedAt: clock.now().toISOString(), days };
        try {
          await kv.set(key, JSON.stringify(entry));
        } catch {
          // A full or blocked store only costs us the cache.
        }
        return days[date];
      } catch {
        // Offline, timeout or server error: a stale forecast beats none.
        return cached?.days[date];
      }
    },

    async geocode(query) {
      const name = query.trim();
      if (name.length < 2) return [];
      try {
        return parseGeocode(
          await getJson(cfg.geocodingUrl, { name, count: '8', language: 'en', format: 'json' }),
        );
      } catch {
        return [];
      }
    },
  };
}
