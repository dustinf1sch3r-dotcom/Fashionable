import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

// Override both to run several builds side by side: E2E_DIST=dist-x E2E_PORT=4180 npm run e2e
const PORT = Number(process.env.E2E_PORT ?? 4173);
const DIST = process.env.E2E_DIST ?? 'dist';

function resolveChromiumPath(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  // existsSync follows symlinks, so this works whether it is the binary or a link to it.
  const preinstalled = '/opt/pw-browsers/chromium';
  if (existsSync(preinstalled)) return preinstalled;
  return undefined;
}

export default defineConfig({
  testDir: 'e2e',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: { executablePath: resolveChromiumPath() },
      },
    },
  ],
  webServer: {
    // Mimic GitHub Pages: real pages for known routes (mix.html for /mix), 404.html for the rest.
    // (`serve -s` would answer every route with index.html and hide routing bugs.)
    command: `npx serve ${DIST} -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
