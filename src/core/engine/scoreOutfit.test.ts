import {
  WEATHER_COLD,
  WEATHER_FREEZING,
  WEATHER_HOT,
  WEATHER_MILD,
  fixtureWearLogs,
} from '../testing/fixtures';
import { colourHarmony } from '../color/harmony';
import { COMPONENT_WEIGHTS } from './weights';
import { scoreOutfit } from './scoreOutfit';
import { outfit } from './testUtils';

const NO_HISTORY = { wearLogs: [] };
const DATE = '2026-01-10';

const CASUAL = { date: DATE, occasion: 'casual' as const, weather: WEATHER_MILD };
const GOOD = outfit('tee-white', 'jeans-dark', 'sneakers-white');
const BAD = outfit('blouse-floral', 'puffer-black', 'sandals-tan');

describe('weights', () => {
  it('sum to 1', () => {
    const sum = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('scoreOutfit renormalisation', () => {
  it('skips components that do not apply and renormalises weights to 1', () => {
    const b = scoreOutfit(GOOD, { date: DATE, occasion: 'any' }, NO_HISTORY);
    expect(Object.keys(b.components).sort()).toEqual(['colour', 'formality', 'pattern']);
    const weights = Object.values(b.components).map((c) => c?.weight ?? 0);
    expect(weights.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 10);
    expect(b.components.colour?.weight).toBeCloseTo(0.3 / 0.6, 10);
    expect(b.components.formality?.weight).toBeCloseTo(0.2 / 0.6, 10);
    expect(b.components.pattern?.weight).toBeCloseTo(0.1 / 0.6, 10);
  });

  it('total = 100 × weighted mean of the applicable components', () => {
    const b = scoreOutfit(GOOD, { date: DATE, occasion: 'any' }, NO_HISTORY);
    const c = colourHarmony(GOOD).value;
    expect(b.total).toBeCloseTo(100 * ((0.3 * c + 0.2 * 1 + 0.1 * 0.85) / 0.6), 8);
  });

  it('includes weather, occasion and freshness when supplied; taste stays skipped', () => {
    const b = scoreOutfit(GOOD, CASUAL, { wearLogs: fixtureWearLogs(), feedback: [] });
    expect(b.components.weather).toBeDefined();
    expect(b.components.occasion).toBeDefined();
    expect(b.components.freshness).toBeDefined();
    expect(b.components.taste).toBeUndefined();
    expect(b.components.coordination).toBeUndefined();
    const weights = Object.values(b.components).map((c) => c?.weight ?? 0);
    expect(weights.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 10);
  });

  it('feedback does not yet affect the score (taste hook is M1-6)', () => {
    const fb = [{ itemIds: ['a'], verdict: 'like' as const }] as never;
    const a = scoreOutfit(GOOD, CASUAL, NO_HISTORY);
    const b = scoreOutfit(GOOD, CASUAL, { wearLogs: [], feedback: fb });
    expect(b.total).toBe(a.total);
  });

  it('empty outfit scores 0 with no components', () => {
    const b = scoreOutfit([], CASUAL, NO_HISTORY);
    expect(b.total).toBe(0);
    expect(b.components).toEqual({});
  });

  it('total stays in 0–100 and adds the sun bonus in points', () => {
    const sunny = { ...WEATHER_MILD, isSunny: true };
    const withGlasses = [...BAD, ...outfit('sunglasses-black')];
    const a = scoreOutfit(
      withGlasses,
      { ...CASUAL, weather: { ...WEATHER_MILD, isSunny: false } },
      NO_HISTORY,
    );
    const b = scoreOutfit(withGlasses, { ...CASUAL, weather: sunny }, NO_HISTORY);
    expect(b.total - a.total).toBeCloseTo(1, 8);
    expect(b.total).toBeLessThanOrEqual(100);
  });

  it('collects reasons from components', () => {
    const b = scoreOutfit(GOOD, CASUAL, NO_HISTORY);
    const codes = b.reasons.map((r) => r.code);
    expect(codes).toContain('FORMALITY_COHESIVE');
    expect(codes.some((c) => c.startsWith('COLOR_'))).toBe(true);
    expect(codes).toContain('WEATHER_SUITED');
  });

  it('is deterministic', () => {
    expect(scoreOutfit(GOOD, CASUAL, NO_HISTORY)).toEqual(scoreOutfit(GOOD, CASUAL, NO_HISTORY));
  });
});

describe('scoreOutfit ranking on fixture outfits', () => {
  it('white tee + dark jeans + white sneakers beats floral blouse + puffer + sandals (casual, mild) clearly', () => {
    const good = scoreOutfit(GOOD, CASUAL, NO_HISTORY).total;
    const bad = scoreOutfit(BAD, CASUAL, NO_HISTORY).total;
    expect(good).toBeGreaterThan(bad + 10);
  });

  it('formal prefers oxford + black trousers + heels/loafers over tee + shorts', () => {
    const ctx = { date: DATE, occasion: 'formal' as const };
    const dressed = scoreOutfit(
      outfit('shirt-oxford-white', 'trousers-black', 'heels-black'),
      ctx,
      NO_HISTORY,
    );
    const dressedLoafers = scoreOutfit(
      outfit('shirt-oxford-white', 'trousers-black', 'loafers-brown'),
      ctx,
      NO_HISTORY,
    );
    const casual = scoreOutfit(
      outfit('tee-white', 'shorts-denim', 'sneakers-white'),
      ctx,
      NO_HISTORY,
    );
    expect(dressed.total).toBeGreaterThan(casual.total);
    expect(dressedLoafers.total).toBeGreaterThan(casual.total);
  });

  it('weather steers: coat + sweater beat a tee-and-shorts look when freezing', () => {
    const ctx = { date: DATE, occasion: 'any' as const, weather: WEATHER_FREEZING };
    const warm = scoreOutfit(
      outfit('tee-white', 'sweater-red', 'jeans-dark', 'boots-black-chelsea', 'puffer-black'),
      ctx,
      NO_HISTORY,
    );
    const cold = scoreOutfit(outfit('tee-white', 'shorts-denim', 'sandals-tan'), ctx, NO_HISTORY);
    expect(warm.total).toBeGreaterThan(cold.total);
    expect(cold.reasons.map((r) => r.code)).toContain('MISSING_LAYER');
  });

  it('a recent repeat of the exact outfit scores lower than a fresh one', () => {
    const logs = fixtureWearLogs(); // tee-white/jeans-dark/sneakers-white worn 2026-01-05
    const repeat = scoreOutfit(GOOD, { date: '2026-01-06', occasion: 'any' }, { wearLogs: logs });
    const fresh = scoreOutfit(GOOD, { date: '2026-02-20', occasion: 'any' }, { wearLogs: logs });
    expect(repeat.total).toBeLessThan(fresh.total);
  });

  it('logs the table of scores', () => {
    const rows: [string, number][] = [
      ['good casual mild', scoreOutfit(GOOD, CASUAL, NO_HISTORY).total],
      ['bad casual mild', scoreOutfit(BAD, CASUAL, NO_HISTORY).total],
      [
        'hot tee/shorts/sandals',
        scoreOutfit(
          outfit('tee-white', 'shorts-denim', 'sandals-tan'),
          { date: DATE, occasion: 'casual', weather: WEATHER_HOT },
          NO_HISTORY,
        ).total,
      ],
      [
        'cold sweater/jeans/boots/trench',
        scoreOutfit(
          outfit('tee-white', 'sweater-red', 'jeans-dark', 'boots-black-chelsea', 'trench-beige'),
          { date: DATE, occasion: 'casual', weather: WEATHER_COLD },
          NO_HISTORY,
        ).total,
      ],
    ];
    for (const [, v] of rows) expect(v).toBeGreaterThanOrEqual(0);
    if (process.env.PRINT_SCORES)
      console.log(rows.map(([n, v]) => `${n}: ${v.toFixed(1)}`).join('\n'));
  });
});
