import { fixtureById } from '@/core/testing/fixtures';
import type { Item, WearLog } from '@/core/model/types';
import {
  dayMark,
  duePlans,
  inForecastRange,
  logsByDate,
  logsOnDate,
  sameItems,
  summarize,
  thumbnailForDay,
  thumbnailItem,
} from './wearLogic';

let n = 0;
const log = (date: string, itemIds: string[], planned = false): WearLog => ({
  id: `l${(n += 1)}`,
  createdAt: '',
  updatedAt: '',
  date,
  itemIds,
  planned,
});

const closet = (ids: string[]): Map<string, Item> =>
  new Map(ids.map((id) => [id, fixtureById(id)]));

describe('wear logic', () => {
  it('filters and groups logs by date', () => {
    const a = log('2026-11-18', ['x']);
    const b = log('2026-11-18', ['y'], true);
    const c = log('2026-11-17', ['x']);
    expect(logsOnDate([a, b, c], '2026-11-18')).toEqual([a, b]);
    expect([...logsByDate([a, b, c]).keys()]).toEqual(['2026-11-18', '2026-11-17']);
  });

  it('marks a day worn when anything was worn, planned when only a plan exists', () => {
    expect(dayMark([])).toBe('none');
    expect(dayMark([log('d', [], true)])).toBe('planned');
    expect(dayMark([log('d', [], true), log('d', [])])).toBe('worn');
  });

  it('asks about plans once their day has arrived', () => {
    const past = log('2026-11-17', ['a'], true);
    const todays = log('2026-11-18', ['a'], true);
    const future = log('2026-11-19', ['a'], true);
    const worn = log('2026-11-17', ['a']);
    expect(duePlans([past, todays, future, worn], '2026-11-18')).toEqual([past, todays]);
  });

  it('picks the dress, then the base top, for a thumbnail', () => {
    const items = ['jeans-dark', 'sneakers-white', 'tee-navy'].map(fixtureById);
    expect(thumbnailItem(items)?.id).toBe('tee-navy');
    expect(thumbnailItem(items.filter((i) => i.id !== 'tee-navy'))?.id).toBe('jeans-dark');
    expect(thumbnailItem([])).toBeUndefined();
  });

  it('takes the thumbnail from the worn log first, and skips pieces that were deleted', () => {
    const byId = closet(['tee-navy', 'jeans-dark', 'tee-white']);
    const planned = log('d', ['tee-white'], true);
    const worn = log('d', ['gone', 'tee-navy', 'jeans-dark']);
    expect(thumbnailForDay([planned, worn], byId)?.id).toBe('tee-navy');
    expect(thumbnailForDay([planned], byId)?.id).toBe('tee-white');
    expect(thumbnailForDay([log('d', ['gone'])], byId)).toBeUndefined();
    expect(thumbnailForDay([], byId)).toBeUndefined();
  });

  describe('summary', () => {
    const today = '2026-11-18';
    it('counts distinct worn days in the last seven, ignoring plans and older days', () => {
      const logs = [
        log('2026-11-18', ['a']),
        log('2026-11-18', ['b']),
        log('2026-11-16', ['a']),
        log('2026-11-12', ['a']),
        log('2026-11-11', ['a']), // 8 days ago
        log('2026-11-17', ['a'], true),
      ];
      expect(summarize(logs, today)).toMatchObject({ loggedLast7: 3, totalDays: 4 });
    });

    it('streak runs back from today, or from yesterday while today is still open', () => {
      const run = ['2026-11-17', '2026-11-16', '2026-11-15'].map((d) => log(d, ['a']));
      expect(summarize(run, today).streak).toBe(3);
      expect(summarize([log(today, ['a']), ...run], today).streak).toBe(4);
      expect(summarize([log('2026-11-16', ['a'])], today).streak).toBe(0);
      expect(summarize([], today)).toEqual({ loggedLast7: 0, streak: 0, totalDays: 0 });
    });
  });

  it('knows how far the forecast reaches', () => {
    expect(inForecastRange('2026-11-18', '2026-11-18')).toBe(true);
    expect(inForecastRange('2026-12-01', '2026-11-18')).toBe(true); // 13 days ahead
    expect(inForecastRange('2026-12-02', '2026-11-18')).toBe(false);
    expect(inForecastRange('2026-11-17', '2026-11-18')).toBe(false);
  });

  it('compares item sets regardless of order', () => {
    expect(sameItems(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameItems(['a'], ['a', 'b'])).toBe(false);
  });
});
