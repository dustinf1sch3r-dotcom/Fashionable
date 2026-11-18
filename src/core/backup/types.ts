import type { Feedback, ID, Item, ISODateTime, Outfit, Profile, WearLog } from '@/core/model/types';

export const BACKUP_FORMAT = 'fashionable-backup';
/** Version of the file layout itself (not of the record schema). */
export const BACKUP_VERSION = 1;

export type BackupMode = 'replace' | 'merge';

/** Every record collection in a backup, soft-deleted records included. */
export interface BackupData {
  /** At most one profile; `undefined` when the closet never had one. */
  profile: Profile | undefined;
  items: Item[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  feedback: Feedback[];
}

export interface BackupImage {
  mime: string;
  /** Standard base64 (RFC 4648), no data-URL prefix. */
  base64: string;
}

export type BackupImages = Record<ID, BackupImage>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: ISODateTime;
  app: { schemaVersion: number };
  profile: Profile | null;
  items: Item[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  feedback: Feedback[];
  images: BackupImages;
}

export type RecordCollection = 'items' | 'outfits' | 'wearLogs' | 'feedback' | 'profile';

export type BackupProblemCode =
  | 'not_json'
  | 'not_an_object'
  | 'wrong_format'
  | 'unsupported_version'
  | 'newer_version'
  | 'newer_schema'
  | 'migration_failed'
  | 'missing'
  | 'wrong_type'
  | 'invalid_record'
  | 'duplicate_id'
  | 'invalid_image';

export interface BackupProblem {
  /** Dotted location, e.g. `items.3.colors.0.hex` or `images.<id>.base64`. */
  path: string;
  code: BackupProblemCode;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; problems: BackupProblem[] };

/** Per-collection outcome of a merge. */
export interface CollectionStats {
  /** Incoming records whose id did not exist before. */
  added: number;
  /** Incoming records that replaced an older existing record. */
  updated: number;
  /** Incoming records ignored because the existing one was newer or identical. */
  skipped: number;
}

export type MergeStats = Record<RecordCollection, CollectionStats>;

export interface MergeResult {
  data: BackupData;
  stats: MergeStats;
}
