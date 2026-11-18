import type { BackupProblem, MergeStats } from '@/core/backup';

/** Wording for why a backup file was refused; nothing was changed in any of these cases. */
export function describeProblems(problems: BackupProblem[]): string {
  const first = problems[0]?.code;
  switch (first) {
    case 'not_json':
      return 'That file is not a Fashionable backup (it is not valid JSON).';
    case 'not_an_object':
    case 'wrong_format':
      return 'That file is not a Fashionable backup.';
    case 'newer_version':
    case 'newer_schema':
      return 'This backup was made by a newer version of Fashionable. Update the app and try again.';
    case 'unsupported_version':
      return 'This backup uses a file version this app does not understand.';
    default:
      return `The backup file is damaged (${problems.length} ${
        problems.length === 1 ? 'problem' : 'problems'
      } found).`;
  }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function line(label: string, added: number, updated: number): string | undefined {
  if (added === 0 && updated === 0) return undefined;
  const parts = [
    added > 0 ? `${added} added` : undefined,
    updated > 0 ? `${updated} updated` : undefined,
  ].filter((p): p is string => p !== undefined);
  return `${label}: ${parts.join(', ')}`;
}

/** One line per collection that changed; a single line when nothing did. */
export function summarizeImport(stats: MergeStats): string[] {
  const lines = [
    line('Items', stats.items.added, stats.items.updated),
    line('Outfits', stats.outfits.added, stats.outfits.updated),
    line('Wear history', stats.wearLogs.added, stats.wearLogs.updated),
    line('Feedback', stats.feedback.added, stats.feedback.updated),
  ].filter((l): l is string => l !== undefined);
  return lines.length > 0
    ? lines
    : ['Nothing new: your closet already had everything in this file.'];
}

export function describeExport(counts: { items: number; images: number }, missing: number): string {
  const base = `${plural(counts.items, 'item', 'items')} and ${plural(counts.images, 'image', 'images')} saved.`;
  return missing > 0
    ? `${base} ${plural(missing, 'image was', 'images were')} missing and left out.`
    : base;
}

const DAY_MS = 86_400_000;

/** `true` when there is something to protect and no backup in the last 30 days. */
export function isBackupDue(
  lastBackupAt: string | undefined,
  itemCount: number,
  now: Date,
): boolean {
  if (itemCount === 0) return false;
  if (!lastBackupAt) return true;
  return now.getTime() - Date.parse(lastBackupAt) > 30 * DAY_MS;
}

export function formatBackupDate(iso: string | undefined, locale?: string): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
