import type { IdGenerator } from '../model/ports';

/** Readable deterministic ids: `item-001`, `item-002`, … */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { uuid: () => `${prefix}-${String(++n).padStart(3, '0')}` };
}
