#!/usr/bin/env node
/**
 * Renders the "garments fitted to the body" gallery (docs/TRY_ON.md §12): five outfits on the
 * silhouette and, optionally, on a real photo, each drawn rigid (before) and fitted (after).
 *
 *   npm run build:web
 *   node scripts/fit-gallery.mjs <outDir> [--photo <path.jpg>] [--dist <dir>] [--debug-rigs]
 *
 * It serves the already-built `dist/` (or `--dist`) on a free port it starts itself and drives the
 * built app with the project's Playwright, so nothing here depends on the source tree except the
 * garment fixtures in e2e/fixtures/garments. With `--photo` it runs the REAL setup flow (pose
 * detection, crop, landmarks) on that picture; the first run downloads the pose model, so allow a
 * minute. Rigid pictures are made by stopping fitted images from being encoded, which makes the
 * Mannequin keep the old rigid placement.
 *
 * Output: fit-<outfit>-<silhouette|photo>-<rigid|fitted>.png (mannequin crops), fit-sheet.png
 * (rows = outfits; columns = silhouette rigid / fitted, photo rigid / fitted) and fit-zoom-*.png.
 * With --debug-rigs it also writes rig-<name>.png per fitted garment: the cutout with the rig points
 * the app detected (read back from the closet it saved them to) drawn and labelled.
 * The photo is only read; it is never copied anywhere.
 */
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const GARMENT_DIR = join(ROOT, 'e2e/fixtures/garments');
const ASPECTS = JSON.parse(readFileSync(join(GARMENT_DIR, 'aspects.json'), 'utf8'));

