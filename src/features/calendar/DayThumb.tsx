import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View } from 'react-native';
import type { Item } from '@/core/model/types';
import { colors, iconSize, radius } from '@/ui/theme';
import type { DayMark } from './wearLogic';

interface DayThumbProps {
  mark: DayMark;
  /** The piece standing for the outfit, when it is still in the closet. */
  item: Item | undefined;
  uri: string | undefined;
  /** Edge of the square thumbnail. */
  size: number;
  testID?: string;
}

/** Tiny outfit thumbnail (worn), a ring (planned) or nothing. Decorative: the cell carries the label. */
export function DayThumb({ mark, item, uri, size, testID }: DayThumbProps) {
  if (mark === 'none') return null;
  if (mark === 'planned') {
    const dot = Math.max(10, Math.round(size / 3));
    return (
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot,
          borderWidth: 2,
          borderColor: colors.accent,
        }}
        testID={testID ? `${testID}-planned` : undefined}
      />
    );
  }
  const box = { width: size, height: size, borderRadius: radius.sm };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="contain"
        accessible={false}
        style={[box, styles.image]}
        testID={testID ? `${testID}-thumb` : undefined}
      />
    );
  }
  const colour = item?.colors[0]?.hex;
  return (
    <View
      style={[box, styles.fallback, colour ? { backgroundColor: colour } : null]}
      testID={testID ? `${testID}-thumb` : undefined}
    >
      {colour ? null : (
        <Ionicons
          name="checkmark"
          size={iconSize.sm}
          color={colors.accent}
          accessibilityElementsHidden
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceAlt },
  fallback: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
});
