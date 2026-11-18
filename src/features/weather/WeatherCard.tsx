import { Ionicons } from '@/ui/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ISODate } from '@/core/model/types';
import { formatTemp, percent, weatherGlyph, type WeatherGlyph } from '@/core/weather';
import { ATTRIBUTION_TEXT, ATTRIBUTION_URL } from '@/services/weather';
import { getStores, useProfile, useWeather } from '@/state';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import type { IconName } from '@/ui/icons';
import { colors, iconSize, minTouch, spacing, typography } from '@/ui/theme';
import { LocationSheet } from './LocationSheet';
import { errorText } from './messages';

const GLYPH_ICON: Record<WeatherGlyph, IconName> = {
  sunny: 'sunny-outline',
  cloudy: 'cloudy-outline',
  rain: 'rainy-outline',
};

interface WeatherCardProps {
  /** Day to show, `YYYY-MM-DD`. Defaults to today. */
  date?: ISODate;
}

/** Compact forecast card for one day, with its own loading, no-location and error states. */
export function WeatherCard({ date }: WeatherCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const units = useProfile((s) => s.profile?.units ?? 'metric');
  const location = useProfile((s) => s.profile?.location);
  const status = useWeather((s) => s.status);
  const error = useWeather((s) => s.error);
  const weather = useWeather((s) => (date ? s.byDate[date] : s.today));
  const locationKey = location ? `${location.lat},${location.lon}` : '';

  useEffect(() => {
    void getStores().weather.getState().refresh(date);
  }, [date, locationKey]);

  const loading = status === 'idle' || status === 'loading';
  const useDevice = () => void getStores().weather.getState().setLocationFromDevice();

  let body;
  if (weather) {
    body = (
      <View style={styles.row}>
        <Ionicons
          name={GLYPH_ICON[weatherGlyph(weather)]}
          size={iconSize.xl}
          color={colors.accent}
          accessibilityElementsHidden
        />
        <View style={styles.flex}>
          <Text style={styles.temp} testID="weather-temp">
            {`${formatTemp(weather.tempMaxC, units)} feels ${formatTemp(weather.feelsLikeC, units)}`}
          </Text>
          <Text style={styles.meta} testID="weather-rain">
            {`${percent(weather.precipProbability)}% chance of rain`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Location: ${location?.label ?? ''}. Change`}
            onPress={() => setSheetOpen(true)}
            style={styles.locationButton}
            testID="weather-location"
          >
            <Ionicons name="location-outline" size={iconSize.sm} color={colors.textMuted} />
            <Text style={styles.meta}>{location?.label}</Text>
          </Pressable>
        </View>
      </View>
    );
  } else if (!location) {
    const message = errorText(error);
    body = (
      <View style={styles.gap}>
        <Text style={styles.meta} testID="weather-no-location">
          Add your location for weather-smart outfits.
        </Text>
        {message ? (
          <Text accessibilityRole="alert" style={styles.meta} testID="weather-message">
            {message}
          </Text>
        ) : null}
        <View style={styles.buttons}>
          <Button label="Use my location" onPress={useDevice} testID="weather-use-location" />
          <Button
            label="Search city"
            variant="secondary"
            onPress={() => setSheetOpen(true)}
            testID="weather-search"
          />
        </View>
      </View>
    );
  } else if (loading) {
    body = (
      <View style={styles.row} testID="weather-loading">
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.text}>Loading weather…</Text>
      </View>
    );
  } else {
    body = (
      <View style={styles.gap}>
        <View style={styles.row}>
          <Ionicons name="cloud-offline-outline" size={iconSize.lg} color={colors.textMuted} />
          <Text style={[styles.text, styles.flex]} testID="weather-unavailable">
            {errorText('weather-unavailable')}
          </Text>
        </View>
        <View style={styles.buttons}>
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void getStores().weather.getState().refresh(date)}
            testID="weather-retry"
          />
          <Button
            label="Change location"
            variant="ghost"
            onPress={() => setSheetOpen(true)}
            testID="weather-change-location"
          />
        </View>
      </View>
    );
  }

  return (
    <Card testID="weather-card">
      {body}
      {/* Attribution is owed wherever forecast data is shown, so only with a forecast. */}
      {weather ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${ATTRIBUTION_TEXT} (opens open-meteo.com)`}
          onPress={() => void Linking.openURL(ATTRIBUTION_URL)}
          style={styles.attribution}
          testID="weather-attribution"
        >
          <Text style={styles.link}>{ATTRIBUTION_TEXT}</Text>
        </Pressable>
      ) : null}
      <LocationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  temp: { ...typography.heading, color: colors.text },
  text: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  locationButton: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  attribution: { minHeight: minTouch, justifyContent: 'center' },
  link: { ...typography.caption, color: colors.accent, textDecorationLine: 'underline' },
});
