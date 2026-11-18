/* Background-removal worker (docs/ARCHITECTURE.md, "Background removal").
 * Plain classic-script worker, served as a static file next to /ort and /models. It holds the
 * onnxruntime-web session (U-2-Netp, Apache-2.0; onnxruntime-web, MIT) so inference never blocks
 * the page. All image maths stays on the page side (src/core/image); only tensors cross over, as
 * transferred ArrayBuffers (no copies).
 *
 * Messages in:  { type: 'init', id, ortScript, ortDir, model: ArrayBuffer, wasm: ArrayBuffer }
 *               { type: 'run', id, input: Float32Array, dims: number[] }
 * Messages out: { type: 'ready'|'stage'|'result'|'error', id, ... }
 */
'use strict';

var session = null;
var ortLib = null;

function post(message, transfer) {
  self.postMessage(message, transfer || []);
}

function describe(error) {
  return error && error.message ? error.message : String(error);
}

async function init(msg) {
  if (!ortLib) {
    importScripts(msg.ortScript);
    ortLib = self.ort;
    if (!ortLib) throw new Error('onnxruntime-web did not register itself');
  }
  ortLib.env.wasm.numThreads = 1;
  ortLib.env.wasm.proxy = false;
  ortLib.env.wasm.wasmPaths = msg.ortDir;
  ortLib.env.wasm.wasmBinary = new Uint8Array(msg.wasm);
  post({ type: 'stage', id: msg.id, stage: 'session-start' });
  session = await ortLib.InferenceSession.create(new Uint8Array(msg.model), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  post({ type: 'ready', id: msg.id });
}

async function run(msg) {
  if (!session) throw new Error('Model session is not ready');
  post({ type: 'stage', id: msg.id, stage: 'infer-start' });
  var tensor = new ortLib.Tensor('float32', msg.input, msg.dims);
  var feeds = {};
  feeds[session.inputNames[0]] = tensor;
  var outputs = await session.run(feeds);
  // The first output (d0) is the fused side map; the others are the intermediate stages.
  var raw = outputs[session.outputNames[0]].data;
  if (!(raw instanceof Float32Array)) throw new Error('Unexpected model output type');
  post({ type: 'stage', id: msg.id, stage: 'infer-end' });
  // `raw` owns its buffer exclusively (one output tensor), so it can be handed over.
  post({ type: 'result', id: msg.id, output: raw }, [raw.buffer]);
}

self.onmessage = function (event) {
  var msg = event.data;
  var job = msg.type === 'init' ? init(msg) : msg.type === 'run' ? run(msg) : null;
  if (job) {
    job.catch(function (error) {
      post({ type: 'error', id: msg.id, message: describe(error) });
    });
  }
};
