import { Pressable, StyleSheet, Text } from 'react-native';
import type { Item } from '@/core/model/types';
import { itemDisplayName } from '@/features/closet/list/filter';
import { ItemImage } from '@/features/closet/list/ItemImage';
import { Card } from '@/ui/Card';
import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';

export interface RankedRow {
  item: Item;
  /** Right-hand text, e.g. "12 wears". */
  value: string;
}

interface RankedListProps {
  title: string;
  /** Shown instead of the rows when there are none. */
  emptyText: string;
  rows: readonly RankedRow[];
  onOpenItem: (itemId: string) => void;
  testID: string;
}

/** A titled card of items with a number on the right (most worn, untouched, cost per wear…). */
export function RankedList({ title, emptyText, rows, onOpenItem, testID }: RankedListProps) {
  return (
    <Card testID={testID}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {rows.length === 0 ? <Text style={styles.empty}>{emptyText}</Text> : null}
      {rows.map(({ item, value }) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${itemDisplayName(item)}`}
          onPress={() => onOpenItem(item.id)}
          style={styles.row}
          testID={`${testID}-${item.id}`}
        >
          <ItemImage imageId={item.images.thumbId} style={styles.thumb} />
          <Text style={styles.name} numberOfLines={1}>
            {itemDisplayName(item)}
          </Text>
          <Text style={styles.value}>{value}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.label, color: colors.text },
  empty: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTouch },
  thumb: { width: 40, height: 40, borderRadius: radius.sm },
  name: { ...typography.body, color: colors.text, flex: 1 },
  value: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
});
