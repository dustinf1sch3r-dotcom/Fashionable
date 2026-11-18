import { fixtureCloset } from './fixtures';
import type { Item } from '../model/types';

/** A closet of `n` items cloned from the fixture closet with new ids and jittered colours. */
export function bigCloset(n: number): Item[] {
  const base = fixtureCloset();
  const out: Item[] = [];
  for (let i = 0; i < n; i++) {
    const src = base[i % base.length] as Item;
    const round = Math.floor(i / base.length);
    const jitter = (round * 37) % 60;
    out.push({
      ...src,
      id: `${src.id}-c${round}`,
      colors: src.colors.map((c, k) => ({
        ...c,
        hex: `#${((parseInt(c.hex.slice(1), 16) + jitter * 4093 * (k + 1)) & 0xffffff)
          .toString(16)
          .padStart(6, '0')}`,
      })),
      images: { ...src.images },
      cutout: { ...src.cutout },
    });
  }
  return out;
}
