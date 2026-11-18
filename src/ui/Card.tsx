import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, spacing } from '@/ui/theme';

interface CardProps {
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({ children, onPress, accessibilityLabel, testID }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={styles.card} testID={testID} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow(1),
  },
  pressed: { opacity: 0.9 },
});
