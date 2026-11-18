import { Ionicons } from '@/ui/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, parseISODate } from '@/core/dates';
import type { ID, ISODate, Item, Outfit, Weather, WearLog } from '@/core/model/types';
import { formatTemp, localISODate, percent } from '@/core/weather';
import { getServices } from '@/services';
import { getStores, useOutfits, useProfile } from '@/state';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Mannequin } from '@/ui/mannequin';
import { TryOnToggle } from '@/ui/TryOnToggle';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { subcategoryLabel } from '../closet/labels';
import { itemDisplayName } from '../closet/list/filter';
import { autoName, outfitName } from '../outfits/naming';
import { resolveOutfitItems } from '../outfits/outfitItems';
import { useFittedLayers } from '../shared/fit/useFittedLayers';
import { useBody, type UseBody } from '../shared/useBody';
import { useImageUris } from '../shared/useImageUris';
import { WeatherCard } from '../weather';
import { ItemPickerSheet } from './ItemPickerSheet';
import { longDate } from './labels';
import { MAX_WIDTH } from './layout';
import { PlanSheet } from './PlanSheet';
import { useCalendarData } from './useCalendarData';
import { inForecastRange, logsOnDate, sameItems } from './wearLogic';

const MANNEQUIN_WIDTH = 170;
const ROW_THUMB = 48;

interface Notice {
  text: string;
  onUndo: () => void;
}

/** One day: what was worn or planned on the mannequin, its pieces and the weather, with actions. */
export function CalendarDayScreen({ date }: { date: string }) {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/calendar'));
  const valid = parseISODate(date) !== undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-calendar-day">
      <View style={styles.bar}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Back to calendar"
          onPress={goBack}
          testID="calendar-day-back"
        />
      </View>
      {valid ? (
        <DayBody date={date} />
      ) : (
        <EmptyState
          icon="help-circle-outline"
          title="Date not found"
          body="That is not a day in the calendar."
          action={{
            label: 'Back to calendar',
            onPress: goBack,
            testID: 'calendar-day-invalid-back',
          }}
          testID="calendar-day-invalid"
        />
      )}
    </SafeAreaView>
  );
}

function relativeDay(date: ISODate, today: ISODate): string | undefined {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return undefined;
}

