import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'e2e/fixtures/red-tee-600x800.png';
// The first cut-out downloads the model and runtime (about 20 MB) and runs it in WebAssembly.
const CUTOUT_TIMEOUT = 90_000;

async function chooseFixture(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-item-choose-photo').click();
  await (await chooser).setFiles(FIXTURE);
  await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: CUTOUT_TIMEOUT });
}

interface StoredItem {
  id: string;
  category: string;
  images: { originalId: string; cutoutId: string; thumbId: string };
  cutout: {
    aspectRatio: number;
    hasAlpha: boolean;
    crop?: { x: number; y: number; width: number; height: number; scale: number };
  };
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
  return (JSON.parse(raw) as { records: StoredItem[] }).records;
}

/** The crop must lie inside the 600 x 800 fixture and agree with the stored cutout's shape. */
function expectSaneCrop(item: StoredItem): void {
  const crop = item.cutout.crop;
  if (!crop) throw new Error('the item has no recorded crop');
  expect(crop.x).toBeGreaterThanOrEqual(0);
  expect(crop.y).toBeGreaterThanOrEqual(0);
  expect(crop.x + crop.width).toBeLessThanOrEqual(600.5);
  expect(crop.y + crop.height).toBeLessThanOrEqual(800.5);
  expect(crop.scale).toBeGreaterThan(0);
  expect(crop.width / crop.height).toBeCloseTo(item.cutout.aspectRatio, 1);
}

/** Alpha at the centre of a stored image, or `undefined` when the image is gone. */
async function centreAlpha(page: Page, imageId: string): Promise<number | undefined> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('fashionable-images');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const req = db.transaction('images', 'readonly').objectStore('images').get(id);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!blob) return undefined;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1)
      .data[3];
  }, imageId);
}

/** Alpha at the middle of the editor's canvas (the photo's centre, where the tee is). */
async function editorCentreAlpha(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="touchup-canvas"]');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) throw new Error('no editor canvas');
    return ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
      .data[3];
  });
}

/** A horizontal mouse stroke through the middle of the picture. */
async function strokeAcrossCentre(page: Page): Promise<void> {
  const box = await page.getByTestId('touchup-canvas').boundingBox();
  if (!box) throw new Error('canvas has no box');
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x - 70, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y, { steps: 10 });
  await page.mouse.up();
}

async function openEditor(page: Page, opener: string): Promise<void> {
  await page.getByTestId(opener).click();
  await expect(page.getByTestId('touchup-editor')).toBeVisible();
  await expect(page.getByTestId('touchup-loading')).toHaveCount(0, { timeout: 20_000 });
}

