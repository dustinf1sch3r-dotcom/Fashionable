import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('differs between seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next stays in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const r = createRng(123);
    const n = 20000;
    const buckets = new Array<number>(10).fill(0);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = r.next();
      sum += v;
      buckets[Math.floor(v * 10)] += 1;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
    for (const c of buckets) {
      expect(c).toBeGreaterThan(n / 10 - 250);
      expect(c).toBeLessThan(n / 10 + 250);
    }
  });

  it('int is inclusive and covers the range', () => {
    const r = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
    expect(r.int(4, 4)).toBe(4);
  });

  it('pick returns members and throws when empty', () => {
    const r = createRng(9);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
    expect(() => r.pick([])).toThrow();
  });

  it('shuffle is a non-mutating permutation, deterministic per seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...arr];
    const out = createRng(11).shuffle(arr);
    expect(arr).toEqual(copy);
    expect([...out].sort((x, y) => x - y)).toEqual(copy);
    expect(createRng(11).shuffle(arr)).toEqual(out);
    expect(createRng(12).shuffle(arr)).not.toEqual(out);
  });
});
