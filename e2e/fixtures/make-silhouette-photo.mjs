// Generates e2e/fixtures/silhouette-500x1000.png: the body-a silhouette (our own artwork, see
// src/ui/mannequin/bodyA.ts) in dark grey on a light backdrop, 500x1000. It is NOT a photo of a
// person; it only gives the pose detector's end-to-end test something person-shaped to look at.
// Run (set PW_CHROMIUM_PATH where Chromium is not at the Playwright default):
//   node --experimental-strip-types e2e/fixtures/make-silhouette-photo.mjs
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { BODY_A_PARTS, MIRROR_TRANSFORM } from '../../src/ui/mannequin/bodyA.ts';

const FILL = '#3a3a42';
const path = (d) => `<path d="${d}" fill="${FILL}"/>`;
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="1000" viewBox="0 0 1000 2000">' +
  '<rect width="1000" height="2000" fill="#e9e6e0"/>' +
  [...BODY_A_PARTS.whole, ...BODY_A_PARTS.pairedLeft].map(path).join('') +
  `<g transform="${MIRROR_TRANSFORM}">${BODY_A_PARTS.pairedLeft.map(path).join('')}</g></svg>`;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 500, height: 1000 } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
writeFileSync(new URL('./silhouette-500x1000.png', import.meta.url), await page.screenshot());
await browser.close();
