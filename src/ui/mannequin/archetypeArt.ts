import { slotOf } from '@/core/model/slots';
import type { Item } from '@/core/model/types';
import { colors } from '@/ui/theme';

/**
 * Flat garment pictures drawn from an item's category, subcategory and colour: simple SVG shapes
 * in a 100 × 100 box, stretched to the item's cutout aspect ratio. Used for the dev mannequin page
 * and for archetypes (suggested pieces the user does not own yet, so there is no photo). Web only
 * (the native Image component does not render SVG); real cutouts replace these.
 */

const SHAPES: Record<string, string> = {
  tee: 'M28 4 L0 26 L12 44 L24 36 L24 98 L76 98 L76 36 L88 44 L100 26 L72 4 C64 14 36 14 28 4 Z',
  longSleeve:
    'M28 4 L0 30 L6 92 L20 92 L24 44 L24 98 L76 98 L76 44 L80 92 L94 92 L100 30 L72 4 C64 14 36 14 28 4 Z',
  open: 'M28 4 L0 30 L6 92 L20 92 L24 44 L24 98 L46 98 L48 20 L52 20 L54 98 L76 98 L76 44 L80 92 L94 92 L100 30 L72 4 C64 14 36 14 28 4 Z',
  coat: 'M30 2 L0 22 L4 90 L20 90 L24 40 L22 100 L78 100 L76 40 L80 90 L96 90 L100 22 L70 2 C62 12 38 12 30 2 Z',
  pants: 'M8 0 H92 L98 100 H56 L50 24 L44 100 H2 Z',
  skirt: 'M20 0 H80 L100 100 H0 Z',
  dress: 'M32 0 L40 0 C44 8 56 8 60 0 L68 0 L66 30 L72 36 L96 100 H4 L28 36 L34 30 Z',
  jumpsuit:
    'M30 0 L38 0 C44 6 56 6 62 0 L70 0 L68 36 L74 46 L96 100 H56 L50 52 L44 100 H4 L26 46 L32 36 Z',
  shoes:
    'M2 30 C2 16 16 8 28 14 L44 34 C48 60 48 80 40 92 H6 C0 80 0 50 2 30 Z M98 30 C98 16 84 8 72 14 L56 34 C52 60 52 80 60 92 H94 C100 80 100 50 98 30 Z',
  sneakers:
    'M2 56 C2 40 10 34 22 34 L40 54 H48 V90 H4 C2 80 2 68 2 56 Z M98 56 C98 40 90 34 78 34 L60 54 H52 V90 H96 C98 80 98 68 98 56 Z',
  boots:
    'M4 6 H34 V60 L46 70 C50 80 50 88 46 94 H4 Z M96 6 H66 V60 L54 70 C50 80 50 88 54 94 H96 Z',
  belt: 'M0 30 H100 V70 H0 Z M44 10 H56 V90 H44 Z',
  bag: 'M10 40 H90 L98 100 H2 Z M26 40 C26 -4 74 -4 74 40 H66 C66 10 34 10 34 40 Z',
  head: 'M6 100 C0 40 24 0 50 0 C76 0 100 40 94 100 Z',
  eyes: 'M2 22 H44 C48 26 52 26 56 22 H98 L92 70 C84 90 64 90 58 62 C56 56 44 56 42 62 C36 90 16 90 8 70 Z',
  neck: 'M0 0 H100 V34 H62 L70 100 H46 L40 34 H0 Z',
  jewelry: 'M10 0 C10 90 90 90 90 0 H80 C80 74 20 74 20 0 Z',
  wrist: 'M30 0 H70 V28 H30 Z M30 72 H70 V100 H30 Z M18 28 H82 V72 H18 Z',
  fallback: 'M0 0 H100 V100 H0 Z',
};

const BOOTS = new Set(['ankle-boots', 'chelsea-boots', 'combat-boots', 'hiking-boots', 'wellies']);
const SKIRTS = new Set(['skirt', 'mini-skirt', 'denim-skirt']);
const SHORT_SLEEVE = new Set(['tshirt', 'polo', 'tank', 'camisole']);

function shapeKey(item: Item): string {
  const slot = slotOf(item);
  switch (slot) {
    case 'base':
      return SHORT_SLEEVE.has(item.subcategory) ? 'tee' : 'longSleeve';
    case 'mid':
      return item.subcategory === 'cardigan' ? 'open' : 'longSleeve';
    case 'outer':
      return 'coat';
    case 'bottom':
      return SKIRTS.has(item.subcategory) ? 'skirt' : 'pants';
    case 'onepiece':
      return item.subcategory === 'jumpsuit' ? 'jumpsuit' : 'dress';
    case 'legs':
      return 'pants';
    case 'shoes':
      if (BOOTS.has(item.subcategory)) return 'boots';
      return item.subcategory === 'sneakers' ? 'sneakers' : 'shoes';
    default:
      return slot in SHAPES ? slot : 'fallback';
  }
}

/** Width / height of the drawn shape, roughly what a real cutout of the same kind measures. */
const ASPECTS: Record<string, number> = {
  tee: 0.95,
  longSleeve: 0.85,
  open: 0.85,
  coat: 0.8,
  pants: 0.4,
  skirt: 0.95,
  dress: 0.62,
  jumpsuit: 0.5,
  shoes: 1.6,
  sneakers: 2,
  boots: 1.2,
  belt: 2.2,
  bag: 1.1,
  head: 1.2,
  eyes: 2.4,
  neck: 0.8,
  jewelry: 0.9,
  wrist: 0.9,
  fallback: 1,
};

/**
 * A copy of `item` with the aspect ratio of its drawn shape, so the mannequin proportions an
 * archetype (aspect ratio 1 in the data) like a real cutout of the same kind.
 */
export function withArtAspect(item: Item): Item {
  return { ...item, cutout: { aspectRatio: ASPECTS[shapeKey(item)] ?? 1, hasAlpha: true } };
}

interface ArtOptions {
  /** A piece to buy rather than own: dashed outline and a slightly see-through fill. */
  suggested?: boolean;
}

/** `data:` URI of a flat picture of `item`, in its first colour. */
export function garmentArtUri(item: Item, opts: ArtOptions = {}): string {
  const fill = item.colors[0]?.hex ?? '#888888';
  const key = shapeKey(item);
  const d = SHAPES[key] ?? SHAPES.fallback;
  const aspect = item.cutout.aspectRatio;
  const h = 300;
  const style = opts.suggested
    ? `fill-opacity="0.88" stroke="${colors.accent}" stroke-width="2.5" stroke-dasharray="7 5"`
    : `stroke="rgba(0,0,0,0.35)" stroke-width="1.5"`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(h * aspect)}" height="${h}" ` +
    `viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<path d="${d}" fill="${fill}" fill-rule="evenodd" ${style} ` +
    `stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  // Raw markup after the prefix: react-native-web percent-encodes it itself.
  return `data:image/svg+xml;utf8,${svg}`;
}
