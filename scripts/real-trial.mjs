#!/usr/bin/env node
/**
 * Real-photo trial of the WHOLE pipeline (docs/TRY_ON.md §11–§12), driving the built app:
 *
 *   npm run build:web
 *   node scripts/real-trial.mjs <outDir> --garments <manifest.json> --people <img1> [<img2> ...]
 *        [--outfits <outfits.json>] [--dist dist]
 *
 * manifest.json   [{ "file": "/abs/shirt.jpg", "id": "tee1", "category": "top", "subcategory": "tshirt" }, ...]
 * outfits.json    [{ "name": "casual", "items": ["tee1", "jeans1"] }, ...]  (optional; otherwise up
 *                 to four outfits are composed from what was added: top+bottom+shoes, a dress,
 *                 a layered outfit with an outer layer, a second top+bottom)
 *
 * 1. Every garment goes through the REAL add-item UI: kind on the capture guide, file chooser,
 *    wait for the background-removal worker, category / subcategory chips, name = manifest id,
 *    save (which also detects the rig). Cutout and rig are read back from the app's storage.
 * 2. Every person image goes through the REAL Me flow (guide, choose photo, pose detection,
 *    correction screen, save). If detection finds no person the trial records that and falls back
 *    to manual placement.
 * 3. Every person x outfit is rendered on the outfit detail page, rigid (fitted images disabled)
 *    and fitted, and composed into trial-sheet.png (rows = outfits, columns = person rigid|fitted).
 *
 * Output: garment-<id>-cutout.png, garment-<id>-rig.png, person-<n>-landmarks.png,
 * outfit-<name>-person-<n>-<rigid|fitted>.png, trial-sheet.png, trial-report.json/.txt.
 * Input photos are only read from the paths given; nothing is copied into the repo.
 */
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  PHONE,
  drawRig,
  launchBrowser,
  openTestId,
  rigidPage,
  startServer,
} from './lib/harness.mjs';

// ── arguments ────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  return args.splice(i, 2)[1];
};
const takeMany = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return [];
  let j = i + 1;
  while (j < args.length && !args[j].startsWith('--')) j++;
  return args.splice(i, j - i).slice(1);
};
const garmentsFile = take('--garments');
const outfitsFile = take('--outfits');
const dist = resolve(take('--dist') ?? 'dist');
const people = takeMany('--people').map((p) => resolve(p));
const outDir = args[0] ? resolve(args[0]) : undefined;
const usage =
  'usage: node scripts/real-trial.mjs <outDir> --garments <manifest.json> --people <img1> [<img2> ...] [--outfits <outfits.json>] [--dist dist]';
