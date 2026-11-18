import type { ISODateTime } from '@/core/model/types';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
  type BackupFile,
  type BackupImages,
} from './types';

/** Assembles the backup document. Pure: the caller supplies the time and the schema version. */
export function buildBackup(
  data: BackupData,
  images: BackupImages,
  exportedAt: ISODateTime,
  schemaVersion: number,
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    app: { schemaVersion },
    profile: data.profile ?? null,
    items: data.items,
    outfits: data.outfits,
    wearLogs: data.wearLogs,
    feedback: data.feedback,
    images,
  };
}

/** Image ids the records point at (soft-deleted records included). */
export function referencedImageIds(data: BackupData): string[] {
  const ids = new Set<string>();
  for (const item of data.items) {
    ids.add(item.images.originalId);
    ids.add(item.images.cutoutId);
    ids.add(item.images.thumbId);
  }
  if (data.profile?.bodyPhoto) ids.add(data.profile.bodyPhoto.imageId);
  return [...ids];
}