// ── arguments ────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const debugRigs = args.includes('--debug-rigs');
if (debugRigs) args.splice(args.indexOf('--debug-rigs'), 1);
const photo = take('--photo');
const dist = resolve(take('--dist') ?? 'dist');
const outDir = args[0] ? resolve(args[0]) : undefined;
if (!outDir) {
  console.error(
    'usage: node scripts/fit-gallery.mjs <outDir> [--photo <path.jpg>] [--dist <dir>] [--debug-rigs]',
  );
  process.exit(2);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build in ${dist}. Run "npm run build:web" first (or pass --dist).`);
  process.exit(2);
}
if (photo && !existsSync(photo)) {
  console.error(`Photo not found: ${photo}`);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

// ── what to draw ─────────────────────────────────────────────────────────────────────────────
/** `file` defaults to `key`; `fitted` marks the pieces that are warped to the body. */
const GARMENTS = {
  'tee-navy': {
    name: 'Navy tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#1f2a44',
    color: 'navy',
  },
  'tee-white': {
    name: 'White tee',
    category: 'top',
    subcategory: 'tshirt',
    layer: 'base',
    hex: '#f1eee6',
    color: 'white',
  },
  'shirt-blue': {
    name: 'Blue shirt',
    category: 'top',
    subcategory: 'shirt',
    layer: 'base',
    hex: '#5a7fb0',
    color: 'blue',
  },
  'sweater-blue': {
    file: 'shirt-blue',
    name: 'Blue sweater',
    category: 'top',
    subcategory: 'sweater',
    layer: 'mid',
    hex: '#5a7fb0',
    color: 'blue',
  },
  'jacket-denim': {
    name: 'Denim jacket',
    category: 'outerwear',
    subcategory: 'denim-jacket',
    hex: '#3d5a80',
    color: 'blue',
  },
  'jeans-dark': {
    name: 'Dark jeans',
    category: 'bottom',
    subcategory: 'jeans',
    hex: '#2b3f66',
    color: 'navy',
  },
  'trousers-grey': {
    name: 'Grey trousers',
    category: 'bottom',
    subcategory: 'trousers',
    hex: '#7a7d82',
    color: 'grey',
  },
  'skirt-olive': {
    name: 'Olive skirt',
    category: 'bottom',
    subcategory: 'skirt',
    hex: '#6b6b3a',
    color: 'olive',
  },
  'dress-green': {
    name: 'Green dress',
    category: 'onepiece',
    subcategory: 'day-dress',
    hex: '#3f7d4e',
    color: 'green',
  },
  'sneakers-white': {
    name: 'White sneakers',
    category: 'shoes',
    subcategory: 'sneakers',
    hex: '#f4f4f2',
    color: 'white',
  },
  'loafers-brown': {
    name: 'Brown loafers',
    category: 'shoes',
    subcategory: 'loafers',
    hex: '#6b4a2f',
    color: 'brown',
  },
  'boots-black': {
    name: 'Black boots',
    category: 'shoes',
    subcategory: 'chelsea-boots',
    hex: '#1b1b1d',
    color: 'black',
  },
};
/** Garment keys that are warped (the rest keep rigid placement). */
const FITTED = new Set([
  'tee-navy',
  'tee-white',
  'shirt-blue',
  'sweater-blue',
  'jacket-denim',
  'jeans-dark',
  'trousers-grey',
  'skirt-olive',
  'dress-green',
]);
const OUTFITS = [
  { name: 'tee-jeans-sneakers', keys: ['tee-navy', 'jeans-dark', 'sneakers-white'] },
  { name: 'shirt-trousers-loafers', keys: ['shirt-blue', 'trousers-grey', 'loafers-brown'] },
  {
    name: 'coat-sweater-jeans-boots',
    keys: ['sweater-blue', 'jacket-denim', 'jeans-dark', 'boots-black'],
  },
  { name: 'dress-boots', keys: ['dress-green', 'boots-black'] },
  { name: 'top-skirt-sneakers', keys: ['tee-white', 'skirt-olive', 'sneakers-white'] },
];
const itemId = (key) => `gallery-${key}`;
const outfitId = (name) => `gallery-outfit-${name}`;

// ── static server (like GitHub Pages: /mix -> mix.html, anything else -> 404.html) ───────────
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
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\.\.+/g, '');
  const candidates = [clean, `${clean}.html`, join(clean, 'index.html')];
  for (const c of candidates) {
    const f = join(dist, c);
    if (existsSync(f) && statSync(f).isFile()) return { file: f, status: 200 };
  }
  return { file: join(dist, '404.html'), status: 404 };
}
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
const BASE = `http://127.0.0.1:${server.address().port}`;

// ── browser helpers ──────────────────────────────────────────────────────────────────────────
const chromiumPath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chromiumPath });
const phone = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const wrap = (records) => JSON.stringify({ schemaVersion: 1, records });
function seedPayload() {
  const keys = Object.keys(GARMENTS);
  const at = '2026-01-01T10:00:00.000Z';
  const items = keys.map((key) => ({
    id: itemId(key),
    createdAt: at,
    updatedAt: at,
    name: GARMENTS[key].name,
    category: GARMENTS[key].category,
    subcategory: GARMENTS[key].subcategory,
    ...(GARMENTS[key].layer ? { layer: GARMENTS[key].layer } : {}),
    colors: [{ hex: GARMENTS[key].hex, share: 1, name: GARMENTS[key].color }],
    pattern: 'solid',
    patternBold: false,
    formality: 2,
    warmth: 2,
    rainOk: true,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: `${key}-o`, cutoutId: `${key}-c`, thumbId: `${key}-t` },
    cutout: { aspectRatio: ASPECTS[GARMENTS[key].file ?? key], hasAlpha: true },
  }));
  const outfits = OUTFITS.map((o) => ({
    id: outfitId(o.name),
    createdAt: at,
    updatedAt: at,
    name: o.name,
    itemIds: o.keys.map(itemId),
    source: 'manual',
    favorite: false,
  }));
  const profile = {
    id: 'gallery-profile',
    createdAt: at,
    updatedAt: at,
    bodyTemplateId: 'body-a',
    units: 'metric',
  };
  const images = keys.map((key) => ({
    ids: [`${key}-c`, `${key}-t`],
    b64: readFileSync(join(GARMENT_DIR, `${GARMENTS[key].file ?? key}.png`)).toString('base64'),
  }));
  return { images, items: wrap(items), outfits: wrap(outfits), profile: wrap([profile]) };
}

