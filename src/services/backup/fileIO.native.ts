import { BackupError } from './errors';

import type { PickedFile } from './fileIO';

export type { PickedFile } from './fileIO';

// Native share sheet / document picker arrives with the store builds; until then say so plainly.

export async function saveBlob(_filename: string, _blob: Blob): Promise<void> {
  throw new BackupError('unsupported', 'Backup export is not supported on this platform yet');
}

export async function pickFile(_accept: string): Promise<PickedFile | null> {
  throw new BackupError('unsupported', 'Backup import is not supported on this platform yet');
}
