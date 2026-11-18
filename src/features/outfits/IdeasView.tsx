import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ID, Occasion, OutfitSuggestion } from '@/core/model/types';
import { useCloset, useOutfits } from '@/state';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { TryOnToggle } from '@/ui/TryOnToggle';
import { EmptyState } from '@/ui/EmptyState';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { useBody } from '../shared/useBody';
import { useImageUris } from '../shared/useImageUris';
import { PhotoHint } from '../me';
import { WeatherCard } from '../weather';
import { itemDisplayName } from '../closet/list/filter';
import { Carousel } from './Carousel';
import { newSeed } from './generateInput';
import { OCCASION_LABELS, OCCASION_ORDER, tooSmallText } from './missingSlots';
import { SuggestionCard } from './SuggestionCard';
import { suggestionView } from './suggestionView';
import { useSuggestions } from './useSuggestions';

const NONE: readonly OutfitSuggestion[] = [];

const sameSet = (a: readonly ID[], b: readonly ID[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

interface IdeasViewProps {
  /** Switch to the Saved tab (used from a saved card). */
  onShowSaved: (outfitId: ID) => void;
}

/** The "Ideas" tab: occasion, weather, Surprise me and the swipeable suggestions. */
export function IdeasView({ onShowSaved }: IdeasViewProps) {
  const router = useRouter();
  const { body, backdrop, mode, setMode, hasPhoto } = useBody();
  const [occasion, setOccasion] = useState<Occasion>('any');
  const [seed, setSeed] = useState<number>(newSeed);
  const [pinned, setPinned] = useState<ID[]>([]);
  const { result, busy, activeCount } = useSuggestions({ occasion, pinnedItemIds: pinned, seed });

  const allItems = useCloset((s) => s.items);
  const feedback = useOutfits((s) => s.feedback);
  const outfits = useOutfits((s) => s.outfits);
  const rate = useOutfits((s) => s.rate);
  const addOutfit = useOutfits((s) => s.addOutfit);

  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const view = result ? suggestionView(result, activeCount) : undefined;
  const suggestions = view?.kind === 'ready' ? view.suggestions : NONE;
  const pinnedItems = pinned.flatMap((id) => byId.get(id) ?? []);

  // useImageUris keys on the sorted, de-duplicated ids, so a fresh array each render is fine.
  const cutoutIds = suggestions.flatMap((s) =>
    s.itemIds.flatMap((id) => byId.get(id)?.images.cutoutId ?? []),
  );
  const imageUris = useImageUris(cutoutIds);

  const togglePin = (id: ID) =>
    setPinned((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const renderCard = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion) return null;
    const items = suggestion.itemIds.flatMap((id) => byId.get(id) ?? []);
    const key = [...suggestion.itemIds].sort().join('|');
    const verdict = feedback.find((f) => f.itemIds.join('|') === key)?.verdict;
    const savedOutfit = outfits.find((o) => sameSet(o.itemIds, suggestion.itemIds));
    return (
      <View style={styles.page}>
        <SuggestionCard
          index={index}
          suggestion={suggestion}
          items={items}
          body={body}
          {...(backdrop ? { backdrop } : {})}
          imageUris={imageUris}
          pinnedIds={pinned}
          verdict={verdict}
          saved={Boolean(savedOutfit)}
          {...(savedOutfit ? { savedOutfitId: savedOutfit.id } : {})}
          onTogglePin={togglePin}
          onOpenItem={(id) => router.push(`/closet/${id}`)}
          onRate={(v) => rate([...suggestion.itemIds].sort(), v)}
          onSave={() =>
            addOutfit({
              itemIds: suggestion.itemIds,
              source: 'generated',
              ...(occasion === 'any' ? {} : { occasion }),
            })
          }
          onOpenSaved={() => savedOutfit && onShowSaved(savedOutfit.id)}
        />
      </View>
    );
  };

  let results;
  if (!view) {
    results = (
      <View style={styles.center} testID="outfits-loading">
        <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Styling ideas" />
        <Text style={styles.muted}>Styling ideas…</Text>
      </View>
    );
  } else if (view.kind === 'empty') {
    results = (
      <EmptyState
        icon="shirt-outline"
        title="Your closet is empty"
        body="Photograph a few pieces and the ideas start here."
        action={{
          label: 'Add your first item',
          onPress: () => router.push('/closet/add'),
          testID: 'outfits-add-item',
        }}
        testID="outfits-empty"
      />
    );
  } else if (view.kind === 'too-small') {
    const text = tooSmallText(view.slots, occasion);
    results = (
      <EmptyState
        icon="add-circle-outline"
        title={text.title}
        body={text.body}
        action={{
          label: 'Add an item',
          onPress: () => router.push('/closet/add'),
          testID: 'outfits-add-item',
        }}
        testID="outfits-too-small"
      />
    );
  } else if (view.kind === 'none') {
    results = (
      <EmptyState
        icon="help-circle-outline"
        title="No outfits to show"
        body={
          pinned.length > 0
            ? 'Those pinned pieces don’t go together. Remove a pin to see ideas.'
            : 'Try another occasion.'
        }
        action={
          pinned.length > 0
            ? { label: 'Clear pins', onPress: () => setPinned([]), testID: 'outfits-clear-pins' }
            : undefined
        }
        testID="outfits-none"
      />
    );
  } else {
    results = (
      <View style={busy ? styles.dim : undefined}>
        <Carousel
          // Fresh results start on the first card.
          key={`${seed}-${occasion}-${pinned.join('|')}`}
          testID="outfits-carousel"
          pages={suggestions.map((_, i) => renderCard(i))}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.gutter}>
        <WeatherCard />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel="Occasion"
        testID="outfits-occasions"
      >
        {OCCASION_ORDER.map((o) => (
          <Chip
            key={o}
            role="radio"
            label={OCCASION_LABELS[o]}
            selected={occasion === o}
            onPress={() => setOccasion(o)}
            testID={`outfits-occasion-${o}`}
          />
        ))}
      </ScrollView>
      <View style={styles.gutter}>
        <Button
          label="Surprise me"
          icon="sparkles"
          size="lg"
          loading={busy && Boolean(view)}
          onPress={() => setSeed(newSeed())}
          testID="outfits-surprise"
        />
      </View>
      <PhotoHint />
      {pinnedItems.length > 0 ? (
        <View style={[styles.gutter, styles.pins]} testID="outfits-pins">
          <Text style={styles.sectionLabel}>Building around</Text>
          <View style={styles.pinRow}>
            {pinnedItems.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Stop building around ${itemDisplayName(item)}`}
                onPress={() => togglePin(item.id)}
                style={styles.pin}
                testID={`outfits-pin-${item.id}`}
              >
                <Ionicons name="pin" size={iconSize.sm} color={colors.accent} />
                <Text style={styles.pinText} numberOfLines={1}>
                  {itemDisplayName(item)}
                </Text>
                <Ionicons name="close" size={iconSize.sm} color={colors.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {view?.kind === 'ready' ? (
        <TryOnToggle mode={mode} onChange={setMode} visible={hasPhoto} />
      ) : null}
      <View>{results}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  gutter: { paddingHorizontal: spacing.md },
  page: { paddingHorizontal: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textMuted },
  chips: { paddingHorizontal: spacing.md, gap: spacing.sm },
  pins: { gap: spacing.xs },
  pinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pin: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  pinText: { ...typography.label, color: colors.accent, flexShrink: 1 },
  center: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  muted: { ...typography.body, color: colors.textMuted },
  dim: { opacity: 0.55 },
});
