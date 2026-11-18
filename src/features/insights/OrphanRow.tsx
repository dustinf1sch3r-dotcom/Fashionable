import { StyleSheet, Text, View } from 'react-native';
import type { Item } from '@/core/model/types';
import { itemDisplayName } from '@/features/closet/list/filter';
import { Card } from '@/ui/Card';
import { colors, spacing, typography } from '@/ui/theme';
import { ThumbTile } from './ThumbTile';

interface OrphanRowProps {
  item: Item;
  /** "Goes with 1 outfit" */
  countLabel: string;
  /** "Black pumps, Black flats"; empty when nothing would help. */
  helpText: string;
  onOpenItem: (itemId: string) => void;
  testID: string;
}

/** A piece that goes with almost nothing, and what would rescue it. */
export function OrphanRow({ item, countLabel, helpText, onOpenItem, testID }: OrphanRowProps) {
  return (
    <Card testID={testID}>
      <View style={styles.row}>
        <ThumbTile item={item} size={72} onPress={onOpenItem} testID={`${testID}-open`} />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {itemDisplayName(item)}
          </Text>
          <Text style={styles.count} testID={`${testID}-count`}>
            {countLabel}
          </Text>
          {helpText ? (
            <Text style={styles.help} testID={`${testID}-help`}>
              Would help: {helpText}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  name: { ...typography.label, color: colors.text },
  count: { ...typography.caption, color: colors.warning, fontWeight: '600' },
  help: { ...typography.caption, color: colors.textMuted },
});
