import type { IdGenerator } from '../types';

/** Deterministic, UUID-shaped ids: `00000000-0000-4000-8000-000000000001`, then `…02`, … */
export function createSequentialIds(): IdGenerator {
  let n = 0;
  return {
    uuid: () => {
      n += 1;
      return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
    },
  };
}
