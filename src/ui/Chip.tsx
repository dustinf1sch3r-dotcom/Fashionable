import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'radio' inside single-select groups, 'checkbox' otherwise. */
  role?: 'radio' | 'checkbox';
  disabled?: boolean;
  testID?: string;
}

export function Chip({ label, selected, onPress, role = 'checkbox', disabled, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    minWidth: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  label: { ...typography.label },
  labelIdle: { color: colors.text },
  labelSelected: { color: colors.accent },
});
