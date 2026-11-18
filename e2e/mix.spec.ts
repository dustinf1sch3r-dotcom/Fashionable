import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Open-Meteo is never reached: the seeded profile has no location, so no weather request is made. */

test.use({ deviceScaleFactor: 2 });

const SHOTS = process.env.MIX_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mix-${name}.png` });
};

const ASPECTS = JSON.parse(readFileSync('e2e/fixtures/garments/aspects.json', 'utf8')) as Record<
  string,
  number
>;

interface Seed {
  key: string;
  name: string;
  category: string;
  subcategory: string;
  hex: string;
  color: string;
  formality: number;
  warmth: number;
  layer?: 'base' | 'mid';
}

const GARMENTS: Seed[] = [
  {
    key: 'tee-navy',
    name: 'Navy tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#1f2a44',
    color: 'navy',
    formality: 2,
    warmth: 2,
  },
  {
    key: 'tee-white',
    name: 'White tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#f1eee6',
    color: 'white',
    formality: 2,
    warmth: 1,
  },
  // A shirt worn open over a tee: gives the Layers row something to show.
  {
    key: 'shirt-blue',
    name: 'Blue shirt',
    category: 'top',
    subcategory: 'shirt',
    layer: 'mid',
    hex: '#8fb3de',
    color: 'blue',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'jeans-dark',
    name: 'Dark jeans',
    category: 'bottom',
    subcategory: 'jeans',
    hex: '#2b3f66',
    color: 'navy',
    formality: 2,
    warmth: 3,
  },
  {
    key: 'trousers-grey',
    name: 'Grey trousers',
    category: 'bottom',
    subcategory: 'trousers',
    hex: '#5a5e68',
    color: 'grey',
    formality: 3,
    warmth: 3,
  },
  {
    key: 'skirt-olive',
    name: 'Olive skirt',
    category: 'bottom',
    subcategory: 'skirt',
    hex: '#6f7650',
    color: 'olive',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'dress-green',
    name: 'Green dress',
    category: 'onepiece',
    subcategory: 'day-dress',
    hex: '#3f7d5c',
    color: 'green',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'sneakers-white',
    name: 'White sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    hex: '#f4f4f2',
    color: 'white',
    formality: 2,
    warmth: 2,
  },
  {
    key: 'loafers-brown',
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    hex: '#6b4a2f',
    color: 'brown',
    formality: 3,
    warmth: 2,
  },
  {
    key: 'boots-black',
    name: 'Black boots',
    category: 'shoes',
    subcategory: 'chelsea-boots',
    hex: '#26262b',
    color: 'black',
    formality: 3,
    warmth: 4,
  },
  {
    key: 'jacket-denim',
    name: 'Denim jacket',
    category: 'outerwear',
    subcategory: 'denim-jacket',
    hex: '#4f6f9c',
    color: 'blue',
    formality: 2,
    warmth: 3,
  },
];

const id = (key: string) => `seed-${key}`;

const record = (g: Seed, i: number) => {
  const at = `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`;
  return {
    id: id(g.key),
    createdAt: at,
    updatedAt: at,
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    ...(g.layer ? { layer: g.layer } : {}),
    colors: [{ hex: g.hex, share: 1, name: g.color }],
    pattern: 'solid',
    patternBold: false,
    formality: g.formality,
    warmth: g.warmth,
    rainOk: true,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: `${g.key}-o`, cutoutId: `${g.key}-c`, thumbId: `${g.key}-t` },
    cutout: { aspectRatio: ASPECTS[g.key], hasAlpha: true },
  };
};

/** Writes the closet (and any outfits) into storage, pictures into IndexedDB, then reloads. */
async function seed(page: Page, outfits: object[] = []): Promise<void> {
  const images = GARMENTS.map((g) => ({
    id: `${g.key}-c`,
    thumb: `${g.key}-t`,
    b64: readFileSync(`e2e/fixtures/garments/${g.key}.png`).toString('base64'),
  }));
  const items = JSON.stringify({ schemaVersion: 1, records: GARMENTS.map(record) });
  const outfitJson = JSON.stringify({ schemaVersion: 1, records: outfits });
  await page.goto('/');
  await page.evaluate(
    async ([imgs, itemJson, outJson]) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('fashionable-images', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('images');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('images', 'readwrite');
          for (const img of imgs) {
            const bytes = Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'image/png' });
            tx.objectStore('images').put(blob, img.id);
            tx.objectStore('images').put(blob, img.thumb);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.setItem('fashionable/v1/items', itemJson);
      localStorage.setItem('fashionable/v1/outfits', outJson);
    },
    [images, items, outfitJson] as const,
  );
}

async function openMix(page: Page, query = ''): Promise<void> {
  await expect(async () => {
    await page.goto(`/mix${query}`);
    await expect(page.getByTestId('screen-mix')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('mix-rows').or(page.getByTestId('mix-fit-panel'))).toBeVisible({
      timeout: 3000,
    });
  }).toPass({ timeout: 20_000 });
}

const garment = (page: Page, key: string): Locator => page.getByTestId(`mannequin-item-${id(key)}`);
const option = (page: Page, row: string, key: string): Locator =>
  page.getByTestId(`mix-option-${row}-${id(key)}`);
const layers = (page: Page): Locator => page.locator('[data-testid^="mannequin-item-"]');

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

/**
 * The garment's box once it is drawn from its fitted picture. Tops and bottoms first show the
 * rigid picture and cross-fade to the fitted one, whose box differs (docs/TRY_ON.md §12.5), so
 * measuring earlier would compare two different pictures.
 */
async function settledBox(page: Page, key: string) {
  await expect(page.getByTestId(`mannequin-fitted-${id(key)}`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(`mannequin-image-${id(key)}`)).toHaveCount(0);
  return box(garment(page, key));
}

async function stored(page: Page, collection: string): Promise<Record<string, unknown>[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(`fashionable/v1/${key}`);
    return raw ? JSON.parse(raw).records : [];
  }, collection);
}

async function wear(page: Page, top: string, bottom: string, shoes: string) {
  await option(page, 'base', top).click();
  await option(page, 'bottom', bottom).click();
  await option(page, 'shoes', shoes).click();
}

test.describe('mix screen', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await openMix(page);
  });

  test('picking a top, bottom and shoes dresses the mannequin and wakes the meter', async ({
    page,
  }) => {
    await expect(layers(page)).toHaveCount(0);
    await expect(page.getByTestId('mix-meter-label')).toHaveText('Pick a few pieces');
    await shot(page, 'empty');

    await option(page, 'base', 'tee-navy').click();
    await expect(layers(page)).toHaveCount(1);
    await option(page, 'bottom', 'jeans-dark').click();
    await option(page, 'shoes', 'sneakers-white').click();
    await expect(layers(page)).toHaveCount(3);
    await expect(garment(page, 'tee-navy')).toBeVisible();
    await expect(page.getByTestId('mix-meter-label')).toHaveText(
      /Great match|Good match|Worth a try/,
    );
    const score = Number(await page.getByTestId('mix-meter-score').innerText());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    await expect(page.getByTestId('mix-meter-bar')).toHaveAttribute(
      'aria-label',
      `Match ${score} out of 100`,
    );

    // Layers and outerwear appear on top.
    await option(page, 'mid', 'shirt-blue').click();
    await option(page, 'outer', 'jacket-denim').click();
    await expect(layers(page)).toHaveCount(5);
    await expect(option(page, 'outer', 'jacket-denim')).toHaveAttribute('aria-selected', 'true');
    await shot(page, 'full-outfit');

    // None empties the row, tapping the picked item again does too.
    await page.getByTestId('mix-option-outer-none').click();
    await expect(layers(page)).toHaveCount(4);
    await option(page, 'mid', 'shirt-blue').click();
    await expect(layers(page)).toHaveCount(3);

    // A different bottom replaces the old one and the meter follows.
    await option(page, 'bottom', 'skirt-olive').click();
    await expect(layers(page)).toHaveCount(3);
    await expect(garment(page, 'jeans-dark')).toHaveCount(0);
    await expect(garment(page, 'skirt-olive')).toBeVisible();
  });

  test('a weaker outfit shows its weak spots', async ({ page }) => {
    await option(page, 'onepiece', 'dress-green').click();
    await option(page, 'mid', 'shirt-blue').click();
    await option(page, 'outer', 'jacket-denim').click();
    await option(page, 'shoes', 'boots-black').click();
    await expect(page.getByTestId('mix-meter-label')).toBeVisible();
    await shot(page, 'meter');
  });

  test('a dress clears top and bottom, and a top clears the dress', async ({ page }) => {
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    await option(page, 'onepiece', 'dress-green').click();
    await expect(garment(page, 'dress-green')).toBeVisible();
    await expect(garment(page, 'tee-navy')).toHaveCount(0);
    await expect(garment(page, 'jeans-dark')).toHaveCount(0);
    await expect(garment(page, 'sneakers-white')).toBeVisible();
    await expect(page.getByTestId('mix-option-base-none')).toHaveAttribute('aria-selected', 'true');
    await option(page, 'bottom', 'jeans-dark').click();
    await expect(garment(page, 'dress-green')).toHaveCount(0);
    await expect(garment(page, 'jeans-dark')).toBeVisible();
  });

  test('locked rows survive Shuffle unlocked, and a row shuffle changes only its row', async ({
    page,
  }) => {
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    await page.getByTestId('mix-lock-base').click();
    await page.getByTestId('mix-lock-shoes').click();
    await expect(page.getByTestId('mix-lock-base')).toHaveAttribute('aria-label', 'Unlock Tops');
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('mix-shuffle').click();
      await expect(garment(page, 'tee-navy')).toBeVisible();
      await expect(garment(page, 'sneakers-white')).toBeVisible();
    }
    // A locked row cannot be shuffled on its own either.
    await expect(page.getByTestId('mix-shuffle-base')).toBeDisabled();

    await page.getByTestId('mix-lock-base').click();
    await page.getByTestId('mix-lock-shoes').click();
    if ((await option(page, 'bottom', 'jeans-dark').getAttribute('aria-selected')) !== 'true') {
      await option(page, 'bottom', 'jeans-dark').click();
    }
    await expect(option(page, 'bottom', 'jeans-dark')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('mix-shuffle-bottom').click();
    await expect(option(page, 'bottom', 'jeans-dark')).toHaveAttribute('aria-selected', 'false');
    await expect(garment(page, 'tee-navy')).toBeVisible();
    await expect(garment(page, 'sneakers-white')).toBeVisible();
  });

  test('tuck in top toggles', async ({ page }) => {
    await expect(page.getByTestId('mix-tuck')).toBeDisabled();
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    const z = async () =>
      page.evaluate(
        (tid) =>
          getComputedStyle(document.querySelector(`[data-testid="${tid}"]`) as Element).zIndex,
        `mannequin-item-${id('tee-navy')}`,
      );
    const before = await z();
    await page.getByTestId('mix-tuck').click();
    await expect(page.getByTestId('mix-tuck')).toHaveAttribute('aria-checked', 'true');
    expect(await z()).not.toBe(before);
  });

  test('select a garment, adjust it with the buttons, save the fit for the item, keep it after a reload', async ({
    page,
  }) => {
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    const mannequin = await box(page.getByTestId('mannequin'));
    const original = await settledBox(page, 'tee-navy');

    await settledBox(page, 'tee-navy');
    await garment(page, 'tee-navy').click();
    await expect(page.getByTestId('fit-bar')).toBeVisible();
    await expect(page.getByTestId('fit-bar')).toContainText('Navy tee');
    await expect(page.getByTestId('mix-rows')).toHaveCount(0);
    await shot(page, 'fit-bar');

    await page.getByTestId('fit-scale-up').click();
    await page.getByTestId('fit-scale-up').click();
    await page.getByTestId('fit-nudge-down').click();
    await page.getByTestId('fit-rotate-right').click();
    await expect(page.getByTestId('fit-scale-value')).toHaveText('110%');
    await expect(page.getByTestId('fit-rotation-value')).toHaveText('5°');
    const adjusted = await settledBox(page, 'tee-navy');
    expect(adjusted.width).toBeGreaterThan(original.width * 1.08);
    expect(adjusted.y + adjusted.height / 2).toBeGreaterThan(original.y + original.height / 2);

    await page.getByTestId('fit-save-item').click();
    await expect(page.getByTestId('fit-message')).toContainText('Saved for this item');
    await expect
      .poll(async () => JSON.stringify(await stored(page, 'items')))
      .toContain('"scale":1.1');

    await openMix(page);
    await option(page, 'base', 'tee-navy').click();
    await expect(garment(page, 'tee-navy')).toBeVisible();
    const m2 = await box(page.getByTestId('mannequin'));
    const after = await settledBox(page, 'tee-navy');
    expect(m2.width).toBeCloseTo(mannequin.width, 0);
    expect(after.width / m2.width).toBeCloseTo(adjusted.width / mannequin.width, 1);
    expect(after.width).toBeGreaterThan(original.width * 1.08);

    // Reset and save puts the item back to its default placement.
    await settledBox(page, 'tee-navy');
    await garment(page, 'tee-navy').click();
    await page.getByTestId('fit-reset').click();
    await page.getByTestId('fit-save-item').click();
    await expect
      .poll(async () => JSON.stringify(await stored(page, 'items')))
      .not.toContain('"scale":1.1');
    await page.getByTestId('fit-done').click();
    await expect(page.getByTestId('mix-rows')).toBeVisible();
    expect((await settledBox(page, 'tee-navy')).width).toBeCloseTo(original.width, 0);
  });

  test('limits: scale stops at 200% and rotation at 30 degrees', async ({ page }) => {
    await option(page, 'base', 'tee-navy').click();
    await settledBox(page, 'tee-navy');
    await garment(page, 'tee-navy').click();
    for (let i = 0; i < 25; i++) {
      if (await page.getByTestId('fit-scale-up').isEnabled())
        await page.getByTestId('fit-scale-up').click();
      if (await page.getByTestId('fit-rotate-left').isEnabled())
        await page.getByTestId('fit-rotate-left').click();
    }
    await expect(page.getByTestId('fit-scale-value')).toHaveText('200%');
    await expect(page.getByTestId('fit-rotation-value')).toHaveText('-30°');
    await expect(page.getByTestId('fit-scale-up')).toBeDisabled();
    await expect(page.getByTestId('fit-rotate-left')).toBeDisabled();
  });

  test('dragging with the mouse moves the selected garment live and keeps it there', async ({
    page,
  }) => {
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    await settledBox(page, 'tee-navy');
    await garment(page, 'tee-navy').click();
    await expect(page.getByTestId('fit-bar')).toBeVisible();
    const start = await settledBox(page, 'tee-navy');
    const cx = start.x + start.width / 2;
    const cy = start.y + start.height / 3;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 10, cy + 8, { steps: 4 });
    await page.mouse.move(cx + 30, cy + 20, { steps: 6 });
    // Live: the garment has already moved before the button is released.
    const during = await settledBox(page, 'tee-navy');
    expect(during.x - start.x).toBeGreaterThan(15);
    await page.mouse.move(cx + 40, cy + 30, { steps: 4 });
    await page.mouse.up();

    const end = await settledBox(page, 'tee-navy');
    expect(end.x - start.x).toBeGreaterThan(30);
    expect(end.x - start.x).toBeLessThan(46);
    expect(end.y - start.y).toBeGreaterThan(22);
    expect(end.y - start.y).toBeLessThan(36);
    expect(Math.abs(end.width - start.width)).toBeLessThan(1);
    // Still selected and the controls are enabled for what was dragged.
    await expect(page.getByTestId('fit-save-item')).toBeEnabled();
    await expect(page.getByTestId('fit-reset')).toBeEnabled();
    // The press that ended the drag did not count as a tap on another garment.
    await expect(page.getByTestId('fit-bar')).toContainText('Navy tee');
  });

  test('a drag does not start without a selected garment', async ({ page }) => {
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    const start = await settledBox(page, 'tee-navy');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 3);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 40, start.y + start.height / 3 + 30, {
      steps: 8,
    });
    await page.mouse.up();
    expect((await settledBox(page, 'tee-navy')).x).toBeCloseTo(start.x, 0);
  });

  test('"Just this outfit" is saved with the outfit, not with the item', async ({ page }) => {
    await wear(page, 'tee-navy', 'jeans-dark', 'sneakers-white');
    const original = await settledBox(page, 'tee-navy');
    await settledBox(page, 'tee-navy');
    await garment(page, 'tee-navy').click();
    await page.getByTestId('fit-scale-up').click();
    await page.getByTestId('fit-scale-up').click();
    await page.getByTestId('fit-save-outfit').click();
    await expect(page.getByTestId('fit-message')).toContainText('saved when you save the outfit');
    await page.getByTestId('fit-done').click();

    await page.getByTestId('mix-save').click();
    await page.getByTestId('mix-save-name').fill('Weekend');
    await page.getByTestId('mix-save-confirm').click();
    await expect(page.getByTestId('mix-status')).toContainText('Weekend');

    await expect.poll(async () => (await stored(page, 'outfits')).length).toBe(1);
    const [outfit] = await stored(page, 'outfits');
    expect(outfit).toMatchObject({ name: 'Weekend', source: 'manual', favorite: false });
    expect(outfit?.itemIds).toEqual(
      expect.arrayContaining([id('tee-navy'), id('jeans-dark'), id('sneakers-white')]),
    );
    expect(JSON.stringify(outfit?.fitOverrides)).toContain('"scale":1.1');
    // The item itself is untouched.
    expect(JSON.stringify(await stored(page, 'items'))).not.toContain('fitAdjust');

    // Reopen the saved outfit from the URL: items, and its own fit, come back.
    await openMix(page, `?outfitId=${outfit?.id}`);
    await expect(layers(page)).toHaveCount(3);
    await expect(page.getByTestId('mix-save')).toContainText('Update outfit');
    const reopened = await settledBox(page, 'tee-navy');
    const m = await box(page.getByTestId('mannequin'));
    expect(reopened.width / m.width).toBeGreaterThan((original.width / m.width) * 1.08);
  });
});

test('save, then update the same outfit', async ({ page }) => {
  await seed(page);
  await openMix(page);
  await expect(page.getByTestId('mix-save')).toBeDisabled();
  await wear(page, 'tee-white', 'trousers-grey', 'loafers-brown');
  await page.getByTestId('mix-save').click();
  await expect(page.getByTestId('mix-save-sheet')).toBeVisible();
  await page.getByTestId('mix-save-confirm').click();
  await expect(page.getByTestId('mix-status')).toHaveText('Outfit saved');
  await expect.poll(async () => (await stored(page, 'outfits')).length).toBe(1);
  await expect(page.getByTestId('mix-save')).toContainText('Update outfit');

  await option(page, 'outer', 'jacket-denim').click();
  await page.getByTestId('mix-save').click();
  await expect(page.getByTestId('mix-status')).toHaveText('Outfit updated');
  await expect
    .poll(async () => ((await stored(page, 'outfits'))[0]?.itemIds as string[]).length)
    .toBe(4);
  expect(await stored(page, 'outfits')).toHaveLength(1);
});

test('opens a saved outfit from ?outfitId, including tuck and fit overrides', async ({ page }) => {
  const at = '2026-02-01T10:00:00.000Z';
  await seed(page, [
    {
      id: 'saved-1',
      createdAt: at,
      updatedAt: at,
      name: 'Seeded look',
      itemIds: [id('shirt-blue'), id('trousers-grey'), id('loafers-brown')],
      source: 'manual',
      favorite: false,
      tucked: true,
      fitOverrides: { [id('trousers-grey')]: { dx: 0, dy: 0, scale: 1.3, rotation: 0 } },
    },
  ]);
  await openMix(page);
  const plain = await box(page.getByTestId('mannequin'));
  void plain;
  await openMix(page, '?outfitId=saved-1');
  await expect(layers(page)).toHaveCount(3);
  await expect(garment(page, 'trousers-grey')).toBeVisible();
  await expect(page.getByTestId('mix-tuck')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('mix-save')).toContainText('Update outfit');
  const m = await box(page.getByTestId('mannequin'));
  const trousers = await settledBox(page, 'trousers-grey');
  // Anchor width for a bottom is about the hips (340 units): 1.3x of that.
  expect(trousers.width / m.width).toBeGreaterThan(0.4);
  await expect(page.getByTestId('mix-missing')).toHaveCount(0);

  await openMix(page, '?outfitId=nope');
  await expect(page.getByTestId('mix-missing')).toBeVisible();
});

test('an empty closet invites adding a first piece', async ({ page }) => {
  await page.goto('/mix');
  await expect(page.getByTestId('mix-empty')).toBeVisible();
  await page.getByTestId('mix-empty-add').click();
  await expect(page.getByTestId('screen-add-item')).toBeVisible();
});

test('missing slots get an "add one" prompt', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const raw = localStorage.getItem('fashionable/v1/items') ?? '{}';
    const doc = JSON.parse(raw);
    doc.records = doc.records.filter((r: { category: string }) => r.category !== 'shoes');
    localStorage.setItem('fashionable/v1/items', JSON.stringify(doc));
  });
  await openMix(page);
  await expect(page.getByTestId('mix-row-shoes-empty')).toContainText('No shoes yet');
  await page.getByTestId('mix-add-shoes').click();
  await expect(page.getByTestId('screen-add-item')).toBeVisible();
});
