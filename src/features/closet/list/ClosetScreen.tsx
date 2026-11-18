import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { colors, spacing, typography } from '@/ui/theme';
import { useCloset } from '@/state';
import { ClosetControls } from './ClosetControls';
import {
  DEFAULT_FILTER,
  countByStatus,
  filterItems,
  hasActiveFilters,
  presentColors,
  sortItems,
  type ClosetFilter,
  type SortKey,
} from './filter';
import { ItemCard } from './ItemCard';
import { useClosetHydration } from './useClosetHydration';

const COLUMNS = 3;
const MAX_CONTENT_WIDTH = 560;
const GAP = spacing.sm;

export function ClosetScreen() {
  const router = useRouter();
  const { status, retry } = useClosetHydration();
  const items = useCloset((s) => s.items);
  const [filter, setFilter] = useState<ClosetFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<SortKey>('newest');
  const { width: windowWidth } = useWindowDimensions();

  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH) - spacing.md * 2;
  const cardWidth = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  const patchFilter = useCallback(
    (patch: Partial<ClosetFilter>) => setFilter((f) => ({ ...f, ...patch })),
    [],
  );
  const openItem = useCallback((id: string) => router.push(`/closet/${id}`), [router]);
  const addItem = useCallback(() => router.push('/closet/add'), [router]);
  const openInsights = useCallback(() => router.push('/insights'), [router]);

  const counts = useMemo(() => countByStatus(items), [items]);
  const colorOptions = useMemo(
    () =>
      presentColors(
        items.filter(
          (i) =>
            i.status === filter.status &&
            (filter.category === 'all' || i.category === filter.category),
        ),
      ),
    [items, filter.status, filter.category],
  );
  const visible = useMemo(() => sortItems(filterItems(items, filter), sort), [items, filter, sort]);

  const loading = status === 'idle' || status === 'loading';
  const empty = !loading && status !== 'error' && items.length === 0;
  const noMatches = !loading && !empty && visible.length === 0;

  const controls = (
    <View style={styles.controls}>
      <ClosetControls
        filter={filter}
        onFilter={patchFilter}
        sort={sort}
        onSort={setSort}
        colorOptions={colorOptions}
      />
    </View>
  );

  let body;
  if (loading) {
    body = (
      <View style={styles.center} testID="closet-loading">
        <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Loading closet" />
      </View>
    );
  } else if (status === 'error') {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="alert-circle-outline"
          title="Could not load your closet"
          body="Your items are safe. Try again."
          action={{ label: 'Try again', onPress: retry, testID: 'closet-retry' }}
          testID="closet-error"
        />
      </View>
    );
  } else if (empty) {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="camera-outline"
          title="Your closet is empty"
          body="Take a photo of something you own and it will show up here."
          action={{ label: 'Add your first item', onPress: addItem, testID: 'closet-empty-add' }}
          testID="closet-empty"
        />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={controls}
        ListEmptyComponent={
          noMatches ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              body={
                hasActiveFilters(filter)
                  ? 'Nothing fits these filters.'
                  : `Nothing here yet (${counts.active} active, ${counts.laundry} in the laundry, ${counts.archived} archived).`
              }
              action={
                hasActiveFilters(filter)
                  ? {
                      label: 'Clear filters',
                      onPress: () => patchFilter({ category: 'all', color: null, query: '' }),
                      testID: 'closet-clear-filters',
                    }
                  : undefined
              }
              testID="closet-no-matches"
            />
          ) : undefined
        }
        renderItem={({ item }) => <ItemCard item={item} width={cardWidth} onPress={openItem} />}
        testID="closet-grid"
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-closet">
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={styles.title}>
              Closet
            </Text>
            <Text style={styles.count} testID="closet-count">
              {items.length === 1 ? '1 item' : `${items.length} items`}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              label="Insights"
              icon="stats-chart-outline"
              variant="secondary"
              onPress={openInsights}
              testID="closet-insights-button"
            />
            <Button label="Add" icon="add" onPress={addItem} testID="closet-add-button" />
          </View>
        </View>
        {body}
      </View>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  titles: { gap: 0 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  count: { ...typography.caption, color: colors.textMuted },
  controls: { paddingBottom: spacing.md },
  list: { paddingBottom: spacing.xl },
  columns: { gap: GAP, marginBottom: spacing.md },
  center: { flex: 1, justifyContent: 'center' },
});
