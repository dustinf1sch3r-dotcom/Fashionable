import { expect, test, type Locator, type Page } from '@playwright/test';
import { OUTFIT_ID, openScreen, seedItemId, seedTryOn } from './helpers/tryonSeed';

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.TRYON_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/c2-${name}.png` });
};

// Decoding the pictures, warping the garments and merging them all happen in the browser.
const MERGE_TIMEOUT = 40_000;
test.setTimeout(90_000);

/** The merged picture's `img` (react-native-web draws an Image as a div around an img). */
const mergedImg = (page: Page, mannequinTestId: string): Locator =>
  page.getByTestId(`${mannequinTestId}-merged`).locator('img');

async function mergedUrl(page: Page, mannequinTestId: string): Promise<string> {
  const img = mergedImg(page, mannequinTestId);
  await expect(img).toBeVisible({ timeout: MERGE_TIMEOUT });
  await expect(img).toHaveAttribute('src', /^blob:/);
  return (await img.getAttribute('src')) ?? '';
}

/** The merged picture covers the whole mannequin canvas, edge to edge. */
async function expectCovers(page: Page, mannequinTestId: string): Promise<void> {
  const canvas = await page.getByTestId(mannequinTestId).boundingBox();
  const merged = await page.getByTestId(`${mannequinTestId}-merged`).boundingBox();
  if (!canvas || !merged) throw new Error('mannequin or merged picture has no box');
  expect(merged.x).toBeCloseTo(canvas.x, 0);
  expect(merged.y).toBeCloseTo(canvas.y, 0);
  expect(merged.width).toBeCloseTo(canvas.width, 0);
  expect(merged.height).toBeCloseTo(canvas.height, 0);
}

/** Pictures the compositor finished so far (User Timing measures named "composite-render"). */
const merges = (page: Page): Promise<number> =>
  page.evaluate(() => performance.getEntriesByName('composite-render').length);

/** Records every long task (main thread blocked > 50 ms) from the start of the page. */
const recordLongTasks = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });

/** The merge runs on the main thread in slices; report how long it blocked the page. */
async function reportTiming(page: Page): Promise<void> {
  const timing = await page.evaluate(() => ({
    pipeline: performance
      .getEntriesByName('composite-pipeline')
      .map((e) => `${(e as PerformanceMeasure).detail?.width}px: ${Math.round(e.duration)}`),
    render: performance
      .getEntriesByName('composite-render')
      .map((e) => `${(e as PerformanceMeasure).detail?.width}px: ${Math.round(e.duration)}`),
    longTasks: (window as unknown as { __long: number[] }).__long.map(Math.round),
  }));
  test
    .info()
    .annotations.push({ type: 'composite timing (ms)', description: JSON.stringify(timing) });
  console.log('composite timing (ms)', JSON.stringify(timing));
  const slowest = Math.max(0, ...timing.longTasks);
  expect(slowest).toBeLessThan(1500);
}

test.describe('outfits merged into one picture', () => {
  test('on the silhouette: the layered outfit shows first, then one merged image covers it', async ({
    page,
  }) => {
    await recordLongTasks(page);
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    // The layered drawing is there straight away…
    await expect(page.getByTestId(`mannequin-item-${seedItemId('tee-navy')}`)).toBeVisible();
    await expect(page.getByTestId('outfit-detail-mannequin-silhouette')).toBeVisible();
    // …and the merged picture replaces it when ready.
    const url = await mergedUrl(page, 'outfit-detail-mannequin');
    expect(url).toMatch(/^blob:/);
    await expectCovers(page, 'outfit-detail-mannequin');
    await page.waitForTimeout(400); // the fade
    await shot(page, 'silhouette');

    await reportTiming(page);
  });

  test('on a seeded body photo, including the Outfits idea cards and the toggle', async ({
    page,
  }) => {
    await recordLongTasks(page);
    await seedTryOn(page);
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(page.getByTestId('outfit-detail-mannequin-backdrop')).toBeVisible();
    await mergedUrl(page, 'outfit-detail-mannequin');
    await expectCovers(page, 'outfit-detail-mannequin');
    await page.waitForTimeout(400);
    await shot(page, 'photo');
    await reportTiming(page);

    // Both modes are merged: switching to the silhouette merges again, on the silhouette.
    const photoUrl = await mergedUrl(page, 'outfit-detail-mannequin');
    await page.getByTestId('tryon-toggle-silhouette').click();
    await expect(page.getByTestId('outfit-detail-mannequin-silhouette')).toBeVisible();
    await expect
      .poll(async () => mergedImg(page, 'outfit-detail-mannequin').getAttribute('src'), {
        timeout: MERGE_TIMEOUT,
      })
      .toMatch(/^blob:/);
    expect(await mergedUrl(page, 'outfit-detail-mannequin')).not.toBe(photoUrl);

    await page.getByTestId('tryon-toggle-me').click();
    await openScreen(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    await mergedUrl(page, 'outfit-mannequin-0');
    await expectCovers(page, 'outfit-mannequin-0');
    await reportTiming(page);
  });

  test('Mix: merged when idle, layered while a garment is selected, merged again when done', async ({
    page,
  }) => {
    await seedTryOn(page);
    await openScreen(page, `/mix?outfitId=${OUTFIT_ID}`, 'screen-mix');
    await mergedUrl(page, 'mannequin');
    await expectCovers(page, 'mannequin');

    // The garments underneath still take taps: selecting one switches to the layered drawing.
    await page.getByTestId(`mannequin-item-${seedItemId('tee-navy')}`).click();
    await expect(page.getByTestId('fit-bar')).toBeVisible();
    await expect(page.getByTestId('mannequin-merged')).toHaveCount(0);
    await expect(page.getByTestId(`mannequin-item-${seedItemId('tee-navy')}`)).toBeVisible();

    await page.getByTestId('fit-done').click();
    await expect(page.getByTestId('mix-rows')).toBeVisible();
    await mergedUrl(page, 'mannequin');
  });

  test('a merged picture is cached: coming back to the outfit shows the same picture at once', async ({
    page,
  }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    const first = await mergedUrl(page, 'outfit-detail-mannequin');
    const done = await merges(page);
    expect(done).toBeGreaterThan(0);

    // Away (client-side, so the in-memory cache lives on) and back.
    await page.getByTestId('outfit-open-mix').click();
    await expect(page.getByTestId('screen-mix')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('screen-outfit-detail')).toBeVisible();
    // No waiting for a merge: the very same picture is there as soon as the screen is.
    await expect(mergedImg(page, 'outfit-detail-mannequin')).toHaveAttribute('src', first, {
      timeout: 1500,
    });
    // Anything the compositor did meanwhile was for the Mix screen, not for this outfit again.
    await page.waitForTimeout(800);
    await expect(mergedImg(page, 'outfit-detail-mannequin')).toHaveAttribute('src', first);
  });
});
