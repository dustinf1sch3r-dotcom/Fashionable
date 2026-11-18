import { Pressable, StyleSheet } from 'react-native';
import type { Item } from '@/core/model/types';
import { ItemImage } from '@/features/closet/list/ItemImage';
import { itemDisplayName } from '@/features/closet/list/filter';
import { colors, radius } from '@/ui/theme';

interface ThumbTileProps {
  item: Item;
  size: number;
  onPress: (itemId: string) => void;
  testID: string;
}

/** Tappable garment thumbnail that opens the item. */
export function ThumbTile({ item, size, onPress, testID }: ThumbTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${itemDisplayName(item)}`}
      onPress={() => onPress(item.id)}
      style={[styles.tile, { width: size, height: size }]}
      testID={testID}
    >
      <ItemImage imageId={item.images.thumbId} style={styles.image} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
