import type { Entity, ID } from '@/core/model/types';

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

export interface CutoutResult {
  /** Displayable URI of the PNG cutout (an object URL on web, a file URI on native). */
  uri: string;
  /** True when the PNG has a transparent background. */
  hasAlpha: boolean;
  /** Pixel size of the cutout after trimming to the garment. */
  width: number;
  height: number;
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
