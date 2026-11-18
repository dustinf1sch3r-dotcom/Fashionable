import { createTestServices } from '@/services';
import { createWearStore, selectLastWornDate, selectLogsForDate } from './wearStore';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('wearStore', () => {
  it('logs worn and planned entries', () => {
    const store = createWearStore(createTestServices());
    const worn = store.getState().logWorn('2026-02-01', ['a', 'b'], 'o1');
    const planned = store.getState().plan('2026-02-02', ['a']);
    expect(worn).toMatchObject({ planned: false, outfitId: 'o1' });
    expect(planned.planned).toBe(true);
    expect('outfitId' in planned).toBe(false);
    expect(selectLogsForDate(store.getState(), '2026-02-01')).toEqual([worn]);
  });

  it('lastWornDate ignores plans and picks the latest date', () => {
    const store = createWearStore(createTestServices());
    store.getState().logWorn('2026-02-01', ['a']);
    store.getState().logWorn('2026-03-01', ['a']);
    store.getState().logWorn('2026-02-15', ['a']);
    store.getState().plan('2026-04-01', ['a']);
    expect(selectLastWornDate(store.getState(), 'a')).toBe('2026-03-01');
    expect(selectLastWornDate(store.getState(), 'z')).toBeUndefined();
  });

  it('removes a log and persists the removal', async () => {
    const services = createTestServices();
    const store = createWearStore(services);
    const log = store.getState().logWorn('2026-02-01', ['a']);
    await store.getState().flush();
    store.getState().remove(log.id);
    store.getState().remove('unknown');
    expect(store.getState().logs).toEqual([]);
    await jest.advanceTimersByTimeAsync(250);
    expect(await services.wearLogs.list()).toEqual([]);
  });

  it('restores logs after restart', async () => {
    const services = createTestServices();
    const store = createWearStore(services);
    store.getState().logWorn('2026-02-01', ['a']);
    await store.getState().flush();
    const again = createWearStore(services);
    await again.getState().hydrate();
    expect(again.getState().logs).toHaveLength(1);
  });

  it('reports write errors', async () => {
    const services = createTestServices();
    const store = createWearStore({
      ...services,
      wearLogs: { ...services.wearLogs, put: () => Promise.reject(new Error('x')) },
    });
    store.getState().logWorn('2026-02-01', ['a']);
    await store.getState().flush();
    expect(store.getState().error).toBe('x');
    expect(store.getState().logs).toHaveLength(1);
  });
});
