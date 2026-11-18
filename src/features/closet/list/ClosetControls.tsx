import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORIES } from '@/core/model/taxonomy';
import type { Category, ColorName, ItemStatus } from '@/core/model/types';
import { Chip } from '@/ui/Chip';
import { ColorDot } from '@/ui/ColorDot';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { COLOR_LABELS } from '../labels';
import { CATEGORY_TAB_LABELS } from './categoryLabels';
import type { ClosetFilter, PresentColor, SortKey } from './filter';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'archived', label: 'Archived' },
] as const satisfies readonly { value: ItemStatus; label: string }[];

const SORT_LABELS: Record<SortKey, string> = { newest: 'Newest', name: 'Name A-Z' };

interface ClosetControlsProps {
  filter: ClosetFilter;
  onFilter: (patch: Partial<ClosetFilter>) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  colorOptions: readonly PresentColor[];
}

/** Search, category tabs, status, colour filter and sort. */
export function ClosetControls({
  filter,
  onFilter,
  sort,
  onSort,
  colorOptions,
}: ClosetControlsProps) {
  const categories: readonly (Category | 'all')[] = ['all', ...CATEGORIES];
  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <Ionicons name="search" size={iconSize.md} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search closet"
          placeholder="Search name, type or brand"
          placeholderTextColor={colors.textMuted}
          value={filter.query}
          onChangeText={(query) => onFilter({ query })}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
          testID="closet-search"
        />
        {filter.query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onFilter({ query: '' })}
            style={styles.clear}
            testID="closet-search-clear"
          >
            <Ionicons name="close-circle" size={iconSize.md} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        accessibilityRole="radiogroup"
        accessibilityLabel="Category"
        testID="closet-categories"
      >
        {categories.map((c) => (
          <Chip
            key={c}
            role="radio"
            label={c === 'all' ? 'All' : CATEGORY_TAB_LABELS[c]}
            selected={filter.category === c}
            onPress={() => onFilter({ category: c })}
            testID={`closet-category-${c}`}
          />
        ))}
      </ScrollView>

      <SegmentedControl
        options={STATUS_OPTIONS}
        value={filter.status}
        onChange={(status) => onFilter({ status })}
        accessibilityLabel="Status"
        testID="closet-status"
      />

      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colors}
          style={styles.colorScroll}
          testID="closet-colors"
        >
          {colorOptions.map((c) => {
            const selected = filter.color === c.name;
            return (
              <Pressable
                key={c.name}
                accessibilityRole="checkbox"
                accessibilityLabel={`Colour ${COLOR_LABELS[c.name]}`}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => onFilter({ color: selected ? null : (c.name as ColorName) })}
                style={[styles.colorBtn, selected && styles.colorBtnSelected]}
                testID={`closet-color-${c.name}`}
              >
                <ColorDot hex={c.hex} size="md" />
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${SORT_LABELS[sort]}. Tap to change`}
          onPress={() => onSort(sort === 'newest' ? 'name' : 'newest')}
          style={styles.sort}
          testID="closet-sort"
        >
          <Ionicons name="swap-vertical" size={iconSize.sm} color={colors.accent} />
          <Text style={styles.sortLabel}>{SORT_LABELS[sort]}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.text, minHeight: minTouch },
  clear: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: spacing.sm, paddingRight: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  colorScroll: { flex: 1 },
  colors: { gap: spacing.xs, alignItems: 'center' },
  colorBtn: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorBtnSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouch,
    paddingHorizontal: spacing.sm,
  },
  sortLabel: { ...typography.label, color: colors.accent },
});
