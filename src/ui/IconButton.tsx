import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import type { IconName } from '@/ui/icons';
import { colors, iconSize, minTouch, radius } from '@/ui/theme';

interface IconButtonProps {
  icon: IconName;
  /** Required: an icon alone says nothing to a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  selected,
  disabled = false,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={iconSize.md} color={selected ? colors.accent : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accentSoft },
  pressed: { backgroundColor: colors.surfaceAlt },
  disabled: { opacity: 0.45 },
});
