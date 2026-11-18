import { CURRENT_SCHEMA_VERSION, migrate, MigrationError, type Migration } from './migrations';

describe('migrate', () => {
  it('current version is 1 and v1 data passes through unchanged', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    const stored = { schemaVersion: 1, records: [{ id: 'a' }] };
    expect(migrate('items', stored)).toEqual(stored);
  });

  it('wraps a legacy bare array as version 1 (identity on records)', () => {
    expect(migrate('items', [{ id: 'a' }])).toEqual({ schemaVersion: 1, records: [{ id: 'a' }] });
  });

  it('shows how a v0 -> v1 migration runs', () => {
    const registry: Record<string, Migration[]> = {
      items: [{ from: 0, up: (rs) => rs.map((r) => ({ ...(r as object), favorite: false })) }],
    };
    expect(migrate('items', [{ id: 'a' }], registry)).toEqual({
      schemaVersion: 1,
      records: [{ id: 'a', favorite: false }],
    });
    // other collections are untouched
    expect(migrate('outfits', [{ id: 'o' }], registry).records).toEqual([{ id: 'o' }]);
  });

  it('applies several steps in order up to the target', () => {
    const registry: Record<string, Migration[]> = {
      items: [
        { from: 1, up: (rs) => rs.map((r) => ({ ...(r as object), v2: true })) },
        { from: 2, up: (rs) => rs.map((r) => ({ ...(r as object), v3: true })) },
      ],
    };
    const out = migrate('items', { schemaVersion: 1, records: [{ id: 'a' }] }, registry, 3);
    expect(out).toEqual({ schemaVersion: 3, records: [{ id: 'a', v2: true, v3: true }] });
  });

  it('rejects newer or malformed data', () => {
    expect(() => migrate('items', { schemaVersion: 2, records: [] })).toThrow(MigrationError);
    expect(() => migrate('items', 'x')).toThrow(MigrationError);
    expect(() => migrate('items', { schemaVersion: 1, records: 'no' })).toThrow(MigrationError);
  });
});
