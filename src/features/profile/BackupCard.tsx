import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { colors, spacing, typography } from '@/ui/theme';
import { formatBackupDate, isBackupDue } from './messages';
import type { BackupNotice, BackupPhase } from './useBackup';

interface BackupCardProps {
  phase: BackupPhase;
  notice: BackupNotice | null;
  lastBackupAt: string | undefined;
  itemCount: number;
  now: Date;
  onExport: () => void;
  onImport: () => void;
}

export function BackupCard({
  phase,
  notice,
  lastBackupAt,
  itemCount,
  now,
  onExport,
  onImport,
}: BackupCardProps) {
  const busy = phase !== 'idle';
  const due = isBackupDue(lastBackupAt, itemCount, now);
  return (
    <Card testID="profile-backup-card">
      <Text accessibilityRole="header" style={styles.heading}>
        Backup
      </Text>
      <Text style={styles.body}>
        Your closet lives only in this browser. Clearing site data or switching phones loses it, so
        export a backup file about once a month and keep it somewhere safe.
      </Text>
      <Text style={styles.body} testID="profile-last-exported">
        Last exported: {formatBackupDate(lastBackupAt)}
      </Text>
      {due ? (
        <Text style={styles.due} testID="profile-backup-due">
          {lastBackupAt ? 'It has been over a month since your last backup.' : 'No backup yet.'}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Export backup"
          icon="download-outline"
          onPress={onExport}
          loading={phase === 'exporting'}
          disabled={busy}
          testID="profile-export-button"
        />
        <Button
          label="Import backup"
          icon="push-outline"
          variant="secondary"
          onPress={onImport}
          loading={phase === 'importing'}
          disabled={busy}
          testID="profile-import-button"
        />
      </View>
      {notice ? (
        <View
          style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]}
          accessibilityRole="alert"
          testID={`profile-backup-${notice.kind}`}
        >
          <Text style={styles.noticeTitle}>
            {notice.kind === 'error' ? 'Error: ' : 'Done: '}
            {notice.title}
          </Text>
          {notice.lines.map((line) => (
            <Text key={line} style={styles.noticeLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
  due: { ...typography.label, color: colors.warning },
  actions: { gap: spacing.sm },
  notice: { borderRadius: spacing.sm, padding: spacing.md, gap: spacing.xs, borderWidth: 1 },
  noticeOk: { borderColor: colors.success, backgroundColor: colors.surfaceAlt },
  noticeError: { borderColor: colors.danger, backgroundColor: colors.surfaceAlt },
  noticeTitle: { ...typography.label, color: colors.text },
  noticeLine: { ...typography.body, color: colors.text },
});
