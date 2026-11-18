import { expect, test } from '@playwright/test';

const TABS = [
  { label: 'Closet', id: 'screen-closet' },
  { label: 'Outfits', id: 'screen-outfits' },
  { label: 'Mix', id: 'screen-mix' },
  { label: 'Calendar', id: 'screen-calendar' },
  { label: 'Profile', id: 'screen-profile' },
];

test('app loads on the Closet tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('screen-closet')).toBeVisible();
});

test('each tab navigates to its screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('screen-closet')).toBeVisible();
  for (const { label, id } of TABS) {
    await page.getByRole('tab', { name: label }).tap();
    await expect(page.getByTestId(id)).toBeVisible();
  }
});
