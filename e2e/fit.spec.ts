import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  BODY_A_LANDMARKS,
  OUTFIT_ID,
  openScreen,
  seedItemId,
  seedTryOn,
} from './helpers/tryonSeed';

test.use({ deviceScaleFactor: 2 });

const RED_TEE = 'e2e/fixtures/red-tee-600x800.png';
// The first cut-out downloads the model and runs it in WebAssembly.
const CUTOUT_TIMEOUT = 90_000;

/** A body that is clearly not the silhouette: broader shoulders, wider hips, longer arms. */
const WIDE = {
  ...BODY_A_LANDMARKS,
  shoulderL: { x: 280, y: 410 },
  shoulderR: { x: 720, y: 410 },
  waistL: { x: 330, y: 800 },
  waistR: { x: 670, y: 800 },
  hipL: { x: 300, y: 960 },
  hipR: { x: 700, y: 960 },
  wristL: { x: 170, y: 1060 },
  wristR: { x: 830, y: 1060 },
};

const fitted = (page: Page, key: string): Locator =>
  page.getByTestId(`mannequin-fitted-${seedItemId(key)}`);
const rigid = (page: Page, key: string): Locator =>
  page.getByTestId(`mannequin-image-${seedItemId(key)}`);
const layer = (page: Page, key: string): Locator =>
  page.getByTestId(`mannequin-item-${seedItemId(key)}`);

/** The picture URL behind an image element (react-native-web draws it as a CSS background). */
async function imageUrl(el: Locator): Promise<string> {
  return el.evaluate((node) => {
    const img = node.querySelector('img');
    if (img?.currentSrc) return img.currentSrc;
    const bg = getComputedStyle(node).backgroundImage;
    return /url\("?([^")]+)"?\)/.exec(bg)?.[1] ?? '';
  });
}

interface StoredItem {
  id: string;
  fit?: {
    kind: string;
    version: number;
    edited: boolean;
    confidence: number;
    points: Record<string, { x: number; y: number }>;
  };
}

async function storedItems(page: Page): Promise<StoredItem[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fashionable/v1/items');
    return raw ? (JSON.parse(raw) as { records: StoredItem[] }).records : [];
  });
}

const storedItem = async (page: Page, key: string) =>
  (await storedItems(page)).find((i) => i.id === seedItemId(key));

/** Render timings the warper recorded (User Timing measures named "fit-render"), in ms. */
async function renderTimes(page: Page): Promise<number[]> {
  return page.evaluate(() => performance.getEntriesByName('fit-render').map((e) => e.duration));
}

