import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/ui/Card';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';

export interface BarRow {
  key: string;
  label: string;
  /** Optional swatch drawn before the label (colour rows). The label always names it too. */
  swatch?: string;
  count: number;
  percent: number;
}

interface BarListProps {
  title: string;
  rows: readonly BarRow[];
  testID: string;
}

/** Simple horizontal bars: name (and colour dot) on the left, count on the right. */
export function BarList({ title, rows, testID }: BarListProps) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card testID={testID}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {rows.map((r) => (
        <View
          key={r.key}
          style={styles.row}
          accessible
          accessibilityLabel={`${r.label}: ${r.count}, ${r.percent} percent`}
          testID={`${testID}-${r.key}`}
        >
          <View style={styles.labelCol}>
            {r.swatch ? <View style={[styles.dot, { backgroundColor: r.swatch }]} /> : null}
            <Text style={styles.label} numberOfLines={1}>
              {r.label}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(4, (r.count / max) * 100)}%` }]} />
          </View>
          <Text style={styles.count}>{r.count}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.label, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  labelCol: { width: 112, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: iconSize.sm,
    height: iconSize.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  label: { ...typography.caption, color: colors.text, flex: 1 },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  fill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
  count: { ...typography.caption, color: colors.textMuted, width: 24, textAlign: 'right' },
});
