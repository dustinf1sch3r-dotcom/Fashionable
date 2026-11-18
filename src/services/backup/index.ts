import { getServices } from '../index';
import type { BackupMode } from '@/core/backup';
import { exportBackup, importBackup } from './backupService';
import type { ExportResult, ImportResult } from './backupService';
import { saveBlob, pickFile } from './fileIO';
import type { PickedFile } from './fileIO';

import { BackupError } from './errors';

export { BackupError } from './errors';
export type { BackupErrorCode } from './errors';
export { backupFilename } from './backupService';
export type { BackupServices, ExportResult, ImportResult } from './backupService';
export type { PickedFile } from './fileIO';

/** Builds the backup from the real services and hands it to the browser as a download. */
export async function downloadBackup(): Promise<ExportResult> {
  const result = await exportBackup(getServices());
  await saveBlob(result.filename, result.blob);
  return result;
}

/** Opens the file picker; `null` when cancelled. */
export function chooseBackupFile(): Promise<PickedFile | null> {
  return pickFile('application/json,.json');
}

/** Reads the chosen file and applies it to the real services. */
export async function restoreBackup(file: PickedFile, mode: BackupMode): Promise<ImportResult> {
  let text: string;
  try {
    text = await file.text();
  } catch (error) {
    throw new BackupError('file_unreadable', error instanceof Error ? error.message : 'unreadable');
  }
  return importBackup(text, mode, getServices());
}

export { exportBackup, importBackup };
