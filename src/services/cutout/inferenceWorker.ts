/**
 * Page-side client of `public/workers/cutout-worker.js`: a request/response protocol over
 * postMessage with request ids, stage events, timeouts and an idle shutdown that frees the model
 * session's memory. It knows nothing about images; tensors go over as transferred buffers.
 */

export interface WorkerLike {
  onmessage: ((event: { data: WorkerReply }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  postMessage(message: WorkerRequest, transfer?: ArrayBuffer[]): void;
  terminate(): void;
}

export interface InitPayload {
  ortScript: string;
  ortDir: string;
  model: ArrayBuffer;
  wasm: ArrayBuffer;
}

export type WorkerRequest =
  | ({ type: 'init'; id: number } & InitPayload)
  | { type: 'run'; id: number; input: Float32Array; dims: number[] };

export type WorkerStage = 'session-start' | 'infer-start' | 'infer-end';

export type WorkerReply =
  | { type: 'stage'; id: number; stage: WorkerStage }
  | { type: 'ready'; id: number }
  | { type: 'result'; id: number; output: Float32Array }
  | { type: 'error'; id: number; message: string };

export interface InferenceWorkerOptions {
  create: () => WorkerLike;
  /** Terminate the worker (and free the model) after this long without a request. */
  idleMs: number;
  initTimeoutMs: number;
  runTimeoutMs: number;
  onStage?: (stage: WorkerStage) => void;
  /** Called when the worker is gone (idle shutdown, crash or timeout): the session must be rebuilt. */
  onGone?: (reason: 'idle' | 'failed') => void;
}

export interface InferenceWorker {
  readonly ready: boolean;
  init(payload: InitPayload): Promise<void>;
  run(input: Float32Array, dims: number[]): Promise<Float32Array>;
  dispose(): void;
}

interface Pending {
  resolve: (value: Float32Array | undefined) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createInferenceWorker(options: InferenceWorkerOptions): InferenceWorker {
  let worker: WorkerLike | undefined;
  let ready = false;
  let nextId = 1;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<number, Pending>();

  const stopIdleTimer = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = undefined;
  };

  const kill = (reason: 'idle' | 'failed', error?: Error) => {
    stopIdleTimer();
    const current = worker;
    worker = undefined;
    ready = false;
    current?.terminate();
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error ?? new Error('Worker stopped'));
    }
    pending.clear();
    if (current) options.onGone?.(reason);
  };

  const armIdleTimer = () => {
    stopIdleTimer();
    if (pending.size > 0 || !worker) return;
    idleTimer = setTimeout(() => kill('idle'), options.idleMs);
  };

  const settle = (id: number, finish: (entry: Pending) => void) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    finish(entry);
    armIdleTimer();
  };

  const start = (): WorkerLike => {
    if (worker) return worker;
    const created = options.create();
    created.onmessage = (event) => {
      const reply = event.data;
      if (reply.type === 'stage') options.onStage?.(reply.stage);
      else if (reply.type === 'ready') {
        ready = true;
        settle(reply.id, (e) => e.resolve(undefined));
      } else if (reply.type === 'result') settle(reply.id, (e) => e.resolve(reply.output));
      else if (reply.type === 'error') settle(reply.id, (e) => e.reject(new Error(reply.message)));
    };
    created.onerror = (event) => kill('failed', new Error(event.message ?? 'Worker crashed'));
    worker = created;
    return created;
  };

  const request = (
    build: (id: number) => WorkerRequest,
    transfer: ArrayBuffer[],
    timeoutMs: number,
  ): Promise<Float32Array | undefined> =>
    new Promise((resolve, reject) => {
      let target: WorkerLike;
      try {
        target = start();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Worker could not start'));
        return;
      }
      stopIdleTimer();
      const id = nextId++;
      const timer = setTimeout(
        () => kill('failed', new Error('Background removal timed out')),
        timeoutMs,
      );
      pending.set(id, { resolve, reject, timer });
      try {
        target.postMessage(build(id), transfer);
      } catch (error) {
        settle(id, (e) =>
          e.reject(error instanceof Error ? error : new Error('postMessage failed')),
        );
      }
    });

  return {
    get ready() {
      return ready;
    },
    async init(payload) {
      await request(
        (id) => ({ type: 'init', id, ...payload }),
        [payload.model, payload.wasm],
        options.initTimeoutMs,
      );
    },
    async run(input, dims) {
      const output = await request(
        (id) => ({ type: 'run', id, input, dims }),
        [input.buffer as ArrayBuffer],
        options.runTimeoutMs,
      );
      if (!output) throw new Error('Worker returned no output');
      return output;
    },
    dispose() {
      kill('idle');
    },
  };
}
