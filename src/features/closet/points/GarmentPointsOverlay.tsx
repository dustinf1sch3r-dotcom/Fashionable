import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/ui/theme';
import { GarmentPointsEditor } from './GarmentPointsEditor';

/** The editor laid over the item screen (so the screen keeps its state while editing). */
export function GarmentPointsOverlay(props: Parameters<typeof GarmentPointsEditor>[0]) {
  return (
    <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right', 'bottom']}>
      <GarmentPointsEditor {...props} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 10 },
});