test.describe('garments fitted to the body', () => {
  test('dev mannequin page draws tops and bottoms from fitted images, shoes stay rigid', async ({
    page,
  }) => {
    await page.goto('/dev/mannequin');
    await expect(page.getByTestId('screen-dev-mannequin')).toBeVisible();
    const fittedLayers = page.locator('[data-testid^="mannequin-fitted-"]');
    await expect(fittedLayers.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('mannequin-fitted-tee-white')).toBeVisible();
    await expect(page.getByTestId('mannequin-fitted-jeans-dark')).toBeVisible();
    expect(await imageUrl(page.getByTestId('mannequin-fitted-tee-white'))).toMatch(/^blob:/);
    // Shoes and the belt keep the rigid placement and picture.
    await expect(page.getByTestId('mannequin-fitted-sneakers-white')).toHaveCount(0);
    await expect(page.getByTestId('mannequin-image-sneakers-white')).toBeVisible();
    await expect(page.getByTestId('mannequin-fitted-belt-brown-leather')).toHaveCount(0);
  });

  test('the outfit detail page fits the seeded closet lazily and stores the rigs', async ({
    page,
  }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(fitted(page, 'tee-navy')).toBeVisible({ timeout: 20_000 });
    await expect(fitted(page, 'jeans-dark')).toBeVisible();
    expect(await imageUrl(fitted(page, 'tee-navy'))).toMatch(/^blob:/);
    await expect(fitted(page, 'sneakers-white')).toHaveCount(0);
    await expect(rigid(page, 'sneakers-white')).toBeVisible();

    // The detected rigs were saved back onto the items (after a short debounce).
    await expect.poll(async () => (await storedItem(page, 'tee-navy'))?.fit?.kind).toBe('top');
    const tee = await storedItem(page, 'tee-navy');
    expect(tee?.fit?.edited).toBe(false);
    expect(Object.keys(tee?.fit?.points ?? {}).length).toBeGreaterThanOrEqual(8);
    expect((await storedItem(page, 'jeans-dark'))?.fit?.kind).toBe('trousers');
    expect((await storedItem(page, 'sneakers-white'))?.fit).toBeUndefined();

    const times = await renderTimes(page);
    expect(times.length).toBeGreaterThan(0);
    test.info().annotations.push({
      type: 'fit-render ms',
      description: times.map((t) => t.toFixed(0)).join(', '),
    });
  });

  test('a fitted garment is not drawn where the rigid one would be', async ({ page, context }) => {
    await seedTryOn(page, { bodyPhoto: false });
    // A second page in the same browser profile where fitted images cannot be encoded, so the
    // garment stays at its rigid placement: that gives the rigid box to compare against.
    const rigidPage = await context.newPage();
    await rigidPage.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => cb(null);
    });
    await openScreen(rigidPage, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(rigid(rigidPage, 'tee-navy')).toBeVisible();
    await rigidPage.waitForTimeout(1500);
    await expect(fitted(rigidPage, 'tee-navy')).toHaveCount(0);
    const rigidBox = await layer(rigidPage, 'tee-navy').boundingBox();
    await rigidPage.close();

    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(fitted(page, 'tee-navy')).toBeVisible({ timeout: 20_000 });
    // Wait for the cross-fade from the rigid picture to finish.
    await expect(rigid(page, 'tee-navy')).toHaveCount(0);
    const fittedBox = await layer(page, 'tee-navy').boundingBox();
    expect(rigidBox).not.toBeNull();
    expect(fittedBox).not.toBeNull();
    if (rigidBox && fittedBox) {
      const moved =
        Math.abs(rigidBox.x - fittedBox.x) +
        Math.abs(rigidBox.y - fittedBox.y) +
        Math.abs(rigidBox.width - fittedBox.width) +
        Math.abs(rigidBox.height - fittedBox.height);
      expect(moved).toBeGreaterThan(4);
    }
  });

  test('Mix draws the garment from a fitted image and fit adjustments still apply on top', async ({
    page,
  }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, `/mix?outfitId=${OUTFIT_ID}`, 'screen-mix');
    await expect(fitted(page, 'tee-navy')).toBeVisible({ timeout: 20_000 });
    await expect(rigid(page, 'tee-navy')).toHaveCount(0);
    expect(await imageUrl(fitted(page, 'tee-navy'))).toMatch(/^blob:/);
    const before = await layer(page, 'tee-navy').boundingBox();
    const urlBefore = await imageUrl(fitted(page, 'tee-navy'));

    // Select it and nudge with the fit bar: the same fitted image moves, it is not re-rendered.
    await layer(page, 'tee-navy').click();
    await page.getByTestId('fit-scale-up').click();
    await expect
      .poll(async () => (await layer(page, 'tee-navy').boundingBox())?.width ?? 0)
      .toBeGreaterThan((before?.width ?? 0) + 1);
    expect(await imageUrl(fitted(page, 'tee-navy'))).toBe(urlBefore);
  });

  test('a body photo with other proportions gives a different fitted image', async ({ page }) => {
    await seedTryOn(page, { landmarks: WIDE, tryOnMode: 'photo' });
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(page.getByTestId('outfit-detail-mannequin-backdrop')).toBeVisible();
    await expect(fitted(page, 'tee-navy')).toBeVisible({ timeout: 20_000 });
    const onPhoto = await imageUrl(fitted(page, 'tee-navy'));
    const photoBox = await layer(page, 'tee-navy').boundingBox();

    await page.getByTestId('tryon-toggle-silhouette').click();
    await expect(page.getByTestId('outfit-detail-mannequin-backdrop')).toHaveCount(0);
    await expect
      .poll(async () => imageUrl(fitted(page, 'tee-navy')), { timeout: 20_000 })
      .not.toBe(onPhoto);
    const silBox = await layer(page, 'tee-navy').boundingBox();
    // The broader photo body gives a wider shirt than the silhouette.
    expect((photoBox?.width ?? 0) - (silBox?.width ?? 0)).toBeGreaterThan(2);

    // And back: the first image is served from the cache again.
    await page.getByTestId('tryon-toggle-me').click();
    await expect.poll(async () => imageUrl(fitted(page, 'tee-navy'))).toBe(onPhoto);
  });

  test('garment points editor: drag a point, save, and the fitted garment changes', async ({
    page,
  }) => {
    await seedTryOn(page, { bodyPhoto: false });
    // Fit once on the outfit page so the rig exists, and note the picture.
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(fitted(page, 'tee-navy')).toBeVisible({ timeout: 20_000 });
    const original = await imageUrl(fitted(page, 'tee-navy'));
    await expect.poll(async () => (await storedItem(page, 'tee-navy'))?.fit?.kind).toBe('top');
    const detected = (await storedItem(page, 'tee-navy'))?.fit;

    await openScreen(page, `/closet/${seedItemId('tee-navy')}`, 'screen-item-detail');
    await page.getByTestId('item-points').click();
    await expect(page.getByTestId('points-editor')).toBeVisible();
    const handle = page.getByTestId('points-handle-shoulderL');
    await expect(handle).toBeVisible();
    await expect(page.getByTestId('points-save')).toBeDisabled();

    const box = await handle.boundingBox();
    if (!box) throw new Error('no handle box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 12, y + 10, { steps: 4 });
    await expect(page.getByTestId('points-loupe')).toBeVisible();
    await page.mouse.move(x - 24, y + 22, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByTestId('points-save')).toBeEnabled();
    await expect(page.getByTestId('points-reset')).toBeEnabled();

    // Reset goes back to the detected points, and dragging again re-enables Save.
    await page.getByTestId('points-reset').click();
    await expect(page.getByTestId('points-save')).toBeDisabled();
    const box2 = await handle.boundingBox();
    if (!box2) throw new Error('no handle box');
    const x2 = box2.x + box2.width / 2;
    const y2 = box2.y + box2.height / 2;
    await page.mouse.move(x2, y2);
    await page.mouse.down();
    await page.mouse.move(x2 - 30, y2 + 26, { steps: 6 });
    await page.mouse.up();
    await page.getByTestId('points-save').click();
    await expect(page.getByTestId('points-editor')).toHaveCount(0);

    await expect
      .poll(async () => (await storedItem(page, 'tee-navy'))?.fit?.edited, { timeout: 10_000 })
      .toBe(true);
    const edited = (await storedItem(page, 'tee-navy'))?.fit;
    expect(edited?.points.shoulderL).not.toEqual(detected?.points.shoulderL);
    expect(edited?.points.shoulderR).toEqual(detected?.points.shoulderR);

    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(fitted(page, 'tee-navy')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => imageUrl(fitted(page, 'tee-navy'))).not.toBe(original);
  });

  test('items without a fit use rigid placement when the cutout cannot be encoded', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = (cb: BlobCallback) => cb(null);
    });
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(rigid(page, 'tee-navy')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid^="mannequin-fitted-"]')).toHaveCount(0);
  });

  test('a shoe has no garment points button', async ({ page }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, `/closet/${seedItemId('sneakers-white')}`, 'screen-item-detail');
    await expect(page.getByTestId('item-edit')).toBeVisible();
    await expect(page.getByTestId('item-points')).toHaveCount(0);
  });

  test('adding a garment from a photo stores a rig on the new item', async ({ page }) => {
    test.setTimeout(CUTOUT_TIMEOUT + 60_000);
    await page.goto('/closet/add');
    await expect(page.getByTestId('screen-add-item')).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('add-item-choose-photo').click();
    await (await chooser).setFiles(RED_TEE);
    await expect(page.getByTestId('add-item-category-top')).toBeVisible({
      timeout: CUTOUT_TIMEOUT,
    });
    await page.getByTestId('add-item-category-top').click();
    await page.getByTestId('add-item-subcategory-tshirt').click();
    await page.getByTestId('add-item-save').click();
    await expect(page.getByTestId('screen-closet')).toBeVisible();
    await expect
      .poll(async () => (await storedItems(page)).at(-1)?.fit?.kind, { timeout: 10_000 })
      .toBe('top');
    const item = (await storedItems(page)).at(-1);
    expect(item?.fit?.edited).toBe(false);
    expect(item?.fit?.version).toBeGreaterThanOrEqual(1);
  });
});
