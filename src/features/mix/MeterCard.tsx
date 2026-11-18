import { StyleSheet, Text, View } from 'react-native';
import type { ScoreBreakdown } from '@/core/model/types';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { matchBand, weakSpots, type MatchTone } from './meter';

interface MeterCardProps {
  /** `null` while there are too few pieces to judge. */
  breakdown: ScoreBreakdown | null;
  /** Today's weather is part of the score. */
  withWeather: boolean;
}

const TONE_COLOR: Record<MatchTone, string> = {
  great: colors.success,
  good: colors.accent,
  try: colors.warning,
};

/** Live harmony meter: label, 0–100 bar and the weakest components in plain words. */
export function MeterCard({ breakdown, withWeather }: MeterCardProps) {
  if (!breakdown) {
    return (
      <View style={styles.card} testID="mix-meter">
        <Text style={styles.label} testID="mix-meter-label">
          Pick a few pieces
        </Text>
        <Text style={styles.hint}>The match meter wakes up once you have two.</Text>
      </View>
    );
  }
  const total = Math.round(breakdown.total);
  const band = matchBand(breakdown.total);
  const color = TONE_COLOR[band.tone];
  const spots = weakSpots(breakdown);
  return (
    <View style={styles.card} testID="mix-meter">
      <View style={styles.head}>
        <Text style={[styles.label, { color }]} testID="mix-meter-label">
          {band.label}
        </Text>
        <Text style={styles.score} testID="mix-meter-score">
          {total}
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`Match ${total} out of 100`}
        accessibilityValue={{ min: 0, max: 100, now: total }}
        testID="mix-meter-bar"
      >
        <View style={[styles.fill, { width: `${total}%`, backgroundColor: color }]} />
      </View>
      {spots.length > 0 ? (
        <View style={styles.spots} testID="mix-meter-spots">
          {spots.map((s) => (
            <Text key={s.component} style={styles.spot} testID={`mix-meter-issue-${s.component}`}>
              {`• ${s.text}`}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.hint} testID="mix-meter-fine">
          No weak spots
        </Text>
      )}
      {withWeather ? <Text style={styles.hint}>Includes today’s weather</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + spacing.xs,
    gap: spacing.xs + 2,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { ...typography.label, color: colors.text, flexShrink: 1 },
  score: { ...typography.heading, color: colors.text },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  spots: { gap: 2 },
  spot: { ...typography.caption, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
});
