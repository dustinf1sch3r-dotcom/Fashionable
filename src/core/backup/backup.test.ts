import { newOutfit, newProfile } from '@/core/model/factories';
import type { Feedback, Item, Outfit, WearLog } from '@/core/model/types';
import { fakeClock, fakeIds } from '@/core/model/testHelpers';
import { fixtureCloset, fixtureFeedback, fixtureWearLogs } from '@/core/testing';
import { buildBackup, referencedImageIds } from './buildBackup';
import { mergeBackup } from './mergeBackup';
import { parseBackup } from './parseBackup';
import { BACKUP_VERSION, type BackupData, type BackupFile, type BackupImages } from './types';

const OPTS = { schemaVersion: 1 };
const clock = fakeClock('2026-03-01T10:00:00.000Z');
const EXPORTED = '2026-03-02T08:00:00.000Z';

function sample(): { data: BackupData; images: BackupImages } {
  const ids = fakeIds('p');
  const items = fixtureCloset().slice(0, 3);
  const outfit: Outfit = newOutfit(
    { itemIds: items.map((i) => i.id), source: 'manual' },
    clock,
    ids,
  );
  const data: BackupData = {
    profile: newProfile({ displayName: 'Sam' }, clock, ids),
    items: [...items, { ...items[0], id: 'gone', deletedAt: '2026-02-01T00:00:00.000Z' }],
    outfits: [outfit],
    wearLogs: fixtureWearLogs().slice(0, 2),
    feedback: fixtureFeedback().slice(0, 2),
  };
  const images: BackupImages = {};
  for (const id of referencedImageIds(data)) images[id] = { mime: 'image/png', base64: 'AAEC' };
  return { data, images };
}

const file = (): BackupFile => {
  const { data, images } = sample();
  return buildBackup(data, images, EXPORTED, 1);
};

const codes = (input: unknown) => {
  const r = parseBackup(input, OPTS);
  return r.ok ? [] : r.problems.map((p) => `${p.path}:${p.code}`);
};

describe('buildBackup', () => {
  it('writes the documented envelope and keeps soft-deleted records', () => {
    const f = file();
    expect(f).toMatchObject({
      format: 'fashionable-backup',
      version: BACKUP_VERSION,
      exportedAt: EXPORTED,
      app: { schemaVersion: 1 },
    });
    expect(f.items.some((i) => i.deletedAt)).toBe(true);
    expect(Object.keys(f)).toEqual([
      'format',
      'version',
      'exportedAt',
      'app',
      'profile',
      'items',
      'outfits',
      'wearLogs',
      'feedback',
      'images',
    ]);
  });
  it('writes a missing profile as null', () => {
    const f = buildBackup({ ...sample().data, profile: undefined }, {}, EXPORTED, 1);
    expect(f.profile).toBeNull();
  });
  it('lists referenced image ids once, including a body photo', () => {
    const { data } = sample();
    const withPhoto = {
      ...data,
      profile: data.profile && {
        ...data.profile,
        bodyPhoto: { imageId: 'body', landmarks: {} as never },
      },
    };
    const found = referencedImageIds(withPhoto);
    expect(found).toContain('body');
    expect(new Set(found).size).toBe(found.length);
    expect(found).toContain(data.items[0].images.thumbId);
  });
});

