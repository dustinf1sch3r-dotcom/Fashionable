import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { IconName } from '@/ui/icons';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';

interface CompactButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  testID?: string;
}

/** A pill button that fits a narrow column (the stock Button has generous side padding). */
export function CompactButton({
  label,
  onPress,
  icon,
  variant = 'secondary',
  disabled = false,
  testID,
}: CompactButtonProps) {
  const primary = variant === 'primary';
  const fg = primary ? colors.onAccent : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Ionicons name={icon} size={iconSize.sm} color={fg} /> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  label: { ...typography.label, flexShrink: 1, textAlign: 'center' },
});
