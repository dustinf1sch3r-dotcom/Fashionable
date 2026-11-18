import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'e2e/fixtures/silhouette-500x1000.png';
// The first detection downloads the model and runtime (about 24 MB) and starts WebAssembly.
const DETECT_TIMEOUT = 90_000;

async function choosePhoto(page: Page): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('dev-pose-choose').click();
  await (await chooser).setFiles(FIXTURE);
}

test('the pose runtime is not downloaded until a photo is analysed', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  const scripts: string[] = [];
  page.on('response', async (r) => {
    if (r.url().endsWith('.js') && r.url().includes('/_expo/')) scripts.push(await r.text());
  });
  await page.goto('/dev/pose');
  await expect(page.getByTestId('screen-dev-pose')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(urls.filter((u) => /\/mediapipe\/|\.task(\?|$)/.test(u))).toEqual([]);
  // Nothing of tasks-vision is bundled into the app's own JavaScript.
  expect(scripts.length).toBeGreaterThan(0);
  for (const code of scripts)
    expect(code).not.toMatch(/HAND_CONNECTIONS|FaceLandmarker|GestureRecognizer/);
});

test('detector loads from our own site, runs on the fixture and crops to 1:2', async ({
  page,
}, testInfo) => {
  test.setTimeout(DETECT_TIMEOUT + 30_000);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  const sizes: Record<string, number> = {};
  page.on('response', async (r) => {
    if (/\/mediapipe\/|\.task(\?|$)/.test(r.url())) {
      sizes[new URL(r.url()).pathname] = Number(r.headers()['content-length'] ?? 0);
    }
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/dev/pose');
  await choosePhoto(page);
  const status = page.getByTestId('dev-pose-status');
  await expect(status.or(page.getByTestId('dev-pose-error'))).toBeVisible({
    timeout: DETECT_TIMEOUT,
  });
  await expect(page.getByTestId('dev-pose-error')).toHaveCount(0);
  expect(errors).toEqual([]);

  // Model, runtime script and WASM come from our own origin, not a CDN.
  const external = urls.filter((u) => /^https?:/.test(u) && !u.startsWith('http://localhost'));
  expect(external).toEqual([]);
  expect(urls.some((u) => u.includes('/models/pose_landmarker_full.task'))).toBe(true);
  expect(urls.some((u) => u.includes('/mediapipe/vision_wasm_internal.wasm'))).toBe(true);
  expect(urls.some((u) => u.includes('/mediapipe/vision_bundle.js'))).toBe(true);

  // Either nobody was found, or 33 keypoints and a sane crop; it must not throw.
  const state = (await status.textContent()) ?? '';
  expect(['done', 'no-keypoints']).toContain(state);
  if (state === 'done') {
    await expect(page.getByTestId('dev-pose-keypoints')).toHaveText('33');
    const crop = await page.getByTestId('dev-pose-crop').boundingBox();
    expect(crop).not.toBeNull();
    if (crop) expect(Math.abs(crop.height / crop.width - 2)).toBeLessThan(0.02);
    const landmarks = JSON.parse(
      (await page.getByTestId('dev-pose-landmarks-json').textContent()) ?? '{}',
    ) as Record<string, { x: number; y: number }>;
    expect(Object.keys(landmarks)).toHaveLength(18);
    // Head above feet, left of the viewer is smaller x, everything near the 1000 x 2000 canvas.
    expect(landmarks.headTop.y).toBeLessThan(landmarks.footL.y);
    expect(landmarks.shoulderL.x).toBeLessThan(landmarks.shoulderR.x);
    for (const p of Object.values(landmarks)) {
      expect(p.x).toBeGreaterThan(-500);
      expect(p.x).toBeLessThan(1500);
      expect(p.y).toBeGreaterThan(-200);
      expect(p.y).toBeLessThan(2200);
    }
  }
  testInfo.annotations.push({
    type: 'timing',
    description: `${(await page.getByTestId('dev-pose-timing').textContent()) ?? ''}; bytes ${JSON.stringify(sizes)}`,
  });
  await page.screenshot({ path: testInfo.outputPath('pose.png'), fullPage: true });
});
