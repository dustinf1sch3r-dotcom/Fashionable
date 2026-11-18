import { createRng } from './rng';

describe('engine createRng', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    expect(Array.from({ length: 10 }, () => b.next())).toEqual(seqA);
    const c = createRng(43);
    expect(Array.from({ length: 10 }, () => c.next())).not.toEqual(seqA);
  });

  it('keeps next() in [0, 1) and int() within its inclusive range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(-2, 3);
      expect(n).toBeGreaterThanOrEqual(-2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('shuffles without mutating the input and keeps the elements', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = createRng(1).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});
