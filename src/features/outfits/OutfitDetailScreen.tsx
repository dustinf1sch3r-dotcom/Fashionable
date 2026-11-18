import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Outfit } from '@/core/model/types';
import { useCloset, useOutfits } from '@/state';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Mannequin } from '@/ui/mannequin';
import { TryOnToggle } from '@/ui/TryOnToggle';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { WoreTodayButton } from '../calendar/WoreTodayButton';
import { subcategoryLabel } from '../closet/labels';
import { itemDisplayName } from '../closet/list/filter';
import { useClosetHydration } from '../closet/list/useClosetHydration';
import { useBody } from '../shared/useBody';
import { useImageUris } from '../shared/useImageUris';
import { OCCASION_LABELS } from './missingSlots';
import { autoName, outfitName } from './naming';
import { outfitNote, resolveOutfitItems } from './outfitItems';
import { RenameSheet } from './RenameSheet';

const MANNEQUIN_WIDTH = 240;
const ROW_THUMB = 52;

/** A saved outfit: big mannequin, rename, favourite, open in Mix, delete with undo. */
export function OutfitDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { status: closetStatus } = useClosetHydration();
  const outfitStatus = useOutfits((s) => s.status);
  const outfit = useOutfits((s) => s.outfits.find((o) => o.id === id));
  const renameOutfit = useOutfits((s) => s.renameOutfit);
  const toggleFavorite = useOutfits((s) => s.toggleFavorite);
  const removeOutfit = useOutfits((s) => s.removeOutfit);
  const restoreOutfit = useOutfits((s) => s.restoreOutfit);
  const [renaming, setRenaming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/outfits'));
  const loading =
    closetStatus === 'idle' ||
    closetStatus === 'loading' ||
    outfitStatus === 'idle' ||
    outfitStatus === 'loading';

  let body;
  if (outfit) {
    body = (
      <DetailBody
        outfit={outfit}
        onRename={() => setRenaming(true)}
        onFavorite={() => toggleFavorite(id)}
        onDelete={() => {
          removeOutfit(id);
          setDeleted(true);
        }}
        onOpenMix={() => router.push(`/mix?outfitId=${id}`)}
        renaming={renaming}
        onCloseRename={() => setRenaming(false)}
        onSaveName={(name) => {
          renameOutfit(id, name);
          setRenaming(false);
        }}
      />
    );
  } else if (deleted) {
    body = (
      <View style={styles.center}>
        <View style={styles.banner} accessibilityRole="alert" testID="outfit-deleted">
          <Text style={styles.bannerText}>Outfit deleted</Text>
          <Button
            label="Undo"
            variant="secondary"
            onPress={() => {
              restoreOutfit(id);
              setDeleted(false);
            }}
            testID="outfit-undo"
          />
        </View>
        <Button
          label="Back to outfits"
          variant="ghost"
          onPress={goBack}
          testID="outfit-deleted-back"
        />
      </View>
    );
  } else if (loading) {
    body = (
      <View style={styles.center} testID="outfit-loading">
        <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Loading outfit" />
      </View>
    );
  } else {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="help-circle-outline"
          title="Outfit not found"
          body="It may have been deleted."
          action={{ label: 'Back to outfits', onPress: goBack, testID: 'outfit-not-found-back' }}
          testID="outfit-not-found"
        />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right']}
      testID="screen-outfit-detail"
    >
      <View style={styles.bar}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Back"
          onPress={goBack}
          testID="outfit-back"
        />
        {outfit ? (
          <View style={styles.barActions}>
            <IconButton
              icon="create-outline"
              accessibilityLabel="Rename outfit"
              onPress={() => setRenaming(true)}
              testID="outfit-rename"
            />
            <IconButton
              icon={outfit.favorite ? 'heart' : 'heart-outline'}
              accessibilityLabel={outfit.favorite ? 'Remove from favourites' : 'Add to favourites'}
              selected={outfit.favorite}
              onPress={() => toggleFavorite(id)}
              testID="outfit-favorite"
            />
          </View>
        ) : null}
      </View>
      {body}
    </SafeAreaView>
  );
}

interface DetailBodyProps {
  outfit: Outfit;
  onRename: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onOpenMix: () => void;
  renaming: boolean;
  onCloseRename: () => void;
  onSaveName: (name: string) => void;
}

