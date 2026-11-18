import {
  createInferenceWorker,
  type InferenceWorkerOptions,
  type WorkerLike,
  type WorkerReply,
  type WorkerRequest,
} from './inferenceWorker';

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  terminated = false;
  sent: { message: WorkerRequest; transfer?: ArrayBuffer[] }[] = [];
  postMessage(message: WorkerRequest, transfer?: ArrayBuffer[]) {
    this.sent.push({ message, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: WorkerReply) {
    this.onmessage?.({ data });
  }
}

function setup(overrides: Partial<InferenceWorkerOptions> = {}) {
  const workers: FakeWorker[] = [];
  const gone: string[] = [];
  const stages: string[] = [];
  const client = createInferenceWorker({
    create: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    idleMs: 1000,
    initTimeoutMs: 5000,
    runTimeoutMs: 2000,
    onGone: (reason) => gone.push(reason),
    onStage: (stage) => stages.push(stage),
    ...overrides,
  });
  return { client, workers, gone, stages };
}

const payload = () => ({
  ortScript: 'http://x/ort.js',
  ortDir: 'http://x/ort/',
  model: new ArrayBuffer(4),
  wasm: new ArrayBuffer(8),
});

describe('createInferenceWorker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('inits with transferred buffers and then runs, matching replies by id', async () => {
    const { client, workers, stages } = setup();
    const p = payload();
    const init = client.init(p);
    const w = workers[0];
    expect(w.sent[0].transfer).toEqual([p.model, p.wasm]);
    w.reply({ type: 'stage', id: 1, stage: 'session-start' });
    w.reply({ type: 'ready', id: 1 });
    await init;
    expect(client.ready).toBe(true);
    expect(stages).toEqual(['session-start']);

    const input = new Float32Array(3);
    const run = client.run(input, [1, 3]);
    expect(w.sent[1].message).toMatchObject({ type: 'run', id: 2 });
    expect(w.sent[1].transfer).toEqual([input.buffer]);
    const output = new Float32Array([0.5]);
    w.reply({ type: 'result', id: 2, output });
    await expect(run).resolves.toBe(output);
  });

  it('rejects on an error reply and keeps the worker alive', async () => {
    const { client, workers, gone } = setup();
    const run = client.run(new Float32Array(1), [1]);
    workers[0].reply({ type: 'error', id: 1, message: 'boom' });
    await expect(run).rejects.toThrow('boom');
    expect(workers[0].terminated).toBe(false);
    expect(gone).toEqual([]);
  });

  it('terminates and reports failure when a request times out', async () => {
    const { client, workers, gone } = setup();
    const run = client.run(new Float32Array(1), [1]);
    jest.advanceTimersByTime(2000);
    await expect(run).rejects.toThrow('timed out');
    expect(workers[0].terminated).toBe(true);
    expect(client.ready).toBe(false);
    expect(gone).toEqual(['failed']);
  });

  it('rejects pending requests when the worker crashes', async () => {
    const { client, workers, gone } = setup();
    const init = client.init(payload());
    workers[0].onerror?.({ message: 'script failed' });
    await expect(init).rejects.toThrow('script failed');
    expect(gone).toEqual(['failed']);
  });

  it('shuts down after the idle period and starts a fresh worker on demand', async () => {
    const { client, workers, gone } = setup();
    const init = client.init(payload());
    workers[0].reply({ type: 'ready', id: 1 });
    await init;
    jest.advanceTimersByTime(999);
    expect(workers[0].terminated).toBe(false);
    jest.advanceTimersByTime(2);
    expect(workers[0].terminated).toBe(true);
    expect(gone).toEqual(['idle']);
    expect(client.ready).toBe(false);

    void client.init(payload()).catch(() => undefined);
    expect(workers).toHaveLength(2);
  });

  it('does not go idle while a request is in flight', async () => {
    const { client, workers } = setup({ runTimeoutMs: 10_000 });
    const run = client.run(new Float32Array(1), [1]);
    jest.advanceTimersByTime(5000);
    expect(workers[0].terminated).toBe(false);
    workers[0].reply({ type: 'result', id: 1, output: new Float32Array(1) });
    await run;
  });

  it('rejects when the worker cannot be created', async () => {
    const { client } = setup({
      create: () => {
        throw new Error('no workers');
      },
    });
    await expect(client.run(new Float32Array(1), [1])).rejects.toThrow('no workers');
  });
});
