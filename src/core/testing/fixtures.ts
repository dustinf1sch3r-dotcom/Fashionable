import { newFeedback, newItem, newWearLog } from '../model/factories';
import type { NewItemInit } from '../model/factories';
import type { ColorName, ColorSwatch, Feedback, Item, Weather, WearLog } from '../model/types';
import { fixedClock } from './clock';
import { sequentialIds } from './ids';

const FIXTURE_TIME = '2026-01-01T00:00:00.000Z';

const HEX: Record<string, string> = {
  white: '#f5f5f2',
  cream: '#efe6d2',
  black: '#1b1b1d',
  navy: '#1f2a44',
  grey: '#8a8d91',
  red: '#b3262e',
  beige: '#d4c0a1',
  brown: '#6b4a2f',
  tan: '#b98a5a',
  olive: '#6b6b3a',
  green: '#3f7d4e',
  pink: '#e8a2b4',
  yellow: '#e7c53a',
  indigo: '#2b3f66',
  lightBlue: '#9db8d6',
};

function sw(key: keyof typeof HEX, name: ColorName, share = 1): ColorSwatch {
  return { hex: HEX[key] as string, share, name };
}

type Spec = Omit<NewItemInit, 'images' | 'cutout'> & { id: string; aspect?: number };

function build(spec: Spec): Item {
  const { id, aspect, ...init } = spec;
  return newItem(
    {
      ...init,
      colors: init.colors.map((c) => ({ ...c })),
      images: { originalId: `${id}-orig`, cutoutId: `${id}-cutout`, thumbId: `${id}-thumb` },
      cutout: { aspectRatio: aspect ?? 1, hasAlpha: true },
    },
    fixedClock(FIXTURE_TIME),
    { uuid: () => id },
  );
}

