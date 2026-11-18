import {
  validateFeedback,
  validateItem,
  validateOutfit,
  validateProfile,
  validateWearLog,
  type ValidationResult,
} from '@/core/model/validate';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
  type BackupImages,
  type BackupProblem,
  type ParseResult,
  type RecordCollection,
} from './types';

export interface ParseOptions {
  /** Record schema version this build writes; files with a higher one are rejected. */
  schemaVersion: number;
  /**
   * Upgrades one collection from an older schema version. Without it, older files are accepted
   * as they are (valid while only one schema exists).
   */
  migrate?: (collection: RecordCollection, records: unknown[], fromVersion: number) => unknown[];
  /** Stop collecting after this many problems. */
  maxProblems?: number;
}

export interface ParsedBackup {
  exportedAt: string;
  schemaVersion: number;
  data: BackupData;
  images: BackupImages;
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const MIME_RE = /^[a-z]+\/[a-z0-9.+-]+$/i;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

interface CollectionSpec {
  key: 'items' | 'outfits' | 'wearLogs' | 'feedback';
  /** Validates one record and, when valid, stores it in `data`. */
  take: (record: unknown, data: BackupData) => { id: string } | undefined;
}

function spec<K extends CollectionSpec['key']>(
  key: K,
  validate: (v: unknown) => ValidationResult<BackupData[K][number]>,
): CollectionSpec {
  return {
    key,
    take(record, data) {
      const res = validate(record);
      if (!res.ok) return undefined;
      (data[key] as BackupData[K][number][]).push(res.value);
      return res.value;
    },
  };
}

const COLLECTIONS: readonly CollectionSpec[] = [
  spec('items', validateItem),
  spec('outfits', validateOutfit),
  spec('wearLogs', validateWearLog),
  spec('feedback', validateFeedback),
];

/**
 * Validates a backup (JSON text or an already parsed value) and returns the records and images.
 * Never throws. A single bad record rejects the whole file: a half-restored closet is worse than
 * a clear error. Problems carry codes and paths only; the UI words them.
 */
export function parseBackup(input: unknown, options: ParseOptions): ParseResult<ParsedBackup> {
  const max = options.maxProblems ?? 50;
  const problems: BackupProblem[] = [];
  const add = (path: string, code: BackupProblem['code']) => {
    if (problems.length < max) problems.push({ path, code });
  };
  const fail = (): ParseResult<ParsedBackup> => ({ ok: false, problems });

  let doc = input;
  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input);
    } catch {
      add('', 'not_json');
      return fail();
    }
  }
  if (!isRec(doc)) {
    add('', 'not_an_object');
    return fail();
  }
  if (doc.format !== BACKUP_FORMAT) {
    add('format', 'wrong_format');
    return fail();
  }
  if (typeof doc.version !== 'number' || !Number.isInteger(doc.version) || doc.version < 1) {
    add('version', doc.version === undefined ? 'missing' : 'unsupported_version');
    return fail();
  }
  if (doc.version > BACKUP_VERSION) {
    add('version', 'newer_version');
    return fail();
  }
  const app = doc.app;
  const fileSchema = isRec(app) ? app.schemaVersion : undefined;
  if (typeof fileSchema !== 'number' || !Number.isInteger(fileSchema) || fileSchema < 0) {
    add('app.schemaVersion', fileSchema === undefined ? 'missing' : 'wrong_type');
    return fail();
  }
  if (fileSchema > options.schemaVersion) {
    add('app.schemaVersion', 'newer_schema');
    return fail();
  }
  if (typeof doc.exportedAt !== 'string' || Number.isNaN(Date.parse(doc.exportedAt))) {
    add('exportedAt', doc.exportedAt === undefined ? 'missing' : 'wrong_type');
    return fail();
  }

  const upgrade = (key: RecordCollection, records: unknown[]): unknown[] => {
    if (!options.migrate || fileSchema === options.schemaVersion) return records;
    try {
      return options.migrate(key, records, fileSchema);
    } catch {
      add(key, 'migration_failed');
      return [];
    }
  };

  const data: BackupData = {
    profile: undefined,
    items: [],
    outfits: [],
    wearLogs: [],
    feedback: [],
  };

  for (const { key, take } of COLLECTIONS) {
    const raw = doc[key];
    if (raw === undefined) {
      add(key, 'missing');
      continue;
    }
    if (!Array.isArray(raw)) {
      add(key, 'wrong_type');
      continue;
    }
    const seen = new Set<string>();
    upgrade(key, raw).forEach((rec, i) => {
      const taken = take(rec, data);
      if (!taken) {
        add(`${key}.${i}`, 'invalid_record');
        return;
      }
      if (seen.has(taken.id)) add(`${key}.${i}.id`, 'duplicate_id');
      seen.add(taken.id);
    });
  }

  if (doc.profile === undefined) add('profile', 'missing');
  else if (doc.profile !== null) {
    const [migrated] = upgrade('profile', [doc.profile]);
    const res = validateProfile(migrated);
    if (res.ok) data.profile = res.value;
    else add('profile', 'invalid_record');
  }

  const images: BackupImages = {};
  if (doc.images === undefined) add('images', 'missing');
  else if (!isRec(doc.images)) add('images', 'wrong_type');
  else {
    for (const [id, img] of Object.entries(doc.images)) {
      if (
        id.length === 0 ||
        !isRec(img) ||
        typeof img.mime !== 'string' ||
        !MIME_RE.test(img.mime) ||
        typeof img.base64 !== 'string' ||
        img.base64.length % 4 !== 0 ||
        !BASE64_RE.test(img.base64)
      ) {
        add(`images.${id}`, 'invalid_image');
        continue;
      }
      images[id] = { mime: img.mime, base64: img.base64 };
    }
  }

  if (problems.length > 0) return fail();
  return {
    ok: true,
    value: { exportedAt: doc.exportedAt, schemaVersion: fileSchema, data, images },
  };
}
