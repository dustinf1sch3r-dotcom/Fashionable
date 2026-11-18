import { StyleSheet, View } from 'react-native';

import { colors } from '@/ui/theme';

const TILES = 8;
const INDEXES = Array.from({ length: TILES }, (_, i) => i);

/**
 * Transparency checkerboard that fills its parent; put an image on top to show that it has a
 * see-through background. Decorative, so hidden from assistive technology.
 */
export function Checkerboard({ testID }: { testID?: string }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {INDEXES.map((row) => (
        <View key={row} style={styles.row}>
          {INDEXES.map((col) => (
            <View
              key={col}
              style={[styles.tile, (row + col) % 2 === 0 ? styles.light : styles.dark]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  tile: { flex: 1 },
  light: { backgroundColor: colors.surface },
  dark: { backgroundColor: colors.border },
});
