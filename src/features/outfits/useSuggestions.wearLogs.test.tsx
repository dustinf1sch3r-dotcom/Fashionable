import { renderHook, waitFor } from '@testing-library/react-native';
import type { GenerateInput } from '@/core/engine/generate';
import { fixtureById } from '@/core/testing/fixtures';
import { createTestServices } from '@/services';
import { getStores, hydrateAll, resetStores } from '@/state';
import { useSuggestions } from './useSuggestions';

const mockServices = createTestServices();
const mockInputs: GenerateInput[] = [];

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));
jest.mock('@/core/engine/generate', () => {
  const actual = jest.requireActual('@/core/engine/generate');
  return {
    ...actual,
    generateOutfits: (input: GenerateInput) => {
      mockInputs.push(input);
      return actual.generateOutfits(input);
    },
  };
});

beforeEach(async () => {
  resetStores();
  mockInputs.length = 0;
  for (const i of await mockServices.items.list()) await mockServices.items.remove(i.id);
});

describe('useSuggestions and wear history', () => {
  it('hands the stored wear logs (worn and planned) to the generator for its freshness rule', async () => {
    for (const id of ['tee-navy', 'jeans-dark', 'sneakers-white']) {
      await mockServices.items.put(fixtureById(id));
    }
    await hydrateAll();
    const wear = getStores().wear.getState();
    const worn = wear.logWorn('2026-11-17', ['tee-navy', 'jeans-dark', 'sneakers-white']);
    const planned = wear.plan('2026-11-20', ['tee-navy']);

    const { result } = await renderHook(() =>
      useSuggestions({ occasion: 'any', pinnedItemIds: [], seed: 1 }),
    );
    await waitFor(() => expect(result.current.busy).toBe(false));

    const input = mockInputs[mockInputs.length - 1];
    expect(input?.wearLogs.map((l) => l.id)).toEqual([worn.id, planned.id]);
    expect(input?.wearLogs.find((l) => l.id === worn.id)?.planned).toBe(false);
  });
});
