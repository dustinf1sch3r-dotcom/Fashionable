import { nameColor } from '../color/classify';
import { createRng } from '../engine/rng';
import type { Formality, Item, Material, Pattern } from '../model/types';
import { fixtureCloset } from '../testing/fixtures';

const HEXES = [
  '#f5f5f2',
  '#1b1b1d',
  '#1f2a44',
  '#8a8d91',
  '#b3262e',
  '#d4c0a1',
  '#6b4a2f',
  '#6b6b3a',
  '#3f7d4e',
  '#e8a2b4',
  '#e7c53a',
  '#9db8d6',
  '#7a3fa0',
  '#ff6a00',
  '#00a3a3',
  '#ff2d95',
];
const PATTERNS: Pattern[] = ['solid', 'solid', 'solid', 'stripe', 'check', 'floral', 'dot'];
const MATERIALS: Material[] = ['cotton', 'denim', 'wool', 'knit', 'leather', 'suede', 'linen'];

/** Test support: seeded synthetic closet: fixture items with randomised colour, formality, pattern, material. */
export function syntheticCloset(n: number, seed: number): Item[] {
  const rng = createRng(seed);
  const base = fixtureCloset();
  const out: Item[] = [];
  for (let i = 0; i < n; i++) {
    const src = rng.pick(base);
    const hex = rng.pick(HEXES);
    const colors = [{ hex, share: 0.7, name: nameColor(hex) }];
    if (rng.next() < 0.4) {
      const h2 = rng.pick(HEXES);
      colors.push({ hex: h2, share: 0.3, name: nameColor(h2) });
    }
    out.push({
      ...src,
      id: `syn-${String(i).padStart(3, '0')}`,
      colors,
      formality: rng.int(1, 5) as Formality,
      pattern: rng.pick(PATTERNS),
      patternBold: rng.next() < 0.4,
      material: rng.pick(MATERIALS),
      metal: rng.next() < 0.3 ? rng.pick(['gold', 'silver', 'rose', 'mixed'] as const) : undefined,
    });
  }
  return out;
}
