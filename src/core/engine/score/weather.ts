import { subcategoryDefaults } from '../../model/taxonomy';
import { slotOf } from '../../model/slots';
import type { Item, Slot, Weather } from '../../model/types';
import {
  RAIN_PRECIP_THRESHOLD,
  RAIN_SENSITIVE_SLOTS,
  SUN_BONUS_HEAD_MAX_WARMTH,
  SUN_BONUS_POINTS,
  SUN_BONUS_SLOTS,
  SUN_MIN_FEELS_LIKE_C,
  WARM_WEATHER_ACCESSORY_SLOTS,
  WARM_WEATHER_ACCESSORY_WARMTH_AT_LEAST,
  WARM_WEATHER_MIN_FEELS_LIKE_C,
  WARMTH_LAYER_SLOTS,
  WEATHER_BANDS,
  WEATHER_HARD_RULE_FACTOR,
  WEATHER_MISSING_LAYER_FACTOR,
  WEATHER_SUITED_MIN,
  WEATHER_WARMTH_DIVISOR,
} from '../weights';
import type { WeatherBand } from '../weights';
import { clamp01, itemsInSlots, mean } from './types';
import type { ComponentResult } from './types';

/** The band for a forecast, chosen by `feelsLikeC` (OUTFIT_ENGINE §6). */
export function weatherBand(weather: Weather): WeatherBand {
  const band = WEATHER_BANDS.find((b) => weather.feelsLikeC >= b.minFeelsLikeC);
  // The last band has an unbounded lower limit; NaN input falls back to it.
  return band ?? WEATHER_BANDS[WEATHER_BANDS.length - 1];
}

/**
 * Slot requirement groups demanded by the weather. Each group is satisfied when at least one of
 * its slots is filled: `[['mid','outer']]` means "mid or outer", `[['outer'],['mid']]` means both.
 * (For `< 5°C` the outer must also have warmth ≥ 4, see `isRequirementMet`.)
 */
export function requiredSlots(weather: Weather): Slot[][] {
  return weatherBand(weather).requiredAnyOf.map((g) => [...g]);
}

export function isRaining(weather: Weather): boolean {
  return weather.precipProbability >= RAIN_PRECIP_THRESHOLD;
}

export function isSunBonusActive(weather: Weather): boolean {
  return weather.isSunny && weather.feelsLikeC >= SUN_MIN_FEELS_LIKE_C;
}

/** Hard weather rules per item (OUTFIT_ENGINE §6). */
export function isItemAllowedInWeather(item: Item, weather: Weather | undefined): boolean {
  if (!weather) return true;
  const band = weatherBand(weather);
  const slot = slotOf(item);
  if (band.forbiddenSlots.includes(slot)) return false;
  if (
    weather.feelsLikeC >= WARM_WEATHER_MIN_FEELS_LIKE_C &&
    WARM_WEATHER_ACCESSORY_SLOTS.includes(slot) &&
    item.warmth >= WARM_WEATHER_ACCESSORY_WARMTH_AT_LEAST
  ) {
    return false;
  }
  if (band.excludeWarmthAtLeast !== undefined && item.warmth >= band.excludeWarmthAtLeast) {
    return false;
  }
  if (slot === 'outer' && band.maxOuterWarmth !== undefined && item.warmth > band.maxOuterWarmth) {
    return false;
  }
  if (
    slot === 'bottom' &&
    band.excludeBottomWarmthAtMost !== undefined &&
    item.warmth <= band.excludeBottomWarmthAtMost
  ) {
    return false;
  }
  const defaults = subcategoryDefaults(item.category, item.subcategory);
  if (band.excludeOpenShoes && slot === 'shoes' && defaults?.openShoe) return false;
  if (band.excludeShorts && slot === 'bottom' && defaults?.isShorts) return false;
  if (isRaining(weather) && RAIN_SENSITIVE_SLOTS.includes(slot) && !item.rainOk) return false;
  return true;
}

function requirementMet(
  items: readonly Item[],
  group: readonly Slot[],
  band: WeatherBand,
): boolean {
  return items.some((i) => {
    const slot = slotOf(i);
    if (!group.includes(slot)) return false;
    if (slot === 'outer' && band.requiredOuterMinWarmth !== undefined) {
      return i.warmth >= band.requiredOuterMinWarmth;
    }
    return true;
  });
}

/** Required groups that this outfit does not satisfy. */
export function missingLayers(items: readonly Item[], weather: Weather): Slot[][] {
  const band = weatherBand(weather);
  return band.requiredAnyOf.filter((g) => !requirementMet(items, g, band)).map((g) => [...g]);
}

/** Bonus points (0–100 scale) for sunglasses / hat in sunny weather ≥ 20°C. */
export function sunBonusPoints(items: readonly Item[], weather: Weather | undefined): number {
  if (!weather || !isSunBonusActive(weather)) return 0;
  const filled = SUN_BONUS_SLOTS.filter((s) =>
    items.some((i) => slotOf(i) === s && (s !== 'head' || i.warmth <= SUN_BONUS_HEAD_MAX_WARMTH)),
  );
  return filled.length * SUN_BONUS_POINTS;
}

/**
 * Weather suitability (OUTFIT_ENGINE §6): `1 − |mean warmth of worn layers − target| / 2`,
 * clamped, ×0.5 when a required layer is missing. `null` without weather or garments.
 *
 * Interpretation: "worn layers" = base, mid, bottom, onepiece, outer, shoes (WARMTH_LAYER_SLOTS);
 * accessories do not enter the warmth mean.
 */
export function scoreWeather(
  items: readonly Item[],
  weather: Weather | undefined,
): ComponentResult | null {
  if (!weather) return null;
  const layers = itemsInSlots(items, WARMTH_LAYER_SLOTS);
  if (layers.length === 0) return null;
  const band = weatherBand(weather);
  const avg = mean(layers.map((i) => i.warmth));
  let value = clamp01(1 - Math.abs(avg - band.targetWarmth) / WEATHER_WARMTH_DIVISOR);
  const missing = missingLayers(items, weather);
  if (missing.length > 0) value *= WEATHER_MISSING_LAYER_FACTOR;
  // The generator filters these items out; this matters for manual outfits (Mix screen).
  const unsuited = items.filter((i) => !isItemAllowedInWeather(i, weather));
  if (unsuited.length > 0) value *= WEATHER_HARD_RULE_FACTOR;

  const reasons: ComponentResult['reasons'] = missing.map((g) => ({
    code: 'MISSING_LAYER',
    params: { slot: g.join('/') },
  }));
  for (const item of unsuited) {
    reasons.push({ code: 'WEATHER_UNSUITED', params: { itemId: item.id, band: band.id } });
  }
  if (missing.length === 0 && unsuited.length === 0 && value >= WEATHER_SUITED_MIN) {
    reasons.push({ code: 'WEATHER_SUITED', params: { band: band.id } });
  }
  if (isRaining(weather)) {
    const exposed = items.some((i) => RAIN_SENSITIVE_SLOTS.includes(slotOf(i)) && !i.rainOk);
    if (!exposed && items.some((i) => RAIN_SENSITIVE_SLOTS.includes(slotOf(i)))) {
      reasons.push({ code: 'WEATHER_RAIN_READY', params: {} });
    }
  }
  return { value, reasons };
}
