import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** Open-Meteo is never reached: the seeded profile has no location. */

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.INSIGHTS_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/insights-${name}.png` });
};

const ASPECTS = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/garments/aspects.json'), 'utf8'),
) as Record<string, number>;

interface Seed {
  id: string;
  /** Fixture picture (e2e/fixtures/garments/<image>.png). */
  image: string;
  name: string;
  category: string;
  subcategory: string;
  layer?: 'base' | 'mid';
  hex: string;
  color: string;
  formality: number;
  warmth: number;
  pricePaid?: number;
}

/**
 * A small closet built to show every section: no white sneakers (a clear gap), a pair of near
 * identical navy tees (duplicates) and a few pieces nobody has worn for months.
 */
const GARMENTS: Seed[] = [
  {
    id: 'tee-navy',
    image: 'tee-navy',
    name: 'Navy tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#1f2a44',
    color: 'navy',
    formality: 2,
    warmth: 2,
    pricePaid: 30,
  },
  {
    id: 'tee-navy-b',
    image: 'tee-navy',
    name: 'Navy tee old',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#202c46',
    color: 'navy',
    formality: 2,
    warmth: 2,
  },
  {
    id: 'tee-white',
    image: 'tee-white',
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
    id: 'shirt-blue',
    image: 'shirt-blue',
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
    id: 'jeans-dark',
    image: 'jeans-dark',
    name: 'Dark jeans',
    category: 'bottom',
    subcategory: 'jeans',
    hex: '#2b3f66',
    color: 'navy',
    formality: 2,
    warmth: 3,
    pricePaid: 60,
  },
  {
    id: 'trousers-grey',
    image: 'trousers-grey',
    name: 'Grey trousers',
    category: 'bottom',
    subcategory: 'trousers',
    hex: '#5a5e68',
    color: 'grey',
    formality: 3,
    warmth: 3,
  },
  {
    id: 'skirt-olive',
    image: 'skirt-olive',
    name: 'Olive skirt',
    category: 'bottom',
    subcategory: 'skirt',
    hex: '#6f7650',
    color: 'olive',
    formality: 3,
    warmth: 2,
  },
  {
    id: 'loafers-brown',
    image: 'loafers-brown',
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    hex: '#6b4a2f',
    color: 'brown',
    formality: 3,
    warmth: 2,
  },
  {
    id: 'boots-black',
    image: 'boots-black',
    name: 'Black boots',
    category: 'shoes',
    subcategory: 'chelsea-boots',
    hex: '#26262b',
    color: 'black',
    formality: 3,
    warmth: 4,
  },
  {
    id: 'jacket-denim',
    image: 'jacket-denim',
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
    id: g.id,
    createdAt: at,
    updatedAt: at,
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    ...(g.layer ? { layer: g.layer } : {}),
    ...(g.pricePaid !== undefined ? { pricePaid: g.pricePaid } : {}),
    colors: [{ hex: g.hex, share: 1, name: g.color }],
    pattern: 'solid',
    patternBold: false,
    formality: g.formality,
    warmth: g.warmth,
    rainOk: true,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: `${g.id}-o`, cutoutId: `${g.id}-c`, thumbId: `${g.id}-t` },
    cutout: { aspectRatio: ASPECTS[g.image], hasAlpha: true },
  };
};

const wearLog = (id: string, date: string, itemIds: string[]) => ({
  id,
  createdAt: `${date}T08:00:00.000Z`,
  updatedAt: `${date}T08:00:00.000Z`,
  date,
  itemIds,
  planned: false,
});

const LOGS = [
  wearLog('w1', '2026-05-20', ['tee-navy', 'jeans-dark', 'boots-black']),
  wearLog('w2', '2026-05-25', ['tee-navy', 'jeans-dark', 'boots-black']),
  wearLog('w3', '2026-05-30', ['tee-navy', 'jeans-dark', 'loafers-brown']),
  wearLog('w4', '2026-05-31', ['tee-white', 'trousers-grey', 'loafers-brown']),
];

/** Writes closet, wear logs and garment pictures into the browser, then reloads. */
async function seed(page: Page, garments: Seed[], logs: object[]): Promise<void> {
  const images = garments.map((g) => ({
    id: `${g.id}-c`,
    thumb: `${g.id}-t`,
    b64: readFileSync(join(__dirname, `fixtures/garments/${g.image}.png`)).toString('base64'),
  }));
  const items = JSON.stringify({ schemaVersion: 1, records: garments.map(record) });
  const wear = JSON.stringify({ schemaVersion: 1, records: logs });
  await page.goto('/');
  await page.evaluate(
    async ([imgs, itemsJson, wearJson]) => {
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
      localStorage.setItem('fashionable/v1/items', itemsJson);
      localStorage.setItem('fashionable/v1/wearLogs', wearJson);
    },
    [images, items, wear] as const,
  );
  await page.reload();
}

/** Scrolls so the element's top is at the top of the scroll area (nicer screenshots). */
const toTop = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => el.scrollIntoView({ block: 'start' }));

async function openInsights(page: Page): Promise<void> {
  await page.getByTestId('closet-insights-button').click();
  await expect(page.getByTestId('screen-insights')).toBeVisible();
}

test.describe('insights', () => {
  test.beforeEach(async ({ page }) => {
    // The stats depend on "today": freeze it so the 90-day rule is the same on every run.
    await page.clock.install({ time: new Date('2026-06-01T10:00:00') });
  });

  test('shows gaps, add-ons, orphans, duplicates and stats for a seeded closet', async ({
    page,
  }) => {
    await seed(page, GARMENTS, LOGS);
    await expect(page.getByTestId('closet-insights-button')).toBeVisible();
    await shot(page, '0-closet-header');
    await openInsights(page);

    // 1. Pieces that would unlock the most outfits: the closet has no sneakers at all.
    const gaps = page.locator('[data-testid^="insights-gap-"]:not([data-testid*="-mannequin"])');
    await expect(page.getByTestId('insights-section-gaps')).toBeVisible();
    await expect(page.getByTestId('insights-gap-white-sneakers')).toBeVisible();
    expect(await gaps.count()).toBeGreaterThan(0);
    await expect(page.getByTestId('insights-gap-white-sneakers-title')).toHaveText(
      'White sneakers',
    );
    await expect(page.getByTestId('insights-gap-white-sneakers-metric')).toHaveText(
      /^\+\d+ outfits?$/,
    );
    await expect(page.getByTestId('insights-gap-white-sneakers-suggested')).toContainText(
      'Suggested',
    );
    // The suggested piece is drawn flat; the user's own pieces use their cutouts.
    const mannequin = page.getByTestId('insights-gap-white-sneakers-mannequin');
    await expect(mannequin.getByTestId('mannequin-image-archetype:white-sneakers')).toBeVisible();
    await expect(mannequin.locator('[data-testid^="mannequin-image-"]')).toHaveCount(3);
    await shot(page, '1-gaps');

    // 2. Add-ons.
    const addons = page.locator(
      '[data-testid^="insights-addon-"]:not([data-testid*="-mannequin"]):not([data-testid*="-title"]):not([data-testid*="-metric"]):not([data-testid*="-suggested"])',
    );
    await expect(page.getByTestId('insights-section-addons')).toBeVisible();
    expect(await addons.count()).toBeGreaterThan(0);
    await expect(
      page.locator('[data-testid^="insights-addon-"][data-testid$="-metric"]').first(),
    ).toHaveText(/^Improves \d+ outfits?$/);
    await toTop(page, 'insights-section-addons');
    await shot(page, '2-addons');

    // 3. Orphans.
    await toTop(page, 'insights-section-orphans');
    await expect(page.getByTestId('insights-section-orphans')).toBeVisible();
    await shot(page, '3-orphans');

    // 4. Duplicates.
    const dup = page.getByTestId('insights-duplicates-0');
    await toTop(page, 'insights-section-duplicates');
    await expect(dup).toBeVisible();
    await expect(page.getByTestId('insights-duplicates-0-item-tee-navy')).toBeVisible();
    await expect(page.getByTestId('insights-duplicates-0-item-tee-navy-b')).toBeVisible();
    await shot(page, '4-duplicates');

    // 5. Stats.
    const most = page.getByTestId('insights-stats-most-worn');
    await toTop(page, 'insights-section-stats');
    await expect(most.getByTestId('insights-stats-most-worn-tee-navy')).toContainText('3 wears');
    await expect(page.getByTestId('insights-stats-untouched-shirt-blue')).toContainText(
      'Never worn',
    );
    // Worn within 90 days, so not untouched; created in January, so old enough otherwise.
    await expect(page.getByTestId('insights-stats-untouched-tee-navy')).toHaveCount(0);
    await shot(page, '5-stats-worn');
    await toTop(page, 'insights-stats-colours');
    await expect(page.getByTestId('insights-stats-colours-navy')).toContainText('Navy');
    await expect(page.getByTestId('insights-stats-categories-top')).toContainText('Top');
    await expect(page.getByTestId('insights-stats-cost-tee-navy')).toContainText('10 per wear');
    await shot(page, '6-stats-colours');
  });

  test('a duplicate opens the item detail, and back returns to Insights', async ({ page }) => {
    await seed(page, GARMENTS, LOGS);
    await openInsights(page);
    await page.getByTestId('insights-duplicates-0-item-tee-navy-b').scrollIntoViewIfNeeded();
    await page.getByTestId('insights-duplicates-0-item-tee-navy-b').click();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('screen-insights')).toBeVisible();
  });

  test('is reachable from the Profile tab', async ({ page }) => {
    await seed(page, GARMENTS, LOGS);
    await page.getByRole('tab', { name: 'Profile' }).click();
    await expect(page.getByTestId('profile-insights')).toBeVisible();
    await shot(page, '9-profile');
    await page.getByTestId('profile-insights').click();
    await expect(page.getByTestId('screen-insights')).toBeVisible();
    await page.getByTestId('insights-back').click();
    await expect(page.getByTestId('screen-profile')).toBeVisible();
  });

  test('an empty closet explains what Insights needs', async ({ page }) => {
    await page.goto('/');
    await openInsights(page);
    await expect(page.getByTestId('insights-empty')).toContainText('tops, bottoms and shoes');
    await shot(page, '7-empty');
  });

  test('a closet that is too small asks for a few more pieces', async ({ page }) => {
    await seed(
      page,
      GARMENTS.filter((g) => ['tee-white', 'jeans-dark'].includes(g.id)),
      [],
    );
    await openInsights(page);
    await expect(page.getByTestId('insights-too-small')).toContainText('tops, bottoms and shoes');
    await expect(page.getByTestId('insights-too-small')).toContainText('0 pairs of shoes');
    // Wear stats still work with no wear logs: a hint instead of empty lists.
    await expect(page.getByTestId('insights-stats-no-wears')).toBeVisible();
    await shot(page, '8-too-small');
  });
});
