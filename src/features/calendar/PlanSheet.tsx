import { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Outfit } from '@/core/model/types';
import { useCloset, useOutfits } from '@/state';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';
import { outfitName } from '../outfits/naming';
import { resolveOutfitItems } from '../outfits/outfitItems';
import { useImageUris } from '../shared/useImageUris';

const MINI = 40;
const MAX_MINI = 4;

interface PlanSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (outfit: Outfit) => void;
  /** Go build a new outfit in Mix. */
  onOpenMix: () => void;
}

/** Pick one of the saved outfits to plan, or jump to Mix to make a new one. */
export function PlanSheet({ visible, onClose, onPick, onOpenMix }: PlanSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Plan an outfit" testID="plan-sheet">
      {visible ? <Options onPick={onPick} onOpenMix={onOpenMix} /> : null}
    </Sheet>
  );
}

function Options({ onPick, onOpenMix }: Pick<PlanSheetProps, 'onPick' | 'onOpenMix'>) {
  const { height } = useWindowDimensions();
  const outfits = useOutfits((s) => s.outfits);
  const items = useCloset((s) => s.items);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const sorted = useMemo(
    () =>
      [...outfits].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      ),
    [outfits],
  );
  const rows = sorted.map((outfit) => ({
    outfit,
    resolved: resolveOutfitItems(outfit.itemIds, byId),
  }));
  const uris = useImageUris(
    rows.flatMap((r) => r.resolved.items.slice(0, MAX_MINI).map((i) => i.images.cutoutId)),
  );

  return (
    <>
      {rows.length === 0 ? (
        <Text style={styles.empty} testID="plan-empty">
          You have no saved outfits yet. Build one in Mix, save it, then plan it here.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: height * 0.45 }} testID="plan-list">
          {rows.map(({ outfit, resolved }) => (
            <Pressable
              key={outfit.id}
              accessibilityRole="button"
              accessibilityLabel={`Plan ${outfitName(outfit, resolved.items)}`}
              onPress={() => onPick(outfit)}
              style={styles.row}
              testID={`plan-outfit-option-${outfit.id}`}
            >
              <View style={styles.minis}>
                {resolved.items.slice(0, MAX_MINI).map((item) => {
                  const uri = uris[item.images.cutoutId];
                  return uri ? (
                    <Image
                      key={item.id}
                      source={{ uri }}
                      resizeMode="contain"
                      accessible={false}
                      style={styles.mini}
                    />
                  ) : (
                    <View
                      key={item.id}
                      style={[
                        styles.mini,
                        { backgroundColor: item.colors[0]?.hex ?? colors.border, opacity: 0.35 },
                      ]}
                    />
                  );
                })}
              </View>
              <Text numberOfLines={2} style={styles.name}>
                {outfitName(outfit, resolved.items)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Button
        label="Build a new one in Mix"
        variant="secondary"
        icon="shuffle"
        onPress={onOpenMix}
        testID="plan-mix"
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.body, color: colors.textMuted },
  row: {
    minHeight: minTouch + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  minis: { flexDirection: 'row', gap: spacing.xs },
  mini: { width: MINI, height: MINI, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  name: { ...typography.label, color: colors.text, flex: 1 },
});
