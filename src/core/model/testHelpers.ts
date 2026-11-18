import type { Clock, IdGenerator } from './ports';

/** Clock that returns a fixed time, advanced by `advance`. For tests only. */
export function fakeClock(startIso = '2026-01-15T10:00:00.000Z'): Clock & {
  advance(ms: number): void;
} {
  let t = Date.parse(startIso);
  return {
    now: () => new Date(t),
    advance(ms: number) {
      t += ms;
    },
  };
}

/** Deterministic ids `id-1`, `id-2`, … For tests only. */
export function fakeIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { uuid: () => `${prefix}-${++n}` };
}
