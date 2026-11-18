import { nameColor } from '@/core/color/classify';
import { extractPalette } from '@/core/color/palette';
import type { ColorName, ColorSwatch } from '@/core/model/types';
import type { PixelData } from '@/services';

/** Fixed seed so the same photo always yields the same palette. */
const PALETTE_SEED = 1;

/** One representative hex per colour name, for the "replace the main colour" palette. */
export const COLOR_HEX: Record<ColorName, string> = {
  black: '#1a1a1a',
  white: '#fafafa',
  grey: '#8c8c8c',
  navy: '#1f2a5c',
  beige: '#d8c3a5',
  brown: '#6b4423',
  olive: '#6b6b2a',
  red: '#d32f2f',
  orange: '#f57c00',
  yellow: '#ffeb3b',
  green: '#388e3c',
  teal: '#00897b',
  blue: '#1e88e5',
  purple: '#8e24aa',
  pink: '#f06292',
};

export const COLOR_NAMES = Object.keys(COLOR_HEX) as ColorName[];

/**
 * Collapses swatches that share a colour name (k-means can return two shades of navy) into one,
 * keeping the hex of the larger share, largest first. Shares still sum to the same total.
 */
export function mergeSameNamed(swatches: readonly ColorSwatch[]): ColorSwatch[] {
  const merged: ColorSwatch[] = [];
  for (const s of [...swatches].sort((a, b) => b.share - a.share)) {
    const existing = merged.find((m) => m.name === s.name);
    if (existing) existing.share += s.share;
    else merged.push({ ...s });
  }
  return merged;
}

/** Up to three named swatches for a photo, or `[]` when pixels are unavailable or empty. */
export function summarizeColors(pixels: PixelData | undefined): ColorSwatch[] {
  if (!pixels) return [];
  return mergeSameNamed(extractPalette(pixels.rgba, pixels.width, pixels.height, PALETTE_SEED));
}

/** Makes `name` the primary colour: replaces swatch 0 (keeping its share) or creates it. */
export function withPrimaryColor(swatches: readonly ColorSwatch[], name: ColorName): ColorSwatch[] {
  const [first, ...rest] = swatches;
  const hex = COLOR_HEX[name];
  const primary: ColorSwatch = { hex, name: nameColor(hex), share: first?.share ?? 1 };
  return mergeSameNamed([primary, ...rest]);
}
