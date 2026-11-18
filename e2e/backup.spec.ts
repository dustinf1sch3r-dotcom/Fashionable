import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const CARDS =
  '[data-testid^="closet-item-"]:not([data-testid*="-image"]):not([data-testid$="-favorite"]):not([data-testid$="-laundry"])';
const PHOTO = '[data-testid$="-image-img"] > div';

async function addNavyTee(page: Page): Promise<void> {
  await page.getByTestId('closet-add-button').click();
  await expect(page.getByTestId('screen-add-item')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('add-item-choose-photo').click();
  await (await chooser).setFiles('e2e/fixtures/navy-200x300.png');
  // Background removal runs between picking and the form: allow for a cold model load on a busy CI machine.
  await expect(page.getByTestId('add-item-form')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('add-item-colour-primary')).toContainText('Navy');
  await page.getByTestId('add-item-save').click();
  await expect(page.getByTestId('screen-closet')).toBeVisible();
}

/** Tab presses can be swallowed while a screen transition is still running, so retry. */
async function openTab(page: Page, name: string, screenId: string): Promise<void> {
  await expect(async () => {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByTestId(screenId)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

const openProfile = (page: Page) => openTab(page, 'Profile', 'screen-profile');
const openCloset = (page: Page) => openTab(page, 'Closet', 'screen-closet');

/** Starts the file picker from the Import button and chooses `file`. */
async function chooseImportFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('profile-import-button').click();
  await (await chooser).setFiles(file);
  await expect(page.getByTestId('import-sheet')).toBeVisible();
}

/**
 * A fresh page load. Chromium occasionally answers a navigation that starts while the previous
 * page is still tearing down with net::ERR_ABORTED; loading again succeeds.
 */
async function freshLoad(page: Page, path: string): Promise<void> {
  await expect(async () => {
    await page.goto(path);
  }).toPass({ timeout: 15_000 });
}

/** Wipes everything the app stores in this browser, as clearing site data would. */
async function clearSiteData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('fashionable-images');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

test('export a backup, lose the browser data, import it and get the closet back', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('closet-empty')).toBeVisible();
  await addNavyTee(page);
  await addNavyTee(page);
  const cards = page.locator(CARDS);
  await expect(cards).toHaveCount(2);

  await openProfile(page);
  await expect(page.getByTestId('profile-item-count')).toHaveText('2 items');
  await expect(page.getByTestId('profile-last-exported')).toContainText('Never');

  const download = page.waitForEvent('download');
  await page.getByTestId('profile-export-button').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^fashionable-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = testInfo.outputPath('backup.json');
  await file.saveAs(path);
  await expect(page.getByTestId('profile-backup-success')).toContainText('2 items');
  await expect(page.getByTestId('profile-last-exported')).not.toContainText('Never');

  const doc = JSON.parse(readFileSync(path, 'utf8'));
  expect(doc).toMatchObject({
    format: 'fashionable-backup',
    version: 1,
    app: { schemaVersion: 1 },
  });
  expect(doc.items).toHaveLength(2);
  expect(Object.keys(doc.images)).toHaveLength(6);

  // Browser data wiped: the closet is empty again.
  await clearSiteData(page);
  await freshLoad(page, '/');
  await expect(page.getByTestId('closet-empty')).toBeVisible();
  await expect(cards).toHaveCount(0);

  await openProfile(page);
  await expect(page.getByTestId('profile-last-exported')).toContainText('Never');
  await chooseImportFile(page, path);
  await page.getByTestId('import-replace').click();
  await expect(page.getByTestId('profile-backup-success')).toContainText('Items: 2 added');
  await expect(page.getByTestId('profile-item-count')).toHaveText('2 items');

  await openCloset(page);
  await expect(cards).toHaveCount(2);
  const photo = page.locator(PHOTO).first();
  await expect(photo).toHaveAttribute('style', /background-image: url\("blob:/);

  // And it is really stored, not just in memory.
  await freshLoad(page, '/profile');
  await expect(page.getByTestId('profile-item-count')).toHaveText('2 items');
  await openCloset(page);
  await expect(cards).toHaveCount(2);
  await expect(page.locator(PHOTO).first()).toHaveAttribute(
    'style',
    /background-image: url\("blob:/,
  );

  // Importing the same file again as a merge changes nothing and keeps images displayed.
  await openProfile(page);
  await chooseImportFile(page, path);
  await page.getByTestId('import-merge').click();
  await expect(page.getByTestId('profile-backup-success')).toContainText('Nothing new');
  await openCloset(page);
  await expect(cards).toHaveCount(2);
  await expect(page.locator(PHOTO).first()).toHaveAttribute(
    'style',
    /background-image: url\("blob:/,
  );
});

test('merge adds the items of a backup to what is already in the closet', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await addNavyTee(page);
  await openProfile(page);
  const download = page.waitForEvent('download');
  await page.getByTestId('profile-export-button').click();
  const path = testInfo.outputPath('one-item.json');
  await (await download).saveAs(path);

  // Make the file look like it came from another phone: different item id.
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  doc.items[0].id = '11111111-1111-4111-8111-111111111111';
  writeFileSync(path, JSON.stringify(doc));

  await chooseImportFile(page, path);
  await page.getByTestId('import-merge').click();
  await expect(page.getByTestId('profile-backup-success')).toContainText('Items: 1 added');
  await expect(page.getByTestId('profile-item-count')).toHaveText('2 items');
});

test('importing a garbage file shows an error and changes nothing', async ({ page }) => {
  await page.goto('/');
  await addNavyTee(page);
  await openProfile(page);
  await expect(page.getByTestId('profile-item-count')).toHaveText('1 item');

  const garbage = [
    { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('this is not json') },
    {
      name: 'other.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
    },
    {
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'fashionable-backup', version: 99 })),
    },
  ];
  const expected = [/not valid JSON/, /not a Fashionable backup/, /newer version/];
  for (const [i, file] of garbage.entries()) {
    await chooseImportFile(page, file);
    await page.getByTestId('import-replace').click();
    await expect(page.getByTestId('profile-backup-error')).toContainText(expected[i]);
    await expect(page.getByTestId('profile-backup-error')).toContainText('Nothing was changed');
    await expect(page.getByTestId('profile-item-count')).toHaveText('1 item');
  }

  await openCloset(page);
  await expect(page.locator(CARDS)).toHaveCount(1);
  await expect(page.locator(PHOTO).first()).toHaveAttribute(
    'style',
    /background-image: url\("blob:/,
  );
});

test('cancelling the import sheet leaves the closet alone', async ({ page }) => {
  await page.goto('/');
  await openProfile(page);
  await chooseImportFile(page, {
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await page.getByTestId('import-cancel').click();
  await expect(page.getByTestId('import-sheet')).toBeHidden();
  await expect(page.getByTestId('profile-backup-error')).toBeHidden();
});