function DayBody({ date }: { date: ISODate }) {
  const router = useRouter();
  const { loading, logs: allLogs, byId } = useCalendarData();
  const outfits = useOutfits((s) => s.outfits);
  const bodyView = useBody();
  const [notice, setNotice] = useState<Notice | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const today: ISODate = localISODate(getServices().clock.now());
  const logs = useMemo(() => logsOnDate(allLogs, date), [allLogs, date]);
  const isPast = date < today;
  const isFuture = date > today;
  const showForecast = inForecastRange(date, today) && !logs.some((l) => !l.planned && l.weather);
  const pickable = useMemo(() => [...byId.values()].filter((i) => i.status !== 'archived'), [byId]);

  /** Weather worth recording on a log for `date`: only what the store already knows. */
  const weatherFor = (): Weather | undefined => {
    const w = getStores().weather.getState();
    return date === today ? w.today : w.byDate[date];
  };

  const wear = () => getStores().wear.getState();
  const remove = (log: WearLog, text: string) => {
    wear().remove(log.id);
    setNotice({ text, onUndo: () => wear().restore(log) });
  };

  const logPieces = (itemIds: ID[]) => {
    const log = wear().logWorn(date, itemIds, undefined, weatherFor());
    setPickerOpen(false);
    setNotice({ text: 'Logged.', onUndo: () => wear().remove(log.id) });
  };

  const planOutfit = (outfit: Outfit) => {
    const ids = outfit.itemIds.filter((id) => byId.has(id));
    const log = wear().plan(date, ids, outfit.id);
    setPlanOpen(false);
    setNotice({ text: 'Planned.', onUndo: () => wear().remove(log.id) });
  };

  const confirmWorn = (log: WearLog) => {
    wear().markWorn(log.id, weatherFor());
    setNotice({
      text: 'Marked as worn.',
      onUndo: () => {
        wear().remove(log.id);
        wear().restore(log);
      },
    });
  };

  const rel = relativeDay(date, today);
  const year = Number(today.slice(0, 4));

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title} testID="calendar-day-title">
              {longDate(date, year)}
            </Text>
            {rel ? (
              <Text style={styles.meta} testID="calendar-day-relative">
                {rel}
              </Text>
            ) : null}
          </View>

          {notice ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.notice}
              testID="calendar-day-notice"
            >
              <Text style={styles.noticeText}>{notice.text}</Text>
              <Button
                label="Undo"
                variant="ghost"
                onPress={() => {
                  notice.onUndo();
                  setNotice(undefined);
                }}
                testID="calendar-day-undo"
              />
            </View>
          ) : null}

          {loading ? (
            <View style={styles.center} testID="calendar-day-loading">
              <ActivityIndicator
                color={colors.accent}
                size="large"
                accessibilityLabel="Loading day"
              />
            </View>
          ) : (
            <>
              {logs.length === 0 ? (
                <Card testID="calendar-day-empty">
                  <Text style={styles.body}>
                    {isFuture
                      ? 'Nothing planned for this day yet.'
                      : 'Nothing logged for this day yet.'}
                  </Text>
                </Card>
              ) : null}

              {logs.map((log) => (
                <DayLog
                  key={log.id}
                  log={log}
                  today={today}
                  byId={byId}
                  outfits={outfits}
                  bodyView={bodyView}
                  onDelete={() => remove(log, log.planned ? 'Plan removed.' : 'Log deleted.')}
                  onYes={() => confirmWorn(log)}
                  onNo={() => remove(log, 'Plan removed.')}
                />
              ))}

              {logs.length > 0 ? (
                <TryOnToggle
                  mode={bodyView.mode}
                  onChange={bodyView.setMode}
                  visible={bodyView.hasPhoto}
                />
              ) : null}

              {showForecast ? <WeatherCard date={date} /> : null}

              <View style={styles.actions}>
                {!isFuture ? (
                  <Button
                    label={logs.some((l) => !l.planned) ? 'Log another outfit' : 'Log what I wore'}
                    icon="add-circle-outline"
                    size="lg"
                    variant={isPast || logs.length === 0 ? 'primary' : 'secondary'}
                    onPress={() => setPickerOpen(true)}
                    testID="log-items"
                  />
                ) : null}
                {!isPast ? (
                  <Button
                    label="Plan an outfit"
                    icon="calendar-outline"
                    size="lg"
                    variant={isFuture ? 'primary' : 'secondary'}
                    onPress={() => setPlanOpen(true)}
                    testID="plan-outfit"
                  />
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <ItemPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="What did you wear?"
        items={pickable}
        onConfirm={logPieces}
      />
      <PlanSheet
        visible={planOpen}
        onClose={() => setPlanOpen(false)}
        onPick={planOutfit}
        onOpenMix={() => {
          setPlanOpen(false);
          router.push('/mix');
        }}
      />
    </>
  );
}

interface DayLogProps {
  log: WearLog;
  today: ISODate;
  byId: ReadonlyMap<ID, Item>;
  outfits: readonly Outfit[];
  bodyView: UseBody;
  onDelete: () => void;
  onYes: () => void;
  onNo: () => void;
}

function DayLog({ log, today, byId, outfits, bodyView, onDelete, onYes, onNo }: DayLogProps) {
  const router = useRouter();
  const { body, backdrop } = bodyView;
  const units = useProfile((s) => s.profile?.units ?? 'metric');
  const resolved = resolveOutfitItems(log.itemIds, byId);
  const imageUris = useImageUris(resolved.items.map((i) => i.images.cutoutId));
  const fitted = useFittedLayers(resolved.items, body, {
    imageUris,
    displayWidth: MANNEQUIN_WIDTH,
  });
  // The saved outfit only supplies tuck and fit tweaks while the pieces still match it.
  const saved = log.outfitId ? outfits.find((o) => o.id === log.outfitId) : undefined;
  const outfit =
    saved &&
    sameItems(
      saved.itemIds,
      resolved.items.map((i) => i.id),
    )
      ? saved
      : undefined;
  const title = saved ? outfitName(saved, resolved.items) : autoName(resolved.items);
  const due = log.planned && log.date <= today;
  const status = !log.planned ? 'Worn' : due ? 'Planned — did you wear it?' : 'Planned';
  const w = log.weather;

  return (
    <Card testID={`day-log-${log.id}`}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, log.planned && styles.badgePlanned]}>
          <Ionicons
            name={log.planned ? 'calendar-outline' : 'checkmark-circle'}
            size={iconSize.sm}
            color={log.planned ? colors.accent : colors.success}
            accessibilityElementsHidden
          />
          <Text
            style={[styles.badgeText, log.planned ? styles.planned : styles.worn]}
            testID={`day-log-status-${log.id}`}
          >
            {status}
          </Text>
        </View>
      </View>
      <Text style={styles.logTitle} numberOfLines={2} testID={`day-log-title-${log.id}`}>
        {title}
      </Text>

      {due ? (
        <View style={styles.confirmRow}>
          <View style={styles.flex}>
            <Button label="Yes, I wore it" onPress={onYes} testID={`day-log-yes-${log.id}`} />
          </View>
          <View style={styles.flex}>
            <Button label="No" variant="secondary" onPress={onNo} testID={`day-log-no-${log.id}`} />
          </View>
        </View>
      ) : null}

      {resolved.items.length > 0 ? (
        <View style={styles.stage}>
          <View style={{ width: MANNEQUIN_WIDTH }}>
            <Mannequin
              body={body}
              {...(backdrop ? { backdrop } : {})}
              items={resolved.items}
              {...(outfit ? { outfit } : {})}
              imageUris={imageUris}
              fitted={fitted}
              interactive={false}
              testID={`day-mannequin-${log.id}`}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.meta} testID={`day-log-gone-${log.id}`}>
          These pieces are no longer in your closet.
        </Text>
      )}

      {w ? (
        <View style={styles.weather} testID={`day-weather-${log.id}`}>
          <Ionicons
            name={w.isSunny ? 'sunny-outline' : 'cloudy-outline'}
            size={iconSize.md}
            color={colors.accent}
            accessibilityElementsHidden
          />
          <Text style={styles.weatherText}>
            {`${formatTemp(w.tempMaxC, units)} high, feels ${formatTemp(w.feelsLikeC, units)} · ${percent(w.precipProbability)}% rain`}
          </Text>
        </View>
      ) : null}

      <View testID={`day-pieces-${log.id}`}>
        {log.itemIds.map((itemId) => {
          const item = byId.get(itemId);
          if (!item) {
            return (
              <View key={itemId} style={styles.pieceRow} testID={`day-piece-${itemId}`}>
                <View style={[styles.pieceThumb, styles.gone]}>
                  <Ionicons name="trash-outline" size={iconSize.md} color={colors.textMuted} />
                </View>
                <Text style={styles.pieceMeta}>No longer in your closet</Text>
              </View>
            );
          }
          const uri = imageUris[item.images.cutoutId];
          return (
            <Pressable
              key={itemId}
              accessibilityRole="button"
              accessibilityLabel={`Open ${itemDisplayName(item)}`}
              onPress={() => router.push(`/closet/${item.id}`)}
              style={styles.pieceRow}
              testID={`day-piece-${itemId}`}
            >
              <View style={styles.pieceThumb}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    resizeMode="contain"
                    accessible={false}
                    style={styles.pieceImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.pieceImage,
                      { backgroundColor: item.colors[0]?.hex ?? colors.border, opacity: 0.35 },
                    ]}
                  />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.pieceName} numberOfLines={1}>
                  {itemDisplayName(item)}
                </Text>
                <Text style={styles.pieceMeta}>{subcategoryLabel(item.subcategory)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Button
        label={log.planned ? 'Remove plan' : 'Delete log'}
        variant="ghost"
        icon="trash-outline"
        onPress={onDelete}
        testID={`day-log-delete-${log.id}`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  scroll: { alignItems: 'center', paddingBottom: spacing.xl },
  page: { width: '100%', maxWidth: MAX_WIDTH, padding: spacing.md, gap: spacing.md },
  titleBlock: { gap: spacing.xs },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.body, color: colors.textMuted },
  body: { ...typography.body, color: colors.text },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
  },
  noticeText: { ...typography.label, color: colors.success },
  actions: { gap: spacing.sm },
  cardHead: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  badgePlanned: { backgroundColor: colors.accentSoft },
  badgeText: { ...typography.label },
  worn: { color: colors.success },
  planned: { color: colors.accent },
  logTitle: { ...typography.heading, color: colors.text },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  stage: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  weather: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weatherText: { ...typography.body, color: colors.text, flex: 1 },
  pieceRow: {
    minHeight: minTouch + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pieceThumb: {
    width: ROW_THUMB,
    height: ROW_THUMB,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gone: { opacity: 0.7 },
  pieceImage: { width: '100%', height: '100%', borderRadius: radius.sm },
  pieceName: { ...typography.label, color: colors.text },
  pieceMeta: { ...typography.caption, color: colors.textMuted },
});
