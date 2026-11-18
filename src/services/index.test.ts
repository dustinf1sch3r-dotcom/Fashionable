import { createTestServices } from './index';
import type { Outfit } from '@/core/model/types';

// `src/services` imports the AsyncStorage adapter, which needs its native module mocked in Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('createTestServices', () => {
  it('wires repositories to a shared in-memory store with fake clock and ids', async () => {
    const s = createTestServices();
    const outfit: Outfit = {
      id: s.ids.uuid(),
      createdAt: s.clock.now().toISOString(),
      updatedAt: s.clock.now().toISOString(),
      itemIds: [],
      source: 'manual',
      favorite: false,
    };
    await s.outfits.put(outfit);
    expect(await s.outfits.list()).toEqual([outfit]);
    expect(await s.items.list()).toEqual([]);
    await s.outfits.remove(outfit.id);
    expect(await s.outfits.list()).toEqual([]);
  });
});
