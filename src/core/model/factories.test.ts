import {
  newFeedback,
  newItem,
  newOutfit,
  newProfile,
  newWearLog,
  softDelete,
  touch,
  type NewItemInit,
} from './factories';
import { fakeClock, fakeIds } from './testHelpers';
import {
  validateFeedback,
  validateItem,
  validateOutfit,
  validateProfile,
  validateWearLog,
} from './validate';

const T0 = '2026-01-15T10:00:00.000Z';
const base: NewItemInit = {
  category: 'top',
  subcategory: 'tshirt',
  colors: [{ hex: '#ffffff', share: 1, name: 'white' }],
  images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
  cutout: { aspectRatio: 1, hasAlpha: true },
};

describe('newItem', () => {
  it('fills defaults from the taxonomy and stamps entity fields', () => {
    const item = newItem(base, fakeClock(), fakeIds());
    expect(item).toMatchObject({
      id: 'id-1',
      createdAt: T0,
      updatedAt: T0,
      layer: 'base',
      formality: 2,
      warmth: 1,
      rainOk: true,
      sporty: false,
      pattern: 'solid',
      patternBold: false,
      status: 'active',
      favorite: false,
    });
    expect(item.deletedAt).toBeUndefined();
    expect(validateItem(item).ok).toBe(true);
  });

  it('lets the caller override defaults', () => {
    const item = newItem(
      { ...base, subcategory: 'sweater', formality: 5, layer: 'base', name: 'x' },
      fakeClock(),
      fakeIds(),
    );
    expect(item.formality).toBe(5);
    expect(item.layer).toBe('base');
    expect(item.name).toBe('x');
    expect(item.warmth).toBe(4);
  });

  it('only sets layer on tops', () => {
    const item = newItem(
      { ...base, category: 'bottom', subcategory: 'jeans', layer: 'mid' },
      fakeClock(),
      fakeIds(),
    );
    expect('layer' in item).toBe(false);
    expect(item.warmth).toBe(3);
    expect(validateItem(item).ok).toBe(true);
  });

  it('throws on an unknown subcategory', () => {
    expect(() => newItem({ ...base, subcategory: 'jeans' }, fakeClock(), fakeIds())).toThrow(Error);
  });

  it('is deterministic with fake clock and ids', () => {
    expect(newItem(base, fakeClock(), fakeIds())).toEqual(newItem(base, fakeClock(), fakeIds()));
  });
});

describe('newOutfit / newWearLog / newProfile', () => {
  it('builds valid outfits with defaults and copies itemIds', () => {
    const ids = ['a', 'b'];
    const o = newOutfit({ itemIds: ids }, fakeClock(), fakeIds());
    expect(o).toMatchObject({ id: 'id-1', source: 'manual', favorite: false, createdAt: T0 });
    expect(o.itemIds).toEqual(ids);
    expect(o.itemIds).not.toBe(ids);
    expect(validateOutfit(o).ok).toBe(true);
    expect(
      newOutfit({ itemIds: [], source: 'generated', name: 'n' }, fakeClock(), fakeIds()),
    ).toMatchObject({
      source: 'generated',
      name: 'n',
    });
  });

  it('builds valid wear logs, planned defaulting to false', () => {
    const w = newWearLog({ date: '2026-01-15', itemIds: ['a'] }, fakeClock(), fakeIds());
    expect(w.planned).toBe(false);
    expect(validateWearLog(w).ok).toBe(true);
    expect(
      newWearLog({ date: '2026-01-16', itemIds: [], planned: true }, fakeClock(), fakeIds())
        .planned,
    ).toBe(true);
  });

  it('builds valid profiles with defaults', () => {
    const p = newProfile({}, fakeClock(), fakeIds());
    expect(p).toMatchObject({ bodyTemplateId: 'body-a', units: 'metric' });
    expect(validateProfile(p).ok).toBe(true);
    expect(
      newProfile({ units: 'imperial', displayName: 'A' }, fakeClock(), fakeIds()),
    ).toMatchObject({
      units: 'imperial',
      displayName: 'A',
    });
  });
});

describe('newFeedback', () => {
  it('sorts item ids ascending and does not mutate input', () => {
    const input = ['c', 'a', 'b'];
    const f = newFeedback({ itemIds: input, verdict: 'like' }, fakeClock(), fakeIds());
    expect(f.itemIds).toEqual(['a', 'b', 'c']);
    expect(input).toEqual(['c', 'a', 'b']);
    expect(validateFeedback(f).ok).toBe(true);
  });

  it('gives the same ids for the same set in any order, and removes duplicates', () => {
    const a = newFeedback({ itemIds: ['b', 'a', 'b'], verdict: 'dislike' }, fakeClock(), fakeIds());
    const b = newFeedback({ itemIds: ['a', 'b'], verdict: 'dislike' }, fakeClock(), fakeIds());
    expect(a).toEqual(b);
  });
});

describe('touch / softDelete', () => {
  it('touch updates only updatedAt and returns a copy', () => {
    const clock = fakeClock();
    const o = newOutfit({ itemIds: [] }, clock, fakeIds());
    clock.advance(5000);
    const t = touch(o, clock);
    expect(t.updatedAt).toBe('2026-01-15T10:00:05.000Z');
    expect(t.createdAt).toBe(T0);
    expect(o.updatedAt).toBe(T0);
    expect(t).not.toBe(o);
  });

  it('softDelete sets deletedAt and updatedAt', () => {
    const clock = fakeClock();
    const o = newOutfit({ itemIds: [] }, clock, fakeIds());
    clock.advance(1000);
    const d = softDelete(o, clock);
    expect(d.deletedAt).toBe('2026-01-15T10:00:01.000Z');
    expect(d.updatedAt).toBe(d.deletedAt);
    expect(o.deletedAt).toBeUndefined();
    expect(validateOutfit(d).ok).toBe(true);
  });
});
