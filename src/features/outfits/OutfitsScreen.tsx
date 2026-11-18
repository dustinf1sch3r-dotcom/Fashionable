import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, spacing, typography } from '@/ui/theme';
import { useClosetHydration } from '../closet/list/useClosetHydration';
import { IdeasView } from './IdeasView';
import { SavedView } from './SavedView';
import { useRouter } from 'expo-router';

type Tab = 'ideas' | 'saved';

const TABS = [
  { value: 'ideas', label: 'Ideas' },
  { value: 'saved', label: 'Saved' },
] as const;

/** Outfits tab: generated ideas and the outfits you saved. */
export function OutfitsScreen() {
  useClosetHydration();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ideas');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-outfits">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Outfits
          </Text>
          <SegmentedControl
            options={TABS}
            value={tab}
            onChange={setTab}
            accessibilityLabel="Outfits view"
            testID="outfits-tab"
          />
        </View>
        {tab === 'ideas' ? (
          <IdeasView onShowSaved={(id) => router.push(`/outfits/${id}`)} />
        ) : (
          <View style={styles.saved}>
            <SavedView onShowIdeas={() => setTab('ideas')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  header: { paddingHorizontal: spacing.md, gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  saved: { paddingHorizontal: spacing.md },
});