async function seed(page) {
  await page.goto(BASE + '/');
  await page.evaluate(async ({ images, items, outfits, profile }) => {
    await new Promise((ok, fail) => {
      const open = indexedDB.open('fashionable-images', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('images');
      open.onerror = () => fail(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('images', 'readwrite');
        for (const img of images) {
          const bytes = Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
          for (const id of img.ids)
            tx.objectStore('images').put(new Blob([bytes], { type: 'image/png' }), id);
        }
        tx.oncomplete = () => ok();
        tx.onerror = () => fail(tx.error);
      };
    });
    localStorage.setItem('fashionable/v1/items', items);
    localStorage.setItem('fashionable/v1/outfits', outfits);
    localStorage.setItem('fashionable/v1/profile', profile);
  }, seedPayload());
}

async function openTestId(page, path, testId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.goto(BASE + path);
    try {
      await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 4000 });
      return;
    } catch {
      /* the stores read storage on load; try again */
    }
  }
  throw new Error(`Could not open ${path}`);
}

/** Pages whose fitted images cannot be encoded: the Mannequin keeps rigid placement. */
async function rigidPage(context) {
  const page = await context.newPage();
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.toBlob = (cb) => cb(null);
  });
  return page;
}

/** Real setup flow on the photo: guide, pick, detect, (place by hand if needed), save. */
async function setUpPhoto(page, file) {
  await openTestId(page, '/profile', 'screen-profile');
  await page.getByTestId('profile-tryon-add').click();
  await page.getByTestId('me-guide').waitFor();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('me-choose-photo').click();
  await (await chooser).setFiles(file);
  const correct = page.getByTestId('me-correct');
  const byHand = page.getByTestId('me-by-hand');
  await correct.or(byHand).waitFor({ timeout: 180_000 });
  let how = 'detected';
  if (await byHand.isVisible()) {
    how = 'by hand (detection found no person)';
    await byHand.click();
    await correct.waitFor();
  }
  await page.screenshot({ path: join(outDir, 'fit-photo-landmarks.png') });
  await page.getByTestId('me-save').click();
  await page.getByTestId('profile-tryon-thumb').waitFor({ timeout: 30_000 });
  console.log(`photo set up: landmarks ${how}`);
}

