import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ID, ISODate, WearLog } from '@/core/model/types';
import { localISODate } from '@/core/weather';
import { getServices } from '@/services';
import { getStores } from '@/state';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';
import { logsOnDate, wornLogs } from './wearLogic';

interface Pending {
  itemIds: ID[];
  outfitId: ID | undefined;
  today: ISODate;
  existing: WearLog[];
}

interface Notice {
  text: string;
  log: WearLog;
  /** Logs deleted by "Replace"; Undo brings them back. */
  replaced: WearLog[];
}

interface WoreToday {
  /** Log these pieces for today (asks Replace / Add another when today already has a log). */
  request: (itemIds: ID[], outfitId?: ID) => void;
  /** The confirmation with Undo and the Replace / Add another sheet; render it near the button. */
  element: ReactNode;
}

/**
 * "Wore this today": logs the pieces for today's local date with today's weather snapshot when
 * it is known. `context` keeps testIDs apart when several buttons are on one screen.
 */
export function useWoreToday(context: string): WoreToday {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();
  const id = `wore-today-${context}`;

  const commit = (p: Pending, replace: boolean) => {
    const { wear, weather } = getStores();
    const state = wear.getState();
    if (replace) for (const l of p.existing) state.remove(l.id);
    const log = state.logWorn(p.today, p.itemIds, p.outfitId, weather.getState().today);
    setNotice({
      text: replace ? 'Replaced today’s outfit.' : 'Logged for today.',
      log,
      replaced: replace ? p.existing : [],
    });
    setPending(undefined);
  };

  const request = (itemIds: ID[], outfitId?: ID) => {
    if (itemIds.length === 0) return;
    const today = localISODate(getServices().clock.now());
    const existing = wornLogs(logsOnDate(getStores().wear.getState().logs, today));
    const p: Pending = { itemIds, outfitId, today, existing };
    if (existing.length > 0) setPending(p);
    else commit(p, false);
  };

  const undo = () => {
    if (!notice) return;
    const state = getStores().wear.getState();
    state.remove(notice.log.id);
    for (const l of notice.replaced) state.restore(l);
    setNotice(undefined);
  };

  const element = (
    <>
      {notice ? (
        <View accessibilityLiveRegion="polite" style={styles.notice} testID={`${id}-notice`}>
          <Text style={styles.noticeText}>{notice.text}</Text>
          <View style={styles.noticeActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo"
              onPress={undo}
              style={styles.link}
              testID={`${id}-undo`}
            >
              <Text style={styles.linkText}>Undo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
              onPress={() => router.push('/calendar')}
              style={styles.link}
              testID={`${id}-calendar`}
            >
              <Text style={styles.linkText}>Calendar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Sheet
        visible={pending !== undefined}
        onClose={() => setPending(undefined)}
        title="Already logged today"
        testID={`${id}-sheet`}
      >
        <Text style={styles.sheetText}>
          You already logged an outfit for today. Replace it, or add this one as well?
        </Text>
        <Button
          label="Replace it"
          onPress={() => pending && commit(pending, true)}
          testID={`${id}-replace`}
        />
        <Button
          label="Add another"
          variant="secondary"
          onPress={() => pending && commit(pending, false)}
          testID={`${id}-add`}
        />
      </Sheet>
    </>
  );

  return { request, element };
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  noticeText: { ...typography.label, color: colors.success, paddingVertical: spacing.sm },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: 'auto' },
  link: {
    minHeight: minTouch,
    minWidth: minTouch,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { ...typography.label, color: colors.accent },
  sheetText: { ...typography.body, color: colors.text },
});
