import { Image, StyleSheet, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Checkerboard } from '@/ui/Checkerboard';
import { colors, radius, spacing } from '@/ui/theme';
import type { ProcessedPhoto } from './processPhoto';

interface PhotoPreviewProps {
  photo: ProcessedPhoto;
  /** Show the plain photo instead of the cutout. */
  useOriginal: boolean;
  onToggleOriginal: () => void;
}

/** The photo as it will be saved: the cutout on a checkerboard, or the original photo. */
export function PhotoPreview({ photo, useOriginal, onToggleOriginal }: PhotoPreviewProps) {
  const cut = useOriginal ? undefined : photo.cutout;
  return (
    <View style={styles.wrap}>
      <View style={styles.frame} testID="add-item-preview-frame">
        {cut ? <Checkerboard testID="add-item-checkerboard" /> : null}
        <Image
          accessibilityLabel={cut ? 'Your garment with the background removed' : 'Your photo'}
          resizeMode="contain"
          source={{ uri: (cut?.thumb ?? photo.thumb).uri }}
          style={styles.image}
          testID="add-item-preview"
        />
      </View>
      {photo.cutout ? (
        <Button
          label={useOriginal ? 'Use cutout' : 'Use original photo'}
          variant="ghost"
          onPress={onToggleOriginal}
          accessibilityLabel={
            useOriginal ? 'Use the photo with the background removed' : 'Use the original photo'
          }
          testID="add-item-use-original"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  frame: {
    width: 120,
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
});
