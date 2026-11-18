export type BackupErrorCode = 'unsupported' | 'file_unreadable';

/** Backup failures the UI can word; `code` is stable, `message` is for logs. */
export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}
