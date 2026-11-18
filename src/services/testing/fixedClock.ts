import type { Clock } from '../types';

export interface FixedClock extends Clock {
  set(date: Date | string): void;
  advance(ms: number): void;
}

export function createFixedClock(start: Date | string = '2026-01-01T00:00:00.000Z'): FixedClock {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set: (date) => {
      current = new Date(date);
    },
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
}
