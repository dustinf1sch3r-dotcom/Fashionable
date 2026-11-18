/** Version written by this build. Bump together with a new entry in `migrations`. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface StoredCollection {
  schemaVersion: number;
  records: unknown[];
}

/** Upgrades the records of one collection from `from` to `from + 1`. */
export interface Migration {
  from: number;
  up(records: unknown[]): unknown[];
}

/**
 * Registry of migrations per collection name. Version 0 is the bare-array layout that preceded the
 * `{ schemaVersion, records }` wrapper; the 0 → 1 step is therefore the identity on the records.
 * Example for a future change (do not remove old steps):
 * `items: [{ from: 1, up: (rs) => rs.map(addNewField) }]`.
 */
export const migrations: Record<string, Migration[] | undefined> = {};

export class MigrationError extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Accepts a v1+ wrapper or a legacy bare array (version 0). Throws `MigrationError` otherwise. */
export function readStored(stored: unknown): StoredCollection {
  if (Array.isArray(stored)) return { schemaVersion: 0, records: stored };
  if (
    isRecord(stored) &&
    typeof stored.schemaVersion === 'number' &&
    Number.isInteger(stored.schemaVersion) &&
    Array.isArray(stored.records)
  ) {
    return { schemaVersion: stored.schemaVersion, records: stored.records };
  }
  throw new MigrationError('Stored collection has an unrecognised shape');
}

/**
 * Brings stored data up to `target`, applying `registry[collection]` steps in order. Steps that
 * do not exist for a version are treated as identity. Data from a newer build is rejected rather
 * than guessed at.
 */
export function migrate(
  collection: string,
  stored: unknown,
  registry: Record<string, Migration[] | undefined> = migrations,
  target: number = CURRENT_SCHEMA_VERSION,
): StoredCollection {
  const { schemaVersion, records } = readStored(stored);
  if (schemaVersion > target) {
    throw new MigrationError(
      `Collection "${collection}" has schemaVersion ${schemaVersion}, newer than supported ${target}`,
    );
  }
  let current = records;
  for (let v = schemaVersion; v < target; v++) {
    const step = registry[collection]?.find((m) => m.from === v);
    if (step) current = step.up(current);
  }
  return { schemaVersion: target, records: current };
}
