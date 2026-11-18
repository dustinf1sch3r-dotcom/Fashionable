import { Platform } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EDE6',
  text: '#1B1B1F',
  textMuted: '#5F5F6B',
  accent: '#6B3FE8',
  accentSoft: '#EEE8FF',
  onAccent: '#FFFFFF',
  border: '#E5E1DA',
  success: '#17693A',
  warning: '#8A4B00',
  danger: '#B3261E',
  /** Flat fill of the mannequin body silhouette (docs/TRY_ON.md §3). */
  silhouette: '#C9CCD1',
  /** Dark scrim behind sheets; deliberately translucent. */
  scrim: 'rgba(27, 27, 31, 0.45)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: NonNullable<TextStyle['fontWeight']>;
}

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const satisfies Record<string, TypeStyle>;

/** Icon and swatch sizes, in points. */
export const iconSize = { sm: 18, md: 22, lg: 28, xl: 48 } as const;

/** Minimum touch target edge, in points. */
export const minTouch = 44;

/** Elevation levels. Native uses elevation + iOS shadow props; web uses boxShadow. */
export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const offset = level * 2;
  const blur = level * 6;
  const opacity = 0.06 + level * 0.03;
  if (Platform.OS === 'web') {
    return { boxShadow: `0px ${offset}px ${blur}px rgba(27, 27, 31, ${opacity})` };
  }
  return {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: offset },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation: level * 2,
  };
}

export const theme = { colors, spacing, radius, typography, iconSize, minTouch } as const;
export type Theme = typeof theme;
