import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Item, ItemStatus } from '@/core/model/types';
import { getServices, type TouchupResult } from '@/services';
import { useCloset } from '@/state';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ColorDot } from '@/ui/ColorDot';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { CATEGORY_LABELS, COLOR_LABELS, PATTERN_LABELS, subcategoryLabel } from '../labels';
import { FORMALITY_LABELS, WARMTH_LABELS, capitalize } from '../list/categoryLabels';
import { itemDisplayName } from '../list/filter';
import { ItemImage } from '../list/ItemImage';
import { useClosetHydration } from '../list/useClosetHydration';
import { EditItemSheet, type ItemEdits } from './EditItemSheet';
import { TouchupOverlay } from '../touchup/TouchupOverlay';
import { recutItem, replaceCutoutImages } from './recut';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'archived', label: 'Archived' },
] as const satisfies readonly { value: ItemStatus; label: string }[];

export function ItemDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { status: load } = useClosetHydration();
  const item = useCloset((s) => s.items.find((i) => i.id === id));
  const toggleFavorite = useCloset((s) => s.toggleFavorite);
  const setStatus = useCloset((s) => s.setStatus);
  const updateItem = useCloset((s) => s.updateItem);
  const removeItem = useCloset((s) => s.removeItem);
  const restoreItem = useCloset((s) => s.restoreItem);
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [recut, setRecut] = useState<'idle' | 'working' | 'failed' | 'done'>('idle');

  const runRecut = async (current: Item) => {
    setRecut('working');
    try {
      const result = await recutItem(getServices(), current);
      updateItem(current.id, result);
      setRecut('done');
    } catch {
      setRecut('failed');
    }
  };

  const [touchup, setTouchup] = useState<
    { state: 'opening' } | { state: 'open'; originalUri: string; cutoutUri?: string } | null
  >(null);
  const [touchupError, setTouchupError] = useState(false);

  const openTouchup = async (current: Item) => {
    setTouchupError(false);
    setTouchup({ state: 'opening' });
    try {
      const { images } = getServices();
      const originalUri = await images.uri(current.images.originalId);
      // An item without a cutout starts as the whole photo, not as a copy of it.
      const cutoutUri = current.cutout.hasAlpha
        ? await images.uri(current.images.cutoutId)
        : undefined;
      setTouchup({ state: 'open', originalUri, cutoutUri });
    } catch {
      setTouchup(null);
      setTouchupError(true);
    }
  };

  const saveTouchup = async (current: Item, result: TouchupResult) => {
    try {
      const saved = await replaceCutoutImages(getServices().images, current, result);
      updateItem(current.id, saved);
      setTouchup(null);
    } catch {
      setTouchup(null);
      setTouchupError(true);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let body;
  if (item) {
    body = (
      <>
        <ItemBody
          item={item}
          onFavorite={() => toggleFavorite(id)}
          onStatus={(s) => setStatus(id, s)}
          onEdit={() => setEditing(true)}
          recut={recut}
          onRecut={() => void runRecut(item)}
          onTouchup={() => void openTouchup(item)}
          touchupState={touchup?.state === 'opening' ? 'opening' : touchupError ? 'failed' : 'idle'}
          onDelete={() => {
            removeItem(id);
            setDeleted(true);
          }}
        />
        {touchup?.state === 'open' ? (
          <TouchupOverlay
            originalUri={touchup.originalUri}
            cutoutUri={touchup.cutoutUri}
            onCancel={() => setTouchup(null)}
            onDone={(result) => void saveTouchup(item, result)}
          />
        ) : null}
        <EditItemSheet
          item={item}
          visible={editing}
          onClose={() => setEditing(false)}
          onSave={(edits: ItemEdits) => {
            updateItem(id, edits);
            setEditing(false);
          }}
        />
      </>
    );
  } else if (deleted) {
    body = (
      <View style={styles.center}>
        <View style={styles.banner} accessibilityRole="alert" testID="item-deleted">
          <Text style={styles.bannerText}>Item deleted</Text>
          <Button
            label="Undo"
            variant="secondary"
            onPress={() => {
              restoreItem(id);
              setDeleted(false);
            }}
            testID="item-undo"
          />
        </View>
        <Button
          label="Back to closet"
          variant="ghost"
          onPress={goBack}
          testID="item-deleted-back"
        />
      </View>
    );
  } else if (load === 'idle' || load === 'loading') {
    body = (
      <View style={styles.center} testID="item-loading">
        <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Loading item" />
      </View>
    );
  } else {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="help-circle-outline"
          title="Item not found"
          body="It may have been deleted."
          action={{ label: 'Back to closet', onPress: goBack, testID: 'item-not-found-back' }}
          testID="item-not-found"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-item-detail">
      <View style={styles.bar}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Back"
          onPress={goBack}
          testID="item-back"
        />
      </View>
      {body}
    </SafeAreaView>
  );
}

interface ItemBodyProps {
  item: Item;
  onFavorite: () => void;
  onStatus: (status: ItemStatus) => void;
  onEdit: () => void;
  recut: 'idle' | 'working' | 'failed' | 'done';
  onRecut: () => void;
  onTouchup: () => void;
  touchupState: 'idle' | 'opening' | 'failed';
  onDelete: () => void;
}

function ItemBody({
  item,
  onFavorite,
  onStatus,
  onEdit,
  recut,
  onRecut,
  onTouchup,
  touchupState,
  onDelete,
}: ItemBodyProps) {
  const rows: [string, string][] = [
    ['Category', CATEGORY_LABELS[item.category]],
    ['Pattern', PATTERN_LABELS[item.pattern]],
    ['Formality', `${item.formality}/5 ${FORMALITY_LABELS[item.formality]}`],
    ['Warmth', `${item.warmth}/5 ${WARMTH_LABELS[item.warmth]}`],
  ];
  if (item.material) rows.push(['Material', capitalize(item.material)]);
  if (item.brand) rows.push(['Brand', item.brand]);
  if (item.notes) rows.push(['Notes', item.notes]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} testID="item-scroll">
      <ItemImage
        imageId={item.images.cutoutId}
        fallbackId={item.images.thumbId}
        style={styles.hero}
        testID="item-image"
      />
      <View style={styles.titleRow}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title} testID="item-name">
            {itemDisplayName(item)}
          </Text>
          <Text style={styles.subtitle}>{subcategoryLabel(item.subcategory)}</Text>
        </View>
        <IconButton
          icon={item.favorite ? 'heart' : 'heart-outline'}
          accessibilityLabel={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
          selected={item.favorite}
          onPress={onFavorite}
          testID="item-favorite"
        />
      </View>

      <View style={styles.colors} testID="item-colors">
        {item.colors.map((c) => (
          <ColorDot key={c.hex} hex={c.hex} label={COLOR_LABELS[c.name]} />
        ))}
      </View>

      <SegmentedControl
        options={STATUS_OPTIONS}
        value={item.status}
        onChange={onStatus}
        accessibilityLabel="Status"
        testID="item-status"
      />

      <Card testID="item-attributes">
        {rows.map(([label, value]) => (
          <View key={label} style={styles.attr}>
            <Text style={styles.attrLabel}>{label}</Text>
            <Text style={styles.attrValue}>{value}</Text>
          </View>
        ))}
      </Card>

      {getServices().cutout.available || getServices().touchup.available ? (
        <View style={styles.recut}>
          <View style={styles.recutButtons}>
            {getServices().touchup.available ? (
              <Button
                label="Touch up"
                icon="brush-outline"
                variant="secondary"
                loading={touchupState === 'opening'}
                onPress={onTouchup}
                accessibilityLabel="Touch up the cutout with a brush"
                testID="item-touchup"
              />
            ) : null}
            {getServices().cutout.available ? (
              <Button
                label="Re-cut background"
                icon="cut-outline"
                variant="secondary"
                loading={recut === 'working'}
                onPress={onRecut}
                testID="item-recut"
              />
            ) : null}
          </View>
          {touchupState === 'failed' ? (
            <Text accessibilityRole="alert" style={styles.recutError} testID="item-touchup-error">
              {'⚠ We couldn\u2019t touch this one up. The current picture is unchanged.'}
            </Text>
          ) : null}
          {recut === 'working' ? (
            <Text style={styles.recutNote} testID="item-recut-working">
              Removing background…
            </Text>
          ) : null}
          {recut === 'failed' ? (
            <Text accessibilityRole="alert" style={styles.recutError} testID="item-recut-error">
              {'⚠ We couldn\u2019t cut this one out. The current picture is unchanged.'}
            </Text>
          ) : null}
          {recut === 'done' ? (
            <Text style={styles.recutNote} testID="item-recut-done">
              Background removed.
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button label="Edit" icon="create-outline" onPress={onEdit} testID="item-edit" />
        <Button
          label="Delete"
          icon="trash-outline"
          variant="danger"
          onPress={onDelete}
          testID="item-delete"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: { paddingHorizontal: spacing.sm, alignItems: 'flex-start' },
  center: { flex: 1, justifyContent: 'center', padding: spacing.md, gap: spacing.md },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingBottom: spacing.xl,
  },
  hero: { width: '100%', aspectRatio: 1, borderRadius: radius.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titles: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  attr: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  attrLabel: { ...typography.body, color: colors.textMuted },
  attrValue: { ...typography.label, color: colors.text, flexShrink: 1, textAlign: 'right' },
  recut: { gap: spacing.xs, alignItems: 'center' },
  recutButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  recutNote: { ...typography.caption, color: colors.textMuted },
  recutError: { ...typography.label, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { ...typography.label, color: colors.text, flex: 1 },
});
