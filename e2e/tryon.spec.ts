import { expect, test, type Page } from '@playwright/test';
import {
  BODY_PHOTO_ID,
  OUTFIT_ID,
  imageExists,
  openScreen,
  seedTryOn,
  storedProfile,
} from './helpers/tryonSeed';

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.TRYON_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/t2-${name}.png` });
  }
};

const backdrop = (page: Page) => page.locator('[data-testid$="-backdrop"]');
const silhouette = (page: Page) =>
  page.locator('[data-testid$="-silhouette"]:not([data-testid^="tryon-toggle"])');

test.describe('try-on photo display', () => {
  test('seeded photo: Outfits shows the toggle, Silhouette switches the backdrop and persists', async ({
    page,
  }) => {
    await seedTryOn(page);
    await openScreen(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('tryon-toggle-me')).toBeVisible();
    await expect(page.getByTestId('tryon-toggle-silhouette')).toBeVisible();
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    await expect(backdrop(page).first()).toBeVisible();
    await expect(silhouette(page)).toHaveCount(0);
    // A photo exists, so the "add a photo" hint is not offered.
    await expect(page.getByTestId('outfits-photo-hint')).toHaveCount(0);
    await shot(page, 'outfits-photo');

    await page.getByTestId('tryon-toggle-silhouette').click();
    await expect(backdrop(page)).toHaveCount(0);
    await expect(silhouette(page).first()).toBeVisible();
    await shot(page, 'outfits-silhouette');

    // Persisted in the profile, so it survives a reload.
    await expect.poll(async () => (await storedProfile(page))?.tryOnMode).toBe('silhouette');
    await openScreen(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    await expect(backdrop(page)).toHaveCount(0);
    await expect(page.getByTestId('tryon-toggle-silhouette')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByTestId('tryon-toggle-me').click();
    await expect(backdrop(page).first()).toBeVisible();
    await expect.poll(async () => (await storedProfile(page))?.tryOnMode).toBe('photo');
  });

  test('the same toggle and backdrop are on the saved outfit and in Mix', async ({ page }) => {
    await seedTryOn(page);
    await openScreen(page, `/outfits/${OUTFIT_ID}`, 'screen-outfit-detail');
    await expect(page.getByTestId('outfit-detail-mannequin-backdrop')).toBeVisible();
    await page.getByTestId('tryon-toggle-silhouette').click();
    await expect(page.getByTestId('outfit-detail-mannequin-backdrop')).toHaveCount(0);
    await expect(page.getByTestId('outfit-detail-mannequin-silhouette')).toBeVisible();

    // The choice is shared across screens: Mix opens on the silhouette, then back to the photo.
    await expect.poll(async () => (await storedProfile(page))?.tryOnMode).toBe('silhouette');
    await openScreen(page, `/mix?outfitId=${OUTFIT_ID}`, 'screen-mix');
    await expect(page.getByTestId('mix-rows')).toBeVisible();
    await expect(page.getByTestId('mannequin-backdrop')).toHaveCount(0);
    await page.getByTestId('tryon-toggle-me').click();
    await expect(page.getByTestId('mannequin-backdrop')).toBeVisible();
    await shot(page, 'mix-photo');
  });

  test('without a photo there is no toggle, and the Outfits screen offers to add one', async ({
    page,
  }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    await expect(page.getByTestId('tryon-toggle-me')).toHaveCount(0);
    await expect(silhouette(page).first()).toBeVisible();
    await expect(page.getByTestId('outfits-photo-hint')).toBeVisible();
    await shot(page, 'outfits-hint');
    await page.getByTestId('outfits-photo-hint-add').click();
    await expect(page.getByTestId('screen-me-photo')).toBeVisible();
    await expect(page.getByTestId('me-guide')).toBeVisible();
  });

  test('the hint can be dismissed and stays away', async ({ page }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, '/outfits', 'screen-outfits');
    await page.getByTestId('outfits-photo-hint-dismiss').click();
    await expect(page.getByTestId('outfits-photo-hint')).toHaveCount(0);
    await openScreen(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    await expect(page.getByTestId('outfits-photo-hint')).toHaveCount(0);
  });
});

test.describe('profile card', () => {
  test('shows the photo, and Delete photo removes it and the toggle', async ({ page }) => {
    await seedTryOn(page);
    await openScreen(page, '/profile', 'screen-profile');
    const card = page.getByTestId('profile-tryon-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('profile-tryon-thumb')).toBeVisible();
    await expect(page.getByTestId('profile-tryon-retake')).toBeVisible();
    await expect(page.getByTestId('profile-tryon-adjust')).toBeVisible();
    await shot(page, 'profile-card');

    await page.getByTestId('profile-tryon-delete').click();
    await expect(page.getByTestId('me-delete-sheet')).toBeVisible();
    await shot(page, 'delete-sheet');
    await page.getByTestId('me-delete').click();
    await expect(page.getByTestId('profile-tryon-add')).toBeVisible();
    await expect(page.getByTestId('profile-tryon-thumb')).toHaveCount(0);
    await expect.poll(async () => (await storedProfile(page))?.bodyPhoto).toBeUndefined();
    expect(await imageExists(page, BODY_PHOTO_ID)).toBe(false);

    await openScreen(page, '/outfits', 'screen-outfits');
    await expect(page.getByTestId('outfit-mannequin-0')).toBeVisible();
    await expect(page.getByTestId('tryon-toggle-me')).toHaveCount(0);
    await expect(backdrop(page)).toHaveCount(0);
  });

  test('without a photo the card invites you to add one', async ({ page }) => {
    await seedTryOn(page, { bodyPhoto: false });
    await openScreen(page, '/profile', 'screen-profile');
    await expect(page.getByTestId('profile-tryon-add')).toBeVisible();
    await expect(page.getByText(/stays on this phone/)).toBeVisible();
    await page.getByTestId('profile-tryon-add').click();
    await expect(page.getByTestId('screen-me-photo')).toBeVisible();
    await expect(page.getByTestId('me-privacy')).toBeVisible();
    await shot(page, 'guide');
  });

  test('Adjust points opens the correction screen on the saved photo, and the handles drag', async ({
    page,
  }) => {
    await seedTryOn(page);
    await openScreen(page, '/me/photo?step=adjust', 'screen-me-photo');
    await expect(page.getByTestId('me-correct')).toBeVisible();
    const handle = page.getByTestId('me-handle-kneeL');
    await expect(handle).toBeVisible();
    // Every handle's touch area is at least 44 px.
    const box = await handle.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await shot(page, 'correction');

    if (!box) throw new Error('no handle box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y - 30, { steps: 6 });
    await expect(page.getByTestId('me-loupe')).toBeVisible();
    await expect(page.getByTestId('me-handle-label')).toHaveText('Your right knee');
    await shot(page, 'correction-drag');
    await page.mouse.up();
    await expect(page.getByTestId('me-loupe')).toHaveCount(0);
    const moved = await handle.boundingBox();
    expect(moved && Math.abs(moved.x - box.x - 20) < 3).toBe(true);
    expect(moved && Math.abs(moved.y - box.y + 30) < 3).toBe(true);

    // Reset goes back to the detected points.
    await page.getByTestId('me-reset').click();
    const back = await handle.boundingBox();
    expect(back && Math.abs(back.x - box.x) < 2 && Math.abs(back.y - box.y) < 2).toBe(true);

    // The live preview draws a sample outfit on the photo.
    await page.getByTestId('me-view-preview').click();
    await expect(page.getByTestId('me-preview-mannequin-backdrop')).toBeVisible();
    await shot(page, 'correction-preview');
    await page.getByTestId('me-view-points').click();

    // Save keeps the same image and writes the dragged point.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y, { steps: 4 });
    await page.mouse.up();
    await page.getByTestId('me-save').click();
    await expect
      .poll(async () => {
        const photo = (await storedProfile(page))?.bodyPhoto as
          { imageId: string; landmarks: { kneeL: { x: number } } } | undefined;
        return photo ? `${photo.imageId}:${photo.landmarks.kneeL.x > 420}` : undefined;
      })
      .toBe(`${BODY_PHOTO_ID}:true`);
  });
});