const SPECS: readonly Spec[] = [
  // base tops
  {
    id: 'tee-white',
    name: 'White tee',
    category: 'top',
    subcategory: 'tshirt',
    colors: [sw('white', 'white')],
    material: 'cotton',
    aspect: 1,
  },
  {
    id: 'tee-navy',
    name: 'Navy tee',
    category: 'top',
    subcategory: 'tshirt',
    colors: [sw('navy', 'navy')],
    material: 'cotton',
    favorite: true,
  },
  {
    id: 'tee-black-laundry',
    name: 'Black tee (in the wash)',
    category: 'top',
    subcategory: 'tshirt',
    colors: [sw('black', 'black')],
    material: 'cotton',
    status: 'laundry',
  },
  {
    id: 'top-breton',
    name: 'Striped breton top',
    category: 'top',
    subcategory: 'longsleeve-tee',
    colors: [sw('white', 'white', 0.55), sw('navy', 'navy', 0.45)],
    pattern: 'stripe',
    material: 'cotton',
  },
  {
    id: 'shirt-oxford-white',
    name: 'White oxford shirt',
    category: 'top',
    subcategory: 'shirt',
    colors: [sw('white', 'white')],
    material: 'cotton',
    formality: 4,
  },
  {
    id: 'blouse-floral',
    name: 'Floral blouse',
    category: 'top',
    subcategory: 'blouse',
    colors: [sw('pink', 'pink', 0.5), sw('white', 'white', 0.3), sw('green', 'green', 0.2)],
    pattern: 'floral',
    patternBold: true,
    material: 'silk',
  },
  {
    id: 'polo-yellow-archived',
    name: 'Yellow polo (given up on)',
    category: 'top',
    subcategory: 'polo',
    colors: [sw('yellow', 'yellow')],
    material: 'cotton',
    status: 'archived',
  },
  // mid tops
  {
    id: 'sweater-red',
    name: 'Red sweater',
    category: 'top',
    subcategory: 'sweater',
    colors: [sw('red', 'red')],
    material: 'wool',
  },
  {
    id: 'hoodie-grey',
    name: 'Grey hoodie',
    category: 'top',
    subcategory: 'hoodie',
    colors: [sw('grey', 'grey')],
    material: 'cotton',
  },
  {
    id: 'cardigan-cream',
    name: 'Cream cardigan',
    category: 'top',
    subcategory: 'cardigan',
    colors: [sw('cream', 'beige')],
    material: 'knit',
    warmth: 3,
  },
  // bottoms
  {
    id: 'jeans-dark',
    name: 'Dark jeans',
    category: 'bottom',
    subcategory: 'jeans',
    colors: [sw('indigo', 'navy')],
    material: 'denim',
    aspect: 0.45,
  },
  {
    id: 'jeans-light',
    name: 'Light wash jeans',
    category: 'bottom',
    subcategory: 'jeans',
    colors: [sw('lightBlue', 'blue')],
    material: 'denim',
    aspect: 0.45,
  },
  {
    id: 'trousers-black',
    name: 'Black trousers',
    category: 'bottom',
    subcategory: 'trousers',
    colors: [sw('black', 'black')],
    material: 'wool',
    aspect: 0.45,
  },
  {
    id: 'chinos-beige',
    name: 'Beige chinos',
    category: 'bottom',
    subcategory: 'chinos',
    colors: [sw('beige', 'beige')],
    material: 'cotton',
    aspect: 0.45,
  },
  {
    id: 'shorts-denim',
    name: 'Denim shorts',
    category: 'bottom',
    subcategory: 'shorts',
    colors: [sw('lightBlue', 'blue')],
    material: 'denim',
  },
  {
    id: 'skirt-midi-pleated',
    name: 'Pleated midi skirt',
    category: 'bottom',
    subcategory: 'skirt',
    colors: [sw('olive', 'olive')],
    material: 'synthetic',
    aspect: 0.7,
  },
  // one-pieces
  {
    id: 'dress-wrap-green',
    name: 'Green wrap dress',
    category: 'onepiece',
    subcategory: 'day-dress',
    colors: [sw('green', 'green')],
    material: 'synthetic',
    aspect: 0.5,
  },
  {
    id: 'jumpsuit-black',
    name: 'Black jumpsuit',
    category: 'onepiece',
    subcategory: 'jumpsuit',
    colors: [sw('black', 'black')],
    material: 'synthetic',
    formality: 4,
    aspect: 0.4,
  },
  // outerwear
  {
    id: 'blazer-navy',
    name: 'Navy blazer',
    category: 'outerwear',
    subcategory: 'blazer',
    colors: [sw('navy', 'navy')],
    material: 'wool',
  },
  {
    id: 'trench-beige',
    name: 'Beige trench coat',
    category: 'outerwear',
    subcategory: 'trench',
    colors: [sw('beige', 'beige')],
    material: 'cotton',
    rainOk: true,
    aspect: 0.6,
  },
  {
    id: 'puffer-black',
    name: 'Black puffer jacket',
    category: 'outerwear',
    subcategory: 'puffer',
    colors: [sw('black', 'black')],
    material: 'synthetic',
    warmth: 5,
  },
  {
    id: 'jacket-denim',
    name: 'Denim jacket',
    category: 'outerwear',
    subcategory: 'denim-jacket',
    colors: [sw('lightBlue', 'blue')],
    material: 'denim',
  },
  // shoes
  {
    id: 'sneakers-white',
    name: 'White sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    colors: [sw('white', 'white')],
    material: 'leather',
    aspect: 1.8,
  },
  {
    id: 'boots-black-chelsea',
    name: 'Black Chelsea boots',
    category: 'shoes',
    subcategory: 'chelsea-boots',
    colors: [sw('black', 'black')],
    material: 'leather',
    rainOk: true,
    aspect: 1.1,
  },
  {
    id: 'loafers-brown',
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    colors: [sw('brown', 'brown')],
    material: 'leather',
    aspect: 1.8,
  },
  {
    id: 'sandals-tan',
    name: 'Tan sandals',
    category: 'shoes',
    subcategory: 'sandals',
    colors: [sw('tan', 'brown')],
    material: 'leather',
    aspect: 1.8,
  },
  {
    id: 'heels-black',
    name: 'Black suede heels',
    category: 'shoes',
    subcategory: 'heels',
    colors: [sw('black', 'black')],
    material: 'suede',
    formality: 5,
    aspect: 1.5,
  },
  {
    id: 'running-shoes-grey',
    name: 'Grey running shoes',
    category: 'shoes',
    subcategory: 'running-shoes',
    colors: [sw('grey', 'grey', 0.7), sw('white', 'white', 0.3)],
    material: 'synthetic',
    aspect: 1.9,
  },
  // accessories
  {
    id: 'belt-brown-leather',
    name: 'Brown leather belt',
    category: 'belt',
    subcategory: 'leather-belt',
    colors: [sw('brown', 'brown')],
    material: 'leather',
    metal: 'gold',
    aspect: 8,
  },
  {
    id: 'belt-black-leather',
    name: 'Black leather belt',
    category: 'belt',
    subcategory: 'leather-belt',
    colors: [sw('black', 'black')],
    material: 'leather',
    metal: 'silver',
    aspect: 8,
  },
  {
    id: 'bag-shoulder-brown',
    name: 'Brown leather shoulder bag',
    category: 'bag',
    subcategory: 'shoulder-bag',
    colors: [sw('brown', 'brown')],
    material: 'leather',
    metal: 'gold',
  },
  {
    id: 'beanie-grey',
    name: 'Grey wool beanie',
    category: 'headwear',
    subcategory: 'beanie',
    colors: [sw('grey', 'grey')],
    material: 'wool',
  },
  {
    id: 'sunglasses-black',
    name: 'Black sunglasses',
    category: 'eyewear',
    subcategory: 'sunglasses',
    colors: [sw('black', 'black')],
    material: 'synthetic',
    aspect: 2.5,
  },
  {
    id: 'scarf-wool-red',
    name: 'Red wool scarf',
    category: 'neckwear',
    subcategory: 'scarf',
    colors: [sw('red', 'red')],
    material: 'wool',
    warmth: 4,
  },
  {
    id: 'watch-silver',
    name: 'Silver dress watch',
    category: 'watch',
    subcategory: 'dress-watch',
    colors: [sw('grey', 'grey')],
    material: 'other',
    metal: 'silver',
  },
  {
    id: 'necklace-gold',
    name: 'Gold chain necklace',
    category: 'jewelry',
    subcategory: 'necklace',
    colors: [sw('yellow', 'yellow')],
    material: 'other',
    metal: 'gold',
    aspect: 1,
  },
  {
    id: 'socks-white',
    name: 'White crew socks',
    category: 'legwear',
    subcategory: 'socks',
    colors: [sw('white', 'white')],
    material: 'cotton',
  },
];

