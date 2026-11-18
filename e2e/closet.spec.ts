import { expect, test, type Page } from '@playwright/test';

const ITEMS_KEY = 'fashionable/v1/items';

function seedItem(
  id: string,
  over: Record<string, unknown>,
  hex: string,
  colorName: string,
  createdAt: string,
) {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    pattern: 'solid',
    patternBold: false,
    formality: 2,
    warmth: 2,
    rainOk: true,
    sporty: false,
    status: 'active',
    favorite: false,
    colors: [{ hex, share: 1, name: colorName }],
    images: { originalId: `${id}-o`, cutoutId: `${id}-c`, thumbId: `${id}-t` },
    cutout: { aspectRatio: 1, hasAlpha: true },
    ...over,
  };
}

const TEE = 'seed-tee';
const JEANS = 'seed-jeans';
const BOOTS = 'seed-boots';

const SEED = {
  schemaVersion: 1,
  records: [
    seedItem(
      TEE,
      { name: 'Navy tee', category: 'top', subcategory: 'tshirt', brand: 'Uniqlo' },
      '#1f2a44',
      'navy',
      '2026-01-01T10:00:00.000Z',
    ),
    seedItem(
      JEANS,
      { category: 'bottom', subcategory: 'jeans', formality: 2, warmth: 3 },
      '#2b3f66',
      'blue',
      '2026-01-02T10:00:00.000Z',
    ),
    seedItem(
      BOOTS,
      { name: 'Brown boots', category: 'shoes', subcategory: 'chelsea-boots', favorite: true },
      '#6b4a2f',
      'brown',
      '2026-01-03T10:00:00.000Z',
    ),
  ],
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      // Only the first load: later loads must see what the app itself wrote.
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
    },
    [ITEMS_KEY, JSON.stringify(SEED)] as const,
  );
}

test.describe('closet with items', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await expect(page.getByTestId('closet-grid')).toBeVisible();
  });

  test('grid shows the seeded items, newest first', async ({ page }) => {
    await expect(page.getByTestId('closet-count')).toHaveText('3 items');
    await expect(page.getByTestId(`closet-item-${TEE}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${JEANS}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${BOOTS}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${BOOTS}-favorite`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${TEE}-image-placeholder`)).toBeVisible();
    await expect(
      page
        .locator(
          '[data-testid^="closet-item-seed-"]:not([data-testid*="-image"]):not([data-testid*="-favorite"])',
        )
        .first(),
    ).toHaveAttribute('data-testid', `closet-item-${BOOTS}`);
  });

  test('category tab narrows the grid', async ({ page }) => {
    await page.getByTestId('closet-category-shoes').click();
    await expect(page.getByTestId(`closet-item-${BOOTS}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toHaveCount(0);
    await expect(page.getByTestId(`closet-item-${JEANS}`)).toHaveCount(0);
    await page.getByTestId('closet-category-top').click();
    await expect(page.getByTestId('closet-no-matches')).toHaveCount(0);
    await expect(page.getByTestId(`closet-item-${TEE}`)).toBeVisible();
    await page.getByTestId('closet-category-watch').click();
    await expect(page.getByTestId('closet-no-matches')).toBeVisible();
    await page.getByTestId('closet-clear-filters').click();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toBeVisible();
  });

  test('colour filter narrows the grid', async ({ page }) => {
    await page.getByTestId('closet-color-brown').click();
    await expect(page.getByTestId(`closet-item-${BOOTS}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toHaveCount(0);
  });

  test('search narrows the grid', async ({ page }) => {
    await page.getByTestId('closet-search').fill('jean');
    await expect(page.getByTestId(`closet-item-${JEANS}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toHaveCount(0);
    await page.getByTestId('closet-search').fill('uniqlo');
    await expect(page.getByTestId(`closet-item-${TEE}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${JEANS}`)).toHaveCount(0);
  });

  test('status filter shows laundry items', async ({ page }) => {
    await page.getByTestId(`closet-item-${TEE}`).click();
    await page.getByTestId('item-status-laundry').click();
    await page.getByTestId('item-back').click();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toHaveCount(0);
    await page.getByTestId('closet-status-laundry').click();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${TEE}-laundry`)).toBeVisible();
  });

  test('item detail: favourite, edit, delete and undo', async ({ page }) => {
    await page.getByTestId(`closet-item-${TEE}`).click();
    await expect(page.getByTestId('screen-item-detail')).toBeVisible();
    await expect(page.getByTestId('item-name')).toHaveText('Navy tee');

    const fav = page.getByTestId('item-favorite');
    await expect(fav).toHaveAttribute('aria-label', 'Add to favourites');
    await fav.click();
    await expect(fav).toHaveAttribute('aria-label', 'Remove from favourites');

    await page.getByTestId('item-edit').click();
    await page.getByTestId('item-edit-name').fill('Ink tee');
    await page.getByTestId('item-edit-formality-4').click();
    await page.getByTestId('item-edit-save').click();
    await expect(page.getByTestId('item-name')).toHaveText('Ink tee');
    await expect(page.getByTestId('item-attributes')).toContainText('4/5 Business');

    await page.getByTestId('item-delete').click();
    await expect(page.getByTestId('item-deleted')).toBeVisible();
    await page.getByTestId('item-undo').click();
    await expect(page.getByTestId('item-name')).toHaveText('Ink tee');
    await expect(page.getByTestId('item-favorite')).toHaveAttribute(
      'aria-label',
      'Remove from favourites',
    );

    await page.getByTestId('item-back').click();
    await expect(page.getByTestId(`closet-item-${TEE}`)).toBeVisible();
    await expect(page.getByTestId(`closet-item-${TEE}-favorite`)).toBeVisible();
  });

  test('a deleted item leaves the grid', async ({ page }) => {
    await page.getByTestId(`closet-item-${JEANS}`).click();
    await page.getByTestId('item-delete').click();
    await expect(page.getByTestId('item-deleted')).toBeVisible();
    await page.getByTestId('item-deleted-back').click();
    await expect(page.getByTestId('closet-count')).toHaveText('2 items');
    await expect(page.getByTestId(`closet-item-${JEANS}`)).toHaveCount(0);
  });

  test('detail survives a reload (deep link)', async ({ page }) => {
    await page.goto(`/closet/${BOOTS}`);
    await expect(page.getByTestId('item-name')).toHaveText('Brown boots');
  });

  test('add button opens the add route', async ({ page }) => {
    await page.getByTestId('closet-add-button').click();
    await expect(page).toHaveURL(/\/closet\/add$/);
  });
});

test('empty closet invites the first photo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('closet-empty')).toBeVisible();
  await expect(page.getByTestId('closet-count')).toHaveText('0 items');
  await page.getByTestId('closet-empty-add').click();
  await expect(page).toHaveURL(/\/closet\/add$/);
});

test('unknown item shows not found', async ({ page }) => {
  await page.goto('/closet/nope');
  await expect(page.getByTestId('item-not-found')).toBeVisible();
});
