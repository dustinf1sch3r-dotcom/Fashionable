/**
 * Canonical domain types for Fashionable.
 *
 * This file is the contract every other module builds on. Changing the meaning of an existing
 * field requires a storage migration (see docs/ARCHITECTURE.md, "Data model").
 */

/** UUID v4, generated on the client. */
export type ID = string;
/** Calendar date, `YYYY-MM-DD`. */
export type ISODate = string;
/** UTC timestamp, ISO 8601. */
export type ISODateTime = string;

export interface Entity {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Soft delete marker. Queries exclude entities that have it. */
  deletedAt?: ISODateTime;
}

// ── Closet ──────────────────────────────────────────────────────────────────────────────────

export type Category =
  | 'top'
  | 'bottom'
  | 'onepiece'
  | 'outerwear'
  | 'shoes'
  | 'legwear'
  | 'belt'
  | 'bag'
  | 'headwear'
  | 'neckwear'
  | 'jewelry'
  | 'eyewear'
  | 'watch';

/** Position an item occupies in an outfit. See docs/OUTFIT_ENGINE.md §2. */
export type Slot =
  | 'base'
  | 'mid'
  | 'bottom'
  | 'onepiece'
  | 'outer'
  | 'shoes'
  | 'legs'
  | 'belt'
  | 'bag'
  | 'head'
  | 'neck'
  | 'eyes'
  | 'wrist'
  | 'jewelry';

export type ColorName =
  | 'black'
  | 'white'
  | 'grey'
  | 'navy'
  | 'beige'
  | 'brown'
  | 'olive'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink';

export interface ColorSwatch {
  /** `#rrggbb`, lower case. */
  hex: string;
  /** Fraction of the garment this colour covers, 0–1. */
  share: number;
  name: ColorName;
}

export type Pattern =
  'solid' | 'stripe' | 'check' | 'floral' | 'dot' | 'graphic' | 'animal' | 'other';

export type Material =
  | 'cotton'
  | 'denim'
  | 'wool'
  | 'knit'
  | 'leather'
  | 'suede'
  | 'silk'
  | 'linen'
  | 'synthetic'
  | 'other';

export type Metal = 'gold' | 'silver' | 'rose' | 'mixed';

/** 1 lounge · 2 casual · 3 smart casual · 4 business · 5 formal */
export type Formality = 1 | 2 | 3 | 4 | 5;
/** 1 summer-light … 5 deep winter */
export type Warmth = 1 | 2 | 3 | 4 | 5;

export type ItemStatus = 'active' | 'laundry' | 'archived';

/** User correction to an item's default placement, in mannequin units (docs/TRY_ON.md §5–6). */
export interface FitAdjust {
  dx: number;
  dy: number;
  scale: number;
  /** Degrees, about the image centre. */
  rotation: number;
}

export interface Item extends Entity {
  name?: string;
  category: Category;
  /** One of the subcategories listed for the category in `model/taxonomy.ts`. */
  subcategory: string;
  /** Tops only: worn against the body (`base`) or over another top (`mid`). */
  layer?: 'base' | 'mid';
  /** 1–3 swatches, largest share first. */
  colors: ColorSwatch[];
  pattern: Pattern;
  patternBold: boolean;
  formality: Formality;
  warmth: Warmth;
  material?: Material;
  rainOk: boolean;
  sporty: boolean;
  metal?: Metal;
  status: ItemStatus;
  favorite: boolean;
  brand?: string;
  notes?: string;
  pricePaid?: number;
  purchasedOn?: ISODate;
  /** Image-store IDs. Never file paths or URLs. */
  images: { originalId: ID; cutoutId: ID; thumbId: ID };
  cutout: {
    /** Width / height of the trimmed cutout. */
    aspectRatio: number;
    /** False when background removal was unavailable and the cutout is the plain photo. */
    hasAlpha: boolean;
  };
  fitAdjust?: FitAdjust;
}

// ── Outfits, history, feedback ──────────────────────────────────────────────────────────────

export type Occasion = 'any' | 'lounge' | 'casual' | 'active' | 'work' | 'smart' | 'formal';

