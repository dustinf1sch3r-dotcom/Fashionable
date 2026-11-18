import { Ionicons } from '@/ui/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { Item } from '@/core/model/types';
import { colors, iconSize, radius, spacing } from '@/ui/theme';
import { itemDisplayName } from '../closet/list/filter';

export const THUMB_SIZE = 56;
const PIN_SIZE = 28;
const PIN_SLOP = 8;

interface ItemThumbProps {
  item: Item;
  /** Cutout URI; the tile shows the garment's colour until it has loaded. */
  uri: string | undefined;
  onPress: () => void;
  /** When given, a pin badge appears ("build an outfit around this"). */
  pinned?: boolean;
  onTogglePin?: () => void;
  testID: string;
}

/** Square garment tile; tapping opens the item, the corner pin builds outfits around it. */
export function ItemThumb({
  item,
  uri,
  onPress,
  pinned = false,
  onTogglePin,
  testID,
}: ItemThumbProps) {
  const name = itemDisplayName(item);
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        onPress={onPress}
        style={[styles.tile, pinned && styles.tilePinned]}
        testID={testID}
      >
        {uri ? (
          <Image
            source={{ uri }}
            resizeMode="contain"
            accessible={false}
            style={styles.image}
            testID={`${testID}-img`}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.pending,
              { backgroundColor: item.colors[0]?.hex ?? colors.border },
            ]}
          />
        )}
      </Pressable>
      {onTogglePin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pinned ? `Stop building around ${name}` : `Build around ${name}`}
          accessibilityState={{ selected: pinned }}
          hitSlop={PIN_SLOP}
          onPress={onTogglePin}
          style={[styles.pin, pinned && styles.pinOn]}
          testID={`${testID}-pin`}
        >
          <Ionicons
            name={pinned ? 'pin' : 'pin-outline'}
            size={iconSize.sm - 4}
            color={pinned ? colors.onAccent : colors.text}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: THUMB_SIZE, height: THUMB_SIZE },
  tile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.xs,
    overflow: 'hidden',
  },
  tilePinned: { borderColor: colors.accent },
  image: { width: '100%', height: '100%' },
  pending: { opacity: 0.35, borderRadius: radius.sm },
  pin: {
    position: 'absolute',
    top: -spacing.xs,
    right: -spacing.xs,
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
