import { compositeOutfit, type CompositeInput, type RGBAImage } from '@/core/composite';
import type { PipelineRequest, PipelineResponse } from './pipeline.worker';

/** The worker is dropped after this long without work, so its memory is given back. */
const IDLE_MS = 60_000;

interface Pending {
  resolve: (image: RGBAImage) => void;
  reject: (error: Error) => void;
}

/**
 * Runs `compositeOutfit` in a dedicated Web Worker so the page stays responsive while an outfit is
 * merged (one merge blocks for 50–300 ms on a phone-sized canvas; docs/TRY_ON.md §13.2). Without
 * `Worker`, or if the worker fails to start, it runs on the main thread instead.
 */
export function createPipelineRunner(): (input: CompositeInput) => Promise<RGBAImage> {
  let worker: Worker | undefined;
  let broken = typeof Worker === 'undefined';
  let nextId = 1;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<number, Pending>();

  const drop = (reason: Error) => {
    worker?.terminate();
    worker = undefined;
    for (const p of pending.values()) p.reject(reason);
    pending.clear();
  };

  const start = (): Worker => {
    const w = new Worker(new URL('./pipeline.worker', import.meta.url));
    w.onmessage = (event: MessageEvent<PipelineResponse>) => {
      const reply = event.data;
      const p = pending.get(reply.id);
      if (!p) return;
      pending.delete(reply.id);
      if (reply.ok) p.resolve(reply.image);
      else p.reject(new Error(reply.message));
    };
    w.onerror = () => {
      broken = true;
      drop(new Error('The compositing worker failed'));
    };
    return w;
  };

  return async (input) => {
    if (!broken) {
      try {
        worker ??= start();
        if (idle) clearTimeout(idle);
        const id = nextId++;
        const done = new Promise<RGBAImage>((resolve, reject) => {
          pending.set(id, { resolve, reject });
        });
        // Copied, not transferred: if the worker cannot run, the main thread still needs the pixels.
        const request: PipelineRequest = { id, input };
        worker.postMessage(request);
        const image = await done;
        idle = setTimeout(() => drop(new Error('idle')), IDLE_MS);
        return image;
      } catch (error) {
        // A worker that cannot start is not tried again; a failed merge is the pipeline's own.
        if (!broken) throw error;
      }
    }
    return compositeOutfit(input);
  };
}
