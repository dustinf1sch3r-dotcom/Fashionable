// Timing test, run on its own (`npm run test:perf`, serially) so parallel suites can't skew it.
import { compositeOutfit } from './index';
import type { CompositeInput } from './index';
import { fill, noisy } from './testUtils';

function scene(kind: CompositeInput['kind']): CompositeInput {
  const backdrop = noisy(500, 1000, [130, 120, 110], 3, 11);
  const layer = (
    w: number,
    h: number,
    c: number,
    x: number,
    y: number,
  ): CompositeInput['layers'][number] => ({
    image: fill(w, h, (px, py) => {
      const inside = (px - w / 2) ** 2 / (w / 2) ** 2 + (py - h / 2) ** 2 / (h / 2) ** 2 < 1;
      return inside ? [c, c - 30, c - 60, 255] : [0, 0, 0, 0];
    }),
    x,
    y,
  });
  return {
    backdrop,
    kind,
    layers: [
      layer(400, 500, 230, 50, 200),
      layer(300, 400, 200, 100, 300),
      layer(420, 300, 120, 40, 650),
      layer(200, 200, 90, 150, 60),
    ],
    density: 1,
    seed: 4,
  };
}

describe('compositeOutfit (timing)', () => {
  it.each(['photo', 'silhouette'] as const)(
    'composes 500x1000 with 4 layers (%s) in under 400 ms median',
    (kind) => {
      const input = scene(kind);
      compositeOutfit(input); // warm up the JIT
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const out = compositeOutfit(input);
        times.push(performance.now() - t0);
        expect(out.width).toBe(500);
      }
      times.sort((a, b) => a - b);
      process.stdout.write(`composite ${kind} ms: ${times.map((t) => t.toFixed(1)).join(' ')}\n`);
      expect(times[Math.floor(times.length / 2)]).toBeLessThan(400);
    },
  );
});
