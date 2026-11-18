import { CATEGORIES, isValidSubcategory } from './taxonomy';
import type { BodyLandmarks, Category, Feedback, Item, Outfit, Profile, WearLog } from './types';

/** Machine-readable problem; `path` is a dotted location such as `colors.0.hex`. */
export interface Problem {
  path: string;
  code: 'missing' | 'wrong_type' | 'invalid_value' | 'out_of_range' | 'invalid_format';
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; problems: Problem[] };

type Rec = Record<string, unknown>;
type Add = (path: string, code: Problem['code']) => void;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);
const PATTERNS = ['solid', 'stripe', 'check', 'floral', 'dot', 'graphic', 'animal', 'other'];
const MATERIALS = [
  'cotton',
  'denim',
  'wool',
  'knit',
  'leather',
  'suede',
  'silk',
  'linen',
  'synthetic',
  'other',
];
const COLOR_NAMES = [
  'black',
  'white',
  'grey',
  'navy',
  'beige',
  'brown',
  'olive',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
];
const METALS = ['gold', 'silver', 'rose', 'mixed'];
const STATUSES = ['active', 'laundry', 'archived'];
const OCCASIONS = ['any', 'lounge', 'casual', 'active', 'work', 'smart', 'formal'];
const LANDMARK_KEYS: (keyof BodyLandmarks)[] = [
  'headTop',
  'chin',
  'eyeLine',
  'neckBase',
  'shoulderL',
  'shoulderR',
  'waistL',
  'waistR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
  'wristL',
  'wristR',
  'footL',
  'footR',
];

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HEX_RE = /^#[0-9a-f]{6}$/;

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isISODateTime(v: unknown): boolean {
  return typeof v === 'string' && DATETIME_RE.test(v) && !Number.isNaN(Date.parse(v));
}

