/**
 * Shared helpers for the scripts that drive the BUILT web app (dist/) with Playwright:
 * a static server that behaves like GitHub Pages, a phone-sized browser, "open this screen",
 * and the rigid-mode page trick. Used by fit-gallery.mjs and real-trial.mjs.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.tflite': 'application/octet-stream',
  '.task': 'application/octet-stream',
};

/** Serves `dist` like GitHub Pages (/mix -> mix.html, anything else -> 404.html). */
export async function startServer(dist) {
  const resolveFile = (urlPath) => {
    const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\.\.+/g, '');
    for (const c of [clean, `${clean}.html`, join(clean, 'index.html')]) {
      const f = join(dist, c);
      if (existsSync(f) && statSync(f).isFile()) return { file: f, status: 200 };
    }
    return { file: join(dist, '404.html'), status: 404 };
  };
  const server = createServer((req, res) => {
    const { file, status } = resolveFile(req.url ?? '/');
    if (!existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(status, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

export function launchBrowser() {
  const executablePath =
    process.env.PW_CHROMIUM_PATH ??
    (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath });
}

/** Goes to `path` until `testId` is visible (the stores read storage on load, so retry). */
export async function openTestId(page, base, path, testId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto(base + path);
    try {
      await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 4000 });
      return;
    } catch {
      /* try again */
    }
  }
  throw new Error(`Could not open ${path}`);
}

/** Pages whose fitted images cannot be encoded: the Mannequin keeps rigid placement. */
export async function rigidPage(context) {
  const page = await context.newPage();
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toBlob = (cb) => cb(null);
  });
  return page;
}

/** Draws `png` (base64) with its rig points labelled; returns nothing, screenshots `#c` to `file`. */
export async function drawRig(sheetPage, { png, points, title, file }) {
  await sheetPage.setViewportSize({ width: 700, height: 800 });
  await sheetPage.setContent(
    '<body style="margin:0;background:#fff"><canvas id="c"></canvas></body>',
  );
  await sheetPage.evaluate(
    async ({ png, points, title }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const k = Math.min(680 / img.width, 760 / img.height);
      const c = document.getElementById('c');
      c.width = img.width * k + 20;
      c.height = img.height * k + 40;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 10, 30, img.width * k, img.height * k);
      g.fillStyle = '#000';
      g.font = '14px sans-serif';
      g.fillText(title, 10, 18);
      g.font = '11px sans-serif';
      for (const [name, p] of Object.entries(points)) {
        const x = 10 + p.x * img.width * k;
        const y = 30 + p.y * img.height * k;
        g.fillStyle = name.endsWith('R') ? '#d00' : '#06c';
        g.beginPath();
        g.arc(x, y, 4, 0, 7);
        g.fill();
        g.fillStyle = '#000';
        g.fillText(name, x + 6, y - 4);
      }
    },
    { png, points, title },
  );
  await sheetPage.locator('#c').screenshot({ path: file });
}
