import type { CutoutCrop, Entity, ID, ISODate, Weather } from '@/core/model/types';
import type { FitMesh } from '@/core/fit';
import type { PixelRect, PoseKeypoint } from '@/core/tryon/pose';
import type { GeocodeResult } from '@/core/weather';

export type { Clock, IdGenerator } from '@/core/model/ports';

/** Typed collection of entities. Implementations must serialise their own writes. */
export interface Repository<T extends Entity> {
  /** All records that are not soft-deleted. */
  list(): Promise<T[]>;
  /** A single non-deleted record, or `undefined`. */
  get(id: ID): Promise<T | undefined>;
  /** Insert or replace. The caller sets `updatedAt`. */
  put(entity: T): Promise<void>;
  /** Every record including soft-deleted ones (backup and sync need the tombstones). */
  listAll(): Promise<T[]>;
  /** Replace the whole collection with `records` (as given, tombstones included). */
  replaceAll(records: T[]): Promise<void>;
  /** Soft delete: sets `deletedAt` and `updatedAt`. No-op for unknown ids. */
  remove(id: ID): Promise<void>;
}

export interface ImageStore {
  save(source: { uri: string } | Blob, opts?: { id?: ID }): Promise<ID>;
  /** Displayable URI (object URL on web, file URI on native). Rejects for unknown ids. */
  uri(id: ID): Promise<string>;
  /** The stored bytes. Rejects for unknown ids. */
  read(id: ID): Promise<Blob>;
  /** Deleting an unknown id is not an error. */
  remove(id: ID): Promise<void>;
}

/** Minimal async string store that repositories are built on (AsyncStorage-shaped). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PixelData {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes per pixel. */
  rgba: Uint8ClampedArray;
}

/** Reads pixels for colour extraction and alpha trimming. */
export interface PixelReader {
  /**
   * Decode `imageUri` scaled so its longest side is at most `maxSize`. Resolves `undefined` when
   * this platform cannot read pixels (callers fall back to manual input); rejects when the image
   * cannot be decoded.
   */
  read(imageUri: string, maxSize: number): Promise<PixelData | undefined>;
}

/**
 * An in-progress touch-up of a cutout (web only for now). It paints into the canvas it was opened
 * with. Coordinates are photo pixels, see `width` / `height`.
 */
export interface TouchupSession {
  /** Photo size in pixels; also the size of the canvas it draws into. */
  readonly width: number;
  readonly height: number;
  /** False when the cutout could not be lined up with the photo: erasing works, restoring not. */
  readonly canRestore: boolean;
  /** Starts a stroke; everything until `endStroke` is one undo step. */
  beginStroke(mode: 'erase' | 'restore'): void;
  /** Continues the stroke to a new pointer position, stamping along the way. */
  strokeTo(x: number, y: number, radius: number): void;
  /** Ends the stroke; resolves to the number of undo steps now available. */
  endStroke(): number;
  /** Undoes the last stroke; resolves to the number of steps left. */
  undo(): number;
  /** Shows the photo faintly through the erased parts (helps when restoring). */
  setGhost(on: boolean): void;
  /** Trims, scales and encodes the result; `undefined` when nothing visible is left. */
  finish(): Promise<TouchupResult | undefined>;
  dispose(): void;
}

export interface TouchupImage {
  /** Displayable URI (object URL on web). */
  uri: string;
  width: number;
  height: number;
}

/** The touched-up cutout (PNG, trimmed to the garment) and its thumbnail (PNG). */
export interface TouchupResult {
  image: TouchupImage;
  thumb: TouchupImage;
  /** Where the new cutout sits in the original photo; absent when the session had no photo space. */
  crop?: CutoutCrop;
}

export interface TouchupOpener {
  /** False where no touch-up editor exists yet (native); the buttons are then hidden. */
  readonly available: boolean;
  /**
   * Loads the photo and the current cutout (`undefined`: start with the whole photo kept) and
   * draws them into `canvas`. Rejects when an image cannot be decoded.
   */
  open(source: {
    originalUri: string;
    cutoutUri?: string;
    /** Where the cutout sits in the original (`Item.cutout.crop`); skips the colour search. */
    crop?: CutoutCrop;
    canvas: HTMLCanvasElement;
  }): Promise<TouchupSession>;
}

export interface CutoutResult {
  /** Displayable URI of the PNG cutout (an object URL on web, a file URI on native). */
  uri: string;
  /** True when the PNG has a transparent background. */
  hasAlpha: boolean;
  /** Pixel size of the cutout after trimming to the garment. */
  width: number;
  height: number;
  /** Rectangle of the photo `remove` was given that the cutout covers, when the remover knows. */
  crop?: CutoutCrop;
  /** Which method made the mask: the model (`u2net`) or plain-background keying (`key`). */
  method?: 'u2net' | 'key';
  /** Quality score 0..1 of the chosen mask (`scoreCutout`, src/core/image/key.ts). */
  score?: number;
}

