import { Ionicons } from '@/ui/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ID, Item, Outfit } from '@/core/model/types';
import { useCloset, useOutfits } from '@/state';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import { useImageUris } from '../shared/useImageUris';
import { OCCASION_LABELS } from './missingSlots';
import { outfitName } from './naming';
import { outfitNote, resolveOutfitItems } from './outfitItems';

const MINI = 44;
const MAX_MINI = 4;

interface SavedViewProps {
  onShowIdeas: () => void;
}

/** The "Saved" tab: every saved outfit, newest first. */
export function SavedView({ onShowIdeas }: SavedViewProps) {
  const router = useRouter();
  const outfits = useOutfits((s) => s.outfits);
  const toggleFavorite = useOutfits((s) => s.toggleFavorite);
  const allItems = useCloset((s) => s.items);
  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);

  const sorted = useMemo(
    () =>
      [...outfits].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      ),
    [outfits],
  );
  const cutoutIds = useMemo(
    () =>
      sorted.flatMap((o) =>
        resolveOutfitItems(o.itemIds, byId)
          .items.slice(0, MAX_MINI)
          .map((i) => i.images.cutoutId),
      ),
    [sorted, byId],
  );
  const imageUris = useImageUris(cutoutIds);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon="heart-outline"
        title="No saved outfits yet"
        body="Tap Save on an idea you like and it will live here."
        action={{ label: 'See ideas', onPress: onShowIdeas, testID: 'saved-see-ideas' }}
        testID="saved-empty"
      />
    );
  }

  return (
    <View style={styles.list} testID="saved-list">
      {sorted.map((outfit) => (
        <SavedRow
          key={outfit.id}
          outfit={outfit}
          byId={byId}
          imageUris={imageUris}
          onOpen={() => router.push(`/outfits/${outfit.id}`)}
          onFavorite={() => toggleFavorite(outfit.id)}
        />
      ))}
    </View>
  );
}

interface SavedRowProps {
  outfit: Outfit;
  byId: ReadonlyMap<ID, Item>;
  imageUris: Readonly<Record<ID, string | undefined>>;
  onOpen: () => void;
  onFavorite: () => void;
}

function SavedRow({ outfit, byId, imageUris, onOpen, onFavorite }: SavedRowProps) {
  const resolved = resolveOutfitItems(outfit.itemIds, byId);
  const name = outfitName(outfit, resolved.items);
  const note = outfitNote(resolved);
  const meta = [
    outfit.occasion && outfit.occasion !== 'any' ? OCCASION_LABELS[outfit.occasion] : undefined,
    `${outfit.itemIds.length} pieces`,
  ]
    .filter(Boolean)
    .join(' · ');
  const shown = resolved.items.slice(0, MAX_MINI);
  const extra = resolved.items.length - shown.length;

  return (
    <Card testID={`saved-outfit-${outfit.id}`}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
          onPress={onOpen}
          style={styles.main}
          testID={`saved-open-${outfit.id}`}
        >
          <View style={styles.minis}>
            {shown.map((item) => {
              const uri = imageUris[item.images.cutoutId];
              return (
                <View key={item.id} style={styles.mini}>
                  {uri ? (
                    <Image
                      source={{ uri }}
                      resizeMode="contain"
                      accessible={false}
                      style={styles.miniImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.miniImage,
                        styles.pending,
                        { backgroundColor: item.colors[0]?.hex ?? colors.border },
                      ]}
                    />
                  )}
                </View>
              );
            })}
            {extra > 0 ? <Text style={styles.extra}>{`+${extra}`}</Text> : null}
          </View>
          <Text style={styles.name} numberOfLines={2} testID={`saved-name-${outfit.id}`}>
            {name}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
          {note ? (
            <View style={styles.note} testID={`saved-note-${outfit.id}`}>
              <Ionicons
                name="information-circle-outline"
                size={iconSize.sm}
                color={colors.warning}
              />
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ) : null}
        </Pressable>
        <IconButton
          icon={outfit.favorite ? 'heart' : 'heart-outline'}
          accessibilityLabel={outfit.favorite ? 'Remove from favourites' : 'Add to favourites'}
          selected={outfit.favorite}
          onPress={onFavorite}
          testID={`saved-favorite-${outfit.id}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  main: { flex: 1, gap: spacing.xs, minHeight: MINI },
  minis: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mini: {
    width: MINI,
    height: MINI,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    padding: 3,
  },
  miniImage: { width: '100%', height: '100%' },
  pending: { opacity: 0.35, borderRadius: radius.sm },
  extra: { ...typography.label, color: colors.textMuted, paddingLeft: spacing.xs },
  name: { ...typography.label, color: colors.text, marginTop: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteText: { ...typography.caption, color: colors.warning, flex: 1 },
});
