import { detectRig, FIT_MIN_CONFIDENCE, RIG_VERSION, rigKindOf, type AlphaMask } from '@/core/fit';
import { removeHanger } from '@/core/image';
import type { GarmentRig, ID, Item } from '@/core/model/types';
import type { PixelReader } from '@/services';

/** Longest side of the cutout pixels the rig detector reads (docs/TRY_ON.md §12.2). */
export const RIG_PIXELS = 256;

type RigSubject = Pick<Item, 'category' | 'subcategory'>;

/**
 * Detects a rig from the cutout at `cutoutUri`. `undefined` when the item keeps rigid placement
 * (unsupported kind), the platform cannot read pixels, or nothing could be found. Never rejects.
 */
export async function detectItemRig(
  pixels: PixelReader,
  item: RigSubject,
  cutoutUri: string,
): Promise<GarmentRig | undefined> {
  try {
    const kind = rigKindOf(item);
    if (!kind) return undefined;
    const data = await pixels.read(cutoutUri, RIG_PIXELS);
    if (!data) return undefined;
    const alpha = new Uint8Array(data.width * data.height);
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = data.rgba[i * 4 + 3] ?? 0;
    // Cutouts made before hanger removal existed may still carry a hook: it is not the garment.
    const mask: AlphaMask = {
      width: data.width,
      height: data.height,
      alpha: removeHanger({ width: data.width, height: data.height, alpha }).alpha,
    };
    return detectRig(mask, kind);
  } catch {
    return undefined;
  }
}

/** Can this item be fitted at all (a supported kind, and a real cutout rather than a photo)? */
export function isFittable(item: Pick<Item, 'category' | 'subcategory' | 'cutout'>): boolean {
  if (!item.cutout.hasAlpha) return false;
  try {
    return rigKindOf(item) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Is this rig good enough to fit the garment to a body with? Points the user edited always are;
 * detected ones only above `FIT_MIN_CONFIDENCE`. Below it the garment keeps rigid placement (a
 * wrong rig warps it into something else) and the item offers "Check garment points".
 */
export function fitUsable(rig: GarmentRig): boolean {
  return rig.edited || rig.confidence >= FIT_MIN_CONFIDENCE;
}

/**
 * Whether the item's stored rig can be used as it is. It cannot when the rig is for another kind
 * (the item was re-tagged) or an old rule-set produced it and the user never edited it.
 */
export function rigIsCurrent(
  item: Pick<Item, 'category' | 'subcategory'>,
  rig: GarmentRig | undefined,
): boolean {
  if (!rig) return false;
  let kind;
  try {
    kind = rigKindOf(item);
  } catch {
    return false;
  }
  if (rig.kind !== kind) return false;
  return rig.edited || rig.version >= RIG_VERSION;
}

export interface LazyRigDetector {
  /** The rig detected earlier in this session for this item and cutout, if any. */
  peek(item: Pick<Item, 'id' | 'images'>): GarmentRig | undefined;
  /** Detect (once per item and cutout) and queue the result for saving. */
  ensure(item: Item, cutoutUri: string): Promise<GarmentRig | undefined>;
  /** Write queued rigs now instead of waiting for the debounce. */
  flush(): void;
}

interface DetectorOptions {
  pixels: PixelReader;
  /** Persist a detected rig on the item (the closet store's `updateItem`). */
  save: (itemId: ID, rig: GarmentRig) => void;
  /** Quiet time before queued rigs are saved, so one screen of items makes one burst of writes. */
  debounceMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/**
 * Lazy rig detection for items that have none (added before fitting existed, or re-tagged). Each
 * item and cutout is tried at most once per session, so a cutout the detector cannot read does not
 * cost a pixel read on every render. Results are kept in memory (so items that are not in the
 * store, like the dev page's fixtures, still fit) and written to the store after a short pause.
 */
export function createLazyRigDetector(options: DetectorOptions): LazyRigDetector {
  const { pixels, save, debounceMs = 400 } = options;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const found = new Map<string, GarmentRig>();
  const tried = new Map<string, Promise<GarmentRig | undefined>>();
  const queued = new Map<ID, GarmentRig>();
  let timer: unknown;

  const keyOf = (item: Pick<Item, 'id' | 'images'>) => `${item.id}|${item.images.cutoutId}`;
  const flush = (): void => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    const batch = [...queued];
    queued.clear();
    for (const [id, rig] of batch) save(id, rig);
  };

  return {
    peek: (item) => found.get(keyOf(item)),
    ensure(item, cutoutUri) {
      const key = keyOf(item);
      const existing = tried.get(key);
      if (existing) return existing;
      const p = detectItemRig(pixels, item, cutoutUri).then((rig) => {
        if (rig) {
          found.set(key, rig);
          queued.set(item.id, rig);
          if (timer !== undefined) clearTimer(timer);
          timer = setTimer(flush, debounceMs);
        }
        return rig;
      });
      tried.set(key, p);
      return p;
    },
    flush,
  };
}
