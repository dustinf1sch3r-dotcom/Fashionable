import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from '../types';

/** `KeyValueStore` over AsyncStorage (localStorage-backed on web). */
export function createAsyncStorageKv(): KeyValueStore {
  return {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
  };
}
