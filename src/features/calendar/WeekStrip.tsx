import { Pressable, StyleSheet, Text, View } from 'react-native';
import { weekDates } from '@/core/dates';
import type { ID, ISODate, Item, WearLog } from '@/core/model/types';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { DayThumb } from './DayThumb';
import { WEEKDAY_SHORT, longDate } from './labels';
import { dayMark, thumbnailForDay } from './wearLogic';

const THUMB = 36;

interface WeekStripProps {
  today: ISODate;
  logsByDate: ReadonlyMap<ISODate, WearLog[]>;
  byId: ReadonlyMap<ID, Item>;
  imageUris: Readonly<Record<ID, string | undefined>>;
  onOpenDay: (date: ISODate) => void;
}

/** The current Monday-first week at a glance. */
export function WeekStrip({ today, logsByDate, byId, imageUris, onOpenDay }: WeekStripProps) {
  return (
    <View style={styles.row} testID="calendar-week">
      {weekDates(today).map((date, i) => {
        const logs = logsByDate.get(date) ?? [];
        const thumb = thumbnailForDay(logs, byId);
        const mark = dayMark(logs);
        const isToday = date === today;
        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={`${longDate(date)}${isToday ? ', today' : ''}`}
            onPress={() => onOpenDay(date)}
            style={[styles.day, isToday && styles.today]}
            testID={`calendar-week-${date}`}
          >
            <Text style={[styles.weekday, isToday && styles.todayText]}>{WEEKDAY_SHORT[i]}</Text>
            <View style={styles.mark}>
              <DayThumb
                mark={mark}
                item={thumb}
                uri={thumb ? imageUris[thumb.images.cutoutId] : undefined}
                size={THUMB}
              />
              {mark === 'none' ? <View style={styles.empty} /> : null}
            </View>
            <Text style={[styles.number, isToday && styles.todayText]}>
              {Number(date.slice(8))}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  today: { backgroundColor: colors.accentSoft },
  weekday: { ...typography.caption, color: colors.textMuted },
  number: { ...typography.label, color: colors.text },
  todayText: { color: colors.accent },
  mark: { height: THUMB, alignItems: 'center', justifyContent: 'center' },
  empty: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
});
