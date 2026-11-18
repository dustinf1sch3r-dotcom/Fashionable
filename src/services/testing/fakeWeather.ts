import type { ISODate, Weather } from '@/core/model/types';
import type { GeocodeResult, LocationService, PositionResult, WeatherProvider } from '../types';

export interface FakeWeatherProvider extends WeatherProvider {
  /** Forecast by date; dates not present resolve `undefined`. */
  days: Record<ISODate, Weather>;
  /** Results `geocode` returns (filtered by label containing the query, case-insensitive). */
  places: GeocodeResult[];
  /** When true, `forecast` resolves `undefined` like an offline provider. */
  offline: boolean;
  readonly forecastCalls: { lat: number; lon: number; date: ISODate }[];
}

export function createFakeWeatherProvider(
  days: Record<ISODate, Weather> = {},
  places: GeocodeResult[] = [],
): FakeWeatherProvider {
  const forecastCalls: FakeWeatherProvider['forecastCalls'] = [];
  const fake: FakeWeatherProvider = {
    days,
    places,
    offline: false,
    forecastCalls,
    forecast: async (lat, lon, date) => {
      forecastCalls.push({ lat, lon, date });
      return fake.offline ? undefined : fake.days[date];
    },
    geocode: async (query) =>
      fake.offline
        ? []
        : fake.places.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase())),
  };
  return fake;
}

export interface FakeLocationService extends LocationService {
  result: PositionResult;
  calls: number;
}

export function createFakeLocationService(
  result: PositionResult = { status: 'unavailable' },
): FakeLocationService {
  const fake: FakeLocationService = {
    result,
    calls: 0,
    getCurrentPosition: async () => {
      fake.calls++;
      return fake.result;
    },
  };
  return fake;
}
