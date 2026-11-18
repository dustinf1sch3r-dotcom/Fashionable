#!/usr/bin/env node
/**
 * Renders the brand SVGs in assets/brand/ to the PNGs the app and the web manifest use.
 * Run by hand after editing an SVG, then commit the PNGs (CI does not run this):
 *   node scripts/render-icons.js (from the repo root)
 * Uses Playwright's Chromium (a dev dependency); set PW_CHROMIUM_PATH to override the browser.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const root = process.cwd(); // run from the repo root
const brand = path.join(root, 'assets', 'brand');
const images = path.join(root, 'assets', 'images');
const webIcons = path.join(root, 'public', 'icons');

// [svg, output file (relative to root), size, transparent]
const JOBS = [
  ['icon.svg', 'assets/images/icon.png', 1024, false],
  ['icon-foreground.svg', 'assets/images/android-icon-foreground.png', 1024, true],
  ['icon-background.svg', 'assets/images/android-icon-background.png', 1024, false],
  ['icon-monochrome.svg', 'assets/images/android-icon-monochrome.png', 1024, true],
  ['icon-splash.svg', 'assets/images/splash-icon.png', 1024, true],
  ['icon.svg', 'assets/images/favicon.png', 48, false],
  ['icon.svg', 'public/icons/favicon-48.png', 48, false],
  ['icon.svg', 'public/icons/apple-touch-icon.png', 180, false],
  ['icon.svg', 'public/icons/icon-192.png', 192, false],
  ['icon.svg', 'public/icons/icon-512.png', 512, false],
  ['icon-maskable.svg', 'public/icons/icon-maskable-512.png', 512, false],
];

function executablePath() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  return fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
}

async function main() {
  fs.mkdirSync(images, { recursive: true });
  fs.mkdirSync(webIcons, { recursive: true });
  const browser = await chromium.launch({ executablePath: executablePath() });
  try {
    for (const [svg, out, size, transparent] of JOBS) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      const src = fs.readFileSync(path.join(brand, svg), 'utf8');
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`,
      );
      const file = path.join(root, out);
      await page.screenshot({ path: file, omitBackground: transparent });
      await page.close();
      console.log(`${out} (${size}px)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
