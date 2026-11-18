import { expect, test } from '@playwright/test';

// The whole first-use journey across the add screen and the closet grid, including a reload,
// so storage of both the record and the photo is exercised together.
test('photograph an item, see it in the closet, and keep it after a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('closet-empty')).toBeVisible();

  await page.getByTestId('closet-add-button').click();
  await expect(page.getByTestId('screen-add-item')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-item-choose-photo').click();
  await (await chooser).setFiles('e2e/fixtures/navy-200x300.png');
  await expect(page.getByTestId('add-item-colour-primary')).toContainText('Navy');
  await page.getByTestId('add-item-save').click();

  await expect(page.getByTestId('screen-closet')).toBeVisible();
  // Whole cards only: inner parts carry ids such as closet-item-<id>-image.
  const cards = page.locator(
    '[data-testid^="closet-item-"]:not([data-testid*="-image"]):not([data-testid$="-favorite"]):not([data-testid$="-laundry"])',
  );
  await expect(cards).toHaveCount(1);
  // React Native for web draws an Image as a background image on an inner element.
  const photo = page.locator('[data-testid$="-image-img"] > div').first();
  await expect(photo).toHaveAttribute('style', /background-image: url\("blob:/);

  await page.reload();
  await expect(cards).toHaveCount(1);
  await expect(photo).toHaveAttribute('style', /background-image: url\("blob:/);

  await cards.first().click();
  await expect(page.getByTestId('screen-item-detail')).toBeVisible();
  await expect(page.getByTestId('screen-item-detail')).toContainText('Navy');
});
