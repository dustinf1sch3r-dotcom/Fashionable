import type { OutfitCompositor } from '@/services';
import { createLru } from '../fit/lru';

export type ComposeRequest = Parameters<OutfitCompositor['compose']>[0];

export interface CompositeJob {
  /** `compositeKey(...)` of what the request below draws. */
  key: string;
  request: ComposeRequest;
}

export interface CompositeEngine {
  readonly available: boolean;
  /** The finished picture for `key`, refreshing its place in the cache. */
  peek(key: string): string | undefined;
  /** True once rendering `key` failed (it is not retried). */
  failed(key: string): boolean;
  /** Render (or reuse) the picture for `job`; resolves `undefined` when rendering fails. */
  request(job: CompositeJob): Promise<string | undefined>;
  /**
   * Mark `key` as on screen: its picture is not released while pinned, even if the cache evicts
   * it. Returns the matching unpin.
   */
  pin(key: string): () => void;
}

interface EngineOptions {
  /** Most finished pictures kept; the object URLs of evicted ones are released. Default 30. */
  max?: number;
}

/**
 * Cache and scheduler in front of the compositor: an in-memory LRU of merged pictures keyed by
 * `compositeKey`, identical requests share one render, and renders run one at a time (each holds
 * several full-size pixel buffers). A key that failed is not retried; the layered picture simply
 * stays. A picture still on screen when evicted is released once it is unpinned.
 */
export function createCompositeEngine(
  compositor: OutfitCompositor,
  options: EngineOptions = {},
): CompositeEngine {
  const { max = 30 } = options;
  const pins = new Map<string, number>();
  const evicted = new Map<string, string[]>();
  const cache = createLru<string>(max, (key, uri) => {
    if ((pins.get(key) ?? 0) > 0) evicted.set(key, [...(evicted.get(key) ?? []), uri]);
    else compositor.release?.(uri);
  });
  const inflight = new Map<string, Promise<string | undefined>>();
  const failed = new Set<string>();
  let tail: Promise<unknown> = Promise.resolve();

  async function render(job: CompositeJob): Promise<string | undefined> {
    try {
      const out = await compositor.compose(job.request);
      cache.set(job.key, out.uri);
      return out.uri;
    } catch {
      failed.add(job.key);
      return undefined;
    }
  }

  return {
    available: compositor.available,
    peek: (key) => cache.get(key),
    failed: (key) => failed.has(key),
    request(job) {
      const hit = cache.get(job.key);
      if (hit) return Promise.resolve(hit);
      if (failed.has(job.key)) return Promise.resolve(undefined);
      const pending = inflight.get(job.key);
      if (pending) return pending;
      const p = tail.then(() => render(job)).finally(() => inflight.delete(job.key));
      tail = p;
      inflight.set(job.key, p);
      return p;
    },
    pin(key) {
      pins.set(key, (pins.get(key) ?? 0) + 1);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const left = (pins.get(key) ?? 1) - 1;
        if (left > 0) {
          pins.set(key, left);
          return;
        }
        pins.delete(key);
        for (const uri of evicted.get(key) ?? []) compositor.release?.(uri);
        evicted.delete(key);
      };
    },
  };
}
