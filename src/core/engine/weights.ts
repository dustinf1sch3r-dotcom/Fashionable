import type { Occasion, ScoreComponent, Slot } from '../model/types';

/**
 * Every tunable number of the outfit engine (OUTFIT_ENGINE §3–§7). Logic reads constants from
 * here only; tuning never touches logic.
 */

// ── §4 Component weights ────────────────────────────────────────────────────────────────────

export const COMPONENT_WEIGHTS: Readonly<Record<ScoreComponent, number>> = {
  colour: 0.3,
  formality: 0.2,
  weather: 0.15,
  pattern: 0.1,
  occasion: 0.1,
  coordination: 0.05,
  freshness: 0.05,
  taste: 0.05,
};

// ── §3 Generator thresholds ─────────────────────────────────────────────────────────────────

export const MAX_CORE_COMBOS = 5000;
export const BEAM_WIDTH = 200;
/** Minimum score gain (0–100 points) for an optional add-on slot. */
export const ADD_ON_MIN_GAIN = 1.0;
/** MMR trade-off between score and diversity. */
export const MMR_LAMBDA = 0.7;
/** §8: a core combo scoring at least this is a "good outfit". */
export const GOOD_OUTFIT_THRESHOLD = 85;
export const DEFAULT_OUTFIT_COUNT = 5;
/** Order in which the generator considers optional slots (§3 step 4). */
export const DRESS_UP_SLOT_ORDER: readonly Slot[] = [
  'outer',
  'mid',
  'belt',
  'neck',
  'head',
  'bag',
  'wrist',
  'eyes',
  'legs',
  'jewelry',
];

/** Optional accessory slots; an outfit fills at most `MAX_ACCESSORY_SLOTS` of them. */
export const ACCESSORY_SLOTS: readonly Slot[] = ['neck', 'head', 'eyes', 'bag', 'wrist', 'jewelry'];
/** Jewelry counts as one slot however many pieces. Belts and weather-required slots are exempt. */
export const MAX_ACCESSORY_SLOTS = 3;

/** Performance limits for large closets (OUTFIT_ENGINE §3, "Performance limits"). */
/** Above this many core combos, a cheap pre-score (no colour, no history) trims the list. */
export const CORE_PRESCORE_THRESHOLD = 1000;
/** Number of cores that survive the pre-score and are fully scored. */
export const CORE_PRESCORE_KEEP = 300;
/** Candidates tried per slot and combo; larger pools are sampled by a rotating window. */
export const DRESS_UP_CANDIDATES_PER_SLOT = 8;
/** Outfit evaluations spent on dress-up; once spent, remaining beam cores are not dressed. */
export const DRESS_UP_EVAL_BUDGET = 1000;
/** Beam cores that are always dressed, whatever the budget. */
export const DRESS_UP_MIN_COMBOS = 8;

// ── §4.2 Formality ──────────────────────────────────────────────────────────────────────────

/** Slots whose formality is compared. */
export const FORMALITY_SLOTS: readonly Slot[] = [
  'base',
  'mid',
  'bottom',
  'onepiece',
  'outer',
  'shoes',
];
/** Score by spread (max − min), index = spread. */
export const FORMALITY_SPREAD_SCORES: readonly number[] = [1.0, 0.9, 0.55, 0.2, 0.0];
/** Score for a deliberate high-low pairing (spread 2, exactly one outlier). */
export const FORMALITY_HIGH_LOW_SCORE = 0.75;
export const FORMALITY_HIGH_LOW_SPREAD = 2;
/** Spread at or below which the outfit reads as cohesive. */
export const FORMALITY_COHESIVE_MAX_SPREAD = 1;

// ── §4.3 Pattern ────────────────────────────────────────────────────────────────────────────

export const PATTERN_SLOTS: readonly Slot[] = [
  'base',
  'mid',
  'bottom',
  'onepiece',
  'outer',
  'neck',
];
export const PATTERN_SCORES = {
  none: 0.85,
  one: 1.0,
  twoDifferent: 0.7,
  twoSameOrBold: 0.35,
  threePlus: 0.1,
} as const;
/** `smart` occasion: bonus when exactly one patterned piece (result clamped to 1). */
export const PATTERN_SMART_BONUS = 0.05;

