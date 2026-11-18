import type { Weather } from '@/core/model/types';
import { localISODate } from '@/core/weather';
import { createTestServices } from '@/services';
import {
  createFakeLocationService,
  createFakeWeatherProvider,
  createFixedClock,
} from '@/services/testing';
import { createProfileStore } from './profileStore';
import { createWeatherStore } from './weatherStore';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const w = (maxC: number): Weather => ({
  tempMinC: 3,
  tempMaxC: maxC,
  feelsLikeC: maxC - 2,
  precipProbability: 0.2,
  windKph: 10,
  isSunny: true,
});

const berlin = { label: 'Berlin, Germany', lat: 52.52, lon: 13.4 };

function setup() {
  const clock = createFixedClock('2026-11-18T12:00:00');
  const base = createTestServices({ clock });
  const provider = createFakeWeatherProvider({}, [berlin]);
  const location = createFakeLocationService();
  const services = { ...base, weather: provider, location };
  const profile = createProfileStore(services);
  const store = createWeatherStore(services, profile);
  const today = localISODate(clock.now());
  return { services, provider, location, profile, store, today };
}

describe('weatherStore', () => {
  it('reports no-location and does not call the provider without a saved location', async () => {
    const { store, provider } = setup();
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({ status: 'no-location', today: undefined });
    expect(provider.forecastCalls).toHaveLength(0);
  });

  it('loads today for the saved location', async () => {
    const { store, provider, profile, today } = setup();
    await profile.getState().hydrate();
    profile.getState().update({ location: berlin });
    provider.days[today] = w(18);
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({ status: 'ready', error: null, today: w(18) });
    expect(provider.forecastCalls[0]).toMatchObject({ lat: 52.52, lon: 13.4, date: today });
  });

  it('keeps several dates and only sets today for today', async () => {
    const { store, provider, profile, today } = setup();
    await profile.getState().hydrate();
    profile.getState().update({ location: berlin });
    provider.days[today] = w(18);
    provider.days['2099-01-02'] = w(5);
    await store.getState().refresh();
    await store.getState().refresh('2099-01-02');
    expect(store.getState().byDate).toEqual({ [today]: w(18), '2099-01-02': w(5) });
    expect(store.getState().today).toEqual(w(18));
  });

  it('goes to error when the provider has nothing (offline)', async () => {
    const { store, provider, profile } = setup();
    await profile.getState().hydrate();
    profile.getState().update({ location: berlin });
    provider.offline = true;
    await store.getState().refresh();
    expect(store.getState()).toMatchObject({
      status: 'error',
      error: 'weather-unavailable',
      today: undefined,
    });
  });

  it('setLocationFromSearch saves the place on the profile and loads weather', async () => {
    const { store, provider, profile, today } = setup();
    provider.days[today] = w(12);
    await store.getState().setLocationFromSearch(berlin);
    expect(profile.getState().profile?.location).toEqual(berlin);
    expect(store.getState()).toMatchObject({ status: 'ready', today: w(12) });
  });

  it('setLocationFromDevice saves "Current location" and loads weather', async () => {
    const { store, provider, location, profile, today } = setup();
    provider.days[today] = w(20);
    location.result = { status: 'ok', lat: 1.5, lon: 2.5 };
    expect(await store.getState().setLocationFromDevice()).toBe('ok');
    expect(profile.getState().profile?.location).toEqual({
      lat: 1.5,
      lon: 2.5,
      label: 'Current location',
    });
    expect(store.getState().today).toEqual(w(20));
  });

  it.each([
    ['denied', 'location-denied'],
    ['unavailable', 'location-unavailable'],
  ] as const)('device location %s leaves the profile alone and sets %s', async (status, error) => {
    const { store, location, profile } = setup();
    await profile.getState().hydrate();
    location.result = { status };
    expect(await store.getState().setLocationFromDevice()).toBe(status);
    expect(profile.getState().profile?.location).toBeUndefined();
    expect(store.getState()).toMatchObject({ status: 'no-location', error });
  });

  it('a failed device lookup keeps the previously saved location and its weather', async () => {
    const { store, provider, location, profile, today } = setup();
    await profile.getState().hydrate();
    profile.getState().update({ location: berlin });
    provider.days[today] = w(18);
    await store.getState().refresh();
    location.result = { status: 'denied' };
    await store.getState().setLocationFromDevice();
    expect(store.getState()).toMatchObject({ status: 'ready', error: 'location-denied' });
    expect(profile.getState().profile?.location).toEqual(berlin);
  });

  it('ignores a slow older response after a newer refresh', async () => {
    const { store, provider, profile, today } = setup();
    await profile.getState().hydrate();
    profile.getState().update({ location: berlin });
    let release: (v: Weather) => void = () => undefined;
    const slow = new Promise<Weather>((r) => (release = r));
    const original = provider.forecast;
    provider.forecast = (lat, lon, date) =>
      provider.forecastCalls.length === 0
        ? (provider.forecastCalls.push({ lat, lon, date }), slow)
        : original(lat, lon, date);
    provider.days[today] = w(18);
    const first = store.getState().refresh();
    await Promise.resolve();
    await store.getState().refresh();
    release(w(99));
    await first;
    expect(store.getState().today).toEqual(w(18));
  });
});
