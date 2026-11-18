import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { colors, iconSize, spacing, typography } from '@/ui/theme';
import { getStores, hydrateAll, useCloset, useOutfits, useProfile } from '@/state';
import { TryOnCard } from '@/features/me';
import { LocationUnitsCard } from '@/features/weather';
import { BackupCard } from './BackupCard';
import { ImportSheet } from './ImportSheet';
import { useBackup } from './useBackup';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ProfileScreen() {
  const router = useRouter();
  const backup = useBackup();
  const itemCount = useCloset((s) => s.items.length);
  const outfitCount = useOutfits((s) => s.outfits.length);
  const lastBackupAt = useProfile((s) => s.profile?.lastBackupAt);

  useEffect(() => {
    if (getStores().closet.getState().status === 'idle') void hydrateAll();
  }, []);

  return (
    <Screen title="Profile" testID="screen-profile">
      <ScrollView contentContainerStyle={styles.content}>
        <Card testID="profile-summary-card">
          <Text accessibilityRole="header" style={styles.heading}>
            Your closet
          </Text>
          <Text style={styles.body} testID="profile-item-count">
            {plural(itemCount, 'item', 'items')}
          </Text>
          <Text style={styles.body} testID="profile-outfit-count">
            {plural(outfitCount, 'outfit', 'outfits')}
          </Text>
        </Card>
        <Card
          onPress={() => router.push('/insights')}
          accessibilityLabel="Insights: what to buy next, duplicates and what you wear most"
          testID="profile-insights"
        >
          <View style={styles.insightsRow}>
            <Ionicons name="stats-chart-outline" size={iconSize.lg} color={colors.accent} />
            <View style={styles.insightsText}>
              <Text accessibilityRole="header" style={styles.heading}>
                Insights
              </Text>
              <Text style={styles.muted}>
                What to buy next, look-alikes and what you wear most.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={iconSize.md} color={colors.textMuted} />
          </View>
        </Card>
        <TryOnCard />
        <LocationUnitsCard />
        <BackupCard
          phase={backup.phase}
          notice={backup.notice}
          lastBackupAt={lastBackupAt}
          itemCount={itemCount}
          now={new Date()}
          onExport={() => void backup.exportNow()}
          onImport={() => void backup.chooseFile()}
        />
      </ScrollView>
      <ImportSheet
        fileName={backup.pending?.name ?? null}
        onChoose={(mode) => void backup.confirmImport(mode)}
        onClose={backup.cancelImport}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  heading: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  insightsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  insightsText: { flex: 1 },
});
