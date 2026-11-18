import { StyleSheet, Text, View } from 'react-native';
import { CATEGORY_LABELS, COLOR_LABELS } from '@/features/closet/labels';
import { Card } from '@/ui/Card';
import { colors, spacing, typography } from '@/ui/theme';
import { plural } from './insights';
import { BarList } from './BarList';
import { RankedList } from './RankedList';
import { LIST_SIZE, formatMoney, type Stats } from './stats';

interface StatsSectionProps {
  stats: Stats;
  onOpenItem: (itemId: string) => void;
}

const wears = (n: number): string => (n === 0 ? 'Never worn' : plural(n, 'wear', 'wears'));

/** Wear and wardrobe numbers: most/least worn, untouched, colours, categories, cost per wear. */
export function StatsSection({ stats, onOpenItem }: StatsSectionProps) {
  const untouched = stats.untouched.slice(0, LIST_SIZE);
  const moreUntouched = stats.untouched.length - untouched.length;
  return (
    <View style={styles.wrap} testID="insights-stats">
      {stats.hasWears ? (
        <>
          <RankedList
            title="Most worn"
            emptyText=""
            rows={stats.mostWorn.map((r) => ({ item: r.item, value: wears(r.count) }))}
            onOpenItem={onOpenItem}
            testID="insights-stats-most-worn"
          />
          <RankedList
            title="Least worn"
            emptyText="Everything has had its turn."
            rows={stats.leastWorn.map((r) => ({ item: r.item, value: wears(r.count) }))}
            onOpenItem={onOpenItem}
            testID="insights-stats-least-worn"
          />
        </>
      ) : (
        <Card testID="insights-stats-no-wears">
          <Text style={styles.note}>
            Once you start logging what you wear, your most and least worn pieces will show up here.
          </Text>
        </Card>
      )}
      <RankedList
        title="Untouched for 90 days"
        emptyText="Nothing is gathering dust. Nice."
        rows={untouched.map((r) => ({
          item: r.item,
          value: r.daysSince === null ? 'Never worn' : `${r.daysSince} days ago`,
        }))}
        onOpenItem={onOpenItem}
        testID="insights-stats-untouched"
      />
      {moreUntouched > 0 ? <Text style={styles.more}>and {moreUntouched} more</Text> : null}
      <BarList
        title="By colour"
        rows={stats.colours.map((c) => ({
          key: c.name,
          label: COLOR_LABELS[c.name],
          swatch: c.hex,
          count: c.count,
          percent: c.percent,
        }))}
        testID="insights-stats-colours"
      />
      <BarList
        title="By category"
        rows={stats.categories.map((c) => ({
          key: c.category,
          label: CATEGORY_LABELS[c.category],
          count: c.count,
          percent: c.percent,
        }))}
        testID="insights-stats-categories"
      />
      {stats.costPerWear.length > 0 ? (
        <RankedList
          title="Cost per wear"
          emptyText=""
          rows={stats.costPerWear.slice(0, LIST_SIZE).map((r) => ({
            item: r.item,
            value: r.perWear === null ? 'Not worn yet' : `${formatMoney(r.perWear)} per wear`,
          }))}
          onOpenItem={onOpenItem}
          testID="insights-stats-cost"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  note: { ...typography.body, color: colors.textMuted },
  more: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
