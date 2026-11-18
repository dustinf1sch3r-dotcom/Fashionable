// Timing test, run on its own (`npm run test:perf`, serially) so parallel suites can't skew it.
import type { Item } from '../model/types';
import { fixtureCloset } from '../testing/fixtures';
import { findGaps } from './findGaps';

describe('performance', () => {
  it('handles a 150-item closet in under 300 ms', () => {
    const base = fixtureCloset();
    const big: Item[] = [];
    for (let i = 0; big.length < 150; i++) {
      const src = base[i % base.length] as Item;
      big.push({ ...src, id: `${src.id}-${i}` });
    }
    findGaps(big); // warm up the JIT
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      findGaps(big);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    process.stdout.write(`findGaps 150 items ms: ${times.map((t) => t.toFixed(1)).join(' ')}\n`);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(300);
  });
});
