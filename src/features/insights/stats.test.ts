import { computeStats, daysBetween, formatMoney, wearSummaries } from './stats';
import { testItem, testLog } from './testItems';

const TODAY = '2026-06-01';
const tee = testItem('tee', { category: 'top', subcategory: 'tshirt', name: 'Tee' });
const jeans = testItem('jeans', {
  category: 'bottom',
  subcategory: 'jeans',
  name: 'Jeans',
  colors: [{ hex: '#2b3550', share: 1, name: 'navy' }],
});
const shoes = testItem('shoes', { category: 'shoes', subcategory: 'sneakers', name: 'Sneakers' });

describe('daysBetween', () => {
  it('counts calendar days across months and leap years', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-06-01', '2026-03-03')).toBe(-90);
    expect(daysBetween('2026-01-01T23:00:00.000Z', '2026-01-02')).toBe(1);
  });
});

describe('wearSummaries', () => {
  it('ignores planned logs and counts an item once per log', () => {
    const map = wearSummaries([
      testLog('a', '2026-05-01', ['tee', 'tee', 'jeans']),
      testLog('b', '2026-05-09', ['tee']),
      testLog('c', '2026-05-20', ['tee', 'shoes'], true),
    ]);
    expect(map.get('tee')).toEqual({ count: 2, last: '2026-05-09' });
    expect(map.get('jeans')).toEqual({ count: 1, last: '2026-05-01' });
    expect(map.has('shoes')).toBe(false);
  });
});

describe('computeStats', () => {
  const logs = [
    testLog('1', '2026-05-30', ['tee', 'jeans']),
    testLog('2', '2026-05-29', ['tee']),
    testLog('3', '2026-05-28', ['tee']),
  ];

  it('ranks most and least worn without repeating a piece', () => {
    const s = computeStats([tee, jeans, shoes], logs, TODAY);
    expect(s.hasWears).toBe(true);
    expect(s.mostWorn.map((r) => [r.item.id, r.count])).toEqual([
      ['tee', 3],
      ['jeans', 1],
    ]);
    expect(s.leastWorn.map((r) => [r.item.id, r.count])).toEqual([['shoes', 0]]);
  });

  it('has no most-worn list when nothing was worn', () => {
    const s = computeStats([tee, jeans], [testLog('p', '2026-05-30', ['tee'], true)], TODAY);
    expect(s.hasWears).toBe(false);
    expect(s.mostWorn).toEqual([]);
    expect(s.leastWorn).toHaveLength(2);
  });

  it('skips archived items everywhere', () => {
    const old = testItem('old', { category: 'top', subcategory: 'shirt', status: 'archived' });
    const s = computeStats([tee, old], [], TODAY);
    expect(s.itemCount).toBe(1);
    expect(s.categories).toEqual([{ category: 'top', count: 1, percent: 100 }]);
  });

  describe('untouched for 90 days', () => {
    const created = (iso: string) => testItem('x', { category: 'top', subcategory: 'shirt' }, iso);
    it('needs 90 days without a wear and 90 days in the closet', () => {
      // 2026-03-03 is exactly 90 days before TODAY.
      expect(computeStats([created('2026-03-03T09:00:00.000Z')], [], TODAY).untouched).toHaveLength(
        1,
      );
      expect(computeStats([created('2026-03-04T09:00:00.000Z')], [], TODAY).untouched).toEqual([]);
    });
    it('a wear within 90 days keeps it fresh, 90 days ago does not', () => {
      const item = created('2025-12-01T09:00:00.000Z');
      const recent = [testLog('r', '2026-03-04', ['x'])];
      const edge = [testLog('e', '2026-03-03', ['x'])];
      expect(computeStats([item], recent, TODAY).untouched).toEqual([]);
      expect(computeStats([item], edge, TODAY).untouched).toEqual([{ item, daysSince: 90 }]);
    });
    it('a planned log does not count, never-worn sorts first', () => {
      const a = testItem('a', { category: 'top', subcategory: 'shirt' }, '2025-01-01T00:00:00Z');
      const b = testItem('b', { category: 'top', subcategory: 'shirt' }, '2025-01-01T00:00:00Z');
      const s = computeStats(
        [a, b],
        [testLog('w', '2026-01-10', ['a']), testLog('p', '2026-05-30', ['a', 'b'], true)],
        TODAY,
      );
      expect(s.untouched.map((u) => [u.item.id, u.daysSince])).toEqual([
        ['b', null],
        ['a', 142],
      ]);
    });
  });

  it('breaks the closet down by primary colour and category', () => {
    const s = computeStats([tee, jeans, shoes], [], TODAY);
    expect(s.colours).toEqual([
      { name: 'black', hex: '#1b1b1d', count: 2, percent: 67 },
      { name: 'navy', hex: '#2b3550', count: 1, percent: 33 },
    ]);
    expect(s.categories.map((c) => [c.category, c.count])).toEqual([
      ['bottom', 1],
      ['shoes', 1],
      ['top', 1],
    ]);
  });

  it('computes cost per wear only where a price exists', () => {
    const priced = (id: string, pricePaid: number) =>
      testItem(id, { category: 'top', subcategory: 'shirt', pricePaid, name: id });
    const s = computeStats(
      [priced('a', 60), priced('b', 20), priced('c', 40), tee],
      [
        testLog('1', '2026-05-01', ['a', 'b']),
        testLog('2', '2026-05-02', ['a']),
        testLog('3', '2026-05-03', ['a']),
      ],
      TODAY,
    );
    expect(s.costPerWear.map((r) => [r.item.id, r.perWear])).toEqual([
      ['a', 20],
      ['b', 20],
      ['c', null],
    ]);
  });
});

describe('formatMoney', () => {
  it('drops needless decimals', () => {
    expect(formatMoney(12)).toBe('12');
    expect(formatMoney(12.5)).toBe('12.50');
    expect(formatMoney(20 / 3)).toBe('6.67');
  });
});