if (!outDir || !garmentsFile || people.length === 0) {
  console.error(usage);
  process.exit(2);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build in ${dist}. Run "npm run build:web" first (or pass --dist).`);
  process.exit(2);
}
const garments = JSON.parse(readFileSync(garmentsFile, 'utf8'));
for (const g of garments) {
  if (!existsSync(g.file)) {
    console.error(`Garment photo not found: ${g.file}`);
    process.exit(2);
  }
}
for (const p of people) {
  if (!existsSync(p)) {
    console.error(`Person photo not found: ${p}`);
    process.exit(2);
  }
}
const outfitSpec = outfitsFile ? JSON.parse(readFileSync(outfitsFile, 'utf8')) : undefined;
mkdirSync(outDir, { recursive: true });

const { server, base: BASE } = await startServer(dist);
const browser = await launchBrowser();
const open = (page, path, testId) => openTestId(page, BASE, path, testId);
const log = (...a) => console.log(...a);
const ms = (t0) => Math.round(performance.now() - t0);

const report = { dist, garments: {}, people: [], outfits: [], renders: [], warnings: [] };

/** All stored records of a collection (AsyncStorage maps to localStorage). */
const readRecords = (page, name) =>
  page.evaluate(
    (n) => JSON.parse(localStorage.getItem(`fashionable/v1/${n}`) ?? '{}').records ?? [],
    name,
  );

/** Reads an image blob out of the app's IndexedDB; returns base64 plus an alpha summary. */
const readImage = (page, id) =>
  page.evaluate(async (imageId) => {
    const db = await new Promise((ok, fail) => {
      const req = indexedDB.open('fashionable-images');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
    const blob = await new Promise((ok, fail) => {
      const req = db.transaction('images', 'readonly').objectStore('images').get(imageId);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
    if (!blob) return null;
    const b64 = await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.readAsDataURL(blob);
    });
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 16) clear++;
    return {
      b64,
      type: blob.type,
      width: bmp.width,
      height: bmp.height,
      transparentFraction: clear / (d.length / 4),
    };
  }, id);

// ── 1. garments through the real add-item flow ───────────────────────────────────────────────
const phone = PHONE;
let stored; // storage state (localStorage + IndexedDB) after all garments are added
const sheetCtx = await browser.newContext({ deviceScaleFactor: 2 });
const sheet = await sheetCtx.newPage();

try {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await open(page, '/closet/add', 'add-item-pick');
  let first = true;
  for (const g of garments) {
    const rec = { file: g.file, category: g.category, subcategory: g.subcategory ?? null };
    report.garments[g.id] = rec;
    try {
      if (!first) {
        // client-side navigation keeps the loaded background-removal model warm
        if (page.url().includes('/closet/add')) await open(page, '/closet/add', 'add-item-pick');
        else if (
          await page
            .getByTestId('closet-add-button')
            .isVisible()
            .catch(() => false)
        )
          await page.getByTestId('closet-add-button').click();
        else await open(page, '/closet/add', 'add-item-pick');
        await page.getByTestId('add-item-pick').waitFor();
      }
      rec.cold = first;
      first = false;
      await page.getByTestId(`add-item-kind-${g.category}`).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByTestId('add-item-choose-photo').click();
      const t0 = performance.now();
      await (await chooser).setFiles(g.file);
      const form = page.getByTestId('add-item-form');
      const err = page.getByTestId('add-item-error');
      await form.or(err).waitFor({ timeout: 240_000 });
      rec.cutoutMs = ms(t0);
      if (!(await form.isVisible()))
        throw new Error('add flow showed an error instead of the form');
      await page.getByTestId(`add-item-category-${g.category}`).click();
      if (g.subcategory) await page.getByTestId(`add-item-subcategory-${g.subcategory}`).click();
      await page.getByTestId('add-item-name').fill(g.id);
      rec.formColour =
        (await page
          .getByTestId('add-item-colour-primary')
          .textContent()
          .catch(() => null)) ?? null;
      await page.getByTestId('add-item-save').click();
      await page.getByTestId('screen-closet').waitFor({ timeout: 60_000 });
      log(`garment ${g.id}: added (${rec.cutoutMs} ms)`);
    } catch (e) {
      rec.error = String(e.message ?? e).split('\n')[0];
      log(`garment ${g.id}: FAILED ${rec.error}`);
      await page.screenshot({ path: join(outDir, `garment-${g.id}-failed.png`) }).catch(() => {});
    }
  }
  // Read back what the app stored.
  const items = await readRecords(page, 'items');
  for (const g of garments) {
    const rec = report.garments[g.id];
    const item = items.find((i) => i.name === g.id && i.status !== 'deleted' && !i.deletedAt);
    if (!item) {
      rec.stored = false;
      continue;
    }
    rec.stored = true;
    rec.item = { ...item, fit: item.fit && { ...item.fit, points: undefined } };
    rec.itemId = item.id;
    rec.hasAlpha = item.cutout?.hasAlpha ?? false;
    rec.aspectRatio = item.cutout?.aspectRatio;
    rec.colours = (item.colors ?? []).map((c) => `${c.name} ${c.hex}`);
    rec.layer = item.layer ?? null;
    const cut = await readImage(page, item.images.cutoutId);
    if (cut) {
      rec.cutoutSize = `${cut.width}x${cut.height}`;
      rec.transparentFraction = Number(cut.transparentFraction.toFixed(3));
      writeFileSync(join(outDir, `garment-${g.id}-cutout.png`), Buffer.from(cut.b64, 'base64'));
    }
    if (item.fit) {
      rec.rig = {
        kind: item.fit.kind,
        confidence: Number(item.fit.confidence.toFixed(3)),
        points: Object.keys(item.fit.points).length,
      };
      if (cut) {
        await drawRig(sheet, {
          png: cut.b64,
          points: item.fit.points,
          title: `${g.id} (${item.fit.kind}, confidence ${item.fit.confidence.toFixed(2)})`,
          file: join(outDir, `garment-${g.id}-rig.png`),
        });
      }
    } else rec.rig = null;
  }
  // storageState() does not carry the image Blobs, so snapshot localStorage and every image by hand.
  stored = {
    local: await page.evaluate(() =>
      Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
    ),
    images: [],
  };
  for (const item of items) {
    if (item.status === 'deleted') continue;
    for (const id of Object.values(item.images)) {
      const img = await readImage(page, id);
      if (img) stored.images.push({ id, b64: img.b64, type: img.type });
    }
  }
  await ctx.close();
} catch (e) {
  report.warnings.push(`garment phase aborted: ${e.message}`);
  log('garment phase aborted:', e.message);
}

// ── outfits ──────────────────────────────────────────────────────────────────────────────────
const byCat = (cat) => garments.filter((g) => report.garments[g.id]?.itemId && g.category === cat);
function composeOutfits() {
  const tops = byCat('top');
  const bottoms = byCat('bottom');
  const shoes = byCat('shoes');
  const dresses = byCat('onepiece');
  const outers = byCat('outerwear');
  const out = [];
  const add = (name, ids) => {
    const items = ids.filter(Boolean).map((g) => g.id);
    if (items.length >= 2 && !out.some((o) => o.items.join() === items.join()))
      out.push({ name, items });
  };
  if (tops[0] && bottoms[0]) add('top-bottom-shoes', [tops[0], bottoms[0], shoes[0]]);
  if (dresses[0]) add('dress', [dresses[0], shoes[1] ?? shoes[0]]);
  if (outers[0] && (tops[0] || dresses[0]))
    add(
      'layered',
      dresses[0] && !tops[0]
        ? [dresses[0], outers[0], shoes[0]]
        : [tops[0], outers[0], bottoms[0], shoes[0]],
    );
  if (tops.length > 1 && bottoms.length)
    add('second-top-bottom', [tops[1], bottoms[1] ?? bottoms[0], shoes[1] ?? shoes[0]]);
  return out.slice(0, 4);
}
const outfits = (outfitSpec ?? composeOutfits()).filter((o) => {
  const ok = o.items.every((id) => report.garments[id]?.itemId);
  if (!ok) report.warnings.push(`outfit "${o.name}" skipped: an item was not added`);
  return ok;
});
report.outfits = outfits;
log(`outfits: ${outfits.map((o) => o.name).join(', ') || 'none'}`);

// ── 2 + 3. each person through the real Me flow, then render the outfits ────────────────────
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const shots = {}; // shots[personIndex][outfitName] = {rigid, fitted}

/** Puts the closet (items + images) built in phase 1 into a fresh browser context. */
async function restoreCloset(page) {
  await page.goto(BASE + '/');
  await page.evaluate(async ({ local, images }) => {
    await new Promise((ok, fail) => {
      const req = indexedDB.open('fashionable-images', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('images');
      req.onerror = () => fail(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('images', 'readwrite');
        for (const img of images) {
          const bytes = Uint8Array.from(atob(img.b64), (c) => c.charCodeAt(0));
          tx.objectStore('images').put(new Blob([bytes], { type: img.type }), img.id);
        }
        tx.oncomplete = () => ok();
        tx.onerror = () => fail(tx.error);
      };
    });
    for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
  }, stored);
}

async function setUpPerson(page, file, n, rec) {
  await open(page, '/profile', 'screen-profile');
  await page.getByTestId('profile-tryon-add').click();
  await page.getByTestId('me-guide').waitFor();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('me-choose-photo').click();
  const t0 = performance.now();
  await (await chooser).setFiles(file);
  const correct = page.getByTestId('me-correct');
  const byHand = page.getByTestId('me-by-hand');
  const failed = page.getByTestId('me-detector-failed');
  await correct.or(byHand).or(failed).waitFor({ timeout: 240_000 });
  rec.poseMs = ms(t0);
  rec.how = 'detected';
  if (await correct.isVisible()) {
    /* detection worked */
  } else if (await failed.isVisible().catch(() => false)) {
    rec.how = 'detector failed to run (manual placement)';
    await byHand.click();
    await correct.waitFor();
  } else {
    rec.how = 'no person found (manual placement)';
    await byHand.click();
    await correct.waitFor();
  }
  await page.waitForTimeout(600);
  rec.problems = await page
    .locator('[data-testid^="me-problem-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('me-problem-', '')));
  rec.problemText = await page
    .getByTestId('me-problems')
    .innerText()
    .then((t) => t.replace(/\s+/g, ' ').trim())
    .catch(() => '');
  await page.screenshot({ path: join(outDir, `person-${n}-landmarks.png`) });
  await page.getByTestId('me-save').click();
  await page.getByTestId('profile-tryon-thumb').waitFor({ timeout: 30_000 });
}

async function seedOutfits(page) {
  const at = '2026-01-01T10:00:00.000Z';
  const records = outfits.map((o) => ({
    id: `trial-outfit-${slug(o.name)}`,
    createdAt: at,
    updatedAt: at,
    name: o.name,
    itemIds: o.items.map((id) => report.garments[id].itemId),
    source: 'manual',
    favorite: false,
  }));
  await page.evaluate(
    (r) =>
      localStorage.setItem(
        'fashionable/v1/outfits',
        JSON.stringify({ schemaVersion: 1, records: r }),
      ),
    records,
  );
}

/** True while a deep link to a dynamic route loads (see HOST FALLBACK in the report). */
const nav = { deepLink: false };

async function shoot(page, n, outfit, variant, rec) {
  const t0 = performance.now();
  nav.deepLink = true;
  await open(page, `/outfits/trial-outfit-${slug(outfit.name)}`, 'screen-outfit-detail');
  await page.waitForTimeout(1200); // let late hydration messages arrive while the flag is set
  nav.deepLink = false;
  const fittedIds = [];
  for (const id of outfit.items) {
    if (report.garments[id].rig) fittedIds.push(report.garments[id].itemId);
  }
  if (variant === 'fitted') {
    for (const itemId of fittedIds) {
      try {
        await page.getByTestId(`mannequin-fitted-${itemId}`).waitFor({ timeout: 30_000 });
      } catch {
        rec.notFitted = [...(rec.notFitted ?? []), itemId];
        rec.mannequinIds = await page
          .locator('[data-testid^="mannequin-"]')
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
      }
    }
  } else {
    await page.getByTestId('outfit-detail-mannequin').waitFor();
    await page.waitForTimeout(1500);
  }
  await page
    .getByTestId('outfit-detail-mannequin-backdrop')
    .waitFor({ timeout: 10_000 })
    .catch(() => {
      rec.noBackdrop = true;
    });
  await page.waitForTimeout(700);
  rec[`${variant}Ms`] = ms(t0);
  const file = join(outDir, `outfit-${slug(outfit.name)}-person-${n}-${variant}.png`);
  await page.getByTestId('outfit-detail-mannequin').screenshot({ path: file });
  return file;
}

try {
  for (let i = 0; i < people.length; i++) {
    const n = i + 1;
    const rec = { n, file: people[i], name: basename(people[i]) };
    report.people.push(rec);
    shots[n] = {};
    try {
      const ctx = await browser.newContext(phone);
      const page = await ctx.newPage();
      rec.console = [];
      rec.hostFallback = [];
      // A deep link to a dynamic route (/outfits/<id>) is answered by 404.html with status 404 and
      // hydrated against the wrong prerendered page (React #418): both are how GitHub Pages
      // behaves, not app bugs, so they are listed apart while `nav.deepLink` is set.
      const note = (line) => {
        const list = nav.deepLink ? rec.hostFallback : rec.console;
        if (list.length < 20) list.push(line);
      };
      page.on('console', (m) => {
        if (['error', 'warning'].includes(m.type())) note(`${m.type()}: ${m.text().slice(0, 300)}`);
      });
      page.on('pageerror', (e) => note(`pageerror: ${String(e.message).slice(0, 300)}`));
      page.on('response', (r) => {
        if (r.status() >= 400) note(`HTTP ${r.status()}: ${r.url()}`);
      });
      if (stored) await restoreCloset(page);
      await setUpPerson(page, people[i], n, rec);
      log(
        `person ${n}: ${rec.how}, pose ${rec.poseMs} ms, problems: ${rec.problems.join(',') || 'none'}`,
      );
      await seedOutfits(page);
      const rigid = await rigidPage(ctx);
      for (const o of outfits) {
        const r = { person: n, outfit: o.name };
        report.renders.push(r);
        try {
          shots[n][o.name] = {
            fitted: await shoot(page, n, o, 'fitted', r),
            rigid: await shoot(rigid, n, o, 'rigid', r),
          };
          log(
            `  ${o.name}: fitted ${r.fittedMs} ms${r.notFitted ? ' (some items not fitted)' : ''}`,
          );
        } catch (e) {
          r.error = String(e.message ?? e).split('\n')[0];
          log(`  ${o.name}: FAILED ${r.error}`);
        }
      }
      await ctx.close();
    } catch (e) {
      rec.error = String(e.message ?? e).split('\n')[0];
      log(`person ${n}: FAILED ${rec.error}`);
    }
  }

  // ── sheet ────────────────────────────────────────────────────────────────────────────────
  const read = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const cell = 200;
  const cols = people.length * 2;
  await sheet.setViewportSize({ width: cols * (cell + 6) + 140, height: 600 });
  const head = people
    .flatMap((p, i) =>
      [`P${i + 1} rigid`, `P${i + 1} fitted`].map((t) => `<div class="h">${t}</div>`),
    )
    .join('');
  const rows = outfits
    .map((o) => {
      const cells = people
        .flatMap((_, i) => {
          const s = shots[i + 1]?.[o.name];
          return ['rigid', 'fitted'].map((v) =>
            s?.[v] ? `<img src="${read(s[v])}">` : '<div class="miss">failed</div>',
          );
        })
        .join('');
      return `<div class="row"><div class="label">${o.name}<br><small>${o.items.join(' + ')}</small></div>${cells}</div>`;
    })
    .join('');
  await sheet.setContent(`<style>body{margin:0;padding:8px;font:12px sans-serif;background:#fff}
    .head,.row{display:flex;gap:6px;margin-bottom:6px}.h{width:${cell}px;font-weight:700;text-align:center}
    .sp{width:128px}.label{width:128px;color:#333;font-weight:600;flex:none}small{font-weight:400;color:#666}
    img,.miss{width:${cell}px;height:${cell * 2}px;flex:none}.miss{background:#eee;display:flex;align-items:center;justify-content:center;color:#a00}</style>
    <div class="head"><div class="sp"></div>${head}</div>${rows}`);
  await sheet.screenshot({ path: join(outDir, 'trial-sheet.png'), fullPage: true });
} finally {
  await sheetCtx.close();
  await browser.close();
  server.close();
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
writeFileSync(join(outDir, 'trial-report.json'), JSON.stringify(report, null, 2));
const lines = [`Real trial, build ${dist}`, '', 'GARMENTS'];
for (const [id, g] of Object.entries(report.garments)) {
  lines.push(
    g.error || !g.stored
      ? `  ${id}: FAILED ${g.error ?? 'not stored'}`
      : `  ${id} (${g.category}/${g.subcategory}): cutout ${g.hasAlpha ? 'ok' : 'NO ALPHA'} ` +
          `(${g.cutoutSize}, ${Math.round((g.transparentFraction ?? 0) * 100)}% transparent, ${g.cutoutMs} ms${g.cold ? ', cold' : ''}); ` +
          `colour ${(g.colours ?? []).join('/') || 'none'}; ` +
          (g.rig
            ? `rig ${g.rig.kind} confidence ${g.rig.confidence} (${g.rig.points} points)`
            : 'no rig'),
  );
}
lines.push('', 'PEOPLE');
for (const p of report.people) {
  lines.push(
    p.error
      ? `  P${p.n} ${p.name}: FAILED ${p.error}`
      : `  P${p.n} ${p.name}: ${p.how}, pose ${p.poseMs} ms, problems: ${p.problems.join(', ') || 'none'}${p.problemText ? ` [${p.problemText}]` : ''}`,
  );
}
lines.push('', 'OUTFITS');
for (const o of outfits) lines.push(`  ${o.name}: ${o.items.join(' + ')}`);
lines.push('', 'RENDERS (ms)');
for (const r of report.renders)
  lines.push(
    r.error
      ? `  P${r.person} ${r.outfit}: FAILED ${r.error}`
      : `  P${r.person} ${r.outfit}: fitted ${r.fittedMs}, rigid ${r.rigidMs}${r.notFitted ? `, NOT FITTED: ${r.notFitted.length} item(s)` : ''}`,
  );
for (const p of report.people)
  if (p.console?.length) lines.push('', `CONSOLE P${p.n}`, ...p.console.map((c) => `  ${c}`));
for (const p of report.people)
  if (p.hostFallback?.length)
    lines.push(
      '',
      `HOST FALLBACK P${p.n} (deep links to /outfits/<id>: 404.html, as on GitHub Pages)`,
      ...p.hostFallback.map((c) => `  ${c}`),
    );
if (report.warnings.length) lines.push('', 'WARNINGS', ...report.warnings.map((w) => `  ${w}`));
writeFileSync(join(outDir, 'trial-report.txt'), lines.join('\n') + '\n');
log(`\nWrote ${outDir}/trial-sheet.png, trial-report.txt, trial-report.json`);
