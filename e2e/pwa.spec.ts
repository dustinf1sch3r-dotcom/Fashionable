import { expect, test } from '@playwright/test';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}
interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

/** Width and height from a PNG's IHDR chunk (bytes 16-23, big endian). */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('index.html links a valid web-app manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const url = new URL(href ?? '', page.url()).toString();
  const res = await request.get(url);
  expect(res.status()).toBe(200);
  const manifest = (await res.json()) as Manifest;

  expect(manifest.name).toBe('Fashionable');
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  // start_url and scope stay inside the folder that holds the manifest (sub-path safe).
  const base = new URL('.', url).toString();
  expect(new URL(manifest.start_url, url).toString()).toBe(base);
  expect(new URL(manifest.scope, url).toString()).toBe(base);

  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
  for (const icon of manifest.icons) {
    const r = await request.get(new URL(icon.src, url).toString());
    expect(r.status(), icon.src).toBe(200);
    const [w, h] = icon.sizes.split('x').map(Number);
    expect(pngSize(await r.body()), icon.src).toEqual({ width: w, height: h });
  }
});

test('index.html has the iOS and theme meta tags', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(1);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );

  const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(href).toBeTruthy();
  const r = await request.get(new URL(href ?? '', page.url()).toString());
  expect(r.status()).toBe(200);
  expect(pngSize(await r.body())).toEqual({ width: 180, height: 180 });

  const favicon = await page.locator('link[rel~="icon"]').first().getAttribute('href');
  expect(favicon).toBeTruthy();
  expect((await request.get(new URL(favicon ?? '', page.url()).toString())).status()).toBe(200);
});

// A custom root HTML must still carry Expo's injected scripts, or the page is static markup only.
test('the page still loads its JavaScript bundle', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('script[src*="_expo/static/js"]').count()).toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'Mix' }).tap();
  await expect(page.getByTestId('screen-mix')).toBeVisible();
});
