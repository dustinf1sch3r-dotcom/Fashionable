import { scoreOutfit } from '@/core/engine/scoreOutfit';
import { outfit } from '@/core/engine/testUtils';
import type { ScoreBreakdown } from '@/core/model/types';
import { MATCH_BANDS, matchBand, MAX_WEAK_SPOTS, weakSpots, WEAK_BELOW, WEAK_TEXT } from './meter';

const breakdown = (components: Record<string, number>): ScoreBreakdown => ({
  total: 50,
  reasons: [],
  components: Object.fromEntries(
    Object.entries(components).map(([k, value]) => [k, { value, weight: 0.1 }]),
  ),
});

describe('matchBand', () => {
  it('uses the 90 / 85 cut-offs', () => {
    expect(MATCH_BANDS.map((b) => b.min)).toEqual([90, 85]);
    expect(matchBand(100).label).toBe('Great match');
    expect(matchBand(90).label).toBe('Great match');
    expect(matchBand(89.9).label).toBe('Good match');
    expect(matchBand(85).label).toBe('Good match');
    expect(matchBand(84.9).label).toBe('Worth a try');
    expect(matchBand(0).label).toBe('Worth a try');
  });
});

describe('weakSpots', () => {
  it('names the weakest components first, at most three', () => {
    const spots = weakSpots(
      breakdown({
        colour: 0.2,
        formality: 0.5,
        pattern: 0.4,
        weather: 0.6,
        taste: 0.7,
        freshness: 1,
      }),
    );
    expect(spots.map((s) => s.component)).toEqual(['colour', 'pattern', 'formality']);
    expect(spots).toHaveLength(MAX_WEAK_SPOTS);
    expect(spots[0]?.text).toBe('Colours clash a bit');
  });

  it('skips components that are fine', () => {
    expect(weakSpots(breakdown({ colour: WEAK_BELOW, formality: 1 }))).toEqual([]);
    expect(weakSpots(breakdown({ colour: WEAK_BELOW - 0.01 }))).toHaveLength(1);
  });

  it('has plain words for every component of a real score', () => {
    const b = scoreOutfit(
      outfit('shirt-oxford-white', 'trousers-black', 'loafers-brown'),
      { date: '2026-06-01', occasion: 'any' },
      { wearLogs: [] },
    );
    for (const key of Object.keys(b.components)) {
      expect(WEAK_TEXT[key as keyof typeof WEAK_TEXT]).toMatch(/\S/);
    }
  });

  it('flags a mixed-formality outfit as such', () => {
    const b = scoreOutfit(
      outfit('hoodie-grey', 'trousers-black', 'heels-black'),
      { date: '2026-06-01', occasion: 'any' },
      { wearLogs: [] },
    );
    expect(weakSpots(b).map((s) => s.text)).toContain('Mixed dress levels');
  });
});
