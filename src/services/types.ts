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
  /** Soft delete: sets `deletedAt` and `updatedAt`. No-op for unknown ids. */
  remove(id: ID): Promise<void>;
}

export interface ImageStore {
  save(source: { uri: string } | Blob, opts?: { id?: ID }): Promise<ID>;
  /** Displayable URI (object URL on web, file URI on native). Rejects for unknown ids. */
  uri(id: ID): Promise<string>;
  /** Deleting an unknown id is not an error. */
  remove(id: ID): Promise<void>;
}

/** Minimal async string store that repositories are built on (AsyncStorage-shaped). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
