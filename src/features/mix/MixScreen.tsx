import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scoreOutfit } from '@/core/engine/scoreOutfit';
import type { FitAdjust, ID, Item, Outfit } from '@/core/model/types';
import { localISODate } from '@/core/weather';
import { IDENTITY_FIT } from '@/core/tryon/place';
import { useWoreToday } from '@/features/calendar/useWoreToday';
import { sameItems } from '@/features/calendar/wearLogic';
import { itemDisplayName } from '@/features/closet/list/filter';
import { useClosetHydration } from '@/features/closet/list/useClosetHydration';
import { useImageUris } from '@/features/shared/useImageUris';
import { getServices } from '@/services';
import { getStores, useCloset, useOutfits, useWeather, useWear } from '@/state';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { effectiveFit, isIdentityFit, sameFit } from '@/ui/mannequin/fit';
import { FitBar } from '@/ui/mannequin/FitBar';
import { Mannequin } from '@/ui/mannequin/Mannequin';
import { TryOnToggle } from '@/ui/TryOnToggle';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { useComposite } from '../shared/composite/useComposite';
import { useFittedLayers } from '../shared/fit/useFittedLayers';
import { useBody } from '../shared/useBody';
import { CompactButton } from './CompactButton';
import { hasBaseTop, prunedOverrides } from './fitOverrides';
import { MeterCard } from './MeterCard';
import { OptionRow } from './OptionRow';
import { SaveOutfitSheet } from './SaveOutfitSheet';
import { shuffleRows } from './shuffle';
import {
  clearRow,
  itemsInRow,
  ROW_KEYS,
  ROWS,
  rowDef,
  rowSelection,
  selectionIds,
  toggleItem,
  type RowKey,
} from './slotRows';

const MAX_WIDTH = 560;
/** Space taken by the tab bar and the browser chrome, when sizing the mannequin to the window. */
const CHROME_HEIGHT = 140;
const STAGE_HEIGHT_SHARE = 0.5;
const MANNEQUIN_WIDTH = { min: 120, max: 200, share: 0.46 } as const;
/** Added to the seed on every shuffle press so repeated presses differ. */
const SEED_STEP = 0x9e3779b1;

const NO_ITEMS: readonly Item[] = [];

function draftOutfit(
  id: ID | undefined,
  itemIds: ID[],
  tucked: boolean,
  fitOverrides: Record<ID, FitAdjust>,
): Outfit {
  return {
    id: id ?? 'mix-draft',
    createdAt: '',
    updatedAt: '',
    itemIds,
    source: 'manual',
    favorite: false,
    tucked,
    fitOverrides,
  };
}

