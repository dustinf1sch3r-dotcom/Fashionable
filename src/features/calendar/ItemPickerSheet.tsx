import { Ionicons } from '@/ui/Ionicons';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ID, Item } from '@/core/model/types';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import { itemDisplayName } from '../closet/list/filter';
import { ROWS, itemsInRow } from '../mix/slotRows';
import { useImageUris } from '../shared/useImageUris';

const SHEET_HEIGHT_SHARE = 0.5;
const TILE_IMAGE = 64;

interface ItemPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Closet items to choose from (archived ones are left out by the caller). */
  items: readonly Item[];
  onConfirm: (itemIds: ID[]) => void;
}

/** Multi-select list of closet items grouped by what they are (tops, bottoms, shoes…). */
export function ItemPickerSheet({
  visible,
  onClose,
  title,
  items,
  onConfirm,
}: ItemPickerSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID="item-picker">
      {visible ? <Picker items={items} onConfirm={onConfirm} /> : null}
    </Sheet>
  );
}

function Picker({ items, onConfirm }: Pick<ItemPickerSheetProps, 'items' | 'onConfirm'>) {
  const { height } = useWindowDimensions();
  const [picked, setPicked] = useState<readonly ID[]>([]);
  const uris = useImageUris(items.map((i) => i.images.cutoutId));
  const groups = useMemo(
    () =>
      ROWS.map((row) => ({ row, items: itemsInRow(items, row.key) })).filter(
        (g) => g.items.length > 0,
      ),
    [items],
  );
  const toggle = (id: ID) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  if (items.length === 0) {
    return (
      <Text style={styles.empty} testID="item-picker-empty">
        Your closet is empty. Add a piece first.
      </Text>
    );
  }
  return (
    <>
      <ScrollView
        style={{ maxHeight: height * SHEET_HEIGHT_SHARE }}
        contentContainerStyle={styles.groups}
        testID="item-picker-list"
      >
        {groups.map(({ row, items: list }) => (
          <View key={row.key} style={styles.group} testID={`item-picker-group-${row.key}`}>
            <Text accessibilityRole="header" style={styles.groupTitle}>
              {row.label}
            </Text>
            <View style={styles.tiles}>
              {list.map((item) => {
                const on = picked.includes(item.id);
                const uri = uris[item.images.cutoutId];
                const name = itemDisplayName(item);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={name}
                    accessibilityState={{ checked: on }}
                    aria-checked={on}
                    onPress={() => toggle(item.id)}
                    style={[styles.tile, on && styles.tileOn]}
                    testID={`log-item-${item.id}`}
                  >
                    {uri ? (
                      <Image
                        source={{ uri }}
                        resizeMode="contain"
                        accessible={false}
                        style={styles.image}
                      />
                    ) : (
                      <View
                        style={[
                          styles.image,
                          { backgroundColor: item.colors[0]?.hex ?? colors.border, opacity: 0.35 },
                        ]}
                      />
                    )}
                    <Text numberOfLines={2} style={styles.tileName}>
                      {name}
                    </Text>
                    {on ? (
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={iconSize.sm} color={colors.onAccent} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <Button
        label={
          picked.length === 0
            ? 'Pick what you wore'
            : `Log ${picked.length} ${picked.length === 1 ? 'piece' : 'pieces'}`
        }
        disabled={picked.length === 0}
        onPress={() => onConfirm([...picked])}
        testID="log-items-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { ...typography.label, color: colors.textMuted },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    flexGrow: 0,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  image: { width: '100%', height: TILE_IMAGE, borderRadius: radius.sm },
  tileName: { ...typography.caption, color: colors.text, textAlign: 'center' },
  check: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
