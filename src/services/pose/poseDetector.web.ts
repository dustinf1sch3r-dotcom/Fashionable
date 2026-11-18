import type { PoseLandmarker } from '@mediapipe/tasks-vision';

import type { PoseKeypoint } from '@/core/tryon/pose';
import { context2d, loadImage, makeCanvas } from '../pixels/canvas.web';
import type { PoseDetector } from '../types';
import { fetchBytes, loadScript, type Progress } from './download.web';

/**
 * Web pose detection: MediaPipe Pose Landmarker (full, float16; Apache-2.0) run by
 * `@mediapipe/tasks-vision` (Apache-2.0) in WebAssembly on the CPU, IMAGE mode, one person.
 *
 * Nothing here is in the app's initial bundle (only a type import, erased at build time). The
 * runtime script, its WASM and the model are static files that `scripts/fetch-models.js` puts
 * into `public/` (see docs/ARCHITECTURE.md), so they are served from our own site, and they are
 * only requested the first time a photo is analysed. Downloads are kept in the Cache API.
 * CPU rather than GPU: it is the delegate that behaves the same on every iPhone Safari.
 */
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
const MP_DIR = `${BASE}/mediapipe/`;
/** Version tags only change the cache key; the server ignores them. Bump with the pinned files. */
const MP_VERSION = '1.2.3';
const MODEL_URL = `${BASE}/models/pose_landmarker_full.task?v=5134a3aa`;
/** Longest side of the image handed to the model; keypoints are normalised, so size is free. */
const DETECT_MAX_PX = 1024;

// Rough shares of the progress bar: script, model (9.4 MB), WASM (14.7 MB), session creation.
const SCRIPT_END = 0.02;
const MODEL_END = 0.38;
const WASM_END = 0.95;

type VisionModule = typeof import('@mediapipe/tasks-vision');

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
    // A missing mark must never break detection.
  }
}

async function loadVision(): Promise<VisionModule> {
  const existing = (globalThis as { Vision?: VisionModule }).Vision;
  if (existing) return existing;
  await loadScript(`${MP_DIR}vision_bundle.js?v=${MP_VERSION}`);
  const loaded = (globalThis as { Vision?: VisionModule }).Vision;
  if (!loaded) throw new Error('MediaPipe did not register itself');
  return loaded;
}

/** The image the model sees: the photo, shrunk so its longest side is at most DETECT_MAX_PX. */
function detectionSource(img: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= DETECT_MAX_PX) return img;
  const k = DETECT_MAX_PX / longest;
  const canvas = makeCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
  context2d(canvas).drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function createDetector(): PoseDetector {
  let loading: Promise<PoseLandmarker> | undefined;
  const listeners = new Set<Progress>();
  let latest = 0;

  const report = (fraction: number) => {
    latest = Math.max(latest, fraction);
    listeners.forEach((fn) => fn(latest));
  };

  const load = async (): Promise<PoseLandmarker> => {
    mark('pose:prepare-start');
    const vision = await loadVision();
    report(SCRIPT_END);
    const [model, wasm] = await Promise.all([
      fetchBytes(MODEL_URL, (f) => report(SCRIPT_END + f * (MODEL_END - SCRIPT_END))),
      fetchBytes(`${MP_DIR}vision_wasm_internal.wasm?v=${MP_VERSION}`, (f) =>
        report(MODEL_END + f * (WASM_END - MODEL_END)),
      ),
    ]);
    // The WASM goes in as a blob so the runtime does not download it a second time.
    const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    try {
      const landmarker = await vision.PoseLandmarker.createFromOptions(
        {
          wasmLoaderPath: new URL(`${MP_DIR}vision_wasm_internal.js?v=${MP_VERSION}`, location.href)
            .href,
          wasmBinaryPath: wasmUrl,
        },
        {
          baseOptions: { modelAssetBuffer: new Uint8Array(model), delegate: 'CPU' },
          runningMode: 'IMAGE',
          numPoses: 1,
        },
      );
      report(1);
      mark('pose:prepare-end');
      measure('pose-prepare', 'pose:prepare-start', 'pose:prepare-end');
      return landmarker;
    } finally {
      URL.revokeObjectURL(wasmUrl);
    }
  };

  const prepare = async (onProgress?: Progress): Promise<PoseLandmarker> => {
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
    async detect(imageUri) {
      const landmarker = await prepare();
      const img = await loadImage(imageUri);
      mark('pose:detect-start');
      const result = landmarker.detect(detectionSource(img));
      mark('pose:detect-end');
      measure('pose-detect', 'pose:detect-start', 'pose:detect-end');
      const first = result.landmarks[0];
      if (!first || first.length === 0) return undefined;
      const keypoints: PoseKeypoint[] = first.map((p) => ({
        x: p.x,
        y: p.y,
        visibility: p.visibility ?? 0,
      }));
      return { keypoints, width: img.naturalWidth, height: img.naturalHeight };
    },
  };
}

export function createPoseDetector(): PoseDetector {
  return createDetector();
}