async function shoot(page, mode, variant) {
  const files = {};
  for (const outfit of OUTFITS) {
    await openTestId(page, `/outfits/${outfitId(outfit.name)}`, 'screen-outfit-detail');
    for (const key of outfit.keys.filter((k) => FITTED.has(k))) {
      const id = itemId(key);
      if (variant === 'fitted') {
        await page.getByTestId(`mannequin-fitted-${id}`).waitFor({ timeout: 30_000 });
        await page
          .getByTestId(`mannequin-image-${id}`)
          .waitFor({ state: 'detached', timeout: 5000 });
      } else {
        await page.getByTestId(`mannequin-image-${id}`).waitFor({ timeout: 30_000 });
      }
    }
    if (mode === 'photo') await page.getByTestId('outfit-detail-mannequin-backdrop').waitFor();
    await page.waitForTimeout(700);
    const file = join(outDir, `fit-${outfit.name}-${mode}-${variant}.png`);
    await page.getByTestId('outfit-detail-mannequin').screenshot({ path: file });
    files[outfit.name] = file;
  }
  return files;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────
const shots = { silhouette: {}, photo: {} };
let rigItems = [];
try {
  // Silhouette: no photo in the profile.
  for (const variant of ['rigid', 'fitted']) {
    const context = await browser.newContext(phone);
    const page = variant === 'rigid' ? await rigidPage(context) : await context.newPage();
    await seed(page);
    shots.silhouette[variant] = await shoot(page, 'silhouette', variant);
    if (variant === 'fitted' && debugRigs) {
      await page.waitForTimeout(2500); // rigs are saved back to the closet after a short pause
      rigItems = await page.evaluate(
        () => JSON.parse(localStorage.getItem('fashionable/v1/items') ?? '{}').records ?? [],
      );
    }
    await context.close();
  }
  // Photo: one context, so the saved photo is shared by the rigid and the fitted page.
  if (photo) {
    const context = await browser.newContext(phone);
    const page = await context.newPage();
    await seed(page);
    await setUpPhoto(page, photo);
    shots.photo.fitted = await shoot(page, 'photo', 'fitted');
    const rigid = await rigidPage(context);
    shots.photo.rigid = await shoot(rigid, 'photo', 'rigid');
    await context.close();
  }

  // Sheet and zooms are drawn by the browser itself, so no image library is needed.
  const data = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const columns = [
    ['silhouette', 'rigid'],
    ['silhouette', 'fitted'],
    ...(photo
      ? [
          ['photo', 'rigid'],
          ['photo', 'fitted'],
        ]
      : []),
  ];
  const cell = 240; // css px per mannequin crop in the sheet
  const sheet = await browser.newContext({
    viewport: { width: columns.length * (cell + 8) + 8, height: 600 },
    deviceScaleFactor: 2,
  });
  const sp = await sheet.newPage();
  const header = columns.map(([m, v]) => `<div class="h">${m} ${v}</div>`).join('');
  const rows = OUTFITS.map(
    (o) =>
      `<div class="label">${o.name}</div><div class="row">${columns
        .map(([m, v]) => `<img src="${data(shots[m][v][o.name])}">`)
        .join('')}</div>`,
  ).join('');
  await sp.setContent(`<style>body{margin:0;padding:8px;font:12px sans-serif;background:#fff}
    .head,.row{display:flex;gap:8px}.h{width:${cell}px;font-weight:700;text-align:center}
    .label{margin:6px 0 2px;color:#555}img{width:${cell}px;height:${cell * 2}px}</style>
    <div class="head">${header}</div>${rows}`);
  await sp.screenshot({ path: join(outDir, 'fit-sheet.png'), fullPage: true });

  // Zooms: the shirt's sleeve (outfit 2) and the jeans' edge (outfit 1), fitted, enlarged 2x.
  const zoom = async (name, file, box) => {
    const [x, y, w, h] = box; // in the 480 x 960 device-pixel crop
    await sp.setViewportSize({ width: w * 2, height: h * 2 });
    await sp.setContent(`<style>body{margin:0}div{width:${w * 2}px;height:${h * 2}px;overflow:hidden}
      img{width:960px;height:1920px;margin:${-y * 2}px 0 0 ${-x * 2}px;image-rendering:pixelated}</style>
      <div><img src="${data(file)}"></div>`);
    await sp.screenshot({ path: join(outDir, name) });
  };
  const modes = photo ? ['silhouette', 'photo'] : ['silhouette'];
  for (const m of modes) {
    await zoom(
      `fit-zoom-shirt-sleeve-${m}.png`,
      shots[m].fitted['shirt-trousers-loafers'],
      [20, 160, 440, 440],
    );
    await zoom(
      `fit-zoom-jeans-edge-${m}.png`,
      shots[m].fitted['tee-jeans-sneakers'],
      [60, 560, 360, 400],
    );
  }
  if (debugRigs) {
    const seen = new Set();
    for (const item of rigItems) {
      const key = item.id.replace(/^gallery-/, '');
      const file = GARMENTS[key]?.file ?? key;
      if (!item.fit || seen.has(file)) continue;
      seen.add(file);
      const png = readFileSync(join(GARMENT_DIR, `${file}.png`)).toString('base64');
      await sp.setViewportSize({ width: 700, height: 800 });
      await sp.setContent('<body style="margin:0;background:#fff"><canvas id="c"></canvas></body>');
      await sp.evaluate(
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
        {
          png,
          points: item.fit.points,
          title: `${file} (${item.fit.kind}, confidence ${item.fit.confidence.toFixed(2)})`,
        },
      );
      await sp.locator('#c').screenshot({ path: join(outDir, `rig-${file}.png`) });
    }
  }
  writeFileSync(join(outDir, 'fit-gallery.txt'), `built from ${dist}\nphoto: ${photo ?? 'none'}\n`);
  console.log(`Wrote the gallery to ${outDir} (fit-sheet.png, fit-zoom-*.png, per-outfit crops).`);
} finally {
  await browser.close();
  server.close();
}
