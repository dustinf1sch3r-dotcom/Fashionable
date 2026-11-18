import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, minTouch, radius, shadow, spacing, typography } from '@/ui/theme';

export type TryOnToggleMode = 'photo' | 'silhouette';

const OPTIONS = [
  { id: 'me', mode: 'photo', label: 'Me' },
  { id: 'silhouette', mode: 'silhouette', label: 'Silhouette' },
] as const;

interface TryOnToggleProps {
  mode: TryOnToggleMode;
  onChange: (mode: TryOnToggleMode) => void;
  /** Only offered when the person has a body photo; renders nothing otherwise. */
  visible: boolean;
  /** Fill the parent's width (narrow side columns) instead of a fixed, centred width. */
  fill?: boolean;
  testID?: string;
}

/**
 * Compact "Me / Silhouette" switch shown next to a full-size mannequin. Segment testIDs are
 * `tryon-toggle-me` and `tryon-toggle-silhouette` (the default `testID` is `tryon-toggle`).
 * Narrower than `SegmentedControl` so "Silhouette" fits in Mix's side column.
 */
export function TryOnToggle({
  mode,
  onChange,
  visible,
  fill = false,
  testID = 'tryon-toggle',
}: TryOnToggleProps) {
  if (!visible) return null;
  return (
    <View style={fill ? undefined : styles.wrap}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Show outfits on"
        style={[styles.track, fill ? styles.fill : styles.fixed]}
        testID={testID}
      >
        {OPTIONS.map((o) => {
          const selected = o.mode === mode;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="tab"
              accessibilityLabel={o.label}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => onChange(o.mode)}
              testID={`${testID}-${o.id}`}
              style={[styles.segment, selected && styles.selected]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  fixed: { width: 240, maxWidth: '100%' },
  fill: { width: '100%' },
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: minTouch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  selected: { backgroundColor: colors.surface, ...shadow(1) },
  label: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  labelSelected: { color: colors.accent },
});
