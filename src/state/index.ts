import { useStore } from 'zustand';
import { getServices, type Services } from '@/services';
import { createClosetStore, type ClosetState, type ClosetStore } from './closetStore';
import { createOutfitStore, type OutfitState, type OutfitStore } from './outfitStore';
import { createProfileStore, type ProfileState, type ProfileStore } from './profileStore';
import { createWeatherStore, type WeatherState, type WeatherStore } from './weatherStore';
import { createWearStore, type WearState, type WearStore } from './wearStore';

export * from './closetStore';
export * from './outfitStore';
export * from './profileStore';
export * from './wearStore';
export * from './weatherStore';
export { PERSIST_DELAY_MS } from './persist';

export interface Stores {
  closet: ClosetStore;
  outfits: OutfitStore;
  wear: WearStore;
  profile: ProfileStore;
  weather: WeatherStore;
}

export function createStores(services: Services): Stores {
  const profile = createProfileStore(services);
  return {
    closet: createClosetStore(services),
    outfits: createOutfitStore(services),
    wear: createWearStore(services),
    profile,
    weather: createWeatherStore(services, profile),
  };
}

let singleton: Stores | undefined;

/** The app's stores, created on first use from the real services. */
export function getStores(): Stores {
  singleton ??= createStores(getServices());
  return singleton;
}

/** Test helper: drop the singleton (does not flush; call `flushAll` first if needed). */
export function resetStores(): void {
  singleton = undefined;
}

/** Load every store from storage. Call once at app start. */
export async function hydrateAll(stores: Stores = getStores()): Promise<void> {
  await Promise.all([
    stores.closet.getState().hydrate(),
    stores.outfits.getState().hydrate(),
    stores.wear.getState().hydrate(),
    stores.profile.getState().hydrate(),
  ]);
}

/** Write all pending changes now; call when the app goes to the background. */
export async function flushAll(stores: Stores = getStores()): Promise<void> {
  await Promise.all([
    stores.closet.getState().flush(),
    stores.outfits.getState().flush(),
    stores.wear.getState().flush(),
    stores.profile.getState().flush(),
  ]);
}

// Selectors that build new arrays/objects must be wrapped in `useShallow` from 'zustand/react/shallow'.
export const useCloset = <T>(selector: (s: ClosetState) => T): T =>
  useStore(getStores().closet, selector);
export const useOutfits = <T>(selector: (s: OutfitState) => T): T =>
  useStore(getStores().outfits, selector);
export const useWear = <T>(selector: (s: WearState) => T): T =>
  useStore(getStores().wear, selector);
export const useProfile = <T>(selector: (s: ProfileState) => T): T =>
  useStore(getStores().profile, selector);
export const useWeather = <T>(selector: (s: WeatherState) => T): T =>
  useStore(getStores().weather, selector);
