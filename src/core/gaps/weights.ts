/** Gap-analysis constants (OUTFIT_ENGINE §8). Engine constants such as the threshold live in engine/weights.ts. */

/** `findGaps` returns at most this many core gaps (new core pieces)... */
export const MAX_GAP_SUGGESTIONS = 5;

/** ...and at most this many add-on gaps (outer, mid, belt, bag, accessories). */
export const MAX_ADDON_SUGGESTIONS = 3;

/** Per-archetype cap on good core combos tried with an add-on; above it they are sampled evenly and the count scaled. */
export const MAX_ADDON_COMBOS = 150;

/** Per-archetype cap on evaluated core combos; above it the combos are sampled and the count scaled. */
export const MAX_ARCHETYPE_COMBOS = 500;

/** Default seed for sampling oversized combo spaces. */
export const DEFAULT_GAP_SEED = 1;

/** An item in fewer than this many good core combos is an orphan. */
export const ORPHAN_MIN_GOOD_OUTFITS = 3;

/** At most this many archetypes are listed in an orphan's `wouldHelp`. */
export const ORPHAN_HELP_MAX = 3;

/** Two items are duplicates only when their primary colours are closer than this (CIE76 ΔE). */
export const DUPLICATE_MAX_DELTA_E = 10;

/** Fixed context for gap scoring: occasion `any`, no weather, no history. */
export const GAP_SCORE_DATE = '2026-01-01';

/** Cap on baseline core combos scored when looking for add-on gains (sampled above it). */
export const MAX_ADDON_BASELINE_COMBOS = 2000;
