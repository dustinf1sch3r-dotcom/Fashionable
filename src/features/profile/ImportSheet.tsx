import { StyleSheet, Text } from 'react-native';
import type { BackupMode } from '@/core/backup';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { colors, typography } from '@/ui/theme';

interface ImportSheetProps {
  fileName: string | null;
  onChoose: (mode: BackupMode) => void;
  onClose: () => void;
}

export function ImportSheet({ fileName, onChoose, onClose }: ImportSheetProps) {
  return (
    <Sheet
      visible={fileName !== null}
      onClose={onClose}
      title="Import backup"
      testID="import-sheet"
    >
      <Text style={styles.body} testID="import-sheet-file">
        {fileName}
      </Text>
      <Text style={styles.body}>
        Merge adds what is missing and keeps whichever copy was edited last. Replace removes
        everything in this browser first and cannot be undone.
      </Text>
      <Button
        label="Merge with my closet"
        onPress={() => onChoose('merge')}
        testID="import-merge"
      />
      <Button
        label="Replace my closet"
        variant="danger"
        onPress={() => onChoose('replace')}
        testID="import-replace"
      />
      <Button label="Cancel" variant="ghost" onPress={onClose} testID="import-cancel" />
    </Sheet>
  );
}

const styles = StyleSheet.create({ body: { ...typography.body, color: colors.textMuted } });
