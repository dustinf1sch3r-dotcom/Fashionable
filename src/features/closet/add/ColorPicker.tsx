import { Ionicons } from '@/ui/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorName } from '@/core/model/types';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { COLOR_LABELS } from '../labels';
import { COLOR_HEX, COLOR_NAMES } from './colors';

interface ColorPickerProps {
  value: ColorName | null;
  onChange: (color: ColorName) => void;
  testID: string;
}

/** The 15 colour names as labelled swatches. Swatch testIDs are `${testID}-${name}`. */
export function ColorPicker({ value, onChange, testID }: ColorPickerProps) {
  return (
    <View accessibilityRole="radiogroup" style={styles.grid} testID={testID}>
      {COLOR_NAMES.map((name) => {
        const selected = value === name;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={COLOR_LABELS[name]}
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            onPress={() => onChange(name)}
            testID={`${testID}-${name}`}
            style={styles.cell}
          >
            <View
              style={[
                styles.dot,
                selected && styles.dotSelected,
                { backgroundColor: COLOR_HEX[name] },
              ]}
            >
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={iconSize.md}
                  color={
                    name === 'white' || name === 'yellow' || name === 'beige'
                      ? colors.text
                      : colors.onAccent
                  }
                />
              ) : null}
            </View>
            <Text style={styles.label}>{COLOR_LABELS[name]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  cell: { width: '20%', minHeight: minTouch, alignItems: 'center', gap: spacing.xs },
  dot: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSelected: { borderColor: colors.accent, borderWidth: 3 },
  label: { ...typography.caption, color: colors.text },
});
