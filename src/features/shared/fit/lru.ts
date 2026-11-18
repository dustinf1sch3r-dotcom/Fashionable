/** A least-recently-used map: reads refresh an entry, and the oldest entry goes past `max`. */
export interface Lru<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  readonly size: number;
}

export function createLru<V>(max: number, onEvict?: (key: string, value: V) => void): Lru<V> {
  const map = new Map<string, V>();
  return {
    get(key) {
      const value = map.get(key);
      if (value === undefined) return undefined;
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      const old = map.get(key);
      if (old !== undefined && old !== value) onEvict?.(key, old);
      map.delete(key);
      map.set(key, value);
      while (map.size > max) {
        const first = map.keys().next();
        if (first.done) break;
        const evicted = map.get(first.value);
        map.delete(first.value);
        if (evicted !== undefined) onEvict?.(first.value, evicted);
      }
    },
    has: (key) => map.has(key),
    get size() {
      return map.size;
    },
  };
}
