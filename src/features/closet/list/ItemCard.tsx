import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item } from '@/core/model/types';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import { itemDisplayName } from './filter';
import { ItemImage } from './ItemImage';

interface ItemCardProps {
  item: Item;
  width: number;
  onPress: (id: string) => void;
}

export function ItemCard({ item, width, onPress }: ItemCardProps) {
  const name = itemDisplayName(item);
  const laundry = item.status === 'laundry';
  const label = [name, item.favorite ? 'favourite' : '', laundry ? 'in the laundry' : '']
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(item.id)}
      testID={`closet-item-${item.id}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <ItemImage
          imageId={item.images.thumbId}
          style={styles.image}
          testID={`closet-item-${item.id}-image`}
        />
        {item.favorite ? (
          <View style={styles.heart} testID={`closet-item-${item.id}-favorite`}>
            <Ionicons name="heart" size={iconSize.sm} color={colors.danger} />
          </View>
        ) : null}
        {laundry ? (
          <View style={styles.badge} testID={`closet-item-${item.id}-laundry`}>
            <Ionicons name="water-outline" size={iconSize.sm - 4} color={colors.warning} />
            <Text style={styles.badgeText}>Laundry</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  pressed: { opacity: 0.85 },
  imageWrap: {
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  image: { ...StyleSheet.absoluteFill },
  heart: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: iconSize.md + spacing.xs,
    height: iconSize.md + spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  badgeText: { ...typography.caption, fontWeight: '600', color: colors.warning },
  name: { ...typography.caption, color: colors.text, paddingHorizontal: 2 },
});
