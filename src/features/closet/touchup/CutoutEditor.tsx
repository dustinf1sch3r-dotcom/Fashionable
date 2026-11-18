import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { colors, spacing, typography } from '@/ui/theme';
import type { CutoutEditorProps } from './types';

/**
 * Native placeholder. The brush needs a drawing surface per platform; the web build has one
 * (`CutoutEditor.web.tsx`), native gets its own later. The entry buttons are hidden wherever
 * `services.touchup.available` is false, so this is only a safety net.
 */
export function CutoutEditor({ onCancel }: CutoutEditorProps) {
  return (
    <View style={styles.root} testID="touchup-editor">
      <Text style={styles.text}>Touch-up is not available on this device yet.</Text>
      <Button label="Close" variant="secondary" onPress={onCancel} testID="touchup-cancel" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  text: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
