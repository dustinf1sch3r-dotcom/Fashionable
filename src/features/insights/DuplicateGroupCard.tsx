import { StyleSheet, Text, View } from 'react-native';
import type { Item } from '@/core/model/types';
import { itemDisplayName } from '@/features/closet/list/filter';
import { Card } from '@/ui/Card';
import { colors, spacing, typography } from '@/ui/theme';
import { ThumbTile } from './ThumbTile';

interface DuplicateGroupCardProps {
  items: readonly Item[];
  /** "2 near-identical Shirts" */
  summary: string;
  onOpenItem: (itemId: string) => void;
  testID: string;
}

/** Near-identical pieces side by side; tap one to open it. */
export function DuplicateGroupCard({
  items,
  summary,
  onOpenItem,
  testID,
}: DuplicateGroupCardProps) {
  return (
    <Card testID={testID}>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.thumbs}>
        {items.map((item) => (
          <View key={item.id} style={styles.cell}>
            <ThumbTile
              item={item}
              size={84}
              onPress={onOpenItem}
              testID={`${testID}-item-${item.id}`}
            />
            <Text style={styles.name} numberOfLines={1}>
              {itemDisplayName(item)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { ...typography.label, color: colors.text },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: 84, gap: spacing.xs },
  name: { ...typography.caption, color: colors.textMuted },
});
