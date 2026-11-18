import { StyleSheet, Text, View } from 'react-native';

import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';

interface ColorDotProps {
  /** #RRGGBB */
  hex: string;
  /** Colour name; shown next to the dot so colour is never the only signal. */
  label?: string;
  size?: 'sm' | 'md';
  testID?: string;
}

export function ColorDot({ hex, label, size = 'md', testID }: ColorDotProps) {
  const dim = size === 'sm' ? iconSize.sm : iconSize.lg;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ? `Colour ${label}` : `Colour ${hex}`}
      style={styles.row}
      testID={testID}
    >
      <View
        style={[styles.dot, { width: dim, height: dim, backgroundColor: hex }]}
        testID={testID ? `${testID}-swatch` : undefined}
      />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  label: { ...typography.caption, color: colors.text },
});
