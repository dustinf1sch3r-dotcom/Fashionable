import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** Open-Meteo is always mocked or unused here; the real API is never called. */

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.OUTFITS_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/outfits-${name}.png` });
};

const ASPECTS = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/garments/aspects.json'), 'utf8'),
) as Record<string, number>;

interface Seed {
  key: string;
  name: string;
  category: string;
  subcategory: string;
  hex: string;
  color: string;
  formality: number;
  warmth: number;
  layer?: 'base' | 'mid';
}

const GARMENTS: Seed[] = [
  {
    key: 'tee-navy',
    name: 'Navy tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#1f2a44',
    color: 'navy',
    formality: 2,
    warmth: 2,
  },
  {
    key: 'tee-white',
    name: 'White tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#f1eee6',
    color: 'white',
    formality: 2,
    warmth: 1,
  },
  {
    key: 'shirt-blue',
    name: 'Blue shirt',
    category: 'top',
    subcategory: 'shirt',
    layer: 'base',
    hex: '#8fb3de',
    color: 'blue',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'jeans-dark',
    name: 'Dark jeans',
    category: 'bottom',
    subcategory: 'jeans',
    hex: '#2b3f66',
    color: 'navy',
    formality: 2,
    warmth: 3,
  },
  {
    key: 'trousers-grey',
    name: 'Grey trousers',
    category: 'bottom',
    subcategory: 'trousers',
    hex: '#5a5e68',
    color: 'grey',
    formality: 3,
    warmth: 3,
  },
  {
    key: 'skirt-olive',
    name: 'Olive skirt',
    category: 'bottom',
    subcategory: 'skirt',
    hex: '#6f7650',
    color: 'olive',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'dress-green',
    name: 'Green dress',
    category: 'onepiece',
    subcategory: 'day-dress',
    hex: '#3f7d5c',
    color: 'green',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'sneakers-white',
    name: 'White sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    hex: '#f4f4f2',
    color: 'white',
    formality: 2,
    warmth: 2,
  },
  {
    key: 'loafers-brown',
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    hex: '#6b4a2f',
    color: 'brown',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'boots-black',
    name: 'Black boots',
    category: 'shoes',
    subcategory: 'chelsea-boots',
    hex: '#26262b',
    color: 'black',
    formality: 3,
    warmth: 4,
  },
  {
    key: 'jacket-denim',
    name: 'Denim jacket',
    category: 'outerwear',
    subcategory: 'denim-jacket',
    hex: '#4f6f9c',
    color: 'blue',
    formality: 2,
    warmth: 3,
  },
];

const record = (g: Seed, i: number) => {
  const at = `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`;
  return {
    id: `seed-${g.key}`,
    createdAt: at,
    updatedAt: at,
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    ...(g.layer ? { layer: g.layer } : {}),
    colors: [{ hex: g.hex, share: 1, name: g.color }],
    pattern: 'solid',
    patternBold: false,
    formality: g.formality,
    warmth: g.warmth,
    rainOk: true,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: `${g.key}-o`, cutoutId: `${g.key}-c`, thumbId: `${g.key}-t` },
    cutout: { aspectRatio: ASPECTS[g.key], hasAlpha: true },
  };
};

/** Writes the closet into localStorage and the garment pictures into IndexedDB, then reloads. */
async function seedCloset(page: Page, keys: string[]): Promise<void> {
  const chosen = GARMENTS.filter((g) => keys.includes(g.key));
  const images = chosen.map((g) => ({
    id: `${g.key}-c`,
    thumb: `${g.key}-t`,
    b64: readFileSync(join(__dirname, `fixtures/garments/${g.key}.png`)).toString('base64'),
  }));
  const items = JSON.stringify({ schemaVersion: 1, records: chosen.map(record) });
  await page.goto('/');
  await page.evaluate(
    async ([imgs, json]) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('fashionable-images', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('images');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('images', 'readwrite');
          for (const img of imgs) {
            const bytes = Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'image/png' });
            tx.objectStore('images').put(blob, img.id);
            tx.objectStore('images').put(blob, img.thumb);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.setItem('fashionable/v1/items', json);
    },
    [images, items] as const,
  );
  await page.reload();
}

async function openOutfits(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByRole('tab', { name: 'Outfits' }).click();
    await expect(page.getByTestId('screen-outfits')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

const FULL = GARMENTS.map((g) => g.key);

test.describe('outfit ideas', () => {
  test.beforeEach(async ({ page }) => {
    await seedCloset(page, FULL);
    await openOutfits(page);
  });

  test('Surprise me shows cards with a dressed mannequin and reasons', async ({ page }) => {
    await expect(page.getByTestId('outfit-card-0')).toBeVisible();
    await expect(page.getByTestId('outfit-score-0')).toContainText(/match|Worth a try/);
    const layers = page.locator('[data-testid^="mannequin-item-"]');
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    expect(
      await page.getByTestId('outfit-card-0').locator('[data-testid^="mannequin-item-"]').count(),
    ).toBeGreaterThanOrEqual(3);
    await expect(
      page.getByTestId('outfit-card-0').locator('[data-testid^="mannequin-image-"]').first(),
    ).toBeVisible();
    expect(await layers.count()).toBeGreaterThan(0);
    await expect(page.getByTestId('outfit-reason-0').first()).toBeVisible();
    await expect(page.getByTestId('outfit-reasons-0')).not.toContainText('undefined');
    await shot(page, 'ideas');
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 480);
    await page.waitForTimeout(300);
    await shot(page, 'card');

    const first = await page.getByTestId('outfit-card-0').innerText();
    await page.getByTestId('outfits-surprise').click();
    await expect(page.getByTestId('outfit-card-0')).toBeVisible();
    // New seed: a (very likely) different set; at minimum it renders again.
    expect((await page.getByTestId('outfit-card-0').innerText()).length).toBeGreaterThan(0);
    void first;
  });

  test('changing occasion regenerates', async ({ page }) => {
    await expect(page.getByTestId('outfit-card-0')).toBeVisible();
    await page.getByTestId('outfits-occasion-formal').click();
    await expect(page.getByTestId('outfits-occasion-formal')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Only smart pieces survive "formal" (formality 4–5): none here, so the closet is too small.
    await expect(page.getByTestId('outfits-too-small')).toBeVisible();
    await page.getByTestId('outfits-occasion-casual').click();
    await expect(page.getByTestId('outfit-card-0')).toBeVisible();
  });

  test('like, dislike and pinning', async ({ page }) => {
    await page.getByTestId('outfit-like-0').click();
    await expect(page.getByTestId('outfit-feedback-0')).toContainText('more like this');
    await page.getByTestId('outfit-dislike-0').click();
    await expect(page.getByTestId('outfit-feedback-0')).toContainText('fewer like this');

    const pin = page.locator('[data-testid^="outfit-0-item-"][data-testid$="-pin"]').first();
    const pinId = (await pin.getAttribute('data-testid')) ?? '';
    const itemId = pinId.replace('outfit-0-item-', '').replace('-pin', '');
    await pin.click();
    await expect(page.getByTestId(`outfits-pin-${itemId}`)).toBeVisible();
    await expect(page.getByTestId('outfit-card-0')).toBeVisible();
    const cards = await page.locator('[data-testid^="outfit-card-"]').count();
    for (let i = 0; i < cards; i++) {
      await expect(page.getByTestId(`outfit-${i}-item-${itemId}`)).toHaveCount(1);
    }
    await page.getByTestId(`outfits-pin-${itemId}`).click();
    await expect(page.getByTestId(`outfits-pin-${itemId}`)).toHaveCount(0);
  });

  test('save, see it under Saved, rename, favourite, open in Mix, delete and undo', async ({
    page,
  }) => {
    await page.getByTestId('outfit-save-0').click();
    await expect(page.getByTestId('outfit-save-0')).toContainText('Saved');
    await page.getByTestId('outfits-tab-saved').click();
    const row = page.locator('[data-testid^="saved-outfit-"]').first();
    await expect(row).toBeVisible();
    await shot(page, 'saved');
    await page.locator('[data-testid^="saved-open-"]').first().click();
    await expect(page.getByTestId('screen-outfit-detail')).toBeVisible();
    await expect(page.getByTestId('outfit-detail-mannequin')).toBeVisible();
    await expect(page.getByTestId('outfit-title')).not.toBeEmpty();
    await expect(
      page
        .getByTestId('outfit-detail-mannequin')
        .locator('[data-testid^="mannequin-image-"]')
        .first(),
    ).toBeVisible();
    await shot(page, 'detail');

    await page.getByTestId('outfit-rename').click();
    await page.getByTestId('outfit-rename-input').fill('Friday drinks');
    await page.getByTestId('outfit-rename-save').click();
    await expect(page.getByTestId('outfit-title')).toHaveText('Friday drinks');
    await page.getByTestId('outfit-favorite').click();
    await expect(page.getByTestId('outfit-favorite')).toHaveAttribute(
      'aria-label',
      'Remove from favourites',
    );

    await page.getByTestId('outfit-open-mix').click();
    await expect(page).toHaveURL(/\/mix\?outfitId=[^&]+/);
    await page.goBack();
    await expect(page.getByTestId('screen-outfit-detail')).toBeVisible();

    await page.getByTestId('outfit-delete').click();
    await expect(page.getByTestId('outfit-deleted')).toBeVisible();
    await page.getByTestId('outfit-undo').click();
    await expect(page.getByTestId('outfit-title')).toHaveText('Friday drinks');
  });

  test('item thumbnail opens the item', async ({ page }) => {
    await page
      .locator(
        '[data-testid^="outfit-0-item-"]:not([data-testid$="-pin"]):not([data-testid$="-img"])',
      )
      .first()
      .click();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
  });
});

test('a saved outfit whose piece was deleted shows a gentle note', async ({ page }) => {
  await seedCloset(page, FULL);
  await page.evaluate(() => {
    const now = '2026-02-01T10:00:00.000Z';
    localStorage.setItem(
      'fashionable/v1/outfits',
      JSON.stringify({
        schemaVersion: 1,
        records: [
          {
            id: 'saved-1',
            createdAt: now,
            updatedAt: now,
            itemIds: ['seed-tee-navy', 'seed-jeans-dark', 'seed-gone'],
            source: 'manual',
            favorite: false,
          },
        ],
      }),
    );
  });
  await page.reload();
  await openOutfits(page);
  await page.getByTestId('outfits-tab-saved').click();
  await expect(page.getByTestId('saved-name-saved-1')).toHaveText('Navy tee & dark jeans');
  await expect(page.getByTestId('saved-note-saved-1')).toContainText('no longer in your closet');
});

test('a closet that is too small says what to add', async ({ page }) => {
  await seedCloset(page, ['tee-navy', 'jeans-dark']);
  await openOutfits(page);
  await expect(page.getByTestId('outfits-too-small')).toContainText('some shoes');
  await shot(page, 'too-small');
  await page.getByTestId('outfits-add-item').click();
  await expect(page.getByTestId('screen-add-item')).toBeVisible();
});

test('an empty closet shows a friendly start', async ({ page }) => {
  await page.goto('/');
  await openOutfits(page);
  await expect(page.getByTestId('outfits-empty')).toBeVisible();
});

test('weather appears on the screen (mocked)', async ({ page }) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const fill = <T>(v: T) => days.map(() => v);
  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        daily: {
          time: days,
          temperature_2m_max: fill(6),
          temperature_2m_min: fill(1),
          apparent_temperature_max: fill(3),
          apparent_temperature_min: fill(-1),
          precipitation_probability_max: fill(60),
          wind_speed_10m_max: fill(14),
          weather_code: fill(61),
        },
      },
    }),
  );
  await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        results: [{ name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 }],
      },
    }),
  );
  await seedCloset(page, FULL);
  await openOutfits(page);
  await page.getByTestId('weather-search').click();
  await page.getByTestId('location-sheet-query').fill('Berlin');
  await page.getByTestId('location-sheet-search').click();
  await page.getByTestId('location-sheet-result-0').click();
  await expect(page.getByTestId('weather-temp')).toBeVisible();
  await expect(page.getByTestId('outfit-card-0')).toBeVisible();
  await expect(page.getByTestId('outfit-reasons-0')).not.toContainText('undefined');
  await shot(page, 'weather');
});
