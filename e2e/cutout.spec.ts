import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'e2e/fixtures/red-tee-600x800.png';
// The first cut-out downloads the model and runtime (about 20 MB) and runs it in WebAssembly.
const CUTOUT_TIMEOUT = 90_000;

async function chooseFixture(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-item-choose-photo').click();
  await (await chooser).setFiles(FIXTURE);
}

interface StoredItem {
  id: string;
  images: { originalId: string; cutoutId: string; thumbId: string };
  cutout: { aspectRatio: number; hasAlpha: boolean };
}

async function storedItems(page: Page): Promise<StoredItem[]> {
  const raw = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.endsWith('/items')) return localStorage.getItem(key) ?? '';
    }
    return '';
  });
  if (!raw) return [];
  const stored = JSON.parse(raw) as { records: StoredItem[] };
  return stored.records;
}

/** Alpha of the corner and the centre of a stored image, read back through a canvas. */
async function alphaProbe(
  page: Page,
  imageId: string,
): Promise<{ corner: number; centre: number; width: number; height: number }> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('fashionable-images');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      const req = db.transaction('images', 'readonly').objectStore('images').get(id);
      req.onsuccess = () => resolve(req.result as Blob);
      req.onerror = () => reject(req.error);
    });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    const alphaAt = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    return {
      corner: alphaAt(1, 1),
      centre: alphaAt(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2)),
      width: bitmap.width,
      height: bitmap.height,
    };
  }, imageId);
}

async function fillAndSave(page: Page): Promise<void> {
  await page.getByTestId('add-item-category-top').click();
  await page.getByTestId('add-item-subcategory-tshirt').click();
  await page.getByTestId('add-item-save').click();
  await expect(page.getByTestId('screen-closet')).toBeVisible();
}

/** Records the longest gap between animation frames once `window.__gapOn` is set. */
async function trackFrameGaps(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __gapOn: boolean; __maxGap: number };
    w.__gapOn = false;
    w.__maxGap = 0;
    let last = performance.now();
    const tick = (t: number) => {
      if (w.__gapOn) w.__maxGap = Math.max(w.__maxGap, t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

test.describe('Background removal', () => {
  test.setTimeout(CUTOUT_TIMEOUT + 30_000);

  test('keeps the UI responsive while a worker cuts out the photo', async ({ page }) => {
    await trackFrameGaps(page);
    await page.goto('/closet/add');
    await page.evaluate(() => ((window as unknown as { __gapOn: boolean }).__gapOn = true));
    await chooseFixture(page);
    await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: CUTOUT_TIMEOUT });
    const { maxGap, usedWorker } = await page.evaluate(() => ({
      maxGap: (window as unknown as { __maxGap: number }).__maxGap,
      usedWorker: performance.getEntriesByName('cutout:worker-infer-end').length > 0,
    }));
    // Inference ran off the main thread (not the fallback), so no frame was held up for long.
    expect(usedWorker).toBe(true);
    expect(maxGap).toBeLessThan(200);
  });

  test('cuts the garment out of a photo and saves a transparent PNG', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await expect(page.getByTestId('add-item-cutting')).toBeVisible();
    await expect(page.getByText('Removing background…')).toBeVisible();
    await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: CUTOUT_TIMEOUT });

    // The preview shows the cutout on a checkerboard, with a way back to the photo.
    await expect(page.getByTestId('add-item-checkerboard')).toBeVisible();
    await expect(page.getByTestId('add-item-use-original')).toContainText('Use original photo');
    await expect(page.getByTestId('add-item-colour-primary')).toContainText('Red');

    await fillAndSave(page);
    await expect.poll(async () => (await storedItems(page)).length).toBe(1);
    const [item] = await storedItems(page);
    expect(item.cutout.hasAlpha).toBe(true);
    // The trimmed cutout is the garment's shape, not the 3:4 photo.
    expect(item.cutout.aspectRatio).toBeGreaterThan(0.6);
    expect(item.cutout.aspectRatio).toBeLessThan(1.1);

    const cutout = await alphaProbe(page, item.images.cutoutId);
    expect(cutout.corner).toBeLessThan(16);
    expect(cutout.centre).toBeGreaterThan(240);
    expect(Math.max(cutout.width, cutout.height)).toBeLessThanOrEqual(1024);
    const thumb = await alphaProbe(page, item.images.thumbId);
    expect(thumb.corner).toBeLessThan(16);
    expect(thumb.centre).toBeGreaterThan(240);
    // The original photo is kept opaque.
    const original = await alphaProbe(page, item.images.originalId);
    expect(original.corner).toBe(255);

    await expect(page.getByTestId(`closet-item-${item.id}`)).toBeVisible();
  });

  test('"Use original photo" keeps the plain photo with hasAlpha false', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: CUTOUT_TIMEOUT });
    await page.getByTestId('add-item-use-original').click();
    await expect(page.getByTestId('add-item-checkerboard')).toHaveCount(0);
    await expect(page.getByTestId('add-item-use-original')).toContainText('Use cutout');
    await fillAndSave(page);
    await expect.poll(async () => (await storedItems(page)).length).toBe(1);
    const [item] = await storedItems(page);
    expect(item.cutout.hasAlpha).toBe(false);
    expect((await alphaProbe(page, item.images.cutoutId)).corner).toBe(255);
  });

  test('re-cuts an existing item from the detail screen', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: CUTOUT_TIMEOUT });
    await page.getByTestId('add-item-use-original').click();
    await fillAndSave(page);
    await expect.poll(async () => (await storedItems(page)).length).toBe(1);
    const [before] = await storedItems(page);
    expect(before.cutout.hasAlpha).toBe(false);

    await page.getByTestId(`closet-item-${before.id}`).click();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
    await page.getByTestId('item-recut').click();
    await expect(page.getByTestId('item-recut-done')).toBeVisible({ timeout: CUTOUT_TIMEOUT });

    await expect.poll(async () => (await storedItems(page))[0].cutout.hasAlpha).toBe(true);
    const [after] = await storedItems(page);
    expect(after.images.cutoutId).not.toBe(before.images.cutoutId);
    expect(after.images.originalId).toBe(before.images.originalId);
    const cutout = await alphaProbe(page, after.images.cutoutId);
    expect(cutout.corner).toBeLessThan(16);
    expect(cutout.centre).toBeGreaterThan(240);
  });
});