describe('parseBackup', () => {
  it('round-trips through JSON text', () => {
    const { data, images } = sample();
    const text = JSON.stringify(buildBackup(data, images, EXPORTED, 1));
    const r = parseBackup(text, OPTS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.data).toEqual(data);
    expect(r.value.images).toEqual(images);
    expect(r.value.exportedAt).toBe(EXPORTED);
    expect(r.value.schemaVersion).toBe(1);
  });

  it('accepts an empty closet', () => {
    const empty = buildBackup(
      { profile: undefined, items: [], outfits: [], wearLogs: [], feedback: [] },
      {},
      EXPORTED,
      1,
    );
    expect(parseBackup(empty, OPTS).ok).toBe(true);
  });

  it('rejects text that is not JSON', () => {
    expect(codes('{not json')).toEqual([':not_json']);
    expect(codes('')).toEqual([':not_json']);
  });
  it('rejects non-objects', () => {
    for (const v of [null, 3, [], 'null']) expect(codes(v)).toEqual([':not_an_object']);
  });
  it('rejects other formats', () => {
    expect(codes({ ...file(), format: 'something-else' })).toEqual(['format:wrong_format']);
    expect(codes({ items: [] })).toEqual(['format:wrong_format']);
  });
  it('rejects a newer file version with its own code', () => {
    expect(codes({ ...file(), version: BACKUP_VERSION + 1 })).toEqual(['version:newer_version']);
  });
  it('rejects missing, zero or fractional versions', () => {
    const { version: _v, ...noVersion } = file();
    expect(codes(noVersion)).toEqual(['version:missing']);
    expect(codes({ ...file(), version: 0 })).toEqual(['version:unsupported_version']);
    expect(codes({ ...file(), version: 1.5 })).toEqual(['version:unsupported_version']);
    expect(codes({ ...file(), version: '1' })).toEqual(['version:unsupported_version']);
  });
  it('rejects data written by a newer record schema', () => {
    expect(codes({ ...file(), app: { schemaVersion: 2 } })).toEqual([
      'app.schemaVersion:newer_schema',
    ]);
    expect(codes({ ...file(), app: {} })).toEqual(['app.schemaVersion:missing']);
    expect(codes({ ...file(), app: { schemaVersion: 'x' } })).toEqual([
      'app.schemaVersion:wrong_type',
    ]);
  });
  it('rejects a bad exportedAt', () => {
    expect(codes({ ...file(), exportedAt: 'soon' })).toEqual(['exportedAt:wrong_type']);
  });
  it('reports missing and mistyped collections', () => {
    const { items: _i, ...noItems } = file();
    expect(codes(noItems)).toEqual(['items:missing']);
    expect(codes({ ...file(), outfits: {} })).toEqual(['outfits:wrong_type']);
    const { images: _m, ...noImages } = file();
    expect(codes(noImages)).toEqual(['images:missing']);
    expect(codes({ ...file(), images: [] })).toEqual(['images:wrong_type']);
    const { profile: _p, ...noProfile } = file();
    expect(codes(noProfile)).toEqual(['profile:missing']);
  });
  it('points at the corrupt record in every collection', () => {
    const f = file();
    const bad = (x: object) => ({ ...x, id: '' });
    expect(codes({ ...f, items: [f.items[0], bad(f.items[1])] })).toEqual([
      'items.1:invalid_record',
    ]);
    expect(codes({ ...f, outfits: [bad(f.outfits[0])] })).toEqual(['outfits.0:invalid_record']);
    expect(codes({ ...f, wearLogs: [bad(f.wearLogs[0])] })).toEqual(['wearLogs.0:invalid_record']);
    expect(codes({ ...f, feedback: [bad(f.feedback[0])] })).toEqual(['feedback.0:invalid_record']);
    expect(codes({ ...f, profile: { id: 'x' } })).toEqual(['profile:invalid_record']);
    expect(codes({ ...f, items: [42] })).toEqual(['items.0:invalid_record']);
  });
  it('rejects duplicate ids inside a collection', () => {
    const f = file();
    expect(codes({ ...f, items: [f.items[0], f.items[0]] })).toEqual(['items.1.id:duplicate_id']);
  });
  it('rejects malformed images', () => {
    const f = file();
    const id = Object.keys(f.images)[0];
    const withImage = (img: unknown) => ({ ...f, images: { ...f.images, [id]: img } });
    const path = `images.${id}:invalid_image`;
    expect(codes(withImage({ mime: 'image/png', base64: 'not base64!' }))).toEqual([path]);
    expect(codes(withImage({ mime: 'image/png', base64: 'AAE' }))).toEqual([path]);
    expect(codes(withImage({ mime: 'png', base64: 'AAEC' }))).toEqual([path]);
    expect(codes(withImage({ base64: 'AAEC' }))).toEqual([path]);
    expect(codes(withImage('AAEC'))).toEqual([path]);
  });
  it('caps the number of reported problems', () => {
    const f = file();
    const many = Array.from({ length: 100 }, () => 1);
    const r = parseBackup({ ...f, items: many }, { ...OPTS, maxProblems: 5 });
    expect(r.ok ? 0 : r.problems.length).toBe(5);
  });
  it('runs migrations for older schema versions and reports a failing one', () => {
    const f = { ...file(), app: { schemaVersion: 0 } };
    const migrate = jest.fn((_c: string, records: unknown[]) => records);
    expect(parseBackup(f, { ...OPTS, migrate }).ok).toBe(true);
    expect(migrate).toHaveBeenCalledWith('items', expect.any(Array), 0);
    const boom = () => {
      throw new Error('x');
    };
    expect(codes(f)).toEqual([]);
    const r = parseBackup(f, { ...OPTS, migrate: boom });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0].code).toBe('migration_failed');
  });
  it('does not migrate files already at the current schema', () => {
    const migrate = jest.fn();
    parseBackup(file(), { ...OPTS, migrate });
    expect(migrate).not.toHaveBeenCalled();
  });
});

