import type { FitMesh } from '@/core/fit';
import type { FitBody, GarmentRig } from '@/core/model/types';
import { BODY_A } from '@/core/tryon/bodies';
import type { GarmentWarper } from '@/services';
import { createFitEngine, type FitJob } from './fitEngine';

jest.mock('@/core/fit', () => ({
  rigTargets: jest.fn(() => ({})),
  buildFitMesh: jest.fn(() => ({
    source: [],
    target: [],
    triangles: [],
    bounds: { x: 1, y: 2, width: 3, height: 4 },
  })),
}));

const rig: GarmentRig = { kind: 'top', version: 1, points: {}, confidence: 1, edited: false };
const body: FitBody = BODY_A.landmarks;
const job = (n: number, itemId = 'i'): FitJob => ({
  key: `k${n}`,
  itemId,
  cutoutId: 'c',
  cutoutUri: `blob:cutout-${n}`,
  rig,
  aspect: 0.8,
  body,
  slot: 'base',
  density: 0.75,
});

function makeWarper() {
  const released: string[] = [];
  let active = 0;
  let maxActive = 0;
  const gates: (() => void)[] = [];
  const warper: GarmentWarper & { rendered: string[]; hold: boolean } = {
    available: true,
    rendered: [],
    hold: false,
    async render(uri: string, mesh: FitMesh) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (warper.hold) await new Promise<void>((r) => gates.push(r));
      active -= 1;
      warper.rendered.push(uri);
      return { uri: `blob:out-${uri}`, bounds: mesh.bounds };
    },
    release: (uri) => released.push(uri),
  };
  return { warper, released, gates, maxActive: () => maxActive };
}

describe('createFitEngine', () => {
  it('renders once per key and serves later requests from the cache', async () => {
    const { warper } = makeWarper();
    const engine = createFitEngine(warper);
    const [a, b] = await Promise.all([engine.request(job(1)), engine.request(job(1))]);
    expect(a).toBe(b);
    expect(warper.rendered).toEqual(['blob:cutout-1']);
    expect(engine.peek('k1')?.uri).toBe('blob:out-blob:cutout-1');
    await engine.request(job(1));
    expect(warper.rendered).toHaveLength(1);
  });

  it('keeps at most `max` images and releases the evicted object URLs', async () => {
    const { warper, released } = makeWarper();
    const engine = createFitEngine(warper, { max: 2 });
    for (const n of [1, 2, 3]) await engine.request(job(n, `item${n}`));
    expect(engine.peek('k1')).toBeUndefined();
    expect(engine.peek('k3')).toBeDefined();
    expect(released).toEqual(['blob:out-blob:cutout-1']);
    expect(engine.latest('item1', 'c')).toBeUndefined();
  });

  it('remembers the latest image of an item for another body', async () => {
    const { warper } = makeWarper();
    const engine = createFitEngine(warper);
    await engine.request(job(1));
    expect(engine.peek('k2')).toBeUndefined();
    expect(engine.latest('i', 'c')?.uri).toBe('blob:out-blob:cutout-1');
    expect(engine.latest('i', 'other-cutout')).toBeUndefined();
  });

  it('limits concurrent renders', async () => {
    const { warper, gates, maxActive } = makeWarper();
    warper.hold = true;
    const engine = createFitEngine(warper, { concurrency: 2 });
    const all = [1, 2, 3, 4].map((n) => engine.request(job(n, `i${n}`)));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    while (gates.length < 4) {
      gates.splice(0).forEach((g) => g());
      await new Promise((r) => setTimeout(r, 0));
      if (warper.rendered.length === 4) break;
    }
    await Promise.all(all);
    expect(maxActive()).toBeLessThanOrEqual(2);
    expect(warper.rendered).toHaveLength(4);
  });

  it('does not retry a key that failed', async () => {
    const warper: GarmentWarper = {
      available: true,
      render: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const engine = createFitEngine(warper);
    expect(await engine.request(job(1))).toBeUndefined();
    expect(await engine.request(job(1))).toBeUndefined();
    expect(warper.render).toHaveBeenCalledTimes(1);
  });
});