test.describe('Capture guides', () => {
  test.setTimeout(CUTOUT_TIMEOUT + 30_000);

  test('shows the outline for what you are adding, pre-selects it and remembers it', async ({
    page,
  }) => {
    await page.goto('/closet/add');
    await expect(page.getByTestId('add-item-guide')).toBeVisible();
    await expect(page.getByTestId('add-item-tips')).toContainText('Lay it flat');
    // A top is the default; the take / choose buttons are right there, one tap away.
    await expect(page.getByTestId('add-item-kind-top')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('add-item-outline-top')).toBeAttached();
    await expect(page.getByTestId('add-item-take-photo')).toBeVisible();
    await expect(page.getByTestId('add-item-choose-photo')).toBeVisible();

    await page.getByTestId('add-item-kind-shoes').click();
    await expect(page.getByTestId('add-item-kind-shoes')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('add-item-outline-shoes')).toBeAttached();
    await expect(page.getByTestId('add-item-outline-top')).toHaveCount(0);

    await chooseFixture(page);
    await expect(page.getByTestId('add-item-category-shoes')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Next visit starts on the same kind.
    await page.goto('/closet/add');
    await expect(page.getByTestId('add-item-kind-shoes')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Touch-up brush', () => {
  test.setTimeout(CUTOUT_TIMEOUT + 60_000);

  test('erases in the add flow, restores from the detail screen', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await page.getByTestId('add-item-category-top').click();
    await page.getByTestId('add-item-subcategory-tshirt').click();

    // Erase, undo, erase again.
    await openEditor(page, 'touchup-open');
    expect(await editorCentreAlpha(page)).toBe(255);
    await page.getByTestId('touchup-size-l').click();
    await expect(page.getByTestId('touchup-undo')).toBeDisabled();
    await strokeAcrossCentre(page);
    expect(await editorCentreAlpha(page)).toBe(0);
    await page.getByTestId('touchup-undo').click();
    expect(await editorCentreAlpha(page)).toBe(255);
    await expect(page.getByTestId('touchup-undo')).toBeDisabled();
    await strokeAcrossCentre(page);
    expect(await editorCentreAlpha(page)).toBe(0);
    await page.getByTestId('touchup-done').click();
    await expect(page.getByTestId('touchup-editor')).toHaveCount(0);
    await expect(page.getByTestId('add-item-form')).toBeVisible();

    // The edited cutout comes back with the hole in it (the pictures still line up) ...
    await openEditor(page, 'touchup-open');
    expect(await editorCentreAlpha(page)).toBe(0);
    await page.getByTestId('touchup-cancel').click();
    await expect(page.getByTestId('touchup-editor')).toHaveCount(0);

    // ... and that is what gets saved.
    await page.getByTestId('add-item-save').click();
    await expect(page.getByTestId('screen-closet')).toBeVisible();
    await expect.poll(async () => (await storedItems(page)).length).toBe(1);
    const [saved] = await storedItems(page);
    expect(saved.cutout.hasAlpha).toBe(true);
    expectSaneCrop(saved); // the touch-up Done in the add flow recorded the crop
    expect(await centreAlpha(page, saved.images.cutoutId)).toBeLessThan(16);
    expect(await centreAlpha(page, saved.images.thumbId)).toBeLessThan(16);

    // Detail screen: restore the hole from the original photo.
    await page.getByTestId(`closet-item-${saved.id}`).click();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
    await openEditor(page, 'item-touchup');
    expect(await editorCentreAlpha(page)).toBe(0);
    await page.getByTestId('touchup-restore').click();
    await page.getByTestId('touchup-size-l').click();
    await strokeAcrossCentre(page);
    expect(await editorCentreAlpha(page)).toBe(255);
    await page.getByTestId('touchup-done').click();
    await expect(page.getByTestId('touchup-editor')).toHaveCount(0);

    await expect
      .poll(async () => (await storedItems(page))[0].images.cutoutId)
      .not.toBe(saved.images.cutoutId);
    const [after] = await storedItems(page);
    expect(after.images.originalId).toBe(saved.images.originalId);
    expect(after.images.thumbId).not.toBe(saved.images.thumbId);
    expect(after.cutout.hasAlpha).toBe(true);
    expectSaneCrop(after);
    expect(await centreAlpha(page, after.images.cutoutId)).toBeGreaterThan(240);
    expect(await centreAlpha(page, after.images.thumbId)).toBeGreaterThan(240);
    // The old pictures are gone, the original photo is kept.
    expect(await centreAlpha(page, saved.images.cutoutId)).toBeUndefined();
    expect(await centreAlpha(page, saved.images.thumbId)).toBeUndefined();
    expect(await centreAlpha(page, saved.images.originalId)).toBe(255);
  });

  test('uses the recorded crop, and still aligns an older item that has none', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await page.getByTestId('add-item-category-top').click();
    await page.getByTestId('add-item-subcategory-tshirt').click();
    await page.getByTestId('add-item-save').click();
    await expect(page.getByTestId('screen-closet')).toBeVisible();
    await expect.poll(async () => (await storedItems(page)).length).toBe(1);
    const [saved] = await storedItems(page);
    // Background removal recorded where the cutout sits in the photo.
    expectSaneCrop(saved);

    // With a crop: the editor opens straight away and the garment lines up (restore works).
    await page.getByTestId(`closet-item-${saved.id}`).click();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
    await page.getByTestId('item-touchup').click();
    await expect(page.getByTestId('touchup-editor')).toBeVisible();
    await expect(page.getByTestId('touchup-loading')).toHaveCount(0, { timeout: 20_000 });
    expect(await editorCentreAlpha(page)).toBe(255);
    await expect(page.getByTestId('touchup-restore')).toBeEnabled();
    await page.getByTestId('touchup-cancel').click();

    // Without a crop (an item made before it was recorded): the colour matching fallback.
    await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.endsWith('/items')) continue;
        const doc = JSON.parse(localStorage.getItem(key) ?? '{}') as {
          records: { cutout: { crop?: unknown } }[];
        };
        for (const record of doc.records) delete record.cutout.crop;
        localStorage.setItem(key, JSON.stringify(doc));
      }
    });
    await page.reload();
    expect((await storedItems(page))[0].cutout.crop).toBeUndefined();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
    await openEditor(page, 'item-touchup');
    expect(await editorCentreAlpha(page)).toBe(255);
    await expect(page.getByTestId('touchup-restore')).toBeEnabled();
    await expect(page.getByTestId('touchup-hint')).toBeVisible();
    // Erase, restore from the photo (proves the placement) and save: the crop is recorded again.
    await page.getByTestId('touchup-size-l').click();
    await strokeAcrossCentre(page);
    expect(await editorCentreAlpha(page)).toBe(0);
    await page.getByTestId('touchup-restore').click();
    await strokeAcrossCentre(page);
    expect(await editorCentreAlpha(page)).toBe(255);
    await page.getByTestId('touchup-done').click();
    await expect(page.getByTestId('touchup-editor')).toHaveCount(0);
    await expect
      .poll(async () => (await storedItems(page))[0].images.cutoutId)
      .not.toBe(saved.images.cutoutId);
    expectSaneCrop((await storedItems(page))[0]);
  });
});
