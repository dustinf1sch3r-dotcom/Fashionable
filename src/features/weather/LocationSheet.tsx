import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GeocodeResult } from '@/services';
import { getStores } from '@/state';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';
import { errorText } from './messages';

interface LocationSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Pick where the forecast is for: the device position, or a typed city. */
export function LocationSheet({ visible, onClose }: LocationSheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const weather = () => getStores().weather.getState();

  const search = async () => {
    setBusy(true);
    setMessage(undefined);
    setResults(await weather().searchPlaces(query));
    setBusy(false);
  };

  const pick = async (place: GeocodeResult) => {
    setBusy(true);
    await weather().setLocationFromSearch(place);
    setBusy(false);
    close();
  };

  const chooseDevice = async () => {
    setBusy(true);
    setMessage(undefined);
    const outcome = await weather().setLocationFromDevice();
    setBusy(false);
    if (outcome === 'ok') close();
    else setMessage(errorText(outcome === 'denied' ? 'location-denied' : 'location-unavailable'));
  };

  const close = () => {
    setQuery('');
    setResults(null);
    setMessage(undefined);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Choose location" testID="location-sheet">
      <Button
        label="Use my location"
        icon="locate-outline"
        variant="secondary"
        disabled={busy}
        onPress={() => void chooseDevice()}
        testID="location-sheet-use-location"
      />
      {message ? (
        <Text accessibilityRole="alert" style={styles.note} testID="location-sheet-message">
          {message}
        </Text>
      ) : null}
      <TextField
        label="City"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. Berlin"
        autoCapitalize="words"
        testID="location-sheet-query"
      />
      <Button
        label="Search"
        icon="search-outline"
        disabled={busy || query.trim().length < 2}
        onPress={() => void search()}
        testID="location-sheet-search"
      />
      {busy ? <ActivityIndicator color={colors.accent} testID="location-sheet-busy" /> : null}
      {results && results.length === 0 && !busy ? (
        <Text style={styles.note} testID="location-sheet-empty">
          No matching places. Check the spelling or try a bigger nearby city.
        </Text>
      ) : null}
      <View style={styles.results}>
        {(results ?? []).map((r, i) => (
          <Pressable
            key={`${r.lat},${r.lon}`}
            accessibilityRole="button"
            accessibilityLabel={`Use ${r.label}`}
            onPress={() => void pick(r)}
            style={({ pressed }) => [styles.result, pressed && styles.pressed]}
            testID={`location-sheet-result-${i}`}
          >
            <Text style={styles.resultText}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.caption, color: colors.textMuted },
  results: { gap: spacing.xs },
  result: {
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
  resultText: { ...typography.body, color: colors.text },
});
