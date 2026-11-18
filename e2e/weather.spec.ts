import { expect, test, type Page } from '@playwright/test';

/** Open-Meteo is always mocked here; the real API is never called. */

const SHOTS = process.env.WEATHER_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/weather-${name}.png` });
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function forecastBody() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return isoDate(d);
  });
  const fill = <T>(v: T) => days.map(() => v);
  return {
    daily: {
      time: days,
      temperature_2m_max: fill(18),
      temperature_2m_min: fill(9),
      apparent_temperature_max: fill(16),
      apparent_temperature_min: fill(6), // feels like 0.7 * 16 + 0.3 * 6 = 13
      precipitation_probability_max: fill(35),
      wind_speed_10m_max: fill(14),
      weather_code: fill(1),
    },
  };
}

const BERLIN = {
  results: [
    { name: 'Berlin', admin1: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 },
    {
      name: 'Berlin',
      admin1: 'New Hampshire',
      country: 'United States',
      latitude: 44.47,
      longitude: -71.18,
    },
  ],
};

async function mockApi(page: Page, opts: { forecastStatus?: number } = {}) {
  const requests: string[] = [];
  await page.route('**/api.open-meteo.com/**', (route) => {
    requests.push(route.request().url());
    if (opts.forecastStatus && opts.forecastStatus !== 200) {
      return route.fulfill({ status: opts.forecastStatus, body: 'nope' });
    }
    return route.fulfill({ json: forecastBody() });
  });
  await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({ json: BERLIN }),
  );
  return requests;
}

async function searchBerlin(page: Page) {
  await page.getByTestId('location-sheet-query').fill('Berlin');
  await page.getByTestId('location-sheet-search').tap();
  await expect(page.getByTestId('location-sheet-result-0')).toContainText('Berlin, Germany');
  await shot(page, 'results');
  await page.getByTestId('location-sheet-result-0').tap();
  await expect(page.getByTestId('location-sheet')).toBeHidden();
}

test.describe('weather card, no permission', () => {
  test('no location: search a city, then shows the weather with attribution', async ({ page }) => {
    const requests = await mockApi(page);
    await page.goto('/dev/weather');
    await expect(page.getByTestId('screen-dev-weather')).toBeVisible();
    await expect(page.getByTestId('weather-no-location')).toBeVisible();
    await expect(page.getByTestId('weather-use-location')).toBeVisible();
    await shot(page, 'no-location');

    await page.getByTestId('weather-search').tap();
    await expect(page.getByTestId('location-sheet')).toBeVisible();
    await shot(page, 'sheet');
    await searchBerlin(page);

    await expect(page.getByTestId('weather-temp')).toHaveText('18° feels 13°');
    await expect(page.getByTestId('weather-rain')).toHaveText('35% chance of rain');
    await expect(page.getByTestId('weather-location')).toContainText('Berlin, Germany');
    await expect(page.getByTestId('weather-attribution')).toContainText(
      'Weather data by Open-Meteo.com',
    );
    await shot(page, 'ready');
    const url = new URL(requests[0] ?? '');
    expect(url.searchParams.get('latitude')).toBe('52.52');
  });

  test('denied permission offers the city search', async ({ page }) => {
    await mockApi(page);
    await page.goto('/dev/weather');
    await page.getByTestId('weather-use-location').tap();
    await expect(page.getByTestId('weather-message')).toContainText(/denied|position/);
    await expect(page.getByTestId('weather-search')).toBeVisible();
    await shot(page, 'denied');
  });

  test('API failure shows the unavailable state', async ({ page }) => {
    await mockApi(page, { forecastStatus: 500 });
    await page.goto('/dev/weather');
    await page.getByTestId('weather-search').tap();
    await searchBerlin(page);
    await expect(page.getByTestId('weather-unavailable')).toHaveText(
      'Weather unavailable — outfits ignore weather',
    );
    await expect(page.getByTestId('weather-retry')).toBeVisible();
    await shot(page, 'unavailable');
  });

  test('profile: location row and imperial units', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Profile' }).tap();
    await expect(page.getByTestId('profile-location-label')).toHaveText('No location set');
    await page.getByTestId('profile-location-button').tap();
    await searchBerlin(page);
    await expect(page.getByTestId('profile-location-label')).toHaveText('Berlin, Germany');
    await page.getByTestId('profile-units-imperial').tap();
    await page.waitForTimeout(600); // profile writes are debounced
    await page.goto('/dev/weather');
    await expect(page.getByTestId('weather-temp')).toHaveText('64° feels 55°');
    await shot(page, 'imperial');
  });
});

test.describe('weather card, permission granted', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 48.85, longitude: 2.35 },
  });

  test('use my location shows the weather', async ({ page }) => {
    const requests = await mockApi(page);
    await page.goto('/dev/weather');
    await page.getByTestId('weather-use-location').tap();
    await expect(page.getByTestId('weather-temp')).toHaveText('18° feels 13°');
    await expect(page.getByTestId('weather-location')).toContainText('Current location');
    const url = new URL(requests[0] ?? '');
    expect(Number(url.searchParams.get('latitude'))).toBeCloseTo(48.85, 2);
    expect(Number(url.searchParams.get('longitude'))).toBeCloseTo(2.35, 2);
  });

  test('the saved location is reloaded after a refresh without asking again', async ({ page }) => {
    await mockApi(page);
    await page.goto('/dev/weather');
    await page.getByTestId('weather-use-location').tap();
    await expect(page.getByTestId('weather-temp')).toBeVisible();
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByTestId('weather-temp')).toHaveText('18° feels 13°');
  });
});
