import type { ID } from '@/core/model/types';
import { getServices } from '@/services';

export interface UriCache {
  /** The resolved URI if already known. */
  peek(id: ID): string | undefined;
  /** Resolve (once per id, concurrent calls share one lookup). Resolves to `undefined` if missing. */
  load(id: ID): Promise<string | undefined>;
}

/**
 * Caches successful lookups only, so an image saved after a failed lookup is found next time.
 */
export function createUriCache(resolve: (id: ID) => Promise<string>): UriCache {
  const done = new Map<ID, string>();
  const inflight = new Map<ID, Promise<string | undefined>>();
  return {
    peek: (id) => done.get(id),
    load(id) {
      const hit = done.get(id);
      if (hit !== undefined) return Promise.resolve(hit);
      const pending = inflight.get(id);
      if (pending) return pending;
      const p = resolve(id).then(
        (uri) => {
          done.set(id, uri);
          inflight.delete(id);
          return uri;
        },
        () => {
          inflight.delete(id);
          return undefined;
        },
      );
      inflight.set(id, p);
      return p;
    },
  };
}

let shared: UriCache | undefined;

/** App-wide cache over the real image store (created on first use). */
export function getSharedUriCache(): UriCache {
  shared ??= createUriCache((id) => getServices().images.uri(id));
  return shared;
}
