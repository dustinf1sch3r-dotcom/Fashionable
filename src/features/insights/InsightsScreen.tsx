import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { archetypeById, archetypeIdOfItemId } from '@/core/gaps';
import type { GapSuggestion } from '@/core/gaps';
import type { ID, Item } from '@/core/model/types';
import { useClosetHydration } from '@/features/closet/list/useClosetHydration';
import { itemDisplayName } from '@/features/closet/list/filter';
import { subcategoryLabel } from '@/features/closet/labels';
import { useBody } from '@/features/outfits/useBody';
import { useImageUris } from '@/features/shared/useImageUris';
import { useCloset, useWear } from '@/state';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { garmentArtUri, withArtAspect } from '@/ui/mannequin';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { DuplicateGroupCard } from './DuplicateGroupCard';
import { GapCard } from './GapCard';
import {
  archetypeTitle,
  closetReadiness,
  goesWithLabel,
  improvedLabel,
  plural,
  unlockedLabel,
  wouldHelpText,
  type Insights,
} from './insights';
import { OrphanRow } from './OrphanRow';
import { StatsSection } from './StatsSection';
import { computeStats } from './stats';
import { useInsights } from './useInsights';

const MAX_CONTENT_WIDTH = 560;

/** Local calendar date, `YYYY-MM-DD`. The feature layer owns "today"; core never reads the clock. */
function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Items of a suggestion's example outfit: closet items as they are, archetypes as flat art. */
function exampleItems(
  suggestion: GapSuggestion,
  byId: ReadonlyMap<ID, Item>,
): { items: Item[]; own: Item[] } {
  const items: Item[] = [];
  const own: Item[] = [];
  for (const id of suggestion.exampleOutfitItemIds) {
    const archetypeId = archetypeIdOfItemId(id);
    if (archetypeId !== undefined) {
      const archetype = archetypeById(archetypeId);
      if (archetype) items.push(withArtAspect(archetype.item));
    } else {
      const item = byId.get(id);
      if (item) {
        items.push(item);
        own.push(item);
      }
    }
  }
  return { items, own };
}

function pairsWithText(own: readonly Item[]): string {
  const names = own.slice(0, 2).map(itemDisplayName);
  if (names.length === 0) return '';
  return `Goes with your ${names.join(' and ')}`;
}