// ── §4.4 Coordination ───────────────────────────────────────────────────────────────────────

export const COORDINATION_SCORES = {
  leathersMatch: 1.0,
  leathersClash: 0.3,
  metalsMatch: 1.0,
  metalsMixed: 0.5,
  bagMatch: 1.0,
  bagClash: 0.6,
} as const;
/** Colour names treated as one family when matching leathers (tan is named brown/beige). */
export const BROWN_LEATHER_FAMILY: readonly string[] = ['brown', 'beige'];
/** Hue distance (degrees) within which two accent colours share a family (§4.1). */
export const HUE_FAMILY_DEGREES = 30;

// ── §4.5 Freshness ──────────────────────────────────────────────────────────────────────────

export const FRESHNESS_WINDOW_DAYS = 14;
/** A main piece counts as "recently worn" if worn within this many days (inclusive). */
export const FRESHNESS_RECENT_DAYS = 3;
/** Weight of the recent-repeat share `r` in `1 − k·r`. */
export const FRESHNESS_RECENT_PENALTY = 0.5;

// ── §5 Occasions ────────────────────────────────────────────────────────────────────────────

export interface OccasionRule {
  minFormality: number;
  maxFormality: number;
  /** `null` = no ideal, occasion component skipped. */
  ideal: number | null;
  /** Only items flagged `sporty` are allowed. */
  onlySporty: boolean;
  /** Slots that are skipped entirely (no items allowed). */
  skipSlots: readonly Slot[];
}

export const OCCASION_RULES: Readonly<Record<Occasion, OccasionRule>> = {
  any: { minFormality: 1, maxFormality: 5, ideal: null, onlySporty: false, skipSlots: [] },
  lounge: { minFormality: 1, maxFormality: 2, ideal: 1, onlySporty: false, skipSlots: [] },
  casual: { minFormality: 1, maxFormality: 3, ideal: 2, onlySporty: false, skipSlots: [] },
  active: {
    minFormality: 1,
    maxFormality: 2,
    ideal: 1,
    onlySporty: true,
    skipSlots: ['belt', 'jewelry', 'neck'],
  },
  work: { minFormality: 3, maxFormality: 4, ideal: 3.5, onlySporty: false, skipSlots: [] },
  smart: { minFormality: 3, maxFormality: 4, ideal: 3.5, onlySporty: false, skipSlots: [] },
  formal: { minFormality: 4, maxFormality: 5, ideal: 4.5, onlySporty: false, skipSlots: [] },
};
/** Sporty items are only eligible for these occasions (unless pinned). */
export const SPORTY_ALLOWED_OCCASIONS: readonly Occasion[] = ['active', 'lounge', 'any'];
/** `1 − |mean − ideal| / OCCASION_DIVISOR`. */
export const OCCASION_DIVISOR = 2;

// ── §6 Weather ──────────────────────────────────────────────────────────────────────────────

export type WeatherBandId = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

export interface WeatherBand {
  id: WeatherBandId;
  /** Inclusive lower bound on `feelsLikeC`. */
  minFeelsLikeC: number;
  targetWarmth: number;
  /** No item may occupy these slots. */
  forbiddenSlots: readonly Slot[];
  /**
   * Requirement groups: each group is satisfied when at least one of its slots is filled
   * (`[['mid','outer']]` = "mid or outer required").
   */
  requiredAnyOf: readonly (readonly Slot[])[];
  /** A required `outer` only counts when its warmth is at least this. */
  requiredOuterMinWarmth?: number;
  /** Outer items above this warmth are excluded. */
  maxOuterWarmth?: number;
  /** Items with warmth at or above this are excluded. */
  excludeWarmthAtLeast?: number;
  /** Bottoms with warmth at or below this are excluded. */
  excludeBottomWarmthAtMost?: number;
  excludeOpenShoes: boolean;
  excludeShorts: boolean;
  /** Slots the generator should favour (no scoring effect here). */
  encouragedSlots: readonly Slot[];
}

