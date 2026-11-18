import * as Location from 'expo-location';
import type { LocationService, PositionResult } from '../types';

/**
 * Device position through `expo-location`, which uses the browser Geolocation API on web and the
 * OS location services on iOS and Android, so there is no per-platform file.
 */
export function createLocationService(): LocationService {
  return {
    async getCurrentPosition(): Promise<PositionResult> {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return { status: 'denied' };
        // `timeout` is honoured by the web implementation (passed to the browser) but is not in
        // expo-location's LocationOptions type, hence the separate variable.
        const options = { accuracy: Location.Accuracy.Balanced, timeout: 15000 };
        const pos = await Location.getCurrentPositionAsync(options);
        return { status: 'ok', lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch {
        return { status: 'unavailable' };
      }
    },
  };
}
