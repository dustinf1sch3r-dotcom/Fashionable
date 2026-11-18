import { createIdGenerator, uuidFromBytes } from './ids';
import { createSystemClock } from './clock';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createIdGenerator', () => {
  it('formats bytes as a v4 UUID', () => {
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
    expect(uuidFromBytes(new Uint8Array(16).fill(255))).toBe(
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
    );
  });

  it('prefers crypto.randomUUID', () => {
    expect(createIdGenerator({ randomUUID: () => 'fixed' }).uuid()).toBe('fixed');
  });

  it('falls back to getRandomValues', () => {
    const gen = createIdGenerator({
      getRandomValues: (a) => {
        a.fill(7);
        return a;
      },
    });
    expect(gen.uuid()).toMatch(V4);
  });

  it('falls back to Math.random when no crypto exists', () => {
    const gen = createIdGenerator({});
    const ids = new Set(Array.from({ length: 200 }, () => gen.uuid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it('default generator yields valid UUIDs on this runtime', () => {
    expect(createIdGenerator().uuid()).toMatch(V4);
  });
});

describe('createSystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const t = createSystemClock().now().getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });
});