/** The shared test closet. Returns fresh copies, so tests may mutate the result freely. */
export function fixtureCloset(): Item[] {
  return SPECS.map(build);
}

/** A fresh copy of one fixture item. Throws if the id is unknown. */
export function fixtureById(id: string): Item {
  const spec = SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown fixture item "${id}"`);
  return build(spec);
}

// ── Weather presets (OUTFIT_ENGINE §6 bands, by feelsLikeC) ────────────────────────────────

/** ≥ 27 °C band. */
export const WEATHER_HOT: Readonly<Weather> = {
  tempMinC: 24,
  tempMaxC: 33,
  feelsLikeC: 31,
  precipProbability: 0,
  windKph: 8,
  isSunny: true,
};

/** 20–26 °C band. */
export const WEATHER_MILD: Readonly<Weather> = {
  tempMinC: 16,
  tempMaxC: 24,
  feelsLikeC: 22,
  precipProbability: 0.1,
  windKph: 10,
  isSunny: true,
};

/** 13–19 °C band, with rain (precip ≥ 0.5). */
export const WEATHER_COOL_RAIN: Readonly<Weather> = {
  tempMinC: 11,
  tempMaxC: 16,
  feelsLikeC: 14,
  precipProbability: 0.8,
  windKph: 18,
  isSunny: false,
};

/** 5–12 °C band. */
export const WEATHER_COLD: Readonly<Weather> = {
  tempMinC: 4,
  tempMaxC: 10,
  feelsLikeC: 7,
  precipProbability: 0.2,
  windKph: 14,
  isSunny: false,
};

/** < 5 °C band. */
export const WEATHER_FREEZING: Readonly<Weather> = {
  tempMinC: -6,
  tempMaxC: 1,
  feelsLikeC: -4,
  precipProbability: 0.1,
  windKph: 20,
  isSunny: false,
};

// ── Sample history ──────────────────────────────────────────────────────────────────────────

/** Three worn days plus one planned. Ids `log-001…`. */
export function fixtureWearLogs(): WearLog[] {
  const clock = fixedClock('2026-01-10T20:00:00.000Z');
  const ids = sequentialIds('log');
  return [
    newWearLog(
      {
        date: '2026-01-05',
        itemIds: ['tee-white', 'jeans-dark', 'sneakers-white'],
        weather: { ...WEATHER_MILD },
      },
      clock,
      ids,
    ),
    newWearLog(
      {
        date: '2026-01-07',
        itemIds: ['shirt-oxford-white', 'trousers-black', 'boots-black-chelsea', 'blazer-navy'],
        weather: { ...WEATHER_COOL_RAIN },
      },
      clock,
      ids,
    ),
    newWearLog(
      {
        date: '2026-01-09',
        itemIds: ['top-breton', 'chinos-beige', 'loafers-brown', 'belt-brown-leather'],
      },
      clock,
      ids,
    ),
    newWearLog(
      { date: '2026-01-12', itemIds: ['dress-wrap-green', 'heels-black'], planned: true },
      clock,
      ids,
    ),
  ];
}

/** Two likes and one dislike. Ids `fb-001…`. */
export function fixtureFeedback(): Feedback[] {
  const clock = fixedClock('2026-01-10T20:00:00.000Z');
  const ids = sequentialIds('fb');
  return [
    newFeedback(
      { itemIds: ['tee-white', 'jeans-dark', 'sneakers-white'], verdict: 'like' },
      clock,
      ids,
    ),
    newFeedback(
      { itemIds: ['shirt-oxford-white', 'trousers-black', 'boots-black-chelsea'], verdict: 'like' },
      clock,
      ids,
    ),
    newFeedback(
      { itemIds: ['blouse-floral', 'sweater-red', 'jeans-light'], verdict: 'dislike' },
      clock,
      ids,
    ),
  ];
}
