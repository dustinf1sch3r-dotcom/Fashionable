import { createTestServices } from '@/services';
import { createProfileStore } from './profileStore';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('profileStore', () => {
  it('creates a default profile on first hydrate and saves it', async () => {
    const services = createTestServices();
    const store = createProfileStore(services);
    await store.getState().hydrate();
    expect(store.getState().profile).toMatchObject({ bodyTemplateId: 'body-a', units: 'metric' });
    await jest.advanceTimersByTimeAsync(250);
    expect(await services.profile.list()).toHaveLength(1);
  });

  it('reuses the stored profile after restart and does not create another', async () => {
    const services = createTestServices();
    const first = createProfileStore(services);
    await first.getState().hydrate();
    first.getState().update({ displayName: 'Ada', units: 'imperial' });
    await first.getState().flush();

    const second = createProfileStore(services);
    await second.getState().hydrate();
    expect(second.getState().profile).toMatchObject({
      id: first.getState().profile?.id,
      displayName: 'Ada',
      units: 'imperial',
    });
    await second.getState().flush();
    expect(await services.profile.list()).toHaveLength(1);
  });

  it('update before hydrate is a no-op', () => {
    const store = createProfileStore(createTestServices());
    store.getState().update({ displayName: 'x' });
    expect(store.getState().profile).toBeNull();
  });

  it('reports write errors', async () => {
    const services = createTestServices();
    const store = createProfileStore({
      ...services,
      profile: { ...services.profile, put: () => Promise.reject(new Error('bad')) },
    });
    await store.getState().hydrate();
    await store.getState().flush();
    expect(store.getState().error).toBe('bad');
    expect(store.getState().profile).not.toBeNull();
  });
});
