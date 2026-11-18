import { fixedClock } from './clock';
import { sequentialIds } from './ids';

describe('deterministic helpers', () => {
  it('fixedClock never moves', () => {
    const c = fixedClock('2026-03-01T08:00:00.000Z');
    expect(c.now().toISOString()).toBe('2026-03-01T08:00:00.000Z');
    expect(c.now().toISOString()).toBe('2026-03-01T08:00:00.000Z');
    expect(() => fixedClock('garbage')).toThrow();
  });

  it('sequentialIds are readable and ordered', () => {
    const ids = sequentialIds('item');
    expect([ids.uuid(), ids.uuid(), ids.uuid()]).toEqual(['item-001', 'item-002', 'item-003']);
  });
});