export interface Outfit extends Entity {
  itemIds: ID[];
  name?: string;
  occasion?: Occasion;
  source: 'generated' | 'manual';
  favorite: boolean;
  /** Draw the base top under the bottom. */
  tucked?: boolean;
  /** One-off placement tweaks that apply to this outfit only. */
  fitOverrides?: Record<ID, FitAdjust>;
}

export interface Weather {
  tempMinC: number;
  tempMaxC: number;
  feelsLikeC: number;
  /** 0–1 */
  precipProbability: number;
  windKph: number;
  isSunny: boolean;
}

export interface WearLog extends Entity {
  date: ISODate;
  itemIds: ID[];
  outfitId?: ID;
  /** True for a future plan, false for something actually worn. */
  planned: boolean;
  weather?: Weather;
  note?: string;
}

export interface Feedback extends Entity {
  /** Sorted ascending so the same outfit always produces the same key. */
  itemIds: ID[];
  verdict: 'like' | 'dislike';
}

// ── Try-on ──────────────────────────────────────────────────────────────────────────────────

/** A point on the 1000 × 2000 mannequin canvas (docs/TRY_ON.md §2). */
export interface Point {
  x: number;
  y: number;
}

export interface BodyLandmarks {
  headTop: Point;
  chin: Point;
  eyeLine: Point;
  neckBase: Point;
  shoulderL: Point;
  shoulderR: Point;
  waistL: Point;
  waistR: Point;
  hipL: Point;
  hipR: Point;
  kneeL: Point;
  kneeR: Point;
  ankleL: Point;
  ankleR: Point;
  wristL: Point;
  wristR: Point;
  footL: Point;
  footR: Point;
}

export interface BodyTemplate {
  id: string;
  landmarks: BodyLandmarks;
}

/** Where and how large to draw one item, in mannequin units. */
export interface Placement {
  itemId: ID;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
}

// ── Profile ─────────────────────────────────────────────────────────────────────────────────

export interface Profile extends Entity {
  displayName?: string;
  bodyTemplateId: string;
  location?: { lat: number; lon: number; label: string };
  units: 'metric' | 'imperial';
  /** Phase 3: the user's own standing photo with detected (and user-corrected) landmarks. */
  bodyPhoto?: { imageId: ID; landmarks: BodyLandmarks };
}

// ── Engine output ───────────────────────────────────────────────────────────────────────────

export type ScoreComponent =
  | 'colour'
  | 'formality'
  | 'weather'
  | 'pattern'
  | 'occasion'
  | 'coordination'
  | 'freshness'
  | 'taste';

/**
 * Machine-readable explanation. The UI turns codes into sentences; core never produces prose.
 * New codes are added here as the engine grows.
 */
export type ReasonCode =
  | 'COLOR_NEUTRAL_BASE'
  | 'COLOR_ACCENT_POP'
  | 'COLOR_MONOCHROME'
  | 'COLOR_COMPLEMENTARY'
  | 'COLOR_ANALOGOUS'
  | 'COLOR_TRIADIC'
  | 'COLOR_CLASH'
  | 'FORMALITY_COHESIVE'
  | 'FORMALITY_HIGH_LOW'
  | 'FORMALITY_MISMATCH'
  | 'PATTERN_STATEMENT'
  | 'PATTERN_BUSY'
  | 'WEATHER_SUITED'
  | 'WEATHER_RAIN_READY'
  | 'WEATHER_UNSUITED'
  | 'MISSING_LAYER'
  | 'LEATHERS_MATCH'
  | 'METALS_MATCH'
  | 'FRESH_COMBINATION'
  | 'TASTE_MATCH'
  | 'PINNED_OVERRIDE';

export interface Reason {
  code: ReasonCode;
  params: Record<string, string | number>;
}

export interface ScoreBreakdown {
  /** 0–100 */
  total: number;
  /** Value 0–1 and the renormalised weight for each component that applied. */
  components: Partial<Record<ScoreComponent, { value: number; weight: number }>>;
  reasons: Reason[];
}

export interface OutfitSuggestion {
  itemIds: ID[];
  /** 0–100 */
  score: number;
  breakdown: ScoreBreakdown;
  reasons: Reason[];
}
