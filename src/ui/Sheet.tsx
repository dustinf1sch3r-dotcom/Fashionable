import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/ui/IconButton';
import { colors, radius, shadow, spacing, typography } from '@/ui/theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  testID?: string;
}

/** Bottom sheet. testIDs: `${testID}` panel, `-scrim`, `-close`. */
export function Sheet({ visible, onClose, title, children, testID }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={styles.scrim}
          testID={testID ? `${testID}-scrim` : undefined}
        />
        <View accessibilityViewIsModal style={styles.panel} testID={testID}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <IconButton
              icon="close"
              accessibilityLabel="Close"
              onPress={onClose}
              testID={testID ? `${testID}-close` : undefined}
            />
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    ...shadow(3),
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xl + spacing.sm,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  body: { gap: spacing.md },
});
