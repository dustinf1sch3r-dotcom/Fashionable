import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'e2e/fixtures/navy-200x300.png';

async function chooseFixture(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-item-choose-photo').click();
  await (await chooser).setFiles(FIXTURE);
}

/** Raw JSON the app persisted for the items collection (AsyncStorage maps to localStorage). */
async function storedItems(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.endsWith('items')) return localStorage.getItem(key) ?? '';
    }
    return '';
  });
}

test.describe('Add item flow', () => {
  test('adds a navy T-shirt from a photo and returns to the closet', async ({ page }) => {
    await page.goto('/closet/add');
    await expect(page.getByTestId('screen-add-item')).toBeVisible();

    await chooseFixture(page);
    await expect(page.getByTestId('add-item-form')).toBeVisible();
    await expect(page.getByTestId('add-item-colour-primary')).toContainText('Navy');

    await page.getByTestId('add-item-category-top').click();
    await page.getByTestId('add-item-subcategory-tshirt').click();
    await expect(page.getByTestId('add-item-subcategory-tshirt')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // T-shirt defaults: formality 2, warmth 1.
    await expect(page.getByTestId('add-item-formality-2')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('add-item-warmth-1')).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('add-item-save').click();
    await expect(page.getByTestId('screen-closet')).toBeVisible();

    // The closet grid is a separate ticket, so check what was persisted instead of the grid.
    await expect.poll(() => storedItems(page)).toContain('"subcategory":"tshirt"');
    expect(await storedItems(page)).toContain('"name":"navy"');
  });

  test('lets the user replace the detected colour', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await expect(page.getByTestId('add-item-colour-primary')).toContainText('Navy');
    await page.getByTestId('add-item-colour-toggle').click();
    await page.getByTestId('add-item-colour-picker-olive').click();
    await expect(page.getByTestId('add-item-colour-primary')).toContainText('Olive');
  });

  test('re-applies subcategory defaults until the user changes a value', async ({ page }) => {
    await page.goto('/closet/add');
    await chooseFixture(page);
    await page.getByTestId('add-item-subcategory-sweater').click();
    await expect(page.getByTestId('add-item-warmth-4')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('add-item-warmth-2').click();
    await page.getByTestId('add-item-subcategory-hoodie').click();
    await expect(page.getByTestId('add-item-warmth-2')).toHaveAttribute('aria-checked', 'true');
  });

  test('reloading the add screen does not crash', async ({ page }) => {
    await page.goto('/closet/add');
    await expect(page.getByTestId('screen-add-item')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('screen-add-item')).toBeVisible();
    await expect(page.getByTestId('add-item-choose-photo')).toBeVisible();
  });
});
