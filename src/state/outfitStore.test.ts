import { createTestServices } from '@/services';
import { createOutfitStore } from './outfitStore';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('outfitStore', () => {
  it('adds, renames, updates, favourites', () => {
    const store = createOutfitStore(createTestServices());
    const o = store.getState().addOutfit({ itemIds: ['a', 'b'] });
    store.getState().renameOutfit(o.id, 'Friday');
    store.getState().toggleFavorite(o.id);
    store.getState().updateOutfit(o.id, { occasion: 'work' });
    expect(store.getState().outfits[0]).toMatchObject({
      name: 'Friday',
      favorite: true,
      occasion: 'work',
      source: 'manual',
    });
  });

  it('soft-deletes and restores, persisting both', async () => {
    const services = createTestServices();
    const store = createOutfitStore(services);
    const o = store.getState().addOutfit({ itemIds: ['a'] });
    await store.getState().flush();
    store.getState().removeOutfit(o.id);
    await store.getState().flush();
    expect(await services.outfits.list()).toEqual([]);
    store.getState().restoreOutfit(o.id);
    await store.getState().flush();
    expect(await services.outfits.list()).toHaveLength(1);
  });

  it('rates with sorted ids and replaces a re-rating of the same set', async () => {
    const store = createOutfitStore(createTestServices());
    store.getState().rate(['b', 'a'], 'like');
    store.getState().rate(['a', 'b'], 'dislike');
    store.getState().rate(['a'], 'like');
    const fb = store.getState().feedback;
    expect(fb).toHaveLength(2);
    expect(fb[0]).toMatchObject({ itemIds: ['a', 'b'], verdict: 'dislike' });
  });

  it('persists on the debounce and restores after restart', async () => {
    const services = createTestServices();
    const store = createOutfitStore(services);
    store.getState().addOutfit({ itemIds: ['a'] });
    store.getState().rate(['a'], 'like');
    await jest.advanceTimersByTimeAsync(250);

    const again = createOutfitStore(services);
    await again.getState().hydrate();
    expect(again.getState()).toMatchObject({ status: 'ready' });
    expect(again.getState().outfits).toHaveLength(1);
    expect(again.getState().feedback).toHaveLength(1);
  });

  it('reports write errors and keeps state', async () => {
    const services = createTestServices();
    const store = createOutfitStore({
      ...services,
      outfits: { ...services.outfits, put: () => Promise.reject(new Error('nope')) },
    });
    store.getState().addOutfit({ itemIds: ['a'] });
    await store.getState().flush();
    expect(store.getState().error).toBe('nope');
    expect(store.getState().outfits).toHaveLength(1);
  });
});
