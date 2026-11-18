import { expect, test } from '@playwright/test';

const OUTFIT_SIZES: Record<string, number> = {
  casual: 5,
  dress: 3,
  winter: 7,
  formal: 4,
  jumpsuit: 4,
};

test('mannequin dev page renders the silhouette and garment layers', async ({ page }) => {
  await page.goto('/dev/mannequin');
  await expect(page.getByTestId('screen-dev-mannequin')).toBeVisible();
  await expect(page.getByTestId('mannequin-silhouette')).toBeVisible();
  await expect(page.locator('[data-testid^="mannequin-item-"]')).toHaveCount(OUTFIT_SIZES.casual);

  const box = await page.getByTestId('mannequin').boundingBox();
  expect(box).not.toBeNull();
  if (box) expect(Math.abs(box.height / box.width - 2)).toBeLessThan(0.02);
});

test('switching outfit changes the garment layers', async ({ page }) => {
  await page.goto('/dev/mannequin');
  for (const [key, count] of Object.entries(OUTFIT_SIZES)) {
    await page.getByTestId(`dev-mannequin-outfits-${key}`).tap();
    await expect(page.locator('[data-testid^="mannequin-item-"]')).toHaveCount(count);
  }
});

test('debug toggle shows landmarks', async ({ page }) => {
  await page.goto('/dev/mannequin');
  await expect(page.getByTestId('mannequin-debug')).toHaveCount(0);
  await page.getByTestId('dev-mannequin-debug-on').tap();
  await expect(page.getByTestId('mannequin-debug')).toBeVisible();
  await page.getByTestId('dev-mannequin-debug-off').tap();
  await expect(page.getByTestId('mannequin-debug')).toHaveCount(0);
});

test('tapping a garment selects it', async ({ page }) => {
  await page.goto('/dev/mannequin');
  await expect(page.getByTestId('dev-mannequin-selected')).toHaveText('Tap a garment');
  await page.getByTestId('mannequin-item-jeans-dark').tap();
  await expect(page.getByTestId('dev-mannequin-selected')).toHaveText('Selected: Dark jeans');
});
