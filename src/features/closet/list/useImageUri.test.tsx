import { renderHook, waitFor } from '@testing-library/react-native';
import { createUriCache } from './imageUris';
import { useImageUri } from './useImageUri';

describe('createUriCache', () => {
  it('resolves once per id and shares in-flight lookups', async () => {
    const resolve = jest.fn(async (id: string) => `blob:${id}`);
    const cache = createUriCache(resolve);
    const [a, b] = await Promise.all([cache.load('x'), cache.load('x')]);
    expect(a).toBe('blob:x');
    expect(b).toBe('blob:x');
    await cache.load('x');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(cache.peek('x')).toBe('blob:x');
    expect(cache.peek('y')).toBeUndefined();
  });

  it('does not cache failures', async () => {
    const resolve = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('Unknown image id'))
      .mockResolvedValueOnce('blob:later');
    const cache = createUriCache(resolve);
    await expect(cache.load('x')).resolves.toBeUndefined();
    await expect(cache.load('x')).resolves.toBe('blob:later');
  });
});

describe('useImageUri', () => {
  it('goes from loading to ready', async () => {
    let finish: (uri: string) => void = () => undefined;
    const cache = createUriCache(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(() => useImageUri('a', cache));
    expect(result.current.status).toBe('loading');
    finish('blob:a');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', uri: 'blob:a' }));
  });

  it('reports missing images', async () => {
    const cache = createUriCache(async () => {
      throw new Error('nope');
    });
    const { result } = await renderHook(() => useImageUri('a', cache));
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });

  it('is ready immediately for cached ids and missing without an id', async () => {
    const cache = createUriCache(async (id) => `blob:${id}`);
    await cache.load('a');
    const hit = await renderHook(() => useImageUri('a', cache));
    expect(hit.result.current).toEqual({ status: 'ready', uri: 'blob:a' });
    const none = await renderHook(() => useImageUri(undefined, cache));
    expect(none.result.current.status).toBe('missing');
  });

  it('follows id changes', async () => {
    const cache = createUriCache(async (id) => `blob:${id}`);
    const { result, rerender } = await renderHook(
      ({ id }: { id: string }) => useImageUri(id, cache),
      {
        initialProps: { id: 'a' },
      },
    );
    await waitFor(() => expect(result.current.uri).toBe('blob:a'));
    await rerender({ id: 'b' });
    await waitFor(() => expect(result.current.uri).toBe('blob:b'));
  });
});
