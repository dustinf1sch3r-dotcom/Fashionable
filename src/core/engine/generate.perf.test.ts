// Timing test, run on its own (`npm run test:perf`, serially) so parallel suites can't skew it.
import { bigCloset } from '../testing/bigCloset';
import { fixtureWearLogs, WEATHER_MILD } from '../testing/fixtures';
import { generateOutfits } from './generate';

const DATE = '2026-01-10';

describe('generateOutfits at scale (timing)', () => {
  it('generates 5 outfits from 300 items in under 150 ms', () => {
    const items = bigCloset(300);
    const input = {
      items,
      wearLogs: fixtureWearLogs(),
      feedback: [],
      context: { date: DATE, occasion: 'casual' as const, weather: WEATHER_MILD },
      count: 5,
      seed: 7,
    };
    generateOutfits(input); // warm up the JIT
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = generateOutfits({ ...input, seed: 7 + i });
      times.push(performance.now() - t0);
      expect(r.suggestions).toHaveLength(5);
    }
    times.sort((a, b) => a - b);
    process.stdout.write(`generate 300 items ms: ${times.map((t) => t.toFixed(1)).join(' ')}\n`);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(150);
  });
});