function DetailBody({
  outfit,
  onDelete,
  onOpenMix,
  renaming,
  onCloseRename,
  onSaveName,
}: DetailBodyProps) {
  const router = useRouter();
  const { body, backdrop, mode, setMode, hasPhoto } = useBody();
  const allItems = useCloset((s) => s.items);
  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const resolved = resolveOutfitItems(outfit.itemIds, byId);
  const imageUris = useImageUris(resolved.items.map((i) => i.images.cutoutId));
  const name = outfitName(outfit, resolved.items);
  const note = outfitNote(resolved);
  const occasion =
    outfit.occasion && outfit.occasion !== 'any' ? OCCASION_LABELS[outfit.occasion] : undefined;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={styles.title} testID="outfit-title">
          {name}
        </Text>
        <Text style={styles.meta} testID="outfit-meta">
          {[occasion, outfit.source === 'generated' ? 'Suggested for you' : 'Made by you']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {note ? (
        <View style={styles.note} testID="outfit-note">
          <Ionicons name="information-circle-outline" size={iconSize.md} color={colors.warning} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      <View style={styles.stage}>
        <View style={{ width: MANNEQUIN_WIDTH }}>
          <Mannequin
            body={body}
            {...(backdrop ? { backdrop } : {})}
            items={resolved.items}
            outfit={outfit}
            imageUris={imageUris}
            interactive={false}
            testID="outfit-detail-mannequin"
          />
        </View>
      </View>
      <TryOnToggle mode={mode} onChange={setMode} visible={hasPhoto} />

      <Button
        label="Open in Mix"
        icon="shuffle"
        size="lg"
        onPress={onOpenMix}
        testID="outfit-open-mix"
      />
      <WoreTodayButton
        itemIds={resolved.items.map((i) => i.id)}
        outfitId={outfit.id}
        context="outfit"
        variant="primary"
      />

      <View style={styles.pieces} testID="outfit-pieces">
        <Text style={styles.sectionLabel}>The pieces</Text>
        {outfit.itemIds.map((itemId) => {
          const item = byId.get(itemId);
          if (!item) {
            return (
              <View key={itemId} style={styles.pieceRow} testID={`outfit-piece-${itemId}`}>
                <View style={[styles.pieceThumb, styles.gone]}>
                  <Ionicons name="trash-outline" size={iconSize.md} color={colors.textMuted} />
                </View>
                <Text style={styles.pieceMeta}>No longer in your closet</Text>
              </View>
            );
          }
          const uri = imageUris[item.images.cutoutId];
          return (
            <Pressable
              key={itemId}
              accessibilityRole="button"
              accessibilityLabel={`Open ${itemDisplayName(item)}`}
              onPress={() => router.push(`/closet/${item.id}`)}
              style={styles.pieceRow}
              testID={`outfit-piece-${itemId}`}
            >
              <View style={styles.pieceThumb}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    resizeMode="contain"
                    accessible={false}
                    style={styles.pieceImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.pieceImage,
                      { backgroundColor: item.colors[0]?.hex ?? colors.border, opacity: 0.35 },
                    ]}
                  />
                )}
              </View>
              <View style={styles.pieceText}>
                <Text style={styles.pieceName} numberOfLines={1}>
                  {itemDisplayName(item)}
                </Text>
                <Text style={styles.pieceMeta}>
                  {[
                    subcategoryLabel(item.subcategory),
                    item.status === 'archived'
                      ? 'Archived'
                      : item.status === 'laundry'
                        ? 'In the laundry'
                        : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Button label="Delete outfit" variant="danger" onPress={onDelete} testID="outfit-delete" />

      <RenameSheet
        visible={renaming}
        initialName={outfit.name ?? ''}
        placeholder={autoName(resolved.items)}
        onClose={onCloseRename}
        onSave={onSaveName}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  barActions: { flexDirection: 'row' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  titleBlock: { gap: spacing.xs },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.body, color: colors.textMuted },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noteText: { ...typography.body, color: colors.warning, flex: 1 },
  stage: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  pieces: { gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.textMuted },
  pieceRow: {
    minHeight: minTouch + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pieceThumb: {
    width: ROW_THUMB,
    height: ROW_THUMB,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gone: { opacity: 0.7 },
  pieceImage: { width: '100%', height: '100%', borderRadius: radius.sm },
  pieceText: { flex: 1 },
  pieceName: { ...typography.label, color: colors.text },
  pieceMeta: { ...typography.caption, color: colors.textMuted },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bannerText: { ...typography.body, color: colors.text },
});
