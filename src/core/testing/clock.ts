import type { Clock } from '../model/ports';
import { fakeClock } from '../model/testHelpers';

export { fakeClock };

/** Clock frozen at `iso`. */
export function fixedClock(iso = '2026-01-15T10:00:00.000Z'): Clock {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Invalid ISO time "${iso}"`);
  return { now: () => new Date(t) };
}
