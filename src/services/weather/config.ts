/**
 * The ONLY place that names the weather API endpoints. Proof of concept: Open-Meteo's free,
 * non-commercial endpoints. Before the app is sold, point these at the paid plan
 * (`https://customer-api.open-meteo.com/v1/forecast`, same parameters plus `apikey`) or another
 * provider; see docs/ARCHITECTURE.md "Weather" and the pre-sale checklist in docs/LICENSES.md.
 */
export interface WeatherConfig {
  forecastUrl: string;
  geocodingUrl: string;
  /** Sent as `apikey` when set (paid plan). */
  apiKey?: string;
  /** Give up on a request after this long. */
  timeoutMs: number;
  /** How many days to request (Open-Meteo allows up to 16; we use 14). */
  forecastDays: number;
}

export const DEFAULT_WEATHER_CONFIG: WeatherConfig = {
  forecastUrl: 'https://api.open-meteo.com/v1/forecast',
  geocodingUrl: 'https://geocoding-api.open-meteo.com/v1/search',
  timeoutMs: 8000,
  forecastDays: 14,
};

export const ATTRIBUTION_TEXT = 'Weather data by Open-Meteo.com';
export const ATTRIBUTION_URL = 'https://open-meteo.com/';
