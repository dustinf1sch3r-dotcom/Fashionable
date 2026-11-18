import { expect, test, type Page } from '@playwright/test';

const WHOLE = 'e2e/fixtures/red-tee-600x800.png';
// The same tee, photographed too close: the body runs off the bottom of the photo.
const CUT_OFF = 'e2e/fixtures/red-tee-cutoff-600x450.png';
// The first cut-out downloads the model and runtime (about 20 MB) and runs it in WebAssembly.
const CUTOUT_TIMEOUT = 90_000;

async function addPhoto(page: Page, file: string): Promise<void> {
  await page.goto('/closet/add');
  await expect(page.getByTestId('screen-add-item')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-item-choose-photo').click();
  await (await chooser).setFiles(file);
  await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: CUTOUT_TIMEOUT });
}

test.describe('capture hint (docs/TRY_ON.md §8)', () => {
  test('a tee cut off by the photo edge gets a friendly, non-blocking hint', async ({ page }) => {
    test.setTimeout(CUTOUT_TIMEOUT + 60_000);
    await addPhoto(page, CUT_OFF);
    const hint = page.getByTestId('add-item-capture-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('looks cut off');
    await expect(hint).toContainText('whole piece laid flat');
    await page.screenshot({ path: 'test-results/capture-hint-390x844.png' });
    // Advice only: the garment can still be saved.
    await page.getByTestId('add-item-category-top').click();
    await page.getByTestId('add-item-subcategory-tshirt').click();
    await expect(page.getByTestId('add-item-save')).toBeEnabled();
    await page.getByTestId('add-item-save').click();
    await expect(page.getByTestId('screen-closet')).toBeVisible();
  });

  test('a whole tee gets no hint', async ({ page }) => {
    test.setTimeout(CUTOUT_TIMEOUT + 60_000);
    await addPhoto(page, WHOLE);
    await expect(page.getByTestId('add-item-category-top')).toBeVisible();
    await expect(page.getByTestId('add-item-capture-hint')).toHaveCount(0);
  });
});
