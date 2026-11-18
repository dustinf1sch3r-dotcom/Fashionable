import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ISODate, Weather } from '@/core/model/types';
import { localISODate } from '@/core/weather';
import type { GeocodeResult, Services } from '@/services';
import type { ProfileStore } from './profileStore';

export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'no-location' | 'error';

/** Why the last attempt failed; the UI turns it into a sentence. */
export type WeatherError = 'location-denied' | 'location-unavailable' | 'weather-unavailable';

export const DEVICE_LOCATION_LABEL = 'Current location';

export interface WeatherState {
  today?: Weather;
  byDate: Record<ISODate, Weather>;
  status: WeatherStatus;
  error: WeatherError | null;
  /** Loads the forecast for `date` (default: today) for the profile's saved location. */
  refresh(date?: ISODate): Promise<void>;
  /** Asks the device for its position, saves it as the profile location, then refreshes. */
  setLocationFromDevice(): Promise<'ok' | 'denied' | 'unavailable'>;
  /** Places matching a typed city name (`[]` when none or offline). */
  searchPlaces(query: string): Promise<GeocodeResult[]>;
  /** Saves a geocoded place as the profile location, then refreshes. */
  setLocationFromSearch(place: GeocodeResult): Promise<void>;
}

export type WeatherStore = StoreApi<WeatherState>;

export function createWeatherStore(services: Services, profileStore: ProfileStore): WeatherStore {
  const { clock, weather, location } = services;
  // Incremented per refresh; a slower, older response must not overwrite a newer one.
  let generation = 0;

  /** `update` is a no-op until the profile has loaded, so make sure it has. */
  const ensureProfile = async () => {
    const { status } = profileStore.getState();
    if (status === 'idle') await profileStore.getState().hydrate();
    else if (status === 'loading') {
      await new Promise<void>((resolve) => {
        const unsubscribe = profileStore.subscribe((s) => {
          if (s.status !== 'loading') {
            unsubscribe();
            resolve();
          }
        });
      });
    }
  };

  const store: WeatherStore = createStore<WeatherState>((set, get) => ({
    byDate: {},
    status: 'idle',
    error: null,

    async refresh(date) {
      const target = date ?? localISODate(clock.now());
      const mine = ++generation;
      await ensureProfile();
      const loc = profileStore.getState().profile?.location;
      if (!loc) {
        set({ status: 'no-location', error: null, today: undefined, byDate: {} });
        return;
      }
      set({ status: 'loading', error: null });
      const w = await weather.forecast(loc.lat, loc.lon, target);
      if (mine !== generation) return;
      const { [target]: _dropped, ...rest } = get().byDate;
      const byDate = w ? { ...rest, [target]: w } : rest;
      const today = localISODate(clock.now());
      set({
        byDate,
        today: byDate[today],
        status: w ? 'ready' : 'error',
        error: w ? null : 'weather-unavailable',
      });
    },

    async setLocationFromDevice() {
      const pos = await location.getCurrentPosition();
      await ensureProfile();
      if (pos.status !== 'ok') {
        const hasSaved = Boolean(profileStore.getState().profile?.location);
        set({
          error: pos.status === 'denied' ? 'location-denied' : 'location-unavailable',
          ...(hasSaved ? {} : { status: 'no-location' as const }),
        });
        return pos.status;
      }
      profileStore
        .getState()
        .update({ location: { lat: pos.lat, lon: pos.lon, label: DEVICE_LOCATION_LABEL } });
      set({ byDate: {}, today: undefined });
      await get().refresh();
      return 'ok';
    },

    searchPlaces: (query) => weather.geocode(query),

    async setLocationFromSearch(place) {
      await ensureProfile();
      profileStore
        .getState()
        .update({ location: { lat: place.lat, lon: place.lon, label: place.label } });
      set({ byDate: {}, today: undefined });
      await get().refresh();
    },
  }));
  return store;
}
