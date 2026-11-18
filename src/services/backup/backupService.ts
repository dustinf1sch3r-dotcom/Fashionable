import {
  buildBackup,
  mergeBackup,
  parseBackup,
  referencedImageIds,
  type BackupData,
  type BackupMode,
  type BackupProblem,
  type MergeStats,
  type RecordCollection,
} from '@/core/backup';
import type { ID, ISODateTime } from '@/core/model/types';
import type { Services } from '../index';
import { CURRENT_SCHEMA_VERSION, migrate } from '../storage/migrations';
import { base64ByteLength, base64ToBytes, bytesToBase64, sniffImageMime } from './base64';

export type BackupServices = Pick<
  Services,
  'items' | 'outfits' | 'wearLogs' | 'feedback' | 'profile' | 'images' | 'clock'
>;

export interface ExportResult {
  blob: Blob;
  filename: string;
  exportedAt: ISODateTime;
  counts: { items: number; outfits: number; wearLogs: number; feedback: number; images: number };
  /** Referenced images the store could not provide; the backup is written without them. */
  missingImages: ID[];
}

export type ImportResult =
  | {
      ok: true;
      stats: MergeStats;
      images: { written: number; skipped: number };
      exportedAt: string;
    }
  | { ok: false; problems: BackupProblem[] };

/** `fashionable-backup-YYYY-MM-DD.json` using the UTC date of `at`. */
export function backupFilename(at: Date): string {
  return `fashionable-backup-${at.toISOString().slice(0, 10)}.json`;
}

async function readAll(s: BackupServices): Promise<BackupData> {
  const [profiles, items, outfits, wearLogs, feedback] = await Promise.all([
    s.profile.listAll(),
    s.items.listAll(),
    s.outfits.listAll(),
    s.wearLogs.listAll(),
    s.feedback.listAll(),
  ]);
  // The profile is a singleton; if storage ever holds several, the latest one is the real one.
  const profile = [...profiles].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )[0];
  return { profile, items, outfits, wearLogs, feedback };
}

const enc = new TextEncoder();
const piece = (text: string): Blob => new Blob([enc.encode(text)]);

/**
 * Reads every record (soft-deleted ones too) and every referenced image into one JSON Blob.
 * Images are appended piece by piece so the JS heap never holds the whole file as one string.
 * Callers must flush pending store writes first.
 */
export async function exportBackup(services: BackupServices): Promise<ExportResult> {
  const now = services.clock.now();
  const exportedAt = now.toISOString();
  const data = await readAll(services);

  const entries: Blob[] = [];
  const missingImages: ID[] = [];
  for (const id of referencedImageIds(data)) {
    let bytes: Uint8Array<ArrayBuffer>;
    let type: string;
    try {
      const stored = await services.images.read(id);
      bytes = new Uint8Array(await stored.arrayBuffer());
      type = stored.type;
    } catch {
      missingImages.push(id);
      continue;
    }
    const mime = type && type.includes('/') ? type : sniffImageMime(bytes);
    const head = `${entries.length > 0 ? ',' : ''}${JSON.stringify(id)}:{"mime":${JSON.stringify(mime)},"base64":"`;
    entries.push(piece(head), piece(bytesToBase64(bytes)), piece('"}'));
  }

  // `images` is the last key of the document, so the document with no images ends in `"images":{}}`.
  const skeleton = JSON.stringify(buildBackup(data, {}, exportedAt, CURRENT_SCHEMA_VERSION));
  const suffix = '{}}';
  if (!skeleton.endsWith(suffix)) throw new Error('Backup layout changed: images must come last');
  const blob = new Blob([piece(skeleton.slice(0, -suffix.length) + '{'), ...entries, piece('}}')], {
    type: 'application/json',
  });
  return {
    blob,
    filename: backupFilename(now),
    exportedAt,
    counts: {
      items: data.items.length,
      outfits: data.outfits.length,
      wearLogs: data.wearLogs.length,
      feedback: data.feedback.length,
      images: entries.length / 3,
    },
    missingImages,
  };
}

/**
 * Validates `text` and writes it into storage, replacing or merging with what is there. Nothing is
 * written when validation fails. Images go first so no record ever points at a missing image.
 * Callers must flush pending store writes before and re-hydrate the stores after.
 */
export async function importBackup(
  text: string,
  mode: BackupMode,
  services: BackupServices,
): Promise<ImportResult> {
  const parsed = parseBackup(text, {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migrate: (collection: RecordCollection, records, from) =>
      migrate(collection, { schemaVersion: from, records }).records,
  });
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  const { data: incoming, images, exportedAt } = parsed.value;

  const merged = mergeBackup(await readAll(services), incoming, mode);

  let written = 0;
  let skipped = 0;
  for (const [id, image] of Object.entries(images)) {
    const existing = await services.images.read(id).catch(() => undefined);
    if (existing && existing.size === base64ByteLength(image.base64)) {
      skipped++; // same bytes already stored; rewriting would invalidate displayed object URLs
      continue;
    }
    const blob = new Blob([base64ToBytes(image.base64)], { type: image.mime });
    await services.images.save(blob, { id });
    written++;
  }

  const { data } = merged;
  await services.items.replaceAll(data.items);
  await services.outfits.replaceAll(data.outfits);
  await services.wearLogs.replaceAll(data.wearLogs);
  await services.feedback.replaceAll(data.feedback);
  await services.profile.replaceAll(data.profile ? [data.profile] : []);

  return { ok: true, stats: merged.stats, images: { written, skipped }, exportedAt };
}
