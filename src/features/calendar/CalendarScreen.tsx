import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addMonths, monthMatrix, monthOf, sameMonth, weekDates } from '@/core/dates';
import type { ISODate } from '@/core/model/types';
import { localISODate } from '@/core/weather';
import { getServices } from '@/services';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { colors, spacing, typography } from '@/ui/theme';
import { useImageUris } from '../shared/useImageUris';
import { MAX_WIDTH } from './layout';
import { MonthGrid } from './MonthGrid';
import { monthTitle } from './labels';
import { useCalendarData } from './useCalendarData';
import { WeekStrip } from './WeekStrip';
import { logsByDate as groupLogs, summarize, thumbnailForDay } from './wearLogic';

/** Text for the summary line under the grid. */
export function summaryText(loggedLast7: number, streak: number, totalDays: number): string {
  if (totalDays === 0) return 'Nothing logged yet. Tap a day to log what you wore.';
  const base = `Logged ${loggedLast7} of the last 7 days`;
  return streak >= 2 ? `${base} · ${streak}-day streak` : base;
}

/** The Calendar tab: month grid with outfit thumbnails, this week, and a short streak summary. */
export function CalendarScreen() {
  const router = useRouter();
  const { loading, logs, byId } = useCalendarData();
  const today: ISODate = localISODate(getServices().clock.now());
  const [month, setMonth] = useState(() => monthOf(today));
  const byDate = useMemo(() => groupLogs(logs), [logs]);

  // Cutouts for what the grid and the week strip show.
  const cutoutIds = useMemo(() => {
    const dates = [
      ...monthMatrix(month)
        .flat()
        .filter((c) => c.inMonth)
        .map((c) => c.date),
      ...weekDates(today),
    ];
    return dates.flatMap((d) => thumbnailForDay(byDate.get(d) ?? [], byId)?.images.cutoutId ?? []);
  }, [month, today, byDate, byId]);
  const imageUris = useImageUris(cutoutIds);

  const summary = summarize(logs, today);
  const openDay = (date: ISODate) => router.push(`/calendar/${date}`);
  const onCurrentMonth = sameMonth(month, monthOf(today));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-calendar">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <Text accessibilityRole="header" style={styles.title}>
            Calendar
          </Text>

          <Card>
            <View style={styles.monthBar}>
              <IconButton
                icon="chevron-back"
                accessibilityLabel="Previous month"
                onPress={() => setMonth(addMonths(month, -1))}
                testID="calendar-prev"
              />
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={styles.monthTitle}
                testID="calendar-month"
              >
                {monthTitle(month)}
              </Text>
              <IconButton
                icon="chevron-forward"
                accessibilityLabel="Next month"
                onPress={() => setMonth(addMonths(month, 1))}
                testID="calendar-next"
              />
            </View>
            {loading ? (
              <View style={styles.loading} testID="calendar-loading">
                <ActivityIndicator color={colors.accent} accessibilityLabel="Loading calendar" />
              </View>
            ) : (
              <MonthGrid
                month={month}
                today={today}
                logsByDate={byDate}
                byId={byId}
                imageUris={imageUris}
                onOpenDay={openDay}
              />
            )}
            {!onCurrentMonth ? (
              <Button
                label="Back to today"
                variant="ghost"
                onPress={() => setMonth(monthOf(today))}
                testID="calendar-today"
              />
            ) : null}
          </Card>

          {loading ? null : (
            <>
              <Text style={styles.summary} testID="calendar-summary">
                {summaryText(summary.loggedLast7, summary.streak, summary.totalDays)}
              </Text>
              <Card>
                <Text accessibilityRole="header" style={styles.section}>
                  This week
                </Text>
                <WeekStrip
                  today={today}
                  logsByDate={byDate}
                  byId={byId}
                  imageUris={imageUris}
                  onOpenDay={openDay}
                />
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { alignItems: 'center', paddingBottom: spacing.xl },
  page: { width: '100%', maxWidth: MAX_WIDTH, padding: spacing.md, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { ...typography.heading, color: colors.text, textAlign: 'center', flex: 1 },
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  summary: { ...typography.label, color: colors.text, textAlign: 'center' },
  section: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
});
