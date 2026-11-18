import { scoreOutfit } from '@/core/engine/scoreOutfit';
import { slotOf } from '@/core/model/slots';
import { fixtureById, fixtureCloset } from '@/core/testing/fixtures';
import type { Item } from '@/core/model/types';
import { shuffleRows } from './shuffle';
import { itemsInRow, ROW_KEYS, rowSelection, type RowKey } from './slotRows';

const pool = fixtureCloset().filter((i) => i.status === 'active');
const get = fixtureById;
const ids = (items: readonly Item[]) => items.map((i) => i.id);
const harmony = (items: readonly Item[]) =>
  scoreOutfit(items, { date: '2026-06-01', occasion: 'any' }, { wearLogs: [] }).total;
const run = (over: Partial<Parameters<typeof shuffleRows>[0]> = {}) =>
  shuffleRows({
    pool,
    selection: [],
    locked: new Set<RowKey>(),
    rows: ROW_KEYS,
    seed: 1,
    score: harmony,
    ...over,
  });

describe('shuffleRows', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(ids(run({ seed: 7 }))).toEqual(ids(run({ seed: 7 })));
    const results = new Set(Array.from({ length: 12 }, (_, s) => ids(run({ seed: s })).join()));
    expect(results.size).toBeGreaterThan(3);
  });

  it('never touches locked rows', () => {
    const selection = [get('tee-white'), get('jeans-dark'), get('sneakers-white')];
    for (let seed = 0; seed < 25; seed++) {
      const out = run({ selection, seed, locked: new Set<RowKey>(['base', 'shoes']) });
      expect(ids(rowSelection(out, 'base'))).toEqual(['tee-white']);
      expect(ids(rowSelection(out, 'shoes'))).toEqual(['sneakers-white']);
      expect(rowSelection(out, 'onepiece')).toEqual([]);
    }
  });

  it('keeps a locked empty row empty', () => {
    const out = run({ selection: [get('tee-white')], locked: new Set<RowKey>(['outer', 'mid']) });
    expect(rowSelection(out, 'outer')).toEqual([]);
    expect(rowSelection(out, 'mid')).toEqual([]);
  });

  it('with everything locked changes nothing', () => {
    const selection = [get('tee-white'), get('jeans-dark')];
    expect(ids(run({ selection, locked: new Set<RowKey>(ROW_KEYS) }))).toEqual(ids(selection));
  });

  it('never mixes a one-piece with a top or bottom, and fills the core slots', () => {
    for (let seed = 0; seed < 40; seed++) {
      const out = run({ seed });
      const slots = out.map(slotOf);
      if (slots.includes('onepiece')) {
        expect(slots).not.toContain('base');
        expect(slots).not.toContain('bottom');
      } else {
        expect(slots).toContain('base');
        expect(slots).toContain('bottom');
      }
      expect(slots).toContain('shoes');
    }
  });

  it('keeps top and bottom when one of them is locked, so no one-piece appears', () => {
    const selection = [get('tee-white'), get('jeans-dark')];
    for (let seed = 0; seed < 25; seed++) {
      const out = run({ selection, seed, locked: new Set<RowKey>(['bottom']) });
      expect(ids(rowSelection(out, 'bottom'))).toEqual(['jeans-dark']);
      expect(rowSelection(out, 'onepiece')).toEqual([]);
    }
  });

  it('a locked dress keeps top and bottom off', () => {
    const selection = [get('dress-wrap-green')];
    const out = run({ selection, locked: new Set<RowKey>(['onepiece']) });
    expect(ids(rowSelection(out, 'onepiece'))).toEqual(['dress-wrap-green']);
    expect(rowSelection(out, 'base')).toEqual([]);
    expect(rowSelection(out, 'bottom')).toEqual([]);
  });

  it('shuffling one row changes only that row, to a different item', () => {
    const selection = [get('tee-white'), get('jeans-dark'), get('sneakers-white')];
    for (let seed = 0; seed < 15; seed++) {
      const out = run({ selection, seed, rows: ['bottom'] });
      expect(ids(rowSelection(out, 'base'))).toEqual(['tee-white']);
      expect(ids(rowSelection(out, 'shoes'))).toEqual(['sneakers-white']);
      const bottom = rowSelection(out, 'bottom');
      expect(bottom).toHaveLength(1);
      expect(bottom[0]?.id).not.toBe('jeans-dark');
    }
  });

  it('prefers the better-scoring candidate', () => {
    // Score by "is the shoe a boot": with all candidates tried, a boot must win.
    const bootsFirst = (items: readonly Item[]) =>
      items.some((i) => i.subcategory.includes('boots')) ? 100 : 0;
    const shoes = itemsInRow(pool, 'shoes');
    expect(shoes.length).toBeGreaterThan(4);
    const wins = Array.from({ length: 20 }, (_, seed) =>
      run({ seed, rows: ['shoes'], selection: [get('sneakers-white')], score: bootsFirst }),
    ).filter((out) => out.some((i) => i.subcategory.includes('boots'))).length;
    // Four of the shoes are tried per run, so a boot is usually found; never worse than chance.
    expect(wins).toBeGreaterThan(8);
  });

  it('does not change the input selection', () => {
    const selection = [get('tee-white')];
    run({ selection });
    expect(ids(selection)).toEqual(['tee-white']);
  });

  it('copes with an empty pool', () => {
    expect(run({ pool: [], selection: [] })).toEqual([]);
  });

  it('respects the jewellery capacity', () => {
    const jewels = ['j1', 'j2', 'j3', 'j4', 'j5'].map((id) => ({ ...get('necklace-gold'), id }));
    for (let seed = 0; seed < 20; seed++) {
      const out = run({ pool: [...pool, ...jewels], seed, rows: ['accessories'] });
      expect(out.filter((i) => slotOf(i) === 'jewelry').length).toBeLessThanOrEqual(3);
    }
  });
});
