import type { Clock } from '../types';

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
