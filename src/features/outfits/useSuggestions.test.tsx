import { renderHook, waitFor } from '@testing-library/react-native';
import { fixtureById } from '@/core/testing/fixtures';
import { createTestServices } from '@/services';
import { getStores, hydrateAll, resetStores } from '@/state';
import { useSuggestions } from './useSuggestions';

const mockServices = createTestServices();
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));

const seedCloset = async (ids: string[]) => {
  for (const id of ids) await mockServices.items.put(fixtureById(id));
  await hydrateAll();
};

beforeEach(async () => {
  resetStores();
  for (const i of await mockServices.items.list()) await mockServices.items.remove(i.id);
});

describe('useSuggestions', () => {
  it('generates after the stores load, and stays stable for the same inputs', async () => {
    await seedCloset(['tee-navy', 'jeans-dark', 'sneakers-white', 'tee-white', 'loafers-brown']);
    const params = { occasion: 'any' as const, pinnedItemIds: [] as string[], seed: 3 };
    const { result, rerender } = await renderHook(() => useSuggestions(params));
    await waitFor(() => expect(result.current.busy).toBe(false));
    const first = result.current.result;
    expect(first?.suggestions.length).toBeGreaterThan(0);
    expect(result.current.activeCount).toBe(5);
    await rerender({});
    expect(result.current.result).toBe(first);
  });

  it('reports the missing slot for a closet that is too small', async () => {
    await seedCloset(['tee-navy', 'jeans-dark']);
    const { result } = await renderHook(() =>
      useSuggestions({ occasion: 'any', pinnedItemIds: [], seed: 1 }),
    );
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.result?.diagnostics.missingSlots).toEqual(['shoes']);
  });

  it('regenerates when the seed changes', async () => {
    await seedCloset(['tee-navy', 'jeans-dark', 'sneakers-white']);
    let seed = 1;
    const { result, rerender } = await renderHook(() =>
      useSuggestions({ occasion: 'any', pinnedItemIds: [], seed }),
    );
    await waitFor(() => expect(result.current.busy).toBe(false));
    const first = result.current.result;
    seed = 2;
    await rerender({});
    await waitFor(() => expect(result.current.result).not.toBe(first));
    expect(getStores().closet.getState().items).toHaveLength(3);
  });
});
