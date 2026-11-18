import { slotOf } from '@/core/model/slots';
import { fixtureById, fixtureCloset } from '@/core/testing/fixtures';
import {
  clearRow,
  itemsInRow,
  rowOfItem,
  ROWS,
  rowSelection,
  selectionIds,
  setRow,
  toggleItem,
} from './slotRows';

const get = fixtureById;
const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);
const ring = (id: string) => ({ ...get('necklace-gold'), id });

describe('rows', () => {
  it('cover every slot exactly once', () => {
    const slots = ROWS.flatMap((r) => r.slots);
    expect(new Set(slots).size).toBe(slots.length);
    for (const item of fixtureCloset()) expect(() => rowOfItem(item)).not.toThrow();
  });

  it('list the right items per row', () => {
    const closet = fixtureCloset();
    expect(itemsInRow(closet, 'mid').map(slotOf)).toEqual(expect.arrayContaining(['mid']));
    expect(itemsInRow(closet, 'accessories').every((i) => rowOfItem(i) === 'accessories')).toBe(
      true,
    );
    expect(ids(itemsInRow(closet, 'onepiece')).sort()).toEqual(
      ['dress-wrap-green', 'jumpsuit-black'].sort(),
    );
  });
});

describe('toggleItem', () => {
  it('fills an empty slot and replaces a single-item slot', () => {
    let sel = toggleItem([], get('tee-white'));
    expect(ids(sel)).toEqual(['tee-white']);
    sel = toggleItem(sel, get('tee-navy'));
    expect(ids(sel)).toEqual(['tee-navy']);
  });

  it('tapping the picked item takes it off', () => {
    const sel = toggleItem([get('tee-white'), get('jeans-dark')], get('tee-white'));
    expect(ids(sel)).toEqual(['jeans-dark']);
  });

  it('a one-piece clears the top and the bottom but keeps shoes, layers and accessories', () => {
    const sel = toggleItem(
      [
        get('tee-white'),
        get('jeans-dark'),
        get('sneakers-white'),
        get('cardigan-cream'),
        get('belt-brown-leather'),
      ],
      get('dress-wrap-green'),
    );
    expect(ids(sel).sort()).toEqual(
      ['belt-brown-leather', 'cardigan-cream', 'dress-wrap-green', 'sneakers-white'].sort(),
    );
  });

  it('a top or a bottom clears the one-piece', () => {
    const dress = [get('dress-wrap-green'), get('heels-black')];
    expect(ids(toggleItem(dress, get('tee-white')))).toEqual(['heels-black', 'tee-white']);
    expect(ids(toggleItem(dress, get('jeans-dark')))).toEqual(['heels-black', 'jeans-dark']);
  });

  it('keeps one item per accessory slot but allows one of each kind', () => {
    let sel = toggleItem([], get('belt-brown-leather'));
    sel = toggleItem(sel, get('belt-black-leather'));
    expect(ids(sel)).toEqual(['belt-black-leather']);
    sel = toggleItem(sel, get('bag-shoulder-brown'));
    expect(ids(sel)).toEqual(['belt-black-leather', 'bag-shoulder-brown']);
  });

  it('holds up to three jewellery pieces and drops the oldest after that', () => {
    let sel = [ring('j1'), ring('j2'), ring('j3')];
    expect(slotOf(ring('j1'))).toBe('jewelry');
    sel = toggleItem(sel, ring('j4'));
    expect(ids(sel)).toEqual(['j2', 'j3', 'j4']);
    sel = toggleItem(sel, ring('j3'));
    expect(ids(sel)).toEqual(['j2', 'j4']);
  });

  it('does not change its input', () => {
    const sel = [get('tee-white')];
    toggleItem(sel, get('dress-wrap-green'));
    expect(ids(sel)).toEqual(['tee-white']);
  });
});

describe('clearRow and setRow', () => {
  const full = [
    get('tee-white'),
    get('jeans-dark'),
    get('belt-brown-leather'),
    get('watch-silver'),
  ];

  it('None empties only that row', () => {
    expect(ids(clearRow(full, 'base'))).toEqual([
      'jeans-dark',
      'belt-brown-leather',
      'watch-silver',
    ]);
    expect(ids(clearRow(full, 'accessories'))).toEqual(['tee-white', 'jeans-dark']);
  });

  it('setRow replaces a row with exactly the given items', () => {
    expect(
      ids(rowSelection(setRow(full, 'accessories', [get('bag-shoulder-brown')]), 'accessories')),
    ).toEqual(['bag-shoulder-brown']);
    expect(ids(setRow(full, 'mid', []))).toEqual(ids(full));
  });

  it('selectionIds lists ids in order', () => {
    expect(selectionIds(full)).toEqual(ids(full));
  });
});
