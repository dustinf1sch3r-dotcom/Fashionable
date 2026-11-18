import type { Profile, Weather } from '../model/types';

export type Units = Profile['units'];

export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;

/** Whole degrees in the display unit (a number, so the UI picks the symbol and spacing). */
export function displayTemp(c: number, units: Units): number {
  const v = units === 'imperial' ? cToF(c) : c;
  const r = Math.round(v);
  return r === 0 ? 0 : r; // avoid "-0"
}

/** "18°" style text; the degree sign carries no unit letter so it fits a compact card. */
export function formatTemp(c: number, units: Units): string {
  return `${displayTemp(c, units)}°`;
}

/** Whole percent from a 0-1 probability. */
export const percent = (p: number): number => Math.round(Math.min(1, Math.max(0, p)) * 100);

export type WeatherGlyph = 'rain' | 'sunny' | 'cloudy';

/** Rain chance at or above which the card shows a rain glyph instead of sun or cloud. */
export const RAIN_GLYPH_THRESHOLD = 0.5;

/** Which icon to show for a day. */
export function weatherGlyph(w: Weather): WeatherGlyph {
  if (w.precipProbability >= RAIN_GLYPH_THRESHOLD) return 'rain';
  return w.isSunny ? 'sunny' : 'cloudy';
}
