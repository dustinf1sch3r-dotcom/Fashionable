#!/usr/bin/env node
/**
 * Build-time asset step for the on-device models (docs/ARCHITECTURE.md, "Background removal"; the
 * pose model is served the same way, docs/TRY_ON.md §11.1).
 *
 * 1. Downloads the pinned models (U-2-Netp ONNX from Hugging Face, MediaPipe Pose Landmarker from
 *    Google's versioned storage bucket; build machines only, phones never contact either), checks
 *    their SHA-256 and caches them in `.cache/models/`.
 * 2. Copies the models into `public/models/`, the onnxruntime-web files into `public/ort/` and the
 *    @mediapipe/tasks-vision runtime (script + WASM) into `public/mediapipe/`. Expo copies
 *    `public/` into the web export, so everything is served from our own site under whatever base
 *    path it is published at. These folders are gitignored.
 *
 * Run by `npm run build:web` and `npm run web`. Safe to re-run: a verified cache needs no network.
 */
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');

// Apache-2.0 model weights: https://huggingface.co/BritishWerewolf/U-2-Netp
const MODEL = {
  repo: 'BritishWerewolf/U-2-Netp',
  commit: '7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8',
  file: 'onnx/model.onnx',
  sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
  bytes: 4574861,
  publicName: 'u2netp.onnx',
};

// Apache-2.0 per the BlazePose GHUM 3D model card:
// https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
// ".../float16/1/..." is the versioned path (".../latest/..." is a moving alias; never use it).
const POSE_MODEL = {
  url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  sha256: '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1',
  bytes: 9398198,
  publicName: 'pose_landmarker_full.task',
};

/** The classic-script build of @mediapipe/tasks-vision and the (non-module) CPU WASM it loads. */
const MEDIAPIPE_FILES = [
  ['vision_bundle.js', 'vision_bundle.js'],
  ['wasm/vision_wasm_internal.js', 'vision_wasm_internal.js'],
  ['wasm/vision_wasm_internal.wasm', 'vision_wasm_internal.wasm'],
];

/** The browser build of onnxruntime-web that runs WebAssembly on the CPU, single-threaded. */
const ORT_FILES = ['ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];

const root = process.cwd();
const cacheDir = path.join(root, '.cache', 'models');
const modelsOut = path.join(root, 'public', 'models');
const ortOut = path.join(root, 'public', 'ort');
const mediapipeOut = path.join(root, 'public', 'mediapipe');
const mediapipeSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const ortSrc = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function ensureDownload(cachedName, url, expectedSha256) {
  const cached = path.join(cacheDir, cachedName);
  if (fs.existsSync(cached) && sha256(cached) === expectedSha256) return cached;
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`fetch-models: downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedSha256) {
    throw new Error(`SHA-256 mismatch for ${url}: expected ${expectedSha256}, got ${actual}`);
  }
  fs.writeFileSync(cached, bytes);
  return cached;
}

const ensureModel = () =>
  ensureDownload(
    `u2netp-${MODEL.commit.slice(0, 8)}.onnx`,
    `https://huggingface.co/${MODEL.repo}/resolve/${MODEL.commit}/${MODEL.file}`,
    MODEL.sha256,
  );

const ensurePoseModel = () =>
  ensureDownload(
    `pose_landmarker_full-${POSE_MODEL.sha256.slice(0, 8)}.task`,
    POSE_MODEL.url,
    POSE_MODEL.sha256,
  );

function copyMediapipe() {
  if (!fs.existsSync(mediapipeSrc)) {
    throw new Error('@mediapipe/tasks-vision is not installed: run npm ci');
  }
  fs.mkdirSync(mediapipeOut, { recursive: true });
  for (const [from, to] of MEDIAPIPE_FILES) {
    fs.copyFileSync(path.join(mediapipeSrc, from), path.join(mediapipeOut, to));
  }
  fs.writeFileSync(
    path.join(mediapipeOut, 'NOTICE.txt'),
    '@mediapipe/tasks-vision, Copyright The MediaPipe Authors, Apache License 2.0.\n' +
      'https://github.com/google-ai-edge/mediapipe\n' +
      'Licence: https://www.apache.org/licenses/LICENSE-2.0\n',
  );
}

function copyOrt() {
  if (!fs.existsSync(ortSrc)) throw new Error('onnxruntime-web is not installed: run npm ci');
  fs.mkdirSync(ortOut, { recursive: true });
  for (const name of ORT_FILES) fs.copyFileSync(path.join(ortSrc, name), path.join(ortOut, name));
  fs.writeFileSync(
    path.join(ortOut, 'NOTICE.txt'),
    'ONNX Runtime Web, Copyright (c) Microsoft Corporation, MIT License.\nhttps://github.com/microsoft/onnxruntime\n',
  );
}

async function main() {
  const cached = await ensureModel();
  const poseCached = await ensurePoseModel();
  fs.mkdirSync(modelsOut, { recursive: true });
  fs.copyFileSync(cached, path.join(modelsOut, MODEL.publicName));
  fs.copyFileSync(poseCached, path.join(modelsOut, POSE_MODEL.publicName));
  fs.writeFileSync(
    path.join(modelsOut, 'NOTICE.txt'),
    [
      'u2netp.onnx is the U-2-Netp model (Apache License 2.0).',
      `Weights: https://huggingface.co/${MODEL.repo} (commit ${MODEL.commit}).`,
      'Original work: U^2-Net, Xuebin Qin et al., https://github.com/xuebinqin/U-2-Net',
      'Licence: https://www.apache.org/licenses/LICENSE-2.0',
      '',
      'pose_landmarker_full.task is the MediaPipe Pose Landmarker (full, float16), based on the',
      'BlazePose GHUM 3D model, Copyright Google LLC, licensed under the Apache License, Version 2.0.',
      `Source: ${POSE_MODEL.url}`,
      'Model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf',
      'Licence: https://www.apache.org/licenses/LICENSE-2.0',
      '',
    ].join('\n'),
  );
  copyOrt();
  copyMediapipe();
  console.log(
    `fetch-models: ready (models sha256 ${MODEL.sha256.slice(0, 8)}…, ${POSE_MODEL.sha256.slice(0, 8)}…)`,
  );
}

// Node's fetch ignores HTTPS_PROXY unless told to; sandboxed build machines need it.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY && !process.env.FETCH_MODELS_CHILD) {
  const child = spawnSync(process.execPath, [process.argv[1]], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_USE_ENV_PROXY: '1',
      FETCH_MODELS_CHILD: '1',
      NODE_NO_WARNINGS: '1',
    },
  });
  process.exit(child.status ?? 1);
}

main().catch((error) => {
  console.error(`fetch-models: ${error.message}`);
  process.exit(1);
});
