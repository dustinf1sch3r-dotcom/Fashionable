/** @jest-environment node */
import { newItem, newOutfit, newProfile } from '@/core/model/factories';
import type { Item } from '@/core/model/types';
import { createTestServices } from '../index';
import type { MemoryImageStore } from '../testing/memoryImageStore';
import { exportBackup, importBackup, backupFilename } from './backupService';

const PNG = [0x89, 0x50, 0x4e, 0x47, 1, 2, 3];

async function seeded() {
  const services = createTestServices();
  const images = services.images as MemoryImageStore;
  const save = (id: string, bytes: number[], type?: string) =>
    images.save(new Blob([new Uint8Array(bytes)], type ? { type } : undefined), { id });
  await save('o1', PNG, 'image/png');
  await save('c1', PNG);
  await save('t1', [0xff, 0xd8, 0xff, 9], 'image/jpeg');
  const item: Item = newItem(
    {
      category: 'top',
      subcategory: 'tshirt',
      colors: [{ hex: '#112233', name: 'navy', share: 1 }],
      images: { originalId: 'o1', cutoutId: 'c1', thumbId: 't1' },
      cutout: { aspectRatio: 1, hasAlpha: true },
    },
    services.clock,
    services.ids,
  );
  await services.items.put(item);
  const deleted = { ...item, id: 'deleted-item', deletedAt: '2026-01-02T00:00:00.000Z' };
  await services.items.put(deleted);
  await services.outfits.put(
    newOutfit({ itemIds: [item.id], source: 'manual' }, services.clock, services.ids),
  );
  await services.profile.put(newProfile({ displayName: 'Sam' }, services.clock, services.ids));
  return { services, item, deleted };
}

describe('exportBackup', () => {
  it('writes records (tombstones included), images and a dated filename', async () => {
    const { services, item } = await seeded();
    const out = await exportBackup(services);
    expect(out.filename).toBe('fashionable-backup-2026-01-01.json');
    expect(out.counts).toMatchObject({ items: 2, outfits: 1, images: 3 });
    expect(out.missingImages).toEqual([]);
    const doc = JSON.parse(await out.blob.text());
    expect(doc).toMatchObject({
      format: 'fashionable-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      app: { schemaVersion: 1 },
    });
    expect(doc.items.map((i: Item) => i.id).sort()).toEqual([item.id, 'deleted-item'].sort());
    expect(Object.keys(doc.images).sort()).toEqual(['c1', 'o1', 't1']);
    expect(doc.images.t1.mime).toBe('image/jpeg');
    expect(doc.images.c1.mime).toBe('image/png'); // sniffed: the blob had no type
    expect(doc.images.o1.base64).toBe(btoa(String.fromCharCode(...PNG)));
    expect(out.blob.type).toBe('application/json');
  });

  it('reports images the store cannot provide instead of failing', async () => {
    const { services } = await seeded();
    await services.images.remove('c1');
    const out = await exportBackup(services);
    expect(out.missingImages).toEqual(['c1']);
    expect(out.counts.images).toBe(2);
    expect(Object.keys(JSON.parse(await out.blob.text()).images).sort()).toEqual(['o1', 't1']);
  });

  it('exports an empty closet as a valid file', async () => {
    const out = await exportBackup(createTestServices());
    const doc = JSON.parse(await out.blob.text());
    expect(doc).toMatchObject({ items: [], images: {}, profile: null });
  });
});

describe('importBackup', () => {
  it('round-trips into empty storage (replace) with images and tombstones', async () => {
    const { services, item } = await seeded();
    const text = await (await exportBackup(services)).blob.text();

    const fresh = createTestServices();
    const res = await importBackup(text, 'replace', fresh);
    expect(res).toMatchObject({
      ok: true,
      stats: { items: { added: 2, updated: 0, skipped: 0 }, outfits: { added: 1 } },
      images: { written: 3, skipped: 0 },
    });
    expect(await fresh.items.list()).toEqual([item]);
    expect((await fresh.items.listAll()).map((i) => i.id)).toContain('deleted-item');
    expect(await fresh.outfits.list()).toHaveLength(1);
    expect((await fresh.profile.list())[0].displayName).toBe('Sam');
    const back = await fresh.images.read('o1');
    expect(back.type).toBe('image/png');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(new Uint8Array(PNG));
  });

  it('replace discards what was there', async () => {
    const { services } = await seeded();
    const text = await (await exportBackup(services)).blob.text();
    const other = createTestServices();
    await other.items.put({ ...(await services.items.list())[0], id: 'local-only' });
    await importBackup(text, 'replace', other);
    expect((await other.items.listAll()).map((i) => i.id)).not.toContain('local-only');
  });

  it('merge keeps local-only records and lets the newer side win', async () => {
    const { services, item } = await seeded();
    const text = await (await exportBackup(services)).blob.text();

    const other = createTestServices();
    const local = { ...item, id: 'local-only' };
    const newerCopy = { ...item, notes: 'edited here', updatedAt: '2030-01-01T00:00:00.000Z' };
    await other.items.put(local);
    await other.items.put(newerCopy);
    const res = await importBackup(text, 'merge', other);
    expect(res).toMatchObject({
      ok: true,
      stats: { items: { added: 1, updated: 0, skipped: 1 } }, // tombstone added, item skipped
    });
    const all = await other.items.listAll();
    expect(all.map((i) => i.id).sort()).toEqual(['deleted-item', item.id, 'local-only'].sort());
    expect(all.find((i) => i.id === item.id)?.notes).toBe('edited here');
  });

  it('does not rewrite images that are already stored with the same size', async () => {
    const { services } = await seeded();
    const text = await (await exportBackup(services)).blob.text();
    const res = await importBackup(text, 'merge', services);
    expect(res).toMatchObject({ ok: true, images: { written: 0, skipped: 3 } });
  });

  it('rewrites an image whose size differs', async () => {
    const { services } = await seeded();
    const text = await (await exportBackup(services)).blob.text();
    await services.images.save(new Blob([new Uint8Array([1])]), { id: 'o1' });
    const res = await importBackup(text, 'merge', services);
    expect(res).toMatchObject({ ok: true, images: { written: 1, skipped: 2 } });
  });

  it('rejects garbage without touching storage', async () => {
    const { services } = await seeded();
    const before = JSON.stringify(await services.items.listAll());
    for (const text of [
      'not json',
      '{}',
      JSON.stringify({ format: 'fashionable-backup', version: 9 }),
    ]) {
      const res = await importBackup(text, 'replace', services);
      expect(res.ok).toBe(false);
    }
    expect(JSON.stringify(await services.items.listAll())).toBe(before);
    expect((await services.images.read('o1')).size).toBe(PNG.length);
  });

  it('reports a newer file version with its code', async () => {
    const res = await importBackup(
      JSON.stringify({ format: 'fashionable-backup', version: 2 }),
      'merge',
      createTestServices(),
    );
    expect(res).toEqual({ ok: false, problems: [{ path: 'version', code: 'newer_version' }] });
  });
});

describe('backupFilename', () => {
  it('uses the UTC date', () => {
    expect(backupFilename(new Date('2026-12-31T23:59:59Z'))).toBe(
      'fashionable-backup-2026-12-31.json',
    );
  });
});