function isISODate(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const m = DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

// ── field helpers ───────────────────────────────────────────────────────────────────────────

function reqString(o: Rec, key: string, add: Add, nonEmpty = false): void {
  const v = o[key];
  if (v === undefined) return add(key, 'missing');
  if (typeof v !== 'string') return add(key, 'wrong_type');
  if (nonEmpty && v.length === 0) add(key, 'invalid_value');
}
function optString(o: Rec, key: string, add: Add): void {
  if (o[key] !== undefined && typeof o[key] !== 'string') add(key, 'wrong_type');
}
function reqBool(o: Rec, key: string, add: Add): void {
  if (o[key] === undefined) add(key, 'missing');
  else if (typeof o[key] !== 'boolean') add(key, 'wrong_type');
}
function optBool(o: Rec, key: string, add: Add): void {
  if (o[key] !== undefined && typeof o[key] !== 'boolean') add(key, 'wrong_type');
}
function enumField(o: Rec, key: string, allowed: readonly string[], add: Add, required: boolean) {
  const v = o[key];
  if (v === undefined) {
    if (required) add(key, 'missing');
    return;
  }
  if (typeof v !== 'string') return add(key, 'wrong_type');
  if (!allowed.includes(v)) add(key, 'invalid_value');
}
function level(o: Rec, key: string, add: Add): void {
  const v = o[key];
  if (v === undefined) return add(key, 'missing');
  if (!isNum(v)) return add(key, 'wrong_type');
  if (!Number.isInteger(v) || v < 1 || v > 5) add(key, 'out_of_range');
}
function range(v: unknown, path: string, min: number, max: number, add: Add): void {
  if (v === undefined) return add(path, 'missing');
  if (!isNum(v)) return add(path, 'wrong_type');
  if (v < min || v > max) add(path, 'out_of_range');
}
function num(v: unknown, path: string, add: Add): void {
  if (v === undefined) add(path, 'missing');
  else if (!isNum(v)) add(path, 'wrong_type');
}
function dateTime(o: Rec, key: string, add: Add, required: boolean): void {
  const v = o[key];
  if (v === undefined) {
    if (required) add(key, 'missing');
    return;
  }
  if (typeof v !== 'string') return add(key, 'wrong_type');
  if (!isISODateTime(v)) add(key, 'invalid_format');
}
function isoDate(o: Rec, key: string, add: Add, required: boolean): void {
  const v = o[key];
  if (v === undefined) {
    if (required) add(key, 'missing');
    return;
  }
  if (typeof v !== 'string') return add(key, 'wrong_type');
  if (!isISODate(v)) add(key, 'invalid_format');
}
function idList(o: Rec, key: string, add: Add, sorted = false): void {
  const v = o[key];
  if (v === undefined) return add(key, 'missing');
  if (!Array.isArray(v)) return add(key, 'wrong_type');
  let ok = true;
  v.forEach((id, i) => {
    if (typeof id !== 'string') add(`${key}.${i}`, 'wrong_type');
    else if (id.length === 0) add(`${key}.${i}`, 'invalid_value');
    else return;
    ok = false;
  });
  if (!ok) return;
  const ids = v as string[];
  if (new Set(ids).size !== ids.length) add(key, 'invalid_value');
  else if (sorted && ids.some((id, i) => i > 0 && ids[i - 1] >= id)) add(key, 'invalid_value');
}

function entityBase(o: Rec, add: Add): void {
  reqString(o, 'id', add, true);
  dateTime(o, 'createdAt', add, true);
  dateTime(o, 'updatedAt', add, true);
  dateTime(o, 'deletedAt', add, false);
}

function nested(
  parent: Rec,
  key: string,
  add: Add,
  required: boolean,
  check: (o: Rec, sub: Add) => void,
): void {
  const v = parent[key];
  if (v === undefined) {
    if (required) add(key, 'missing');
    return;
  }
  if (!isRec(v)) return add(key, 'wrong_type');
  check(v, (p, c) => add(`${key}.${p}`, c));
}

function fitAdjust(o: Rec, add: Add): void {
  for (const k of ['dx', 'dy', 'scale', 'rotation']) num(o[k], k, add);
  if (isNum(o.scale) && o.scale <= 0) add('scale', 'out_of_range');
}

function point(v: unknown, path: string, add: Add): void {
  if (v === undefined) return add(path, 'missing');
  if (!isRec(v)) return add(path, 'wrong_type');
  num(v.x, `${path}.x`, add);
  num(v.y, `${path}.y`, add);
}

function landmarks(o: Rec, add: Add): void {
  for (const k of LANDMARK_KEYS) point(o[k], k, add);
}

const RIG_KINDS = ['top', 'trousers', 'skirt', 'dress', 'jumpsuit'] as const;

/** Garment rig (docs/TRY_ON.md §12.1): points normalised to the cutout, a little slack allowed. */
function garmentRig(o: Rec, add: Add): void {
  enumField(o, 'kind', RIG_KINDS, add, true);
  num(o.version, 'version', add);
  range(o.confidence, 'confidence', 0, 1, add);
  reqBool(o, 'edited', add);
  if (!isRec(o.points)) return add('points', o.points === undefined ? 'missing' : 'wrong_type');
  for (const [name, v] of Object.entries(o.points)) {
    point(v, `points.${name}`, add);
    if (
      isRec(v) &&
      isNum(v.x) &&
      isNum(v.y) &&
      (v.x < -0.25 || v.x > 1.25 || v.y < -0.25 || v.y > 1.25)
    )
      add(`points.${name}`, 'out_of_range');
  }
}

function weather(o: Rec, add: Add): void {
  for (const k of ['tempMinC', 'tempMaxC', 'feelsLikeC']) num(o[k], k, add);
  range(o.precipProbability, 'precipProbability', 0, 1, add);
  range(o.windKph, 'windKph', 0, Infinity, add);
  reqBool(o, 'isSunny', add);
}

// ── runner ──────────────────────────────────────────────────────────────────────────────────

function run<T>(input: unknown, check: (o: Rec, add: Add) => void): ValidationResult<T> {
  if (!isRec(input)) return { ok: false, problems: [{ path: '', code: 'wrong_type' }] };
  const problems: Problem[] = [];
  check(input, (path, code) => problems.push({ path, code }));
  return problems.length === 0
    ? { ok: true, value: input as unknown as T }
    : { ok: false, problems };
}

// ── entity validators ───────────────────────────────────────────────────────────────────────

export function validateItem(input: unknown): ValidationResult<Item> {
  return run<Item>(input, (o, add) => {
    entityBase(o, add);
    optString(o, 'name', add);
    enumField(o, 'category', [...CATEGORY_SET], add, true);
    reqString(o, 'subcategory', add);
    if (
      typeof o.category === 'string' &&
      CATEGORY_SET.has(o.category) &&
      typeof o.subcategory === 'string' &&
      !isValidSubcategory(o.category as Category, o.subcategory)
    ) {
      add('subcategory', 'invalid_value');
    }
    enumField(o, 'layer', ['base', 'mid'], add, false);
    if (o.layer !== undefined && o.category !== 'top') add('layer', 'invalid_value');

    const colors = o.colors;
    if (colors === undefined) add('colors', 'missing');
    else if (!Array.isArray(colors)) add('colors', 'wrong_type');
    else {
      if (colors.length < 1 || colors.length > 3) add('colors', 'out_of_range');
      colors.forEach((c: unknown, i) => {
        const p = `colors.${i}`;
        if (!isRec(c)) return add(p, 'wrong_type');
        if (c.hex === undefined) add(`${p}.hex`, 'missing');
        else if (typeof c.hex !== 'string') add(`${p}.hex`, 'wrong_type');
        else if (!HEX_RE.test(c.hex)) add(`${p}.hex`, 'invalid_format');
        range(c.share, `${p}.share`, 0, 1, add);
        enumField(c, 'name', COLOR_NAMES, (_k, code) => add(`${p}.name`, code), true);
      });
    }

    enumField(o, 'pattern', PATTERNS, add, true);
    reqBool(o, 'patternBold', add);
    level(o, 'formality', add);
    level(o, 'warmth', add);
    enumField(o, 'material', MATERIALS, add, false);
    reqBool(o, 'rainOk', add);
    reqBool(o, 'sporty', add);
    enumField(o, 'metal', METALS, add, false);
    enumField(o, 'status', STATUSES, add, true);
    reqBool(o, 'favorite', add);
    optString(o, 'brand', add);
    optString(o, 'notes', add);
    if (o.pricePaid !== undefined) range(o.pricePaid, 'pricePaid', 0, Infinity, add);
    isoDate(o, 'purchasedOn', add, false);
    nested(o, 'images', add, true, (im, sub) => {
      reqString(im, 'originalId', (_p, c) => sub('originalId', c), true);
      reqString(im, 'cutoutId', (_p, c) => sub('cutoutId', c), true);
      reqString(im, 'thumbId', (_p, c) => sub('thumbId', c), true);
    });
    nested(o, 'cutout', add, true, (c, sub) => {
      const v = c.aspectRatio;
      if (v === undefined) sub('aspectRatio', 'missing');
      else if (!isNum(v)) sub('aspectRatio', 'wrong_type');
      else if (v <= 0) sub('aspectRatio', 'out_of_range');
      reqBool(c, 'hasAlpha', sub);
      nested(c, 'crop', sub, false, (r, sub2) => {
        for (const k of ['x', 'y', 'width', 'height', 'scale']) num(r[k], k, sub2);
        for (const k of ['width', 'height', 'scale']) {
          if (isNum(r[k]) && r[k] <= 0) sub2(k, 'out_of_range');
        }
      });
    });
    nested(o, 'fitAdjust', add, false, fitAdjust);
    nested(o, 'fit', add, false, garmentRig);
  });
}

export function validateOutfit(input: unknown): ValidationResult<Outfit> {
  return run<Outfit>(input, (o, add) => {
    entityBase(o, add);
    idList(o, 'itemIds', add);
    optString(o, 'name', add);
    enumField(o, 'occasion', OCCASIONS, add, false);
    enumField(o, 'source', ['generated', 'manual'], add, true);
    reqBool(o, 'favorite', add);
    optBool(o, 'tucked', add);
    nested(o, 'fitOverrides', add, false, (fo, sub) => {
      for (const [id, v] of Object.entries(fo)) {
        if (!isRec(v)) sub(id, 'wrong_type');
        else fitAdjust(v, (p, c) => sub(`${id}.${p}`, c));
      }
    });
  });
}

export function validateWearLog(input: unknown): ValidationResult<WearLog> {
  return run<WearLog>(input, (o, add) => {
    entityBase(o, add);
    isoDate(o, 'date', add, true);
    idList(o, 'itemIds', add);
    optString(o, 'outfitId', add);
    reqBool(o, 'planned', add);
    nested(o, 'weather', add, false, weather);
    optString(o, 'note', add);
  });
}

export function validateFeedback(input: unknown): ValidationResult<Feedback> {
  return run<Feedback>(input, (o, add) => {
    entityBase(o, add);
    idList(o, 'itemIds', add, true);
    enumField(o, 'verdict', ['like', 'dislike'], add, true);
  });
}

export function validateProfile(input: unknown): ValidationResult<Profile> {
  return run<Profile>(input, (o, add) => {
    entityBase(o, add);
    optString(o, 'displayName', add);
    reqString(o, 'bodyTemplateId', add, true);
    nested(o, 'location', add, false, (l, sub) => {
      range(l.lat, 'lat', -90, 90, (p, c) => sub(p, c));
      range(l.lon, 'lon', -180, 180, (p, c) => sub(p, c));
      reqString(l, 'label', sub);
    });
    enumField(o, 'units', ['metric', 'imperial'], add, true);
    dateTime(o, 'lastBackupAt', add, false);
    nested(o, 'bodyPhoto', add, false, (b, sub) => {
      reqString(b, 'imageId', (_p, c) => sub('imageId', c), true);
      nested(b, 'landmarks', sub, true, landmarks);
      nested(b, 'detected', sub, false, landmarks);
      dateTime(b, 'takenAt', sub, false);
      nested(b, 'elbows', sub, false, (e, esub) => {
        point(e.elbowL, 'elbowL', esub);
        point(e.elbowR, 'elbowR', esub);
      });
    });
    enumField(o, 'tryOnMode', ['photo', 'silhouette'], add, false);
  });
}

export const isItem = (v: unknown): v is Item => validateItem(v).ok;
export const isOutfit = (v: unknown): v is Outfit => validateOutfit(v).ok;
export const isWearLog = (v: unknown): v is WearLog => validateWearLog(v).ok;
export const isFeedback = (v: unknown): v is Feedback => validateFeedback(v).ok;
export const isProfile = (v: unknown): v is Profile => validateProfile(v).ok;
