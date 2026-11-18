import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BODY_A } from '@/core/tryon/bodies';
import { fixtureById } from '@/core/testing/fixtures';
import type { ID, Item } from '@/core/model/types';
import { ChipGroup } from '@/ui/ChipGroup';
import { useFittedLayers } from '@/features/shared/fit/useFittedLayers';
import { Mannequin } from '@/ui/mannequin';
import { placeholderGarmentUri } from '@/ui/mannequin/devGarments';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, spacing, typography } from '@/ui/theme';

const OUTFITS = [
  {
    value: 'casual',
    label: 'Casual',
    ids: ['tee-white', 'jeans-dark', 'sneakers-white', 'belt-brown-leather', 'watch-silver'],
  },
  {
    value: 'dress',
    label: 'Dress',
    ids: ['dress-wrap-green', 'heels-black', 'bag-shoulder-brown'],
  },
  {
    value: 'winter',
    label: 'Winter',
    ids: [
      'tee-white',
      'cardigan-cream',
      'trench-beige',
      'jeans-dark',
      'boots-black-chelsea',
      'scarf-wool-red',
      'beanie-grey',
    ],
  },
  {
    value: 'formal',
    label: 'Formal',
    ids: ['shirt-oxford-white', 'trousers-black', 'loafers-brown', 'belt-black-leather'],
  },
  {
    value: 'jumpsuit',
    label: 'Jumpsuit',
    ids: ['jumpsuit-black', 'sandals-tan', 'sunglasses-black', 'necklace-gold'],
  },
] as const;

type OutfitKey = (typeof OUTFITS)[number]['value'];

const DEBUG_OPTIONS = [
  { value: 'off', label: 'Debug off' },
  { value: 'on', label: 'Debug on' },
] as const;

/** Developer page: fixture outfits on the mannequin with placeholder garments; anchor-tuning aid. */
export default function DevMannequinScreen() {
  const [outfitKey, setOutfitKey] = useState<OutfitKey>('casual');
  const [debug, setDebug] = useState<'on' | 'off'>('off');
  const [selected, setSelected] = useState<ID | undefined>();

  const items: Item[] = useMemo(() => {
    const def = OUTFITS.find((o) => o.value === outfitKey) ?? OUTFITS[0];
    return def.ids.map((id) => fixtureById(id));
  }, [outfitKey]);
  const imageUris = useMemo(() => {
    const map: Record<ID, string> = {};
    for (const item of items) map[item.images.cutoutId] = placeholderGarmentUri(item);
    return map;
  }, [items]);
  const fitted = useFittedLayers(items, BODY_A, { imageUris, displayWidth: 300 });
  const selectedItem = items.find((i) => i.id === selected);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right']}
      testID="screen-dev-mannequin"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Mannequin
        </Text>
        <ChipGroup
          options={OUTFITS}
          value={outfitKey}
          onChange={(v) => {
            setOutfitKey(v);
            setSelected(undefined);
          }}
          accessibilityLabel="Outfit"
          testID="dev-mannequin-outfits"
        />
        <SegmentedControl
          options={DEBUG_OPTIONS}
          value={debug}
          onChange={setDebug}
          accessibilityLabel="Debug overlay"
          testID="dev-mannequin-debug"
        />
        <Text style={styles.note} testID="dev-mannequin-selected">
          {selectedItem ? `Selected: ${selectedItem.name ?? selectedItem.id}` : 'Tap a garment'}
        </Text>
        <View style={styles.stage}>
          <Mannequin
            body={BODY_A}
            items={items}
            imageUris={imageUris}
            fitted={fitted}
            selectedItemId={selected}
            onSelectItem={setSelected}
            debug={debug === 'on'}
            testID="mannequin"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 3, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  note: { ...typography.caption, color: colors.textMuted },
  stage: { alignSelf: 'center', width: '100%', maxWidth: 300 },
});
