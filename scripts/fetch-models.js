#!/usr/bin/env node
/**
 * Build-time asset step for background removal (docs/ARCHITECTURE.md, "Background removal").
 *
 * 1. Downloads the pinned U-2-Netp ONNX model from Hugging Face (build machines only; phones never
 *    contact Hugging Face), checks its SHA-256 and caches it in `.cache/models/`.
 * 2. Copies the model into `public/models/` and the onnxruntime-web files the browser needs into
 *    `public/ort/`. Expo copies `public/` into the web export, so everything is served from our
 *    own site under whatever base path it is published at. Both folders are gitignored.
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

/** The browser build of onnxruntime-web that runs WebAssembly on the CPU, single-threaded. */
const ORT_FILES = ['ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];

const root = process.cwd();
const cacheDir = path.join(root, '.cache', 'models');
const modelsOut = path.join(root, 'public', 'models');
const ortOut = path.join(root, 'public', 'ort');
const ortSrc = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function ensureModel() {
  const cached = path.join(cacheDir, `u2netp-${MODEL.commit.slice(0, 8)}.onnx`);
  if (fs.existsSync(cached) && sha256(cached) === MODEL.sha256) return cached;
  fs.mkdirSync(cacheDir, { recursive: true });
  const url = `https://huggingface.co/${MODEL.repo}/resolve/${MODEL.commit}/${MODEL.file}`;
  console.log(`fetch-models: downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== MODEL.sha256) {
    throw new Error(`SHA-256 mismatch for the model: expected ${MODEL.sha256}, got ${actual}`);
  }
  fs.writeFileSync(cached, bytes);
  return cached;
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
  fs.mkdirSync(modelsOut, { recursive: true });
  fs.copyFileSync(cached, path.join(modelsOut, MODEL.publicName));
  fs.writeFileSync(
    path.join(modelsOut, 'NOTICE.txt'),
    [
      'u2netp.onnx is the U-2-Netp model (Apache License 2.0).',
      `Weights: https://huggingface.co/${MODEL.repo} (commit ${MODEL.commit}).`,
      'Original work: U^2-Net, Xuebin Qin et al., https://github.com/xuebinqin/U-2-Net',
      'Licence: https://www.apache.org/licenses/LICENSE-2.0',
      '',
    ].join('\n'),
  );
  copyOrt();
  console.log(`fetch-models: ready (model sha256 ${MODEL.sha256.slice(0, 12)}…)`);
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