function Skeleton() {
  return (
    <View
      style={styles.section}
      testID="insights-loading"
      accessibilityLabel="Working out insights"
    >
      <ActivityIndicator color={colors.accent} accessibilityLabel="Working out insights" />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonBody} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: '40%' }]} />
            <View style={[styles.skeletonLine, { width: '70%' }]} />
            <View style={[styles.skeletonLine, { width: '55%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Section({
  title,
  hint,
  testID,
  children,
}: {
  title: string;
  hint?: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Quiet({ text, testID }: { text: string; testID: string }) {
  return (
    <Card testID={testID}>
      <Text style={styles.quiet}>{text}</Text>
    </Card>
  );
}

/** Closet insights: what to buy next, pieces that need friends, duplicates, wear stats. */
export function InsightsScreen() {
  const router = useRouter();
  const { status } = useClosetHydration();
  const items = useCloset((s) => s.items);
  const logs = useWear((s) => s.logs);
  const wearStatus = useWear((s) => s.status);
  const body = useBody();

  const loaded = status === 'ready' && wearStatus === 'ready';
  const readiness = useMemo(() => closetReadiness(items), [items]);
  const insights = useInsights(items, loaded && readiness.ready);
  const today = useMemo(() => localISODate(new Date()), []);
  const stats = useMemo(() => computeStats(items, logs, today), [items, logs, today]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const examples = useMemo(() => {
    const out = new Map<string, { items: Item[]; own: Item[] }>();
    if (insights)
      for (const g of [...insights.core, ...insights.addons])
        out.set(g.archetypeId, exampleItems(g, byId));
    return out;
  }, [insights, byId]);

  const cutoutIds = useMemo(
    () => [...examples.values()].flatMap((e) => e.own.map((i) => i.images.cutoutId)),
    [examples],
  );
  const loadedUris = useImageUris(cutoutIds);
  const imageUris = useMemo(() => {
    const uris: Record<ID, string | undefined> = { ...loadedUris };
    for (const e of examples.values())
      for (const item of e.items)
        if (archetypeIdOfItemId(item.id) !== undefined)
          uris[item.images.cutoutId] = garmentArtUri(item, { suggested: true });
    return uris;
  }, [loadedUris, examples]);

  const openItem = useCallback((id: string) => router.push(`/closet/${id}`), [router]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-insights">
      <View style={styles.page}>
        <View style={styles.header}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel="Back"
            onPress={goBack}
            testID="insights-back"
          />
          <Text accessibilityRole="header" style={styles.title}>
            Insights
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} testID="insights-scroll">
          {!loaded ? (
            <Skeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon="stats-chart-outline"
              title="Nothing to analyse yet"
              body="Add at least a few tops, bottoms and shoes and Insights will show what your closet is missing and what you wear most."
              action={{
                label: 'Add an item',
                onPress: () => router.push('/closet/add'),
                testID: 'insights-empty-add',
              }}
              testID="insights-empty"
            />
          ) : (
            <>
              <Suggestions
                insights={insights}
                readiness={readiness}
                items={items}
                examples={examples}
                body={body}
                imageUris={imageUris}
                byId={byId}
                onOpenItem={openItem}
              />
              <Section
                title="Your wardrobe in numbers"
                hint={`${plural(stats.itemCount, 'piece', 'pieces')} in your closet`}
                testID="insights-section-stats"
              >
                <StatsSection stats={stats} onOpenItem={openItem} />
              </Section>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

interface SuggestionsProps {
  insights: Insights | undefined;
  readiness: ReturnType<typeof closetReadiness>;
  items: readonly Item[];
  examples: ReadonlyMap<string, { items: Item[]; own: Item[] }>;
  body: ReturnType<typeof useBody>;
  imageUris: Readonly<Record<ID, string | undefined>>;
  byId: ReadonlyMap<ID, Item>;
  onOpenItem: (id: string) => void;
}

function Suggestions({
  insights,
  readiness,
  examples,
  body,
  imageUris,
  byId,
  onOpenItem,
}: SuggestionsProps) {
  if (!readiness.ready) {
    return (
      <Card testID="insights-too-small">
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Add a few more pieces
        </Text>
        <Text style={styles.quiet}>
          To suggest what to buy next, Insights needs at least a few tops, bottoms and shoes (or a
          dress and shoes) to build outfits from. You have {plural(readiness.tops, 'top', 'tops')},{' '}
          {plural(readiness.bottoms, 'bottom', 'bottoms')} and{' '}
          {plural(readiness.shoes, 'pair', 'pairs')} of shoes.
        </Text>
      </Card>
    );
  }
  if (!insights) return <Skeleton />;

  const card = (g: GapSuggestion, kind: 'gap' | 'addon') => {
    const example = examples.get(g.archetypeId);
    return (
      <GapCard
        key={g.archetypeId}
        title={archetypeTitle(g.archetypeId)}
        metric={kind === 'gap' ? unlockedLabel(g.unlockedCount) : improvedLabel(g.improvedCount)}
        pairsWith={pairsWithText(example?.own ?? [])}
        items={example?.items ?? []}
        body={body}
        imageUris={imageUris}
        testID={`insights-${kind}-${g.archetypeId}`}
      />
    );
  };

  return (
    <>
      <Section
        title="Pieces that would unlock the most outfits"
        hint="New outfits you could build if you owned one of these. The dashed piece is the suggestion."
        testID="insights-section-gaps"
      >
        {insights.core.length === 0 ? (
          <Quiet
            testID="insights-gaps-none"
            text="Your closet already covers the staples. Nothing obvious is missing."
          />
        ) : (
          insights.core.map((g) => card(g, 'gap'))
        )}
      </Section>

      {insights.addons.length > 0 ? (
        <Section
          title="Add-ons that lift outfits you have"
          hint="Layers and accessories that make outfits you can already wear look better."
          testID="insights-section-addons"
        >
          {insights.addons.map((g) => card(g, 'addon'))}
        </Section>
      ) : null}

      <Section
        title="Pieces that need friends"
        hint="Things that go with almost nothing else you own."
        testID="insights-section-orphans"
      >
        {insights.orphans.length === 0 ? (
          <Quiet
            testID="insights-orphans-none"
            text="Everything you own goes with something. Nice."
          />
        ) : (
          insights.orphans.map((o) => {
            const item = byId.get(o.itemId);
            return item ? (
              <OrphanRow
                key={o.itemId}
                item={item}
                countLabel={goesWithLabel(o.goodOutfitCount)}
                helpText={wouldHelpText(o.wouldHelp)}
                onOpenItem={onOpenItem}
                testID={`insights-orphan-${o.itemId}`}
              />
            ) : null;
          })
        )}
      </Section>

      <Section
        title="Looks like duplicates"
        hint="Near-identical pieces. Maybe you do not need both."
        testID="insights-section-duplicates"
      >
        {insights.duplicates.length === 0 ? (
          <Quiet testID="insights-duplicates-none" text="No look-alikes in your closet." />
        ) : (
          insights.duplicates.map((group, n) => {
            const members = group.itemIds
              .map((id) => byId.get(id))
              .filter((i): i is Item => i !== undefined);
            const first = members[0];
            return (
              <DuplicateGroupCard
                key={group.itemIds.join('+')}
                items={members}
                summary={`${first ? subcategoryLabel(first.subcategory) : 'Item'} · ${members.length} look-alikes`}
                onOpenItem={onOpenItem}
                testID={`insights-duplicates-${n}`}
              />
            );
          })
        )}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  title: { ...typography.title, color: colors.text },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.heading, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  quiet: { ...typography.body, color: colors.textMuted },
  skeletonCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonBody: { width: 96, height: 140, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  skeletonLines: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: colors.surfaceAlt },
});
