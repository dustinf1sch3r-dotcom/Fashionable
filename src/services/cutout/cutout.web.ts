import type { InferenceSession } from 'onnxruntime-web';

import { coverage, normalizeMinMax, softThreshold, toModelInput, U2NET_SIZE } from '@/core/image';
import { applyMaskToImage, loadImage, readSquashed } from '../pixels/canvas.web';
import type { BackgroundRemover, CutoutResult } from '../types';

/**
 * Web background removal: U-2-Netp (Apache-2.0) run by onnxruntime-web (MIT) in WebAssembly.
 *
 * Nothing here is in the app's initial bundle. The runtime script, its WASM and the model are
 * static files that `scripts/fetch-models.js` puts into `public/` at build time (see
 * docs/ARCHITECTURE.md), so they are served from our own site, and they are only requested the
 * first time a photo is cut out. Downloads are kept in the browser's Cache API for later visits.
 *
 * Phone constraints: GitHub Pages cannot send COOP/COEP headers, so there is no SharedArrayBuffer
 * and the runtime is single-threaded (`numThreads = 1`, no proxy worker). The model runs at its
 * native 320 x 320 input and the mask is scaled up to the photo afterwards.
 */

// Same-origin, under the sub-path the site is published at (GitHub Pages: /<repo>/).
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
const ORT_DIR = `${BASE}/ort/`;
/** Version tags only change the cache key; the server ignores them. Bump with the pinned files. */
const ORT_VERSION = '1.31.1';
const MODEL_URL = `${BASE}/models/u2netp.onnx?v=309c8469`;
const CACHE_NAME = 'fashionable-cutout-v1';
/** A mask covering less of the picture than this means the model found no garment. */
const MIN_COVERAGE = 0.01;

// Rough download shares of the progress bar: runtime script, model (4.6 MB), WASM (14.8 MB).
const SCRIPT_END = 0.04;
const MODEL_END = 0.28;
const WASM_END = 0.96;

type Progress = (fraction: number) => void;
type OrtModule = typeof import('onnxruntime-web');

function mark(name: string): void {
  try {
    performance.mark(name);
  } catch {
    // User Timing is a diagnostic only.
  }
}

function measure(name: string, start: string, end: string): void {
  try {
    performance.measure(name, start, end);
  } catch {
    // A missing mark must never break background removal.
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function loadOrt(): Promise<OrtModule> {
  const existing = (globalThis as { ort?: OrtModule }).ort;
  if (existing) return existing;
  await loadScript(`${ORT_DIR}ort.wasm.min.js?v=${ORT_VERSION}`);
  const loaded = (globalThis as { ort?: OrtModule }).ort;
  if (!loaded) throw new Error('onnxruntime-web did not register itself');
  return loaded;
}

async function openCache(): Promise<Cache | undefined> {
  try {
    return typeof caches === 'undefined' ? undefined : await caches.open(CACHE_NAME);
  } catch {
    return undefined; // private mode or blocked storage: download every time
  }
}

/** Downloads `url` as bytes with progress, using (and filling) the Cache API. */
async function fetchBytes(url: string, onFraction: Progress): Promise<ArrayBuffer> {
  const cache = await openCache();
  try {
    const hit = await cache?.match(url);
    if (hit) {
      const bytes = await hit.arrayBuffer();
      onFraction(1);
      return bytes;
    }
  } catch {
    // Fall through to the network.
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const total = Number(response.headers.get('content-length')) || 0;
  let bytes: ArrayBuffer;
  if (response.body && total > 0) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onFraction(Math.min(1, received / total));
    }
    const joined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    bytes = joined.buffer;
  } else {
    bytes = await response.arrayBuffer();
  }
  onFraction(1);
  // `serve -s` and some hosts answer a missing file with index.html: refuse to cache that.
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/html')) throw new Error(`Not a binary file: ${url}`);
  try {
    await cache?.put(url, new Response(bytes.slice(0)));
  } catch {
    // Quota exceeded: still usable this session.
  }
  return bytes;
}

interface Loaded {
  ort: OrtModule;
  session: InferenceSession;
}

function createRemover(): BackgroundRemover {
  let loading: Promise<Loaded> | undefined;
  const listeners = new Set<Progress>();
  let latest = 0;

  const report = (fraction: number) => {
    latest = Math.max(latest, fraction);
    listeners.forEach((fn) => fn(latest));
  };

  const load = async (): Promise<Loaded> => {
    mark('cutout:prepare-start');
    const ort = await loadOrt();
    report(SCRIPT_END);
    const [model, wasm] = await Promise.all([
      fetchBytes(MODEL_URL, (f) => report(SCRIPT_END + f * (MODEL_END - SCRIPT_END))),
      fetchBytes(`${ORT_DIR}ort-wasm-simd-threaded.wasm?v=${ORT_VERSION}`, (f) =>
        report(MODEL_END + f * (WASM_END - MODEL_END)),
      ),
    ]);
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = ORT_DIR;
    ort.env.wasm.wasmBinary = new Uint8Array(wasm);
    const session = await ort.InferenceSession.create(new Uint8Array(model), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    report(1);
    mark('cutout:prepare-end');
    measure('cutout-prepare', 'cutout:prepare-start', 'cutout:prepare-end');
    return { ort, session };
  };

  const prepare = async (onProgress?: Progress): Promise<Loaded> => {
    if (onProgress) {
      listeners.add(onProgress);
      onProgress(latest);
    }
    loading ??= load().catch((error: unknown) => {
      loading = undefined; // let the next call retry (e.g. after going back online)
      latest = 0;
      throw error;
    });
    try {
      return await loading;
    } finally {
      if (onProgress) listeners.delete(onProgress);
    }
  };

  return {
    available: typeof document !== 'undefined' && typeof WebAssembly !== 'undefined',
    async prepare(onProgress) {
      await prepare(onProgress);
    },
    async remove(imageUri, onProgress): Promise<CutoutResult> {
      // Loading is 0..0.85 of the bar, inference and compositing the rest.
      const { ort, session } = await prepare(onProgress && ((f) => onProgress(f * 0.85)));
      mark('cutout:infer-start');
      const img = await loadImage(imageUri);
      const input = toModelInput(readSquashed(img, U2NET_SIZE, U2NET_SIZE));
      const tensor = new ort.Tensor('float32', input, [1, 3, U2NET_SIZE, U2NET_SIZE]);
      const outputs = await session.run({ [session.inputNames[0]]: tensor });
      onProgress?.(0.95);
      // The first output (d0) is the fused side map; the others are the intermediate stages.
      const raw = outputs[session.outputNames[0]].data;
      if (!(raw instanceof Float32Array)) throw new Error('Unexpected model output type');
      const mask = normalizeMinMax(raw);
      if (coverage(mask) < MIN_COVERAGE) throw new Error('No garment found in the photo');
      const cut = await applyMaskToImage(img, softThreshold(mask), U2NET_SIZE, U2NET_SIZE);
      if (!cut) throw new Error('No garment found in the photo');
      mark('cutout:infer-end');
      measure('cutout-infer', 'cutout:infer-start', 'cutout:infer-end');
      onProgress?.(1);
      return {
        uri: URL.createObjectURL(cut.blob),
        hasAlpha: true,
        width: cut.width,
        height: cut.height,
      };
    },
  };
}

export function createBackgroundRemover(): BackgroundRemover {
  return createRemover();
}
