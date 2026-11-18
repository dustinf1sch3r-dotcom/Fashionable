import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/ui/theme';
import { CutoutEditor } from './CutoutEditor';
import type { CutoutEditorProps } from './types';

/**
 * The editor laid over a screen without unmounting it, so a half-filled form keeps its state
 * while the brush is open.
 */
export function TouchupOverlay(props: CutoutEditorProps) {
  return (
    <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right', 'bottom']}>
      <CutoutEditor {...props} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 10 },
});