describe('mergeBackup', () => {
  const base = (): BackupData => sample().data;
  const at = <T extends { updatedAt: string }>(r: T, updatedAt: string): T => ({ ...r, updatedAt });

  it('replace returns the incoming data only', () => {
    const existing = base();
    const incoming: BackupData = {
      ...base(),
      items: [existing.items[0], at(existing.items[1], '2030-01-01T00:00:00.000Z')],
      outfits: [],
      wearLogs: [],
      feedback: [],
    };
    const { data, stats } = mergeBackup(existing, incoming, 'replace');
    expect(data.items).toEqual(incoming.items);
    expect(data.outfits).toEqual([]);
    expect(data.profile).toEqual(incoming.profile);
    expect(stats.items).toEqual({ added: 0, updated: 2, skipped: 0 });
  });

  it('replace with no incoming profile drops the profile', () => {
    expect(mergeBackup(base(), { ...base(), profile: undefined }, 'replace').data.profile).toBe(
      undefined,
    );
  });

  it('merge unions by id', () => {
    const existing = base();
    const extra = { ...existing.items[0], id: 'new-one' };
    const incoming: BackupData = { ...base(), items: [extra] };
    const { data, stats } = mergeBackup(existing, incoming, 'merge');
    expect(data.items).toHaveLength(existing.items.length + 1);
    expect(data.items.map((i) => i.id)).toContain('new-one');
    expect(stats.items).toEqual({ added: 1, updated: 0, skipped: 0 });
  });

  it('merge: newer updatedAt wins in either direction, a tie keeps the existing record', () => {
    const existing = base();
    const [a, b, c] = existing.items;
    const incoming: BackupData = {
      ...base(),
      items: [
        { ...a, notes: 'incoming newer', updatedAt: '2030-01-01T00:00:00.000Z' },
        { ...b, notes: 'incoming older', updatedAt: '2000-01-01T00:00:00.000Z' },
        { ...c, notes: 'incoming tie' },
      ],
    };
    const { data, stats } = mergeBackup(existing, incoming, 'merge');
    const byId = (id: string): Item => data.items.find((i) => i.id === id) as Item;
    expect(byId(a.id).notes).toBe('incoming newer');
    expect(byId(b.id).notes).toBe(b.notes);
    expect(byId(c.id).notes).toBe(c.notes);
    expect(stats.items).toEqual({ added: 0, updated: 1, skipped: 2 });
  });

  it('merge: a newer deletion beats an older live record, and an older one loses', () => {
    const existing = base();
    const [a, b] = existing.items;
    const incoming: BackupData = {
      ...base(),
      items: [
        { ...a, deletedAt: '2031-01-01T00:00:00.000Z', updatedAt: '2031-01-01T00:00:00.000Z' },
        { ...b, deletedAt: '1999-01-01T00:00:00.000Z', updatedAt: '1999-01-01T00:00:00.000Z' },
      ],
    };
    const { data } = mergeBackup(existing, incoming, 'merge');
    expect(data.items.find((i) => i.id === a.id)?.deletedAt).toBeDefined();
    expect(data.items.find((i) => i.id === b.id)?.deletedAt).toBeUndefined();
  });

  it('merge compares instants, not strings, across time zones', () => {
    const existing = base();
    const a = existing.items[0];
    const older = { ...a, updatedAt: '2026-01-01T12:00:00.000Z' };
    const newer = { ...a, updatedAt: '2026-01-01T13:00:00+02:00' }; // 11:00Z, so older
    const r = mergeBackup({ ...existing, items: [older] }, { ...base(), items: [newer] }, 'merge');
    expect(r.data.items[0].updatedAt).toBe(older.updatedAt);
  });

  it('merges every collection', () => {
    const existing = base();
    const wl: WearLog = { ...existing.wearLogs[0], id: 'wl-new' };
    const fb: Feedback = { ...existing.feedback[0], id: 'fb-new' };
    const out: Outfit = { ...existing.outfits[0], id: 'o-new' };
    const { data, stats } = mergeBackup(
      existing,
      { profile: undefined, items: [], outfits: [out], wearLogs: [wl], feedback: [fb] },
      'merge',
    );
    expect(data.outfits).toHaveLength(2);
    expect(data.wearLogs).toHaveLength(existing.wearLogs.length + 1);
    expect(data.feedback).toHaveLength(existing.feedback.length + 1);
    expect(stats.outfits.added + stats.wearLogs.added + stats.feedback.added).toBe(3);
    expect(data.profile).toEqual(existing.profile);
  });

  it('merge keeps a single profile: the newer one wins, even with a different id', () => {
    const existing = base();
    const profile = existing.profile;
    if (!profile) throw new Error('fixture');
    const newer = {
      ...profile,
      id: 'other',
      displayName: 'New',
      updatedAt: '2031-01-01T00:00:00.000Z',
    };
    const older = {
      ...profile,
      id: 'other',
      displayName: 'Old',
      updatedAt: '2000-01-01T00:00:00.000Z',
    };
    expect(mergeBackup(existing, { ...base(), profile: newer }, 'merge').data.profile).toEqual(
      newer,
    );
    const kept = mergeBackup(existing, { ...base(), profile: older }, 'merge');
    expect(kept.data.profile).toEqual(profile);
    expect(kept.stats.profile.skipped).toBe(1);
    const fromNothing = mergeBackup(
      { ...existing, profile: undefined },
      { ...base(), profile: older },
      'merge',
    );
    expect(fromNothing.data.profile).toEqual(older);
    expect(fromNothing.stats.profile.added).toBe(1);
  });

  it('merging a backup into itself changes nothing', () => {
    const existing = base();
    const { data, stats } = mergeBackup(existing, base(), 'merge');
    expect(data).toEqual(existing);
    expect(stats.items).toEqual({ added: 0, updated: 0, skipped: existing.items.length });
  });

  it('does not mutate its inputs', () => {
    const existing = base();
    const incoming = base();
    const snapshot = JSON.stringify([existing, incoming]);
    mergeBackup(existing, incoming, 'merge');
    mergeBackup(existing, incoming, 'replace');
    expect(JSON.stringify([existing, incoming])).toBe(snapshot);
  });
});
