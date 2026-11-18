import { Ionicons } from '@/ui/Ionicons';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ID } from '@/core/model/types';
import { colors, iconSize } from '@/ui/theme';
import { useImageUri } from './useImageUri';

interface ItemImageProps {
  imageId: ID;
  /** Used when `imageId` cannot be found. */
  fallbackId?: ID;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Garment image with a neutral placeholder while loading or when the image is missing. */
export function ItemImage({ imageId, fallbackId, style, testID }: ItemImageProps) {
  const primary = useImageUri(imageId);
  const backup = useImageUri(primary.status === 'missing' ? fallbackId : undefined);
  const uri = primary.uri ?? backup.uri;
  return (
    <View style={[styles.box, style]} testID={testID}>
      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={styles.image}
          accessible={false}
          testID={testID ? `${testID}-img` : undefined}
        />
      ) : (
        <Ionicons
          name="shirt-outline"
          size={iconSize.lg}
          color={colors.border}
          testID={testID ? `${testID}-placeholder` : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
