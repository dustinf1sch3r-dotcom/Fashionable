import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeatherCard } from '@/features/weather';
import { colors, spacing } from '@/ui/theme';

/** Dev-only host for the weather card (the Outfits screen mounts it later). */
export default function DevWeather() {
  return (
    <SafeAreaView style={styles.safe} testID="screen-dev-weather">
      <ScrollView contentContainerStyle={styles.content}>
        <WeatherCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
});
