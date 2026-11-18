import type { Category, ColorName, Pattern } from '@/core/model/types';

/**
 * Display text for taxonomy codes. The UI layer owns wording; core only knows the codes.
 * Plain maps so any closet screen can import them.
 */
export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'Top',
  bottom: 'Bottom',
  onepiece: 'Dress / one-piece',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  legwear: 'Legwear',
  belt: 'Belt',
  bag: 'Bag',
  headwear: 'Headwear',
  neckwear: 'Neckwear',
  jewelry: 'Jewellery',
  eyewear: 'Eyewear',
  watch: 'Watch',
};

/** Keyed by subcategory code; codes are unique across categories. */
export const SUBCATEGORY_LABELS: Record<string, string> = {
  // top
  tshirt: 'T-shirt',
  'longsleeve-tee': 'Long-sleeve tee',
  tank: 'Tank top',
  polo: 'Polo',
  shirt: 'Shirt',
  blouse: 'Blouse',
  'sports-top': 'Sports top',
  sweater: 'Sweater',
  cardigan: 'Cardigan',
  hoodie: 'Hoodie',
  sweatshirt: 'Sweatshirt',
  waistcoat: 'Waistcoat',
  // bottom
  jeans: 'Jeans',
  trousers: 'Trousers',
  'suit-trousers': 'Suit trousers',
  chinos: 'Chinos',
  shorts: 'Shorts',
  'sports-shorts': 'Sports shorts',
  skirt: 'Skirt',
  'mini-skirt': 'Mini skirt',
  'denim-skirt': 'Denim skirt',
  leggings: 'Leggings',
  joggers: 'Joggers',
  // onepiece
  'casual-dress': 'Casual dress',
  'day-dress': 'Day dress',
  'shirt-dress': 'Shirt dress',
  'sweater-dress': 'Sweater dress',
  'cocktail-dress': 'Cocktail dress',
  'evening-gown': 'Evening gown',
  jumpsuit: 'Jumpsuit',
  dungarees: 'Dungarees',
  // outerwear
  blazer: 'Blazer',
  'suit-jacket': 'Suit jacket',
  'denim-jacket': 'Denim jacket',
  'leather-jacket': 'Leather jacket',
  bomber: 'Bomber',
  trench: 'Trench coat',
  overcoat: 'Overcoat',
  peacoat: 'Peacoat',
  parka: 'Parka',
  puffer: 'Puffer',
  raincoat: 'Raincoat',
  windbreaker: 'Windbreaker',
  // shoes
  sneakers: 'Sneakers',
  'running-shoes': 'Running shoes',
  'ankle-boots': 'Ankle boots',
  'chelsea-boots': 'Chelsea boots',
  'combat-boots': 'Combat boots',
  'hiking-boots': 'Hiking boots',
  'knee-boots': 'Knee boots',
  wellies: 'Wellies',
  loafers: 'Loafers',
  oxfords: 'Oxfords',
  derbies: 'Derbies',
  heels: 'Heels',
  pumps: 'Pumps',
  flats: 'Flats',
  sandals: 'Sandals',
  'heeled-sandals': 'Heeled sandals',
  'flip-flops': 'Flip-flops',
  slides: 'Slides',
  // legwear
  socks: 'Socks',
  'ankle-socks': 'Ankle socks',
  tights: 'Tights',
  stockings: 'Stockings',
  'thermal-tights': 'Thermal tights',
  // belt
  'leather-belt': 'Leather belt',
  'casual-belt': 'Casual belt',
  'dress-belt': 'Dress belt',
  // bag
  tote: 'Tote',
  backpack: 'Backpack',
  crossbody: 'Crossbody',
  'shoulder-bag': 'Shoulder bag',
  handbag: 'Handbag',
  clutch: 'Clutch',
  briefcase: 'Briefcase',
  // headwear
  cap: 'Cap',
  beanie: 'Beanie',
  'bucket-hat': 'Bucket hat',
  'sun-hat': 'Sun hat',
  beret: 'Beret',
  hat: 'Hat',
  // neckwear
  scarf: 'Scarf',
  'silk-scarf': 'Silk scarf',
  tie: 'Tie',
  'bow-tie': 'Bow tie',
  // jewelry
  necklace: 'Necklace',
  earrings: 'Earrings',
  bracelet: 'Bracelet',
  ring: 'Ring',
  brooch: 'Brooch',
  // eyewear
  sunglasses: 'Sunglasses',
  glasses: 'Glasses',
  // watch
  'dress-watch': 'Dress watch',
  'casual-watch': 'Casual watch',
  'sports-watch': 'Sports watch',
};

export const COLOR_LABELS: Record<ColorName, string> = {
  black: 'Black',
  white: 'White',
  grey: 'Grey',
  navy: 'Navy',
  beige: 'Beige',
  brown: 'Brown',
  olive: 'Olive',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
};

export const PATTERN_LABELS: Record<Pattern, string> = {
  solid: 'Plain',
  stripe: 'Stripes',
  check: 'Check',
  floral: 'Floral',
  dot: 'Dots',
  graphic: 'Graphic',
  animal: 'Animal print',
  other: 'Other',
};

/** Label for a subcategory code, falling back to the code itself. */
export function subcategoryLabel(code: string): string {
  return SUBCATEGORY_LABELS[code] ?? code;
}
