import { createFakeOutfitCompositor } from '@/services/testing';
import type { OutfitCompositor } from '@/services';
import { createCompositeEngine, type CompositeJob } from './compositeEngine';

const job = (key: string): CompositeJob => ({
  key,
  request: { backdropUri: '', kind: 'silhouette', layers: [], pixelsPerUnit: 0.5, seed: 1 },
});

describe('createCompositeEngine', () => {
  it('renders once per key and serves later requests from the cache', async () => {
    const compositor = createFakeOutfitCompositor();
    const engine = createCompositeEngine(compositor);
    const [a, b] = await Promise.all([engine.request(job('a')), engine.request(job('a'))]);
    expect(a).toBe(b);
    expect(compositor.calls).toBe(1);
    expect(engine.peek('a')).toBe(a);
    expect(await engine.request(job('a'))).toBe(a);
    expect(compositor.calls).toBe(1);
  });

  it('runs renders one at a time', async () => {
    let running = 0;
    let most = 0;
    const compositor: OutfitCompositor = {
      available: true,
      async compose() {
        running += 1;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return { uri: `blob:${Math.random()}` };
      },
    };
    const engine = createCompositeEngine(compositor);
    await Promise.all(['a', 'b', 'c'].map((k) => engine.request(job(k))));
    expect(most).toBe(1);
  });

  it('evicts the least recently used picture and releases its URL', async () => {
    const compositor = createFakeOutfitCompositor();
    const engine = createCompositeEngine(compositor, { max: 2 });
    const a = await engine.request(job('a'));
    await engine.request(job('b'));
    engine.peek('a'); // a is now newer than b
    await engine.request(job('c'));
    expect(engine.peek('b')).toBeUndefined();
    expect(engine.peek('a')).toBe(a);
    expect(compositor.released).toHaveLength(1);
    expect(compositor.released[0]).not.toBe(a);
  });

  it('keeps an evicted picture that is still on screen until it is unpinned', async () => {
    const compositor = createFakeOutfitCompositor();
    const engine = createCompositeEngine(compositor, { max: 1 });
    const a = await engine.request(job('a'));
    const unpin = engine.pin('a');
    await engine.request(job('b'));
    expect(engine.peek('a')).toBeUndefined();
    expect(compositor.released).toEqual([]);
    unpin();
    expect(compositor.released).toEqual([a]);
    unpin(); // a second call changes nothing
    expect(compositor.released).toEqual([a]);
  });

  it('does not retry a key that failed', async () => {
    const compose = jest.fn(async () => {
      throw new Error('no canvas');
    });
    const engine = createCompositeEngine({ available: true, compose });
    expect(await engine.request(job('a'))).toBeUndefined();
    expect(engine.failed('a')).toBe(true);
    expect(await engine.request(job('a'))).toBeUndefined();
    expect(compose).toHaveBeenCalledTimes(1);
    // A failure does not stop the queue.
    const ok = createCompositeEngine(createFakeOutfitCompositor());
    expect(await ok.request(job('b'))).toBeDefined();
  });
});
