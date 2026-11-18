import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';

export type Rating = 1 | 2 | 3 | 4 | 5;
const STEPS: readonly Rating[] = [1, 2, 3, 4, 5];

interface Rating5Props {
  label: string;
  value: Rating | null;
  onChange: (value: Rating) => void;
  lowLabel: string;
  highLabel: string;
  testID?: string;
}

/** 1-5 scale with captions for both ends. Step testIDs are `${testID}-${n}`. */
export function Rating5({ label, value, onChange, lowLabel, highLabel, testID }: Rating5Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
        {STEPS.map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${n} of 5`}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => onChange(n)}
              testID={testID ? `${testID}-${n}` : undefined}
              style={[styles.step, selected ? styles.selected : styles.idle]}
            >
              <Text style={[styles.number, selected ? styles.numberSelected : styles.numberIdle]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{lowLabel}</Text>
        <Text style={styles.end}>{highLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  step: {
    flex: 1,
    minHeight: minTouch,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  number: { ...typography.label },
  numberIdle: { color: colors.text },
  numberSelected: { color: colors.onAccent },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { ...typography.caption, color: colors.textMuted },
});
