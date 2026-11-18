import type { Entity } from '@/core/model/types';
import type {
  BackupData,
  BackupMode,
  CollectionStats,
  MergeResult,
  RecordCollection,
} from './types';

const empty = (): CollectionStats => ({ added: 0, updated: 0, skipped: 0 });

/** ISO timestamps with the same format compare chronologically; parse to be safe with offsets. */
const time = (e: Entity): number => Date.parse(e.updatedAt);

function mergeList<T extends Entity>(
  existing: T[],
  incoming: T[],
  mode: BackupMode,
): { records: T[]; stats: CollectionStats } {
  const stats = empty();
  const current = new Map(existing.map((e) => [e.id, e]));
  const out = new Map<string, T>(mode === 'merge' ? current : []);
  for (const rec of incoming) {
    const old = current.get(rec.id);
    if (!old) {
      stats.added++;
      out.set(rec.id, rec);
    } else if (mode === 'replace' || time(rec) > time(old)) {
      stats.updated++;
      out.set(rec.id, rec);
    } else {
      stats.skipped++;
    }
  }
  return { records: [...out.values()], stats };
}

/**
 * Combines the stored data with a backup.
 * - `replace`: the result is the incoming data only.
 * - `merge`: union by id; when both sides have a record the newer `updatedAt` wins and a tie keeps
 *   the existing one. Soft-deleted records take part like any other, so a newer deletion wins.
 * The profile is a singleton: merge keeps whichever profile was updated last (and never both).
 */
export function mergeBackup(
  existing: BackupData,
  incoming: BackupData,
  mode: BackupMode,
): MergeResult {
  const items = mergeList(existing.items, incoming.items, mode);
  const outfits = mergeList(existing.outfits, incoming.outfits, mode);
  const wearLogs = mergeList(existing.wearLogs, incoming.wearLogs, mode);
  const feedback = mergeList(existing.feedback, incoming.feedback, mode);

  const profileStats = empty();
  let profile = existing.profile;
  const inc = incoming.profile;
  if (mode === 'replace') {
    profile = inc;
    if (inc) {
      if (existing.profile) profileStats.updated++;
      else profileStats.added++;
    }
  } else if (inc) {
    if (!existing.profile) {
      profile = inc;
      profileStats.added++;
    } else if (time(inc) > time(existing.profile)) {
      profile = inc;
      profileStats.updated++;
    } else {
      profileStats.skipped++;
    }
  }

  const stats: Record<RecordCollection, CollectionStats> = {
    items: items.stats,
    outfits: outfits.stats,
    wearLogs: wearLogs.stats,
    feedback: feedback.stats,
    profile: profileStats,
  };
  return {
    data: {
      profile,
      items: items.records,
      outfits: outfits.records,
      wearLogs: wearLogs.records,
      feedback: feedback.records,
    },
    stats,
  };
}
