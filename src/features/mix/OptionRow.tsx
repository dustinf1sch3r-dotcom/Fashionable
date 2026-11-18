import { Ionicons } from '@/ui/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Item } from '@/core/model/types';
import { ItemImage } from '@/features/closet/list/ItemImage';
import { itemDisplayName } from '@/features/closet/list/filter';
import { IconButton } from '@/ui/IconButton';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import type { RowDef } from './slotRows';

/** Edge of a thumbnail tile, in points. */
export const TILE = 64;

interface OptionRowProps {
  def: RowDef;
  /** Active items that belong in this row. */
  options: readonly Item[];
  /** What the outfit currently holds in this row. */
  picked: readonly Item[];
  locked: boolean;
  onPick: (item: Item) => void;
  onNone: () => void;
  onToggleLock: () => void;
  onShuffle: () => void;
}

/** One swipeable slot row: heading, lock and shuffle, then "None" and a thumbnail per item. */
export function OptionRow({
  def,
  options,
  picked,
  locked,
  onPick,
  onNone,
  onToggleLock,
  onShuffle,
}: OptionRowProps) {
  const id = def.key;
  const pickedIds = new Set(picked.map((i) => i.id));
  return (
    <View style={styles.row} testID={`mix-row-${id}`}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          {def.label}
        </Text>
        <View style={styles.tools}>
          <IconButton
            icon={locked ? 'lock-closed' : 'lock-open-outline'}
            selected={locked}
            accessibilityLabel={locked ? `Unlock ${def.label}` : `Lock ${def.label}`}
            onPress={onToggleLock}
            testID={`mix-lock-${id}`}
          />
          <IconButton
            icon="shuffle"
            disabled={locked || options.length === 0}
            accessibilityLabel={`Shuffle ${def.label}`}
            onPress={onShuffle}
            testID={`mix-shuffle-${id}`}
          />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiles}
        testID={`mix-row-${id}-scroll`}
      >
        <Tile
          label="None"
          selected={picked.length === 0}
          onPress={onNone}
          testID={`mix-option-${id}-none`}
        >
          <Ionicons name="close-circle-outline" size={iconSize.lg} color={colors.textMuted} />
          <Text style={styles.noneText}>None</Text>
        </Tile>
        {options.map((item) => (
          <Tile
            key={item.id}
            label={itemDisplayName(item)}
            selected={pickedIds.has(item.id)}
            onPress={() => onPick(item)}
            testID={`mix-option-${id}-${item.id}`}
          >
            <ItemImage
              imageId={item.images.thumbId}
              fallbackId={item.images.cutoutId}
              style={styles.image}
            />
          </Tile>
        ))}
      </ScrollView>
    </View>
  );
}

interface TileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
  testID: string;
}

function Tile({ label, selected, onPress, children, testID }: TileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.tileSelected,
        pressed && styles.pressed,
      ]}
    >
      {children}
      {selected ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={iconSize.sm - 4} color={colors.onAccent} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 0 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  title: { ...typography.label, color: colors.text },
  tools: { flexDirection: 'row' },
  tiles: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xs },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.8 },
  image: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  noneText: { ...typography.caption, color: colors.textMuted },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