export function MixScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ outfitId?: string | string[] }>();
  const outfitParam = Array.isArray(params.outfitId) ? params.outfitId[0] : params.outfitId;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { status: closetStatus } = useClosetHydration();
  const items = useCloset((s) => s.items);
  const outfits = useOutfits((s) => s.outfits);
  const outfitsStatus = useOutfits((s) => s.status);
  const feedback = useOutfits((s) => s.feedback);
  const wearLogs = useWear((s) => s.logs);
  const weather = useWeather((s) => s.today);

  const [itemIds, setItemIds] = useState<ID[]>([]);
  const [locked, setLocked] = useState<ReadonlySet<RowKey>>(() => new Set());
  const [tucked, setTucked] = useState(false);
  const [overrides, setOverrides] = useState<Record<ID, FitAdjust>>({});
  const [editingId, setEditingId] = useState<ID | undefined>();
  const [garmentId, setGarmentId] = useState<ID | undefined>();
  const [saveOpen, setSaveOpen] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [fitStatus, setFitStatus] = useState<string | undefined>();
  const [missing, setMissing] = useState(false);
  const woreToday = useWoreToday('mix');
  const seed = useRef(getServices().clock.now().getTime());

  // Weather feeds the score; it is a no-op when no location has been saved.
  useEffect(() => {
    const w = getStores().weather.getState();
    if (w.status === 'idle') void w.refresh();
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const pool = useMemo(() => items.filter((i) => i.status === 'active'), [items]);
  const selection = useMemo(
    () => itemIds.flatMap((id) => byId.get(id) ?? NO_ITEMS),
    [itemIds, byId],
  );
  const garment = garmentId ? selection.find((i) => i.id === garmentId) : undefined;

  // Open a saved outfit: /mix?outfitId=<id>. Adjusting state while rendering is React's pattern
  // for resetting state when an input (here the route parameter) changes.
  const [loadedFor, setLoadedFor] = useState<string | undefined>();
  if (
    outfitParam &&
    loadedFor !== outfitParam &&
    closetStatus === 'ready' &&
    outfitsStatus === 'ready'
  ) {
    setLoadedFor(outfitParam);
    const outfit = outfits.find((o) => o.id === outfitParam);
    setMissing(!outfit);
    if (outfit) {
      setItemIds(outfit.itemIds.filter((id) => byId.has(id)));
      setTucked(outfit.tucked ?? false);
      setOverrides({ ...outfit.fitOverrides });
      setEditingId(outfit.id);
      setLocked(new Set());
      setGarmentId(undefined);
      setStatus(undefined);
      setFitStatus(undefined);
    }
  }

  const today = localISODate(getServices().clock.now());
  const score = useCallback(
    (list: readonly Item[]) =>
      scoreOutfit(list, { date: today, occasion: 'any', weather }, { wearLogs, feedback }),
    [today, weather, wearLogs, feedback],
  );
  const breakdown = useMemo(
    () => (selection.length >= 2 ? score(selection) : null),
    [selection, score],
  );

  const draft = useMemo(
    () => draftOutfit(editingId, itemIds, tucked, overrides),
    [editingId, itemIds, tucked, overrides],
  );
  const cutoutUris = useImageUris(selection.map((i) => i.images.cutoutId));
  const { body, backdrop, mode, setMode, hasPhoto } = useBody();

  const changed = () => {
    setStatus(undefined);
    setFitStatus(undefined);
  };
  const setSelection = (next: readonly Item[]) => {
    setItemIds(selectionIds(next));
    changed();
  };
  const pick = (item: Item) => setSelection(toggleItem(selection, item));
  const none = (row: RowKey) => setSelection(clearRow(selection, row));
  const toggleLock = (row: RowKey) =>
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  const shuffle = (rows: readonly RowKey[]) => {
    seed.current = (seed.current + SEED_STEP) >>> 0;
    setSelection(
      shuffleRows({
        pool,
        selection,
        locked,
        rows,
        seed: seed.current,
        score: (l) => score(l).total,
      }),
    );
  };
  const startOver = () => {
    setItemIds([]);
    setOverrides({});
    setTucked(false);
    setLocked(new Set());
    setGarmentId(undefined);
    setEditingId(undefined);
    changed();
  };

  // ── fit editing ──────────────────────────────────────────────────────────────────────────
  const setFit = (itemId: ID, fit: FitAdjust) => {
    setOverrides((prev) => ({ ...prev, [itemId]: fit }));
    setFitStatus(undefined);
  };
  const saveFitToItem = (item: Item) => {
    const fit = effectiveFit(item, draft);
    getStores()
      .closet.getState()
      .updateItem(item.id, {
        fitAdjust: isIdentityFit(fit) ? undefined : fit,
      });
    setOverrides(({ [item.id]: _dropped, ...rest }) => rest);
    setFitStatus('Saved for this item. Every outfit uses it now.');
  };
  const saveFitToOutfit = () => {
    if (editingId) {
      getStores()
        .outfits.getState()
        .updateOutfit(editingId, {
          fitOverrides: prunedOverrides(selection, overrides),
        });
      setFitStatus('Kept for this outfit.');
    } else {
      setFitStatus('Kept for this outfit. It is saved when you save the outfit.');
    }
  };

  // ── saving ───────────────────────────────────────────────────────────────────────────────
  const outfitFields = () => ({
    itemIds: selectionIds(selection),
    tucked: tucked && hasBaseTop(selection),
    fitOverrides: prunedOverrides(selection, overrides),
  });
  const saveNew = (name: string) => {
    const saved = getStores()
      .outfits.getState()
      .addOutfit({ ...outfitFields(), source: 'manual', ...(name ? { name } : null) });
    setEditingId(saved.id);
    setSaveOpen(false);
    setStatus(name ? `Saved “${name}”` : 'Outfit saved');
  };
  const update = () => {
    if (!editingId) return;
    getStores().outfits.getState().updateOutfit(editingId, outfitFields());
    setStatus('Outfit updated');
  };

  // ── layout ───────────────────────────────────────────────────────────────────────────────
  const contentWidth = Math.min(windowWidth, MAX_WIDTH);
  const mannequinWidth = Math.round(
    Math.max(
      MANNEQUIN_WIDTH.min,
      Math.min(
        MANNEQUIN_WIDTH.max,
        contentWidth * MANNEQUIN_WIDTH.share,
        ((windowHeight - CHROME_HEIGHT) * STAGE_HEIGHT_SHARE - spacing.xl) / 2,
      ),
    ),
  );

  const fitted = useFittedLayers(selection, body, {
    imageUris: cutoutUris,
    displayWidth: mannequinWidth,
  });
  // One merged picture while nothing is being fitted; the layers take over while a garment is selected.
  const composite = useComposite({
    items: selection,
    body,
    ...(backdrop ? { backdrop } : {}),
    outfit: draft,
    imageUris: cutoutUris,
    fitted,
    displayWidth: mannequinWidth,
    background: colors.surfaceAlt,
    enabled: garment === undefined,
  });

  if (closetStatus === 'idle' || closetStatus === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-mix">
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (pool.length === 0 && selection.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-mix">
        <EmptyState
          icon="shirt-outline"
          title="Nothing to mix yet"
          body="Photograph a few of your clothes and come back to try them together."
          action={{
            label: 'Add your first piece',
            onPress: () => router.push('/closet/add'),
            testID: 'mix-empty-add',
          }}
          testID="mix-empty"
        />
      </SafeAreaView>
    );
  }

  const itemSaved = garment ? effectiveFit(garment) : IDENTITY_FIT;
  const garmentFit = garment ? effectiveFit(garment, draft) : IDENTITY_FIT;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-mix">
      <View style={[styles.page, { maxWidth: MAX_WIDTH }]}>
        <View style={styles.stage}>
          <View style={[styles.mannequin, { width: mannequinWidth + spacing.md }]}>
            {body ? (
              <Mannequin
                body={body}
                {...(backdrop ? { backdrop } : {})}
                items={selection}
                outfit={draft}
                imageUris={cutoutUris}
                fitted={fitted}
                {...(composite.uri ? { merged: composite.uri } : {})}
                selectedItemId={garment?.id}
                onSelectItem={(id) => {
                  setGarmentId(id);
                  setFitStatus(undefined);
                }}
                onFitChange={setFit}
                interactive
              />
            ) : null}
          </View>
          <View style={styles.side}>
            <TryOnToggle mode={mode} onChange={setMode} visible={hasPhoto} fill />
            <MeterCard breakdown={breakdown} withWeather={weather !== undefined} />
            <Chip
              label="Tuck in top"
              selected={tucked}
              disabled={!hasBaseTop(selection)}
              onPress={() => {
                setTucked(!tucked);
                changed();
              }}
              testID="mix-tuck"
            />
            <CompactButton
              label="Shuffle unlocked"
              icon="shuffle"
              onPress={() => shuffle(ROW_KEYS)}
              testID="mix-shuffle"
            />
            <CompactButton
              label={editingId ? 'Update outfit' : 'Save outfit'}
              icon="bookmark-outline"
              variant="primary"
              disabled={selection.length === 0}
              onPress={() => (editingId ? update() : setSaveOpen(true))}
              testID="mix-save"
            />
            <CompactButton
              label="Wore this today"
              icon="checkmark-circle-outline"
              disabled={selection.length === 0}
              onPress={() => {
                const ids = selectionIds(selection);
                const saved = outfits.find((o) => o.id === editingId);
                woreToday.request(
                  ids,
                  saved && sameItems(saved.itemIds, ids) ? saved.id : undefined,
                );
              }}
              testID="wore-today-mix"
            />
            {woreToday.element}
            {status ? (
              <Text accessibilityLiveRegion="polite" style={styles.status} testID="mix-status">
                {status}
              </Text>
            ) : null}
          </View>
        </View>

        {missing ? (
          <Text style={styles.warn} testID="mix-missing">
            That outfit could not be found, so you are starting fresh.
          </Text>
        ) : null}

        {garment ? (
          <ScrollView
            style={styles.lower}
            contentContainerStyle={styles.fitPanel}
            testID="mix-fit-panel"
          >
            <FitBar
              title={itemDisplayName(garment)}
              fit={garmentFit}
              onChange={(fit) => setFit(garment.id, fit)}
              onReset={() => setFit(garment.id, IDENTITY_FIT)}
              onSaveItem={() => saveFitToItem(garment)}
              onSaveOutfit={saveFitToOutfit}
              dirty={!sameFit(garmentFit, itemSaved)}
              message={fitStatus}
              onDone={() => {
                setGarmentId(undefined);
                setFitStatus(undefined);
              }}
            />
            {selection.length > 1 ? (
              <View style={styles.garments} testID="mix-fit-garments">
                {selection.map((i) => (
                  <Chip
                    key={i.id}
                    label={itemDisplayName(i)}
                    role="radio"
                    selected={i.id === garment.id}
                    onPress={() => {
                      setGarmentId(i.id);
                      setFitStatus(undefined);
                    }}
                    testID={`mix-fit-garment-${i.id}`}
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView style={styles.lower} contentContainerStyle={styles.rows} testID="mix-rows">
            {ROWS.map((def) => {
              const options = itemsInRow(pool, def.key);
              if (options.length === 0) {
                if (!def.core) return null;
                return (
                  <View key={def.key} style={styles.emptyRow} testID={`mix-row-${def.key}`}>
                    <Text style={styles.emptyText} testID={`mix-row-${def.key}-empty`}>
                      {`No ${def.empty} yet.`}
                    </Text>
                    <Button
                      label="Add one"
                      variant="ghost"
                      onPress={() => router.push('/closet/add')}
                      testID={`mix-add-${def.key}`}
                    />
                  </View>
                );
              }
              return (
                <OptionRow
                  key={def.key}
                  def={rowDef(def.key)}
                  options={options}
                  picked={rowSelection(selection, def.key)}
                  locked={locked.has(def.key)}
                  onPick={pick}
                  onNone={() => none(def.key)}
                  onToggleLock={() => toggleLock(def.key)}
                  onShuffle={() => shuffle([def.key])}
                />
              );
            })}
            <View style={styles.footer}>
              <Text style={styles.hint}>Tap a garment on the mannequin to adjust how it sits.</Text>
              <Button label="Start over" variant="ghost" onPress={startOver} testID="mix-clear" />
            </View>
          </ScrollView>
        )}
      </View>
      <SaveOutfitSheet visible={saveOpen} onClose={() => setSaveOpen(false)} onSave={saveNew} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, width: '100%', alignSelf: 'center' },
  stage: {
    flexDirection: 'row',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  mannequin: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    overflow: 'visible',
    padding: spacing.sm,
    paddingBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  side: { flex: 1, gap: spacing.sm, justifyContent: 'flex-start' },
  status: { ...typography.caption, color: colors.success },
  warn: { ...typography.caption, color: colors.warning, paddingHorizontal: spacing.md },
  lower: { flex: 1 },
  rows: { paddingBottom: spacing.lg, gap: spacing.xs },
  fitPanel: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  garments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  emptyText: { ...typography.body, color: colors.textMuted },
  footer: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
