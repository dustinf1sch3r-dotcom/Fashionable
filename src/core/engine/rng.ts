/** Seeded pseudo-random generator (mulberry32). Same seed → same sequence, so the generator is reproducible. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A random element. Throws on an empty array. */
  pick<T>(arr: readonly T[]): T;
  /** A shuffled copy (Fisher–Yates); the input is not modified. */
  shuffle<T>(arr: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(next() * (hi - lo + 1));
  };
  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('pick from empty array');
    return arr[int(0, arr.length - 1)] as T;
  };
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  return { next, int, pick, shuffle };
}
