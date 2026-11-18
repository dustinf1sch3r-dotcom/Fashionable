import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Open-Meteo is never reached: the seeded profile has no location, so no weather request is made. */

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.CAL_SHOTS;
const shot = async (page: Page, name: string) => {
  // Let sheets finish sliding in before the picture.
  if (SHOTS) await page.waitForTimeout(500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/calendar-${name}.png` });
};

// The browser clock is frozen at midday on this (local) date, so every date below is deterministic.
const TODAY = '2026-11-18';
const YESTERDAY = '2026-11-17';
const TOMORROW = '2026-11-19';
const NOW = new Date(2026, 10, 18, 12, 0, 0);

const ASPECTS = JSON.parse(readFileSync('e2e/fixtures/garments/aspects.json', 'utf8')) as Record<
  string,
  number
>;

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
];

const id = (key: string) => `seed-${key}`;

const record = (g: Seed, i: number) => {
  const at = `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`;
  return {
    id: id(g.key),
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

const OUTFIT = {
  id: 'seed-outfit-1',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
  name: 'Weekday navy',
  itemIds: [id('tee-navy'), id('jeans-dark'), id('sneakers-white')],
  source: 'manual',
  favorite: false,
};

const wearLog = (logId: string, date: string, keys: string[], planned: boolean) => ({
  id: logId,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  date,
  itemIds: keys.map(id),
  planned,
});

/** Closet, outfits and wear logs into storage, pictures into IndexedDB, then the clock is frozen. */
async function seed(page: Page, outfits: object[] = [OUTFIT], logs: object[] = []): Promise<void> {
  await page.clock.setFixedTime(NOW);
  const images = GARMENTS.map((g) => ({
    id: `${g.key}-c`,
    thumb: `${g.key}-t`,
    b64: readFileSync(`e2e/fixtures/garments/${g.key}.png`).toString('base64'),
  }));
  const wrap = (records: object[]) => JSON.stringify({ schemaVersion: 1, records });
  await page.goto('/');
  await page.evaluate(
    async ([imgs, items, outs, wears]) => {
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
      localStorage.setItem('fashionable/v1/items', items);
      localStorage.setItem('fashionable/v1/outfits', outs);
      localStorage.setItem('fashionable/v1/wearLogs', wears);
    },
    [images, wrap(GARMENTS.map(record)), wrap(outfits), wrap(logs)] as const,
  );
}

/** Opens a route and waits for its screen (a fresh load after the seed so the stores read it). */
async function open(page: Page, path: string, screen: string): Promise<void> {
  await expect(async () => {
    await page.goto(path);
    await expect(page.getByTestId(screen)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

const thumb = (page: Page, date: string) => page.getByTestId(`calendar-day-${date}-thumb`);
const mannequin = (page: Page) =>
  page.locator('[data-testid^="day-mannequin-"]:not([data-testid$="-silhouette"])');
const planned = (page: Page, date: string) => page.getByTestId(`calendar-day-${date}-planned`);

test.describe('calendar', () => {
  test('wore this today from a saved outfit shows on the calendar, and can be deleted', async ({
    page,
  }) => {
    await seed(page);
    await open(page, `/outfits/${OUTFIT.id}`, 'screen-outfit-detail');
    await expect(page.getByTestId('outfit-title')).toHaveText('Weekday navy');
    await shot(page, 'outfit-button');

    await page.getByTestId('wore-today-outfit').click();
    await expect(page.getByTestId('wore-today-outfit-notice')).toContainText('Logged for today');
    await shot(page, 'wore-notice');
    await page.getByTestId('wore-today-outfit-calendar').click();

    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    await expect(page.getByTestId('calendar-month')).toHaveText('November 2026');
    await expect(thumb(page, TODAY)).toBeVisible();
    await expect(page.getByTestId('calendar-summary')).toHaveText('Logged 1 of the last 7 days');
    await expect(page.getByTestId(`calendar-day-${TODAY}`)).toHaveAccessibleName(
      'Wednesday 18 November, today, outfit logged',
    );
    await shot(page, 'month');

    await page.getByTestId(`calendar-day-${TODAY}`).click();
    await expect(page.getByTestId('screen-calendar-day')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/calendar/${TODAY}`));
    await expect(page.getByTestId('calendar-day-title')).toHaveText('Wednesday 18 November');
    await expect(mannequin(page)).toBeVisible();
    await expect(page.locator('[data-testid^="day-log-title-"]')).toHaveText('Weekday navy');
    await expect(page.locator('[data-testid^="day-log-status-"]')).toHaveText('Worn');
    for (const key of ['tee-navy', 'jeans-dark', 'sneakers-white']) {
      await expect(page.getByTestId(`day-piece-${id(key)}`)).toBeVisible();
    }
    await shot(page, 'day');

    await page.locator('[data-testid^="day-log-delete-"]').click();
    await expect(page.getByTestId('calendar-day-empty')).toBeVisible();
    await expect(page.locator('[data-testid^="day-log-"]')).toHaveCount(0);

    // Undo brings it back; deleting again and going back leaves the grid empty.
    await page.getByTestId('calendar-day-undo').click();
    await expect(mannequin(page)).toBeVisible();
    await page.locator('[data-testid^="day-log-delete-"]').click();
    await page.getByTestId('calendar-day-back').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    await expect(thumb(page, TODAY)).toHaveCount(0);
    await expect(page.getByTestId('calendar-summary')).toContainText('Nothing logged yet');
  });

  test('a second "Wore this today" offers Replace or Add another, and Undo reverts', async ({
    page,
  }) => {
    await seed(page);
    await open(page, `/outfits/${OUTFIT.id}`, 'screen-outfit-detail');
    await page.getByTestId('wore-today-outfit').click();
    await expect(page.getByTestId('wore-today-outfit-notice')).toBeVisible();

    await page.getByTestId('wore-today-outfit').click();
    await expect(page.getByTestId('wore-today-outfit-sheet')).toBeVisible();
    await shot(page, 'replace-sheet');
    await page.getByTestId('wore-today-outfit-add').click();
    await expect(page.getByTestId('wore-today-outfit-notice')).toContainText('Logged for today');

    await page.getByTestId('wore-today-outfit').click();
    await page.getByTestId('wore-today-outfit-replace').click();
    await expect(page.getByTestId('wore-today-outfit-notice')).toContainText('Replaced');
    await page.getByTestId('wore-today-outfit-undo').click();
    await expect(page.getByTestId('wore-today-outfit-notice')).toHaveCount(0);

    // Replace removed both earlier logs; Undo of the replacement restored them: two logs again.
    await open(page, `/calendar/${TODAY}`, 'screen-calendar-day');
    await expect(page.locator('[data-testid^="day-log-status-"]')).toHaveCount(2);
  });

  test('plan a saved outfit for tomorrow, and answer "did you wear it?" when the day comes', async ({
    page,
  }) => {
    await seed(
      page,
      [OUTFIT],
      [
        wearLog('plan-yes', YESTERDAY, ['tee-white', 'jeans-dark', 'sneakers-white'], true),
        wearLog('plan-no', '2026-11-16', ['tee-navy', 'jeans-dark', 'loafers-brown'], true),
      ],
    );
    await open(page, `/calendar/${TOMORROW}`, 'screen-calendar-day');
    await expect(page.getByTestId('log-items')).toHaveCount(0);
    await expect(page.getByTestId('calendar-day-relative')).toHaveText('Tomorrow');
    await page.getByTestId('plan-outfit').click();
    await expect(page.getByTestId('plan-sheet')).toBeVisible();
    await shot(page, 'plan-sheet');
    await page.getByTestId(`plan-outfit-option-${OUTFIT.id}`).click();
    await expect(page.getByTestId('calendar-day-notice')).toHaveText(/Planned\./);
    await expect(page.locator('[data-testid^="day-log-status-"]')).toHaveText('Planned');
    await expect(page.locator('[data-testid^="day-log-title-"]')).toHaveText('Weekday navy');
    await shot(page, 'day-planned');

    await page.getByTestId('calendar-day-back').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    await expect(planned(page, TOMORROW)).toBeVisible();
    await expect(page.getByTestId(`calendar-day-${TOMORROW}`)).toHaveAccessibleName(
      'Thursday 19 November, outfit planned',
    );
    // A plan is not a wear: it does not count towards the summary.
    await expect(page.getByTestId('calendar-summary')).toContainText('Nothing logged yet');
    await shot(page, 'month-planned');

    // Yesterday's plan is due: Yes converts it, and the day now counts as worn.
    await page.getByTestId(`calendar-day-${YESTERDAY}`).click();
    await expect(page.getByTestId('day-log-status-plan-yes')).toHaveText(
      'Planned — did you wear it?',
    );
    await shot(page, 'day-due');
    await page.getByTestId('day-log-yes-plan-yes').click();
    await expect(page.getByTestId('day-log-status-plan-yes')).toHaveText('Worn');
    await expect(page.getByTestId('day-log-yes-plan-yes')).toHaveCount(0);
    await page.getByTestId('calendar-day-back').click();
    await expect(thumb(page, YESTERDAY)).toBeVisible();
    await expect(page.getByTestId('calendar-summary')).toHaveText('Logged 1 of the last 7 days');

    // The other plan: No removes it.
    await page.getByTestId('calendar-day-2026-11-16').click();
    await page.getByTestId('day-log-no-plan-no').click();
    await expect(page.getByTestId('calendar-day-empty')).toBeVisible();
    await page.getByTestId('calendar-day-back').click();
    await expect(planned(page, '2026-11-16')).toHaveCount(0);
  });

  test('log loose items for yesterday from the day view', async ({ page }) => {
    await seed(page);
    await open(page, `/calendar/${YESTERDAY}`, 'screen-calendar-day');
    await expect(page.getByTestId('plan-outfit')).toHaveCount(0);
    await page.getByTestId('log-items').click();
    await expect(page.getByTestId('item-picker')).toBeVisible();
    await expect(page.getByTestId('log-items-confirm')).toBeDisabled();
    await expect(page.getByTestId('item-picker-group-base')).toBeVisible();
    await expect(page.getByTestId('item-picker-group-shoes')).toBeVisible();
    await shot(page, 'picker');

    await page.getByTestId(`log-item-${id('tee-white')}`).click();
    await page.getByTestId(`log-item-${id('jeans-dark')}`).click();
    await page.getByTestId(`log-item-${id('loafers-brown')}`).click();
    await expect(page.getByTestId('log-items-confirm')).toHaveText('Log 3 pieces');
    await page.getByTestId('log-items-confirm').click();

    await expect(page.getByTestId('calendar-day-notice')).toHaveText(/Logged\./);
    await expect(mannequin(page)).toBeVisible();
    await expect(page.locator('[data-testid^="day-log-status-"]')).toHaveText('Worn');
    await expect(page.getByTestId(`day-piece-${id('tee-white')}`)).toBeVisible();
    await expect(page.getByTestId('log-items')).toHaveAttribute('aria-label', 'Log another outfit');

    await page.getByTestId('calendar-day-back').click();
    await expect(thumb(page, YESTERDAY)).toBeVisible();
  });

  test('month navigation moves between months and returns to today', async ({ page }) => {
    await seed(page, [OUTFIT], [wearLog('old', '2026-10-30', ['tee-navy', 'jeans-dark'], false)]);
    await open(page, '/calendar', 'screen-calendar');
    const month = page.getByTestId('calendar-month');
    await expect(month).toHaveText('November 2026');
    await expect(page.getByTestId('calendar-today')).toHaveCount(0);
    await expect(page.getByTestId('calendar-day-2026-11-01')).toBeVisible();
    await expect(page.getByTestId('calendar-day-2026-10-30')).toHaveCount(0);

    await page.getByTestId('calendar-prev').click();
    await expect(month).toHaveText('October 2026');
    await expect(thumb(page, '2026-10-30')).toBeVisible();
    await page.getByTestId('calendar-prev').click();
    await expect(month).toHaveText('September 2026');
    await page.getByTestId('calendar-next').click();
    await page.getByTestId('calendar-next').click();
    await page.getByTestId('calendar-next').click();
    await expect(month).toHaveText('December 2026');
    await page.getByTestId('calendar-next').click();
    await expect(month).toHaveText('January 2027');
    await page.getByTestId('calendar-today').click();
    await expect(month).toHaveText('November 2026');

    // Today is marked in the accessible name; the week strip covers Monday to Sunday.
    await expect(page.getByTestId(`calendar-week-${TODAY}`)).toBeVisible();
    await expect(page.getByTestId('calendar-week-2026-11-16')).toBeVisible();
    await expect(page.getByTestId('calendar-week-2026-11-22')).toBeVisible();
    await expect(page.getByTestId('calendar-week-2026-11-23')).toHaveCount(0);

    // A day from another month opens its own day view.
    await page.getByTestId('calendar-prev').click();
    await page.getByTestId('calendar-day-2026-10-30').click();
    await expect(page.getByTestId('calendar-day-title')).toHaveText('Friday 30 October');
  });

  test('Wore this today works from Mix too', async ({ page }) => {
    await seed(page);
    await open(page, '/mix', 'screen-mix');
    await expect(page.getByTestId('wore-today-mix')).toBeDisabled();
    await page.getByTestId(`mix-option-base-${id('tee-navy')}`).click();
    await page.getByTestId(`mix-option-bottom-${id('jeans-dark')}`).click();
    await page.getByTestId('wore-today-mix').click();
    await expect(page.getByTestId('wore-today-mix-notice')).toContainText('Logged for today');
    await shot(page, 'mix');
    await page.getByTestId('wore-today-mix-calendar').click();
    await expect(thumb(page, TODAY)).toBeVisible();
  });

  test('Wore this today works from an outfit idea', async ({ page }) => {
    await seed(page);
    await open(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('outfit-card-0')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('wore-today-suggestion-0').click();
    await expect(page.getByTestId('wore-today-suggestion-0-notice')).toContainText(
      'Logged for today',
    );
    await shot(page, 'idea');
    await page.getByTestId('wore-today-suggestion-0-calendar').click();
    await expect(thumb(page, TODAY)).toBeVisible();
  });

  test('an invalid date shows a gentle message', async ({ page }) => {
    await seed(page);
    await open(page, '/calendar/2026-02-31', 'screen-calendar-day');
    await expect(page.getByTestId('calendar-day-invalid')).toBeVisible();
  });
});
