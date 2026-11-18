import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/**
 * Seeds a closet, one outfit and (optionally) a profile with a body photo straight into the
 * browser's storage, so a spec can start from "a photo already exists" without running pose
 * detection. Storage layout: AsyncStorage maps to localStorage ("fashionable/v1/<collection>"),
 * pictures live in the "fashionable-images" IndexedDB database.
 */

/** The body-a silhouette artwork on a plain backdrop, 500 × 1000 (already 1:2). */
export const BODY_PHOTO_FIXTURE = 'e2e/fixtures/silhouette-500x1000.png';
export const BODY_PHOTO_ID = 'seed-body-photo';
export const OUTFIT_ID = 'seed-outfit-1';

/** body-a landmarks in mannequin units (src/core/tryon/bodies.ts), which the fixture is drawn to. */
const p = (x: number, y: number) => ({ x, y });
export const BODY_A_LANDMARKS = {
  headTop: p(500, 80),
  chin: p(500, 312),
  eyeLine: p(500, 196),
  neckBase: p(500, 372),
  shoulderL: p(310, 400),
  shoulderR: p(690, 400),
  waistL: p(350, 800),
  waistR: p(650, 800),
  hipL: p(330, 960),
  hipR: p(670, 960),
  kneeL: p(420, 1400),
  kneeR: p(580, 1400),
  ankleL: p(400, 1860),
  ankleR: p(600, 1860),
  wristL: p(210, 1040),
  wristR: p(790, 1040),
  footL: p(390, 1940),
  footR: p(610, 1940),
};

interface Garment {
  key: string;
  /** Fixture PNG in e2e/fixtures/garments (without extension); defaults to `key`. */
  file?: string;
  name: string;
  category: string;
  subcategory: string;
  hex: string;
  color: string;
  layer?: 'base' | 'mid';
  aspect: number;
}

const GARMENTS: Garment[] = [
  {
    key: 'tee-navy',
    name: 'Navy tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#1f2a44',
    color: 'navy',
    aspect: 0.839,
  },
  {
    key: 'tee-white',
    name: 'White tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#f1eee6',
    color: 'white',
    aspect: 0.839,
  },
  {
    key: 'jeans-dark',
    name: 'Dark jeans',
    category: 'bottom',
    subcategory: 'jeans',
    hex: '#2b3f66',
    color: 'navy',
    aspect: 0.361,
  },
  {
    key: 'sneakers-white',
    name: 'White sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    hex: '#f4f4f2',
    color: 'white',
    aspect: 2.422,
  },
  {
    key: 'loafers-brown',
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    hex: '#6b4a2f',
    color: 'brown',
    aspect: 2.547,
  },
];

/** More garments, only seeded when a spec asks for them by key (`SeedOptions.extra`). */
const EXTRA_GARMENTS: Garment[] = [
  {
    key: 'shirt-blue',
    name: 'Blue shirt',
    category: 'top',
    subcategory: 'shirt',
    layer: 'base',
    hex: '#5a7fb0',
    color: 'blue',
    aspect: 0.839,
  },
  {
    key: 'sweater-blue',
    file: 'shirt-blue',
    name: 'Blue sweater',
    category: 'top',
    subcategory: 'sweater',
    layer: 'mid',
    hex: '#5a7fb0',
    color: 'blue',
    aspect: 0.839,
  },
  {
    key: 'jacket-denim',
    name: 'Denim jacket',
    category: 'outerwear',
    subcategory: 'denim-jacket',
    hex: '#3d5a80',
    color: 'blue',
    aspect: 0.917,
  },
  {
    key: 'trousers-grey',
    name: 'Grey trousers',
    category: 'bottom',
    subcategory: 'trousers',
    hex: '#7a7d82',
    color: 'grey',
    aspect: 0.331,
  },
  {
    key: 'skirt-olive',
    name: 'Olive skirt',
    category: 'bottom',
    subcategory: 'skirt',
    hex: '#6b6b3a',
    color: 'olive',
    aspect: 0.825,
  },
  {
    key: 'dress-green',
    name: 'Green dress',
    category: 'onepiece',
    subcategory: 'day-dress',
    hex: '#3f7d4e',
    color: 'green',
    aspect: 0.625,
  },
  {
    key: 'boots-black',
    name: 'Black boots',
    category: 'shoes',
    subcategory: 'chelsea-boots',
    hex: '#1b1b1d',
    color: 'black',
    aspect: 1.1,
  },
];

export interface SeedOutfit {
  id: string;
  name: string;
  /** Garment keys, e.g. 'tee-navy'. */
  keys: string[];
}

