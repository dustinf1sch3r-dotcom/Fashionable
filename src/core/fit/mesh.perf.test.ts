// Timing test, run on its own (`npm run test:perf`, serially) so parallel suites can't skew it.
import { buildFitMesh } from './mesh';
import { rigTargets } from './targets';
import { bodyA, detected } from './testHelpers';

describe('buildFitMesh (timing)', () => {
  it('is fast: the default grid takes under 15 ms (median of 5)', () => {
    const d = detected('jumpsuit');
    const t = rigTargets(d.rig, d.aspect, bodyA, 'onepiece');
    buildFitMesh(d.rig, t, d.aspect); // warm-up
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      buildFitMesh(d.rig, t, d.aspect);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(15);
  });
});
