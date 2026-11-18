import { createLru } from './lru';

describe('createLru', () => {
  it('evicts the least recently used entry and reports it', () => {
    const evicted: string[] = [];
    const lru = createLru<number>(2, (k) => evicted.push(k));
    lru.set('a', 1);
    lru.set('b', 2);
    expect(lru.get('a')).toBe(1); // a is now the freshest
    lru.set('c', 3);
    expect(evicted).toEqual(['b']);
    expect(lru.has('b')).toBe(false);
    expect(lru.size).toBe(2);
  });

  it('reports a replaced value so its resource can be freed', () => {
    const evicted: [string, number][] = [];
    const lru = createLru<number>(3, (k, v) => evicted.push([k, v]));
    lru.set('a', 1);
    lru.set('a', 2);
    expect(evicted).toEqual([['a', 1]]);
    expect(lru.get('a')).toBe(2);
  });
});
