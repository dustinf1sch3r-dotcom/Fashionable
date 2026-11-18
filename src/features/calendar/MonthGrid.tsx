import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { monthMatrix, type YearMonth } from '@/core/dates';
import type { ID, ISODate, Item, WearLog } from '@/core/model/types';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { DayThumb } from './DayThumb';
import { WEEKDAY_SHORT, longDate } from './labels';
import { dayMark, thumbnailForDay, type DayMark } from './wearLogic';

const THUMB = 28;
const NUMBER = 24;

interface MonthGridProps {
  month: YearMonth;
  today: ISODate;
  logsByDate: ReadonlyMap<ISODate, WearLog[]>;
  byId: ReadonlyMap<ID, Item>;
  imageUris: Readonly<Record<ID, string | undefined>>;
  onOpenDay: (date: ISODate) => void;
}

const MARK_TEXT: Record<DayMark, string> = {
  worn: 'outfit logged',
  planned: 'outfit planned',
  none: 'nothing logged',
};

/** Weekday header plus the weeks of one month, Monday first. */
export function MonthGrid({
  month,
  today,
  logsByDate,
  byId,
  imageUris,
  onOpenDay,
}: MonthGridProps) {
  const weeks = monthMatrix(month);
  return (
    <View testID="calendar-grid">
      <View style={styles.row}>
        {WEEKDAY_SHORT.map((w) => (
          <Text key={w} style={[styles.cell, styles.weekday]} accessibilityElementsHidden>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]?.date} style={styles.row}>
          {week.map((cell) => {
            if (!cell.inMonth) return <View key={cell.date} style={styles.cell} />;
            const logs = logsByDate.get(cell.date) ?? [];
            const thumb = thumbnailForDay(logs, byId);
            return (
              <DayCell
                key={cell.date}
                date={cell.date}
                isToday={cell.date === today}
                mark={dayMark(logs)}
                item={thumb}
                uri={thumb ? imageUris[thumb.images.cutoutId] : undefined}
                onOpenDay={onOpenDay}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface DayCellProps {
  date: ISODate;
  isToday: boolean;
  mark: DayMark;
  item: Item | undefined;
  uri: string | undefined;
  onOpenDay: (date: ISODate) => void;
}

const DayCell = memo(function DayCell({ date, isToday, mark, item, uri, onOpenDay }: DayCellProps) {
  const day = Number(date.slice(8));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${longDate(date)}${isToday ? ', today' : ''}, ${MARK_TEXT[mark]}`}
      onPress={() => onOpenDay(date)}
      style={({ pressed }) => [styles.cell, styles.day, pressed && styles.pressed]}
      testID={`calendar-day-${date}`}
    >
      <View style={[styles.number, isToday && styles.today]}>
        <Text style={[styles.numberText, isToday && styles.todayText]}>{day}</Text>
      </View>
      <View style={styles.mark}>
        <DayThumb mark={mark} item={item} uri={uri} size={THUMB} testID={`calendar-day-${date}`} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1 },
  weekday: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing.xs,
  },
  day: {
    minHeight: NUMBER + THUMB + spacing.xs * 2 + 2,
    alignItems: 'center',
    paddingTop: 2,
    gap: 2,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  number: {
    minWidth: NUMBER,
    height: NUMBER,
    borderRadius: NUMBER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { ...typography.caption, color: colors.text },
  today: { backgroundColor: colors.accent },
  todayText: { color: colors.onAccent, fontWeight: '700' },
  mark: { height: THUMB, alignItems: 'center', justifyContent: 'center' },
});
