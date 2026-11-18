import { expect, test, type Page } from '@playwright/test';

/**
 * The built app must be quiet: no console errors (React hydration error #418 among them), no
 * uncaught exceptions and no failed requests (404s) on the main tabs and the Me (try-on photo)
 * flow, on a first load and on a reload (a cached icon font is what used to trigger #418).
 * Dynamic detail routes (/outfits/<id>) are only reached by in-app navigation here: a deep link to
 * one is answered by the host's 404.html fallback, which GitHub Pages does with status 404.
 */

function watch(page: Page): { problems: string[] } {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return { problems };
}

const SETTLE_MS = 1500;

const SCREENS = [
  { path: '/', id: 'screen-closet' },
  { path: '/outfits', id: 'screen-outfits' },
  { path: '/mix', id: 'screen-mix' },
  { path: '/calendar', id: 'screen-calendar' },
  { path: '/profile', id: 'screen-profile' },
  { path: '/insights', id: 'screen-insights' },
  { path: '/closet/add', id: 'screen-add-item' },
  { path: '/me/photo', id: 'screen-me-photo' },
];

for (const { path, id } of SCREENS) {
  test(`${path} logs no errors and no 404s, on load and on reload`, async ({ page }) => {
    const { problems } = watch(page);
    await page.goto(path);
    await expect(page.getByTestId(id)).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await page.reload();
    await expect(page.getByTestId(id)).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    expect(problems).toEqual([]);
  });
}

test('the Me flow from the Profile tab logs no errors and no 404s', async ({ page }) => {
  const { problems } = watch(page);
  await page.goto('/profile');
  await expect(page.getByTestId('screen-profile')).toBeVisible();
  await page.getByTestId('profile-tryon-add').click();
  await expect(page.getByTestId('me-guide')).toBeVisible();
  await expect(page.getByTestId('me-choose-photo')).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  await page.getByTestId('me-back').click();
  await expect(page.getByTestId('screen-profile')).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  expect(problems).toEqual([]);
});

test('switching between the tabs logs no errors', async ({ page }) => {
  const { problems } = watch(page);
  await page.goto('/');
  await expect(page.getByTestId('screen-closet')).toBeVisible();
  for (const label of ['Outfits', 'Mix', 'Calendar', 'Profile', 'Closet']) {
    await page.getByRole('tab', { name: label }).tap();
    await page.waitForTimeout(400);
  }
  expect(problems).toEqual([]);
});
