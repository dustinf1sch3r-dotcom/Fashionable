import { expect, test } from '@playwright/test';

test.describe('UI kit gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByTestId('screen-dev-ui')).toBeVisible();
  });

  test('chip selection toggles aria state', async ({ page }) => {
    const chip = page.getByTestId('dev-chips-multi-work');
    await chip.scrollIntoViewIfNeeded();
    await expect(chip).toHaveAttribute('aria-checked', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', 'true');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', 'false');
  });

  test('rating selects a value', async ({ page }) => {
    const four = page.getByTestId('dev-rating-formality-4');
    await four.scrollIntoViewIfNeeded();
    await expect(four).toHaveAttribute('aria-checked', 'false');
    await four.click();
    await expect(four).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('dev-rating-readout')).toHaveText('Formality: 4');
  });

  test('sheet opens and closes', async ({ page }) => {
    const sheet = page.getByTestId('dev-sheet');
    await expect(sheet).toHaveCount(0);
    const open = page.getByTestId('dev-sheet-open');
    await open.scrollIntoViewIfNeeded();
    await open.click();
    await expect(sheet).toBeVisible();
    await page.getByTestId('dev-sheet-close').click();
    await expect(sheet).toHaveCount(0);
    await open.click();
    await expect(sheet).toBeVisible();
    await page.getByTestId('dev-sheet-done').click();
    await expect(sheet).toHaveCount(0);
  });
});
