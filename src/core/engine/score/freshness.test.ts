import { fixtureWearLogs } from '../../testing/fixtures';
import { newWearLog } from '../../model/factories';
import { fakeClock, fakeIds } from '../../model/testHelpers';
import type { WearLog } from '../../model/types';
import { outfit } from '../testUtils';
import { daysBetween, scoreFreshness } from './freshness';

const log = (date: string, itemIds: string[], planned = false): WearLog =>
  newWearLog({ date, itemIds, planned }, fakeClock(), fakeIds());

const SET = ['tee-white', 'jeans-dark', 'sneakers-white'];

describe('date maths', () => {
  it('counts whole days across month, year and leap boundaries', () => {
    expect(daysBetween('2026-01-05', '2026-01-10')).toBe(5);
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(3);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-01-10', '2026-01-05')).toBe(-5);
  });
});

describe('scoreFreshness (§4.5)', () => {
  const items = outfit(...SET);

  it('is null with no history', () => {
    expect(scoreFreshness(items, '2026-01-10', [])).toBeNull();
  });
  it('ignores planned and future logs (still "no history")', () => {
    expect(scoreFreshness(items, '2026-01-10', [log('2026-01-09', SET, true)])).toBeNull();
    expect(scoreFreshness(items, '2026-01-10', [log('2026-01-12', SET)])).toBeNull();
  });
  it('never worn set and unrelated pieces → 1.0', () => {
    const r = scoreFreshness(items, '2026-01-30', [
      log('2026-01-01', ['shirt-oxford-white', 'trousers-black']),
    ]);
    expect(r?.value).toBe(1);
    expect(r?.reasons[0].code).toBe('FRESH_COMBINATION');
  });
  it('same set worn today → 0 (d = 0)', () => {
    expect(scoreFreshness(items, '2026-01-10', [log('2026-01-10', SET)])?.value).toBe(0);
  });
  it('d/14 scaling: worn 7 days ago, no recent pieces → 0.5', () => {
    const r = scoreFreshness(items, '2026-01-20', [log('2026-01-13', SET)]);
    expect(r?.value).toBeCloseTo(0.5, 10);
  });
  it('caps at 14 days', () => {
    expect(scoreFreshness(items, '2026-03-01', [log('2026-01-01', SET)])?.value).toBe(1);
  });
  it('uses the most recent wearing of the set', () => {
    const r = scoreFreshness(items, '2026-01-20', [log('2026-01-01', SET), log('2026-01-13', SET)]);
    expect(r?.value).toBeCloseTo(0.5, 10);
  });
  it('set comparison is order-insensitive and exact', () => {
    const r = scoreFreshness(items, '2026-01-20', [log('2026-01-13', [...SET].reverse())]);
    expect(r?.value).toBeCloseTo(0.5, 10);
    // superset is not the same set
    expect(
      scoreFreshness(items, '2026-01-20', [log('2026-01-13', [...SET, 'belt-black-leather'])])
        ?.value,
    ).toBe(1);
  });
  it('recent-repeat penalty: r = share of main pieces worn in last 3 days', () => {
    // set never worn; tee+jeans worn yesterday (2 of 3 main pieces) → 1 × (1 − 0.5 × 2/3)
    const r = scoreFreshness(items, '2026-01-10', [log('2026-01-09', ['tee-white', 'jeans-dark'])]);
    expect(r?.value).toBeCloseTo(1 - 0.5 * (2 / 3), 10);
  });
  it('3 days ago counts as recent, 4 days ago does not', () => {
    expect(
      scoreFreshness(items, '2026-01-10', [log('2026-01-07', ['tee-white'])])?.value,
    ).toBeCloseTo(1 - 0.5 / 3, 10);
    expect(scoreFreshness(items, '2026-01-10', [log('2026-01-06', ['tee-white'])])?.value).toBe(1);
  });
  it('whole set worn within 3 days: factor d/14 × (1 − 0.5)', () => {
    const r = scoreFreshness(items, '2026-01-12', [log('2026-01-10', SET)]);
    expect(r?.value).toBeCloseTo((2 / 14) * 0.5, 10);
  });
  it('works with fixture wear logs', () => {
    const r = scoreFreshness(items, '2026-01-10', fixtureWearLogs());
    // set last worn 5 days ago; its pieces are not in the 3-day window → 5/14
    expect(r?.value).toBeCloseTo(5 / 14, 10);
  });
});