/** Ordered from warmest weather to coldest; the first band whose lower bound fits wins. */
export const WEATHER_BANDS: readonly WeatherBand[] = [
  {
    id: 'hot',
    minFeelsLikeC: 27,
    targetWarmth: 1.5,
    forbiddenSlots: ['mid', 'outer'],
    requiredAnyOf: [],
    excludeWarmthAtLeast: 4,
    excludeOpenShoes: false,
    excludeShorts: false,
    encouragedSlots: [],
  },
  {
    id: 'warm',
    minFeelsLikeC: 20,
    targetWarmth: 2,
    forbiddenSlots: [],
    requiredAnyOf: [],
    maxOuterWarmth: 2,
    excludeWarmthAtLeast: 4,
    excludeOpenShoes: false,
    excludeShorts: false,
    encouragedSlots: [],
  },
  {
    id: 'mild',
    minFeelsLikeC: 13,
    targetWarmth: 3,
    forbiddenSlots: [],
    requiredAnyOf: [['mid', 'outer']],
    excludeBottomWarmthAtMost: 1,
    excludeOpenShoes: false,
    excludeShorts: false,
    encouragedSlots: [],
  },
  {
    id: 'cool',
    minFeelsLikeC: 5,
    targetWarmth: 3.5,
    forbiddenSlots: [],
    requiredAnyOf: [['outer']],
    excludeOpenShoes: true,
    excludeShorts: true,
    encouragedSlots: [],
  },
  {
    id: 'cold',
    minFeelsLikeC: Number.NEGATIVE_INFINITY,
    targetWarmth: 4.5,
    forbiddenSlots: [],
    requiredAnyOf: [['outer'], ['mid']],
    requiredOuterMinWarmth: 4,
    excludeOpenShoes: true,
    excludeShorts: true,
    encouragedSlots: ['neck', 'head'],
  },
];

/** Rain: `precipProbability` at or above this excludes `rainOk: false` items in the slots below. */
export const RAIN_PRECIP_THRESHOLD = 0.5;
export const RAIN_SENSITIVE_SLOTS: readonly Slot[] = ['shoes', 'outer', 'bag'];

/** Sun: `isSunny` and `feelsLikeC` at or above this. */
export const SUN_MIN_FEELS_LIKE_C = 20;
export const SUN_BONUS_SLOTS: readonly Slot[] = ['eyes', 'head'];
/** Points on the 0–100 outfit score per sun slot filled. */
export const SUN_BONUS_POINTS = 1;
/** Only `head` items up to this warmth earn the sun bonus (caps, sun hats; not beanies). */
export const SUN_BONUS_HEAD_MAX_WARMTH = 2;

/** From this `feelsLikeC` up, warm `neck` / `head` items are excluded and no `mid` is added. */
export const WARM_WEATHER_MIN_FEELS_LIKE_C = 20;
export const WARM_WEATHER_ACCESSORY_SLOTS: readonly Slot[] = ['neck', 'head'];
/** In warm weather, neck / head items with warmth at or above this are excluded. */
export const WARM_WEATHER_ACCESSORY_WARMTH_AT_LEAST = 3;

/** Slots whose items count as "worn layers" for the warmth mean. */
export const WARMTH_LAYER_SLOTS: readonly Slot[] = [
  'base',
  'mid',
  'bottom',
  'onepiece',
  'outer',
  'shoes',
];
export const WEATHER_WARMTH_DIVISOR = 2;
export const WEATHER_MISSING_LAYER_FACTOR = 0.5;
/** Multiplier when any item breaks a weather hard rule (puffer on a hot day, sandals in snow). */
export const WEATHER_HARD_RULE_FACTOR = 0.3;
/** Weather value at or above which the outfit is reported as `WEATHER_SUITED`. */
export const WEATHER_SUITED_MIN = 0.75;

// ── §7 Taste ────────────────────────────────────────────────────────────────────────────────

/** Weight of the mean item-pair affinity in `sigmoid(a·item + b·attr)`. */
export const TASTE_ITEM_PAIR_MIX = 0.6;
/** Weight of the mean attribute-pair affinity. */
export const TASTE_ATTR_PAIR_MIX = 0.4;
/** Slope `k` of `1 / (1 + e^(−k·x))`. */
export const TASTE_SIGMOID_SLOPE = 1;
/** Taste value at or above which the outfit is reported as `TASTE_MATCH`. */
export const TASTE_MATCH_MIN = 0.6;
/** Width of a hue bucket (degrees) in the stable colour-family key. */
export const TASTE_HUE_BUCKET_DEGREES = 30;
