import { BackupError } from './errors';

/** A file the user chose; read it lazily because backups can be large. */
export interface PickedFile {
  name: string;
  size: number;
  text(): Promise<string>;
}

/**
 * Platform dispatch: Metro/Expo resolve `./fileIO` to `fileIO.web.ts` or `fileIO.native.ts`
 * first. This file is the fallback for environments with neither (plain Node).
 */
export async function saveBlob(_filename: string, _blob: Blob): Promise<void> {
  throw new BackupError('unsupported', 'File export is not available on this platform');
}

/** Opens the system file picker. Resolves `null` when the user cancels. */
export async function pickFile(_accept: string): Promise<PickedFile | null> {
  throw new BackupError('unsupported', 'File import is not available on this platform');
}
