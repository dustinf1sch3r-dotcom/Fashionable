import type { WeatherError } from '@/state';

export const UNAVAILABLE_TEXT = 'Weather unavailable — outfits ignore weather';

/** Sentence for a failed attempt, or `undefined` when there is nothing to say. */
export function errorText(error: WeatherError | null): string | undefined {
  switch (error) {
    case 'location-denied':
      return 'Location permission was denied. Search for a city instead.';
    case 'location-unavailable':
      return 'Could not get your position. Search for a city instead.';
    case 'weather-unavailable':
      return UNAVAILABLE_TEXT;
    default:
      return undefined;
  }
}
