import { renderHook, waitFor } from '@testing-library/react-native';

import { createUriCache } from './imageUris';
import { useImageUris } from './useImageUris';

describe('useImageUris', () => {
  it('resolves every id, deduplicates lookups and leaves missing ids undefined', async () => {
    const calls: string[] = [];
    const cache = createUriCache(async (id) => {
      calls.push(id);
      if (id === 'gone') throw new Error('missing');
      return `blob:${id}`;
    });
    const { result } = await renderHook(() => useImageUris(['a', 'b', 'a', 'gone'], cache));
    await waitFor(() => expect(result.current.b).toBe('blob:b'));
    expect(result.current).toEqual({ a: 'blob:a', b: 'blob:b', gone: undefined });
    expect(calls.sort()).toEqual(['a', 'b', 'gone']);
  });
});
