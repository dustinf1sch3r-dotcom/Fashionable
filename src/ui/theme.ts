export const colors = {
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  text: '#1B1B1F',
  textMuted: '#6B6B76',
  accent: '#7C4DFF',
  border: '#E5E1DA',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

export const theme = { colors, spacing, radius } as const;
export type Theme = typeof theme;
