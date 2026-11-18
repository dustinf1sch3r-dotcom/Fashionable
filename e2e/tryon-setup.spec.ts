import { expect, test, type Page } from '@playwright/test';
import {
  BODY_PHOTO_FIXTURE,
  imageExists,
  openScreen,
  seedTryOn,
  storedProfile,
} from './helpers/tryonSeed';

/**
 * The whole setup flow with the REAL pose detector and cropper (no fakes): guide, pick a photo,
 * detect, correct, save, retake, delete. The fixture is the body-a silhouette artwork, so the
 * detector may or may not find a "person" in it; both outcomes must lead to a saved photo (a
 * miss goes through "Place points by hand"). The first detection downloads the model (~24 MB
 * with the runtime), hence the long timeouts.
 */

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.TRYON_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/t2-setup-${name}.png` });
  }
};

const DETECT_TIMEOUT = 90_000;

async function choosePhoto(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('me-choose-photo').click();
  await (await chooser).setFiles(BODY_PHOTO_FIXTURE);
}

/** From the guide to the correction screen, by detection or by hand. */
async function pickAndReachCorrection(page: Page): Promise<'detected' | 'by-hand'> {
  await choosePhoto(page);
  await expect(page.getByTestId('me-progress')).toBeVisible();
  const correct = page.getByTestId('me-correct');
  const problems = page.getByTestId('me-by-hand');
  await expect(correct.or(problems)).toBeVisible({ timeout: DETECT_TIMEOUT });
  if (await problems.isVisible()) {
    await shot(page, 'problems');
    await expect(page.locator('[data-testid^="me-problem-"]').first()).toBeVisible();
    await problems.click();
    await expect(correct).toBeVisible();
    return 'by-hand';
  }
  return 'detected';
}

async function dragHandle(page: Page, key: string, dx: number, dy: number): Promise<void> {
  const box = await page.getByTestId(`me-handle-${key}`).boundingBox();
  if (!box) throw new Error(`no handle ${key}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

test('add a photo: guide, detect, correct, save, then it is the backdrop everywhere', async ({
  page,
}) => {
  test.setTimeout(DETECT_TIMEOUT + 60_000);
  const external: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://localhost')) {
      external.push(r.url());
    }
  });

  await seedTryOn(page, { bodyPhoto: false });
  await openScreen(page, '/profile', 'screen-profile');
  await page.getByTestId('profile-tryon-add').click();
  await expect(page.getByTestId('me-guide')).toBeVisible();
  await expect(page.getByTestId('me-privacy')).toContainText('never uploaded');

  const how = await pickAndReachCorrection(page);
  await shot(page, `correction-${how}`);
  await expect(page.getByTestId('me-photo')).toBeVisible();
  await dragHandle(page, 'headTop', 0, 20);
  await page.getByTestId('me-view-preview').click();
  await expect(page.getByTestId('me-preview-mannequin-backdrop')).toBeVisible();
  await shot(page, 'preview');
  await page.getByTestId('me-view-points').click();
  await page.getByTestId('me-save').click();

  // Back on the profile card with a thumbnail; the profile holds the photo and the points.
  await expect(page.getByTestId('profile-tryon-thumb')).toBeVisible();
  const first = (await storedProfile(page))?.bodyPhoto as
    { imageId: string; landmarks: Record<string, unknown>; detected?: unknown } | undefined;
  expect(first?.imageId).toBeTruthy();
  expect(Object.keys(first?.landmarks ?? {})).toHaveLength(18);
  expect(first?.detected !== undefined).toBe(how === 'detected');
  expect((await storedProfile(page))?.tryOnMode).toBe('photo');

  // The stored picture is the 1000 x 2000 canvas.
  const size = await page.evaluate(
    (id) =>
      new Promise<{ w: number; h: number }>((resolve, reject) => {
        const open = indexedDB.open('fashionable-images', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('images').objectStore('images').get(id);
          get.onsuccess = async () => {
            const bmp = await createImageBitmap(get.result as Blob);
            resolve({ w: bmp.width, h: bmp.height });
          };
        };
      }),
    first?.imageId ?? '',
  );
  expect(size).toEqual({ w: 1000, h: 2000 });

  // Retake replaces the image and deletes the old one.
  await page.getByTestId('profile-tryon-retake').click();
  await expect(page.getByTestId('me-guide')).toBeVisible();
  await pickAndReachCorrection(page);
  await page.getByTestId('me-save').click();
  await expect(page.getByTestId('profile-tryon-thumb')).toBeVisible();
  await expect
    .poll(async () => ((await storedProfile(page))?.bodyPhoto as { imageId: string }).imageId)
    .not.toBe(first?.imageId);
  expect(await imageExists(page, first?.imageId ?? '')).toBe(false);

  // Nothing left the device.
  expect(external).toEqual([]);

  // Outfits now show the person.
  await seedAndOpenOutfits(page);
  await expect(page.getByTestId('tryon-toggle-me')).toBeVisible();
  await expect(page.locator('[data-testid$="-backdrop"]').first()).toBeVisible();
  await shot(page, 'outfits');
});

async function seedAndOpenOutfits(page: Page): Promise<void> {
  // The closet seed only adds items (the profile with its new photo is kept).
  const profile = await storedProfile(page);
  await seedTryOn(page, { bodyPhoto: false });
  await page.evaluate((p) => {
    localStorage.setItem(
      'fashionable/v1/profile',
      JSON.stringify({ schemaVersion: 1, records: [p] }),
    );
  }, profile);
  await openScreen(page, '/outfits', 'screen-outfits');
  await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
}

test('a photo with nobody in it explains why and offers retake or placing points by hand', async ({
  page,
}) => {
  test.setTimeout(DETECT_TIMEOUT + 30_000);
  await seedTryOn(page, { bodyPhoto: false });
  await openScreen(page, '/me/photo', 'screen-me-photo');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('me-choose-photo').click();
  // A plain empty image: no person to find.
  await (
    await chooser
  ).setFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAUCAIAAAA7jDsBAAAAFUlEQVR4nGN4+ewBHsQwKj0qTS1pAB5aGNdA2EPgAAAAAElFTkSuQmCC',
      'base64',
    ),
  });
  await expect(page.getByTestId('me-problem-no-person')).toBeVisible({ timeout: DETECT_TIMEOUT });
  await expect(page.getByTestId('me-retake')).toBeVisible();
  await shot(page, 'no-person');
  await page.getByTestId('me-retake').click();
  await expect(page.getByTestId('me-guide')).toBeVisible();
});
