import type { Category, Formality, Warmth } from '@/core/model/types';

/** Plural category names for the closet tabs (`labels.ts` has the singular forms). */
export const CATEGORY_TAB_LABELS: Readonly<Record<Category, string>> = {
  top: 'Tops',
  bottom: 'Bottoms',
  onepiece: 'One-pieces',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  legwear: 'Legwear',
  belt: 'Belts',
  bag: 'Bags',
  headwear: 'Headwear',
  neckwear: 'Neckwear',
  jewelry: 'Jewellery',
  eyewear: 'Eyewear',
  watch: 'Watches',
};

export const FORMALITY_LABELS: Readonly<Record<Formality, string>> = {
  1: 'Lounge',
  2: 'Casual',
  3: 'Smart casual',
  4: 'Business',
  5: 'Formal',
};

export const WARMTH_LABELS: Readonly<Record<Warmth, string>> = {
  1: 'Summer-light',
  2: 'Light',
  3: 'Mid-weight',
  4: 'Warm',
  5: 'Deep winter',
};

export function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}
