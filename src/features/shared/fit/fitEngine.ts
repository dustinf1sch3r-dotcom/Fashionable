import { buildFitMesh, rigTargets } from '@/core/fit';
import type { FitBody, GarmentRig, ID, Point } from '@/core/model/types';
import type { GarmentWarper } from '@/services';
import type { FittedLayer } from '@/ui/mannequin';
import type { FitSlot } from './fitKey';
import { createLru } from './lru';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Records a User Timing measure (visible in devtools and to tests); a no-op where unsupported. */
function mark(name: string, start: number): void {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
  try {
    performance.measure(name, { start, duration: now() - start });
  } catch {
    // Timing is only a diagnostic.
  }
}

/** Everything needed to render one fitted garment image. */
export interface FitJob {
  /** `fitKey(...)` of the parts below. */
  key: string;
  itemId: ID;
  cutoutId: ID;
  cutoutUri: string;
  rig: GarmentRig;
  /** Cutout width ÷ height. */
  aspect: number;
  body: FitBody;
  slot: FitSlot;
  /** Output pixels per mannequin unit. */
  density: number;
  /** Pre-computed body targets (e.g. nested inside another layer); default `rigTargets(...)`. */
  targets?: Record<string, Point>;
}

export interface FitEngine {
  readonly available: boolean;
  /** The finished image for `key`, refreshing its place in the cache. */
  peek(key: string): FittedLayer | undefined;
  /**
   * The newest finished image of this item and cutout, whatever body it was made for. Shown while
   * the exact one is still being computed, so the garment does not jump back to rigid placement.
   */
  latest(itemId: ID, cutoutId: ID): FittedLayer | undefined;
  /** Render (or reuse) the image for `job`; resolves `undefined` when rendering fails. */
  request(job: FitJob): Promise<FittedLayer | undefined>;
}

interface EngineOptions {
  /** Most finished images kept (their object URLs are released on eviction). Default 60. */
  max?: number;
  /** Renders running at once. Default 2: each one briefly holds a canvas of up to a few MB. */
  concurrency?: number;
}

interface Entry extends FittedLayer {
  itemId: ID;
  cutoutId: ID;
}

/**
 * Cache and scheduler in front of the mesh renderer: an in-memory LRU of finished images keyed by
 * `fitKey`, identical requests share one render, and at most `concurrency` renders run together.
 * A key that failed to render is not retried (the garment simply stays rigid).
 */
export function createFitEngine(warper: GarmentWarper, options: EngineOptions = {}): FitEngine {
  const { max = 60, concurrency = 2 } = options;
  const latestByItem = new Map<string, Entry>();
  const cache = createLru<Entry>(max, (_key, entry) => {
    for (const [k, v] of latestByItem) if (v.uri === entry.uri) latestByItem.delete(k);
    warper.release?.(entry.uri);
  });
  const inflight = new Map<string, Promise<FittedLayer | undefined>>();
  const failed = new Set<string>();
  const waiting: (() => void)[] = [];
  let running = 0;

  const acquire = (): Promise<void> =>
    running < concurrency
      ? ((running += 1), Promise.resolve())
      : new Promise<void>((resolve) => waiting.push(() => resolve()));
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  };

  async function render(job: FitJob): Promise<FittedLayer | undefined> {
    await acquire();
    try {
      const started = now();
      const targets = job.targets ?? rigTargets(job.rig, job.aspect, job.body, job.slot);
      const mesh = buildFitMesh(job.rig, targets, job.aspect);
      mark('fit-mesh', started);
      const out = await warper.render(job.cutoutUri, mesh, job.density);
      const entry: Entry = {
        uri: out.uri,
        bounds: out.bounds,
        itemId: job.itemId,
        cutoutId: job.cutoutId,
      };
      cache.set(job.key, entry);
      latestByItem.set(`${job.itemId}|${job.cutoutId}`, entry);
      return entry;
    } catch {
      failed.add(job.key);
      return undefined;
    } finally {
      release();
    }
  }

  return {
    available: warper.available,
    peek: (key) => cache.get(key),
    latest: (itemId, cutoutId) => latestByItem.get(`${itemId}|${cutoutId}`),
    request(job) {
      const hit = cache.get(job.key);
      if (hit) return Promise.resolve(hit);
      if (failed.has(job.key)) return Promise.resolve(undefined);
      const pending = inflight.get(job.key);
      if (pending) return pending;
      const p = render(job).finally(() => inflight.delete(job.key));
      inflight.set(job.key, p);
      return p;
    },
  };
}
