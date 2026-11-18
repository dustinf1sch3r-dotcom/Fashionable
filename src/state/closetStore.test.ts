import { createTestServices } from '@/services';
import { createFixedClock } from '@/services/testing';
import { createClosetStore, selectActiveItems, selectItemsByCategory } from './closetStore';
import { jeans, spyRepo, tee } from './testUtils';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('closetStore', () => {
  it('hydrates an empty closet to ready', async () => {
    const store = createClosetStore(createTestServices());
    expect(store.getState().status).toBe('idle');
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ status: 'ready', items: [], error: null });
  });

  it('adds an item immediately using the services clock and ids', () => {
    const services = createTestServices();
    const store = createClosetStore(services);
    const item = store.getState().addItem(tee());
    expect(store.getState().items).toEqual([item]);
    expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(item.status).toBe('active');
  });

  it('updates, changes status, toggles favourite and touches updatedAt', () => {
    const clock = createFixedClock();
    const store = createClosetStore(createTestServices({ clock }));
    const { id } = store.getState().addItem(tee());
    clock.advance(1000);
    store.getState().updateItem(id, { notes: 'soft', warmth: 2 });
    store.getState().setStatus(id, 'laundry');
    store.getState().toggleFavorite(id);
    const [item] = store.getState().items;
    expect(item).toMatchObject({ notes: 'soft', warmth: 2, status: 'laundry', favorite: true });
    expect(item.updatedAt).toBe('2026-01-01T00:00:01.000Z');
    store.getState().toggleFavorite(id);
    expect(store.getState().items[0].favorite).toBe(false);
  });

  it('ignores unknown ids', () => {
    const store = createClosetStore(createTestServices());
    store.getState().updateItem('nope', { notes: 'x' });
    store.getState().removeItem('nope');
    store.getState().restoreItem('nope');
    expect(store.getState().items).toEqual([]);
  });

  it('selects active items and groups by category', () => {
    const store = createClosetStore(createTestServices());
    const a = store.getState().addItem(tee());
    const b = store.getState().addItem(jeans());
    store.getState().setStatus(b.id, 'archived');
    expect(selectActiveItems(store.getState()).map((i) => i.id)).toEqual([a.id]);
    const grouped = selectItemsByCategory(store.getState());
    expect(grouped.top.map((i) => i.id)).toEqual([a.id]);
    expect(grouped.bottom.map((i) => i.id)).toEqual([b.id]);
    expect(grouped.shoes).toEqual([]);
  });

  it('coalesces a burst of changes into one write per record after 250 ms', async () => {
    const services = createTestServices();
    const spy = spyRepo(services.items);
    const store = createClosetStore({ ...services, items: spy.wrapped });
    const { id } = store.getState().addItem(tee());
    store.getState().updateItem(id, { notes: 'a' });
    store.getState().toggleFavorite(id);
    await jest.advanceTimersByTimeAsync(249);
    expect(spy.calls.put).toBe(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(spy.calls.put).toBe(1);
    expect((await services.items.list())[0]).toMatchObject({ notes: 'a', favorite: true });
  });

  it('restores data after a restart on the same storage', async () => {
    const services = createTestServices();
    const first = createClosetStore(services);
    const { id } = first.getState().addItem(tee());
    first.getState().toggleFavorite(id);
    await first.getState().flush();

    const second = createClosetStore(services);
    await second.getState().hydrate();
    expect(second.getState().items).toHaveLength(1);
    expect(second.getState().items[0]).toMatchObject({ id, favorite: true });
  });

  it('soft-deletes and restores', async () => {
    const services = createTestServices();
    const store = createClosetStore(services);
    const { id } = store.getState().addItem(tee());
    await store.getState().flush();

    store.getState().removeItem(id);
    expect(store.getState().items).toEqual([]);
    await store.getState().flush();
    expect(await services.items.list()).toEqual([]);

    store.getState().restoreItem(id);
    expect(store.getState().items.map((i) => i.id)).toEqual([id]);
    await store.getState().flush();
    const stored = await services.items.list();
    expect(stored.map((i) => i.id)).toEqual([id]);
    expect(stored[0].deletedAt).toBeUndefined();
  });

  it('undo before the flush never writes a delete', async () => {
    const services = createTestServices();
    const spy = spyRepo(services.items);
    const store = createClosetStore({ ...services, items: spy.wrapped });
    const { id } = store.getState().addItem(tee());
    await store.getState().flush();
    store.getState().removeItem(id);
    store.getState().restoreItem(id);
    await store.getState().flush();
    expect(spy.calls.remove).toBe(0);
    expect(await services.items.list()).toHaveLength(1);
  });

  it('keeps in-memory state, sets error on write failure, and retries on next flush', async () => {
    const services = createTestServices();
    const spy = spyRepo(services.items);
    const store = createClosetStore({ ...services, items: spy.wrapped });
    spy.state.fail = true;
    store.getState().addItem(tee());
    await store.getState().flush();
    expect(store.getState().error).toBe('disk full');
    expect(store.getState().items).toHaveLength(1);

    spy.state.fail = false;
    await store.getState().flush();
    expect(store.getState().error).toBeNull();
    expect(await services.items.list()).toHaveLength(1);
  });

  it('sets status error when loading throws', async () => {
    const services = createTestServices();
    const store = createClosetStore({
      ...services,
      items: { ...services.items, list: () => Promise.reject(new Error('boom')) },
    });
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ status: 'error', error: 'boom' });
  });

  it('drops invalid stored records on load', async () => {
    const services = createTestServices();
    const writer = createClosetStore(services);
    writer.getState().addItem(tee());
    await writer.getState().flush();
    await services.items.put({
      id: 'bad',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
    const reader = createClosetStore(services);
    await reader.getState().hydrate();
    expect(reader.getState().items).toHaveLength(1);
  });
});
