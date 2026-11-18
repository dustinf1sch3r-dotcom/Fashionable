import { createFixedClock, createMemoryKv } from '../testing';
import { createOpenMeteoProvider } from './openMeteo';

const body = {
  daily: {
    time: ['2026-11-18', '2026-11-19'],
    temperature_2m_max: [18, 12],
    temperature_2m_min: [8, 4],
    apparent_temperature_max: [16, 9],
    apparent_temperature_min: [6, 1],
    precipitation_probability_max: [35, 80],
    wind_speed_10m_max: [20, 30],
    weather_code: [1, 63],
  },
};

function ok(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

function setup(responder: (url: string) => Promise<Response> = async () => ok(body)) {
  const urls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    urls.push(String(input));
    return responder(String(input));
  };
  const clock = createFixedClock('2026-11-18T12:00:00');
  const kv = createMemoryKv();
  const provider = createOpenMeteoProvider({ kv, clock, fetchFn });
  return { urls, clock, kv, provider };
}

const TODAY = '2026-11-18';

describe('createOpenMeteoProvider.forecast', () => {
  it('requests the daily fields in one call and maps the day', async () => {
    const { provider, urls } = setup();
    const w = await provider.forecast(52.52, 13.4, TODAY);
    expect(w).toMatchObject({ tempMaxC: 18, tempMinC: 8, precipProbability: 0.35, isSunny: true });
    const url = new URL(urls[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_days')).toBe('14');
    expect(url.searchParams.get('latitude')).toBe('52.52');
    expect(url.searchParams.get('daily')).toContain('apparent_temperature_max');
    expect(url.searchParams.get('daily')).toContain('precipitation_probability_max');
    expect(url.searchParams.get('daily')).toContain('wind_speed_10m_max');
    expect(url.searchParams.get('daily')).toContain('weather_code');
  });

  it('serves later days of the same location from the cache with one request', async () => {
    const { provider, urls } = setup();
    await provider.forecast(52.52, 13.4, TODAY);
    const tomorrow = await provider.forecast(52.5201, 13.4001, '2026-11-19');
    expect(tomorrow?.precipProbability).toBe(0.8);
    expect(urls).toHaveLength(1);
  });

  it('refetches today once the cached forecast is over 3 hours old', async () => {
    const { provider, urls, clock } = setup();
    await provider.forecast(52.52, 13.4, TODAY);
    clock.advance(2 * 3600_000);
    await provider.forecast(52.52, 13.4, TODAY);
    expect(urls).toHaveLength(1);
    clock.advance(1.5 * 3600_000);
    await provider.forecast(52.52, 13.4, TODAY);
    expect(urls).toHaveLength(2);
  });

  it('returns undefined when offline with nothing cached', async () => {
    const { provider } = setup(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await provider.forecast(1, 2, TODAY)).toBeUndefined();
  });

  it('returns undefined on HTTP errors and on unusable bodies', async () => {
    const http = setup(
      async () => ({ ok: false, status: 429, json: async () => ({}) }) as Response,
    );
    expect(await http.provider.forecast(1, 2, TODAY)).toBeUndefined();
    const junk = setup(async () => ok({ error: true }));
    expect(await junk.provider.forecast(1, 2, TODAY)).toBeUndefined();
  });

  it('falls back to a stale cached forecast when the refresh fails', async () => {
    let fail = false;
    const { provider, clock } = setup(async () => {
      if (fail) throw new Error('offline');
      return ok(body);
    });
    await provider.forecast(1, 2, TODAY);
    clock.advance(5 * 3600_000);
    fail = true;
    expect((await provider.forecast(1, 2, TODAY))?.tempMaxC).toBe(18);
  });

  it('times out hung requests', async () => {
    jest.useFakeTimers();
    try {
      const fetchFn: typeof fetch = (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      const provider = createOpenMeteoProvider({
        kv: createMemoryKv(),
        clock: createFixedClock('2026-11-18T12:00:00'),
        fetchFn,
        config: { timeoutMs: 1000 },
      });
      const pending = provider.forecast(1, 2, TODAY);
      await jest.advanceTimersByTimeAsync(1001);
      expect(await pending).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('honours a swapped base URL and api key', async () => {
    const urls: string[] = [];
    const provider = createOpenMeteoProvider({
      kv: createMemoryKv(),
      clock: createFixedClock('2026-11-18T12:00:00'),
      fetchFn: async (input) => (urls.push(String(input)), ok(body)),
      config: { forecastUrl: 'https://customer-api.open-meteo.com/v1/forecast', apiKey: 'k' },
    });
    await provider.forecast(1, 2, TODAY);
    expect(urls[0]).toMatch(/^https:\/\/customer-api\.open-meteo\.com\/v1\/forecast\?/);
    expect(urls[0]).toContain('apikey=k');
  });
});

describe('createOpenMeteoProvider.geocode', () => {
  it('maps results and sends the name', async () => {
    const { provider, urls } = setup(async () =>
      ok({ results: [{ name: 'Berlin', country: 'Germany', latitude: 52.5, longitude: 13.4 }] }),
    );
    expect(await provider.geocode('  Berlin ')).toEqual([
      { label: 'Berlin, Germany', lat: 52.5, lon: 13.4 },
    ]);
    expect(new URL(urls[0] ?? '').searchParams.get('name')).toBe('Berlin');
    expect(urls[0]).toContain('geocoding-api.open-meteo.com/v1/search');
  });

  it('returns [] for short queries without a request, and on failure', async () => {
    const { provider, urls } = setup(async () => {
      throw new Error('offline');
    });
    expect(await provider.geocode('B')).toEqual([]);
    expect(urls).toHaveLength(0);
    expect(await provider.geocode('Berlin')).toEqual([]);
  });
});