/**
 * Thrown by `remove` when no method produced a usable mask: the photo's background could not be
 * separated. Callers keep the original photo and suggest a plainer background or a touch-up.
 */
export class CutoutRejectedError extends Error {
  /** Best score reached, when a mask was scored at all. */
  readonly score: number | undefined;
  constructor(score?: number) {
    super("Couldn't separate the background");
    this.name = 'CutoutRejectedError';
    this.score = score;
  }
}

/** Removes the background of a garment photo (docs/TRY_ON.md §7). */
export interface BackgroundRemover {
  /** False when this platform has no remover; callers keep the original photo. */
  readonly available: boolean;
  /**
   * Downloads and warms the model so the first `remove` is quick. `onProgress` gets 0..1.
   * Safe to call repeatedly; rejects when the model cannot be loaded.
   */
  prepare(onProgress?: (fraction: number) => void): Promise<void>;
  /**
   * Cuts out the garment and trims to it. Calls `prepare` if needed. Rejects when removal fails or
   * finds no garment; callers then fall back to the original with `hasAlpha: false`.
   */
  remove(imageUri: string, onProgress?: (fraction: number) => void): Promise<CutoutResult>;
}

export type { GeocodeResult };

/** Daily weather and place search (docs/ARCHITECTURE.md "Weather"). Never rejects. */
export interface WeatherProvider {
  /**
   * Forecast for `date` (device-local `YYYY-MM-DD`, within the next ~14 days) at the location, from
   * the cache when fresh. `undefined` when offline, timed out, refused or out of range.
   */
  forecast(lat: number, lon: number, date: ISODate): Promise<Weather | undefined>;
  /** Places matching a typed name, best first. `[]` when nothing matches or on any failure. */
  geocode(query: string): Promise<GeocodeResult[]>;
}

export type PositionResult =
  | { status: 'ok'; lat: number; lon: number }
  /** The user refused permission. */
  | { status: 'denied' }
  /** No position could be had (no GPS, timeout, unsupported). */
  | { status: 'unavailable' };

/** The device's current position. Never rejects. */
export interface LocationService {
  getCurrentPosition(): Promise<PositionResult>;
}

/** Raw pose detection on a photo (docs/TRY_ON.md §11.1). Web: MediaPipe; native: later. */
export interface PoseDetector {
  readonly available: boolean;
  /** Download / warm up the model; progress 0–1. Safe to call repeatedly. */
  prepare(onProgress?: (fraction: number) => void): Promise<void>;
  /** Keypoints for the most prominent person, or `undefined` when nobody is found. */
  detect(
    imageUri: string,
  ): Promise<{ keypoints: PoseKeypoint[]; width: number; height: number } | undefined>;
}

/** Crops a photo to a window (may extend past the edges; filled with `fill`) and scales it. */
export interface BodyPhotoCropper {
  readonly available: boolean;
  crop(
    imageUri: string,
    window: PixelRect,
    output: { width: number; height: number; fill: string },
  ): Promise<{ uri: string; blob: Blob }>;
}

/** Draws a garment cutout warped by a fit mesh (docs/TRY_ON.md §12.5). */
export interface GarmentWarper {
  readonly available: boolean;
  /**
   * Render `cutoutUri` through `mesh` at `pixelsPerUnit` (mannequin units → output pixels).
   * Returns an image covering `mesh.bounds`.
   */
  render(
    cutoutUri: string,
    mesh: FitMesh,
    pixelsPerUnit: number,
  ): Promise<{ uri: string; bounds: FitMesh['bounds'] }>;
  /** Frees the resource behind a URI `render` returned (an object URL on web). Optional. */
  release?(uri: string): void;
}

/** Draws one merged outfit image (docs/TRY_ON.md §13.2). */
export interface OutfitCompositor {
  readonly available: boolean;
  /**
   * Merge the garment images (already positioned in mannequin units, bottom to top) into the
   * backdrop. The output covers the whole 1000 × 2000 mannequin canvas at `pixelsPerUnit`.
   */
  compose(input: {
    backdropUri: string;
    kind: 'photo' | 'silhouette';
    layers: readonly {
      uri: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }[];
    pixelsPerUnit: number;
    seed: number;
  }): Promise<{ uri: string }>;
  /** Release an image returned by `compose`. */
  release?(uri: string): void;
}