const gid = (key: string) => `seed-${key}`;
/** Item id of a seeded garment key. */
export const seedItemId = gid;
const wrap = (records: object[]) => JSON.stringify({ schemaVersion: 1, records });

function itemRecord(g: Garment, i: number) {
  const at = `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`;
  return {
    id: gid(g.key),
    createdAt: at,
    updatedAt: at,
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    ...(g.layer ? { layer: g.layer } : {}),
    colors: [{ hex: g.hex, share: 1, name: g.color }],
    pattern: 'solid',
    patternBold: false,
    formality: 2,
    warmth: 2,
    rainOk: true,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: `${g.key}-o`, cutoutId: `${g.key}-c`, thumbId: `${g.key}-t` },
    cutout: { aspectRatio: g.aspect, hasAlpha: true },
  };
}

const outfitRecord = {
  id: OUTFIT_ID,
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
  name: 'Weekday navy',
  itemIds: [gid('tee-navy'), gid('jeans-dark'), gid('sneakers-white')],
  source: 'manual',
  favorite: false,
};

function extraOutfit(o: SeedOutfit) {
  return {
    ...outfitRecord,
    id: o.id,
    name: o.name,
    itemIds: o.keys.map(gid),
  };
}

export interface SeedOptions {
  /** Put a body photo (and the profile that points at it) into storage. Default true. */
  bodyPhoto?: boolean;
  tryOnMode?: 'photo' | 'silhouette';
  /** Keys of extra garments to seed (shirt-blue, sweater-blue, jacket-denim, trousers-grey, …). */
  extra?: string[];
  /** Landmarks of the seeded body photo; default `BODY_A_LANDMARKS` (the silhouette's own). */
  landmarks?: typeof BODY_A_LANDMARKS;
  /** More saved outfits, besides the default one. */
  outfits?: SeedOutfit[];
}

export async function seedTryOn(page: Page, options: SeedOptions = {}): Promise<void> {
  const {
    bodyPhoto = true,
    tryOnMode,
    extra = [],
    outfits = [],
    landmarks = BODY_A_LANDMARKS,
  } = options;
  const garments = [...GARMENTS, ...EXTRA_GARMENTS.filter((g) => extra.includes(g.key))];
  const images = [
    ...garments.map((g) => ({
      ids: [`${g.key}-c`, `${g.key}-t`],
      b64: readFileSync(`e2e/fixtures/garments/${g.file ?? g.key}.png`).toString('base64'),
    })),
    ...(bodyPhoto
      ? [{ ids: [BODY_PHOTO_ID], b64: readFileSync(BODY_PHOTO_FIXTURE).toString('base64') }]
      : []),
  ];
  const profile = {
    id: 'seed-profile',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    bodyTemplateId: 'body-a',
    units: 'metric',
    ...(bodyPhoto
      ? {
          bodyPhoto: {
            imageId: BODY_PHOTO_ID,
            landmarks,
            detected: landmarks,
            takenAt: '2026-01-01T00:00:00.000Z',
          },
        }
      : {}),
    ...(tryOnMode ? { tryOnMode } : {}),
  };
  await page.goto('/');
  await page.evaluate(
    async ([imgs, items, outfits, profiles]) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('fashionable-images', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('images');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('images', 'readwrite');
          for (const img of imgs) {
            const bytes = Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'image/png' });
            for (const id of img.ids) tx.objectStore('images').put(blob, id);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.setItem('fashionable/v1/items', items);
      localStorage.setItem('fashionable/v1/outfits', outfits);
      localStorage.setItem('fashionable/v1/profile', profiles);
    },
    [
      images,
      wrap(garments.map(itemRecord)),
      wrap([outfitRecord, ...outfits.map(extraOutfit)]),
      wrap([profile]),
    ] as const,
  );
}

/** Opens a route and waits for its screen (a fresh load after the seed so the stores read it). */
export async function openScreen(page: Page, path: string, screen: string): Promise<void> {
  await expect(async () => {
    await page.goto(path);
    await expect(page.getByTestId(screen)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

/** The profile record as the app last persisted it (the store writes after a short delay). */
export async function storedProfile(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fashionable/v1/profile');
    if (!raw) return undefined;
    const doc = JSON.parse(raw) as { records: Record<string, unknown>[] };
    return doc.records[0];
  });
}

/** Whether the image store still holds `id`. */
export async function imageExists(page: Page, id: string): Promise<boolean> {
  return page.evaluate(
    (key) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('fashionable-images', 1);
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const get = open.result.transaction('images', 'readonly').objectStore('images').get(key);
          get.onsuccess = () => resolve(get.result !== undefined);
          get.onerror = () => resolve(false);
        };
      }),
    id,
  );
}
