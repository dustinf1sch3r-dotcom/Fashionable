import { useCallback, useState } from 'react';
import type { BackupMode } from '@/core/backup';
import {
  BackupError,
  chooseBackupFile,
  downloadBackup,
  restoreBackup,
  type PickedFile,
} from '@/services/backup';
import { flushAll, getStores, hydrateAll } from '@/state';
import { describeExport, describeProblems, summarizeImport } from './messages';

export type BackupPhase = 'idle' | 'exporting' | 'importing';

export interface BackupNotice {
  kind: 'success' | 'error';
  title: string;
  lines: string[];
}

const failure = (error: unknown): BackupNotice => {
  if (error instanceof BackupError && error.code === 'unsupported') {
    return { kind: 'error', title: 'Not available here yet', lines: [error.message] };
  }
  if (error instanceof BackupError && error.code === 'file_unreadable') {
    return { kind: 'error', title: 'Could not read that file', lines: ['Nothing was changed.'] };
  }
  return {
    kind: 'error',
    title: 'Something went wrong',
    lines: [error instanceof Error ? error.message : String(error)],
  };
};

export function useBackup() {
  const [phase, setPhase] = useState<BackupPhase>('idle');
  const [notice, setNotice] = useState<BackupNotice | null>(null);
  const [pending, setPending] = useState<PickedFile | null>(null);

  const exportNow = useCallback(async () => {
    setPhase('exporting');
    setNotice(null);
    try {
      await flushAll(); // queued edits must be on disk before they are read back
      const result = await downloadBackup();
      getStores().profile.getState().update({ lastBackupAt: result.exportedAt });
      setNotice({
        kind: 'success',
        title: `Saved ${result.filename}`,
        lines: [describeExport(result.counts, result.missingImages.length)],
      });
    } catch (error) {
      setNotice(failure(error));
    } finally {
      setPhase('idle');
    }
  }, []);

  /** Step 1: let the user choose a file. Step 2 (`confirmImport`) asks Replace or Merge. */
  const chooseFile = useCallback(async () => {
    setNotice(null);
    try {
      setPending(await chooseBackupFile());
    } catch (error) {
      setNotice(failure(error));
    }
  }, []);

  const cancelImport = useCallback(() => setPending(null), []);

  const confirmImport = useCallback(
    async (mode: BackupMode) => {
      const file = pending;
      if (!file) return;
      setPending(null);
      setPhase('importing');
      try {
        await flushAll();
        const result = await restoreBackup(file, mode);
        if (!result.ok) {
          setNotice({
            kind: 'error',
            title: 'Import failed. Nothing was changed.',
            lines: [describeProblems(result.problems)],
          });
          return;
        }
        await hydrateAll();
        setNotice({
          kind: 'success',
          title:
            mode === 'replace' ? 'Closet replaced from backup' : 'Backup merged into your closet',
          lines: summarizeImport(result.stats),
        });
      } catch (error) {
        setNotice(failure(error));
      } finally {
        setPhase('idle');
      }
    },
    [pending],
  );

  return { phase, notice, pending, exportNow, chooseFile, cancelImport, confirmImport };
}
