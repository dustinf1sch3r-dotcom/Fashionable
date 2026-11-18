# Licences: what this app is built from

Fashionable will be sold as a closed-source app. Everything it is built from, and everything it
downloads or calls at run time, must allow that. This file is the register. **Add a row whenever
you add a dependency, model, font, icon set, image, sound or data source.**

This is an engineering record, not legal advice. Have a lawyer review it before the store launch.

## The rule

| Allowed                                                                                  | Not allowed                                                       |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| MIT, ISC, BSD, Apache-2.0, 0BSD, BlueOak, CC0, Unlicense and similar permissive licences | GPL, AGPL, LGPL                                                   |
| Platform APIs that ship with iOS / Android                                               | Anything marked "non-commercial", "research only", "personal use" |
| Assets we made ourselves, or with a licence allowing commercial use                      | Images, fonts or icons copied from the web without a licence      |

## Automatic check

`npm run licenses` reads every installed package (direct and indirect) and fails if any has a
licence that is not on the cleared list in `scripts/check-licenses.js`. CI runs it on every push.

Last run: all packages cleared. Two packages are cleared by name rather than by licence, both
build tools that are not part of the app's own code:

| Package        | Licence   | Why it is fine                                                                                                                         |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `caniuse-lite` | CC BY 4.0 | Browser-support data used by the bundler. Commercial use allowed with attribution: data from caniuse.com.                              |
| `lightningcss` | MPL-2.0   | CSS compiler used by the bundler. Commercial use allowed; the share-alike part only covers changes to its own files, and we make none. |

`node-forge` is offered under "BSD-3-Clause OR GPL-2.0"; we use it under BSD-3-Clause.

### Runtime packages added on purpose

| Package                                     | Licence    | Why                                                                                                 |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `zustand`                                   | MIT        | App state stores                                                                                    |
| `@react-native-async-storage/async-storage` | MIT        | On-device record storage                                                                            |
| `expo-file-system`                          | MIT        | On-device image files (store builds)                                                                |
| `expo-location`                             | MIT        | Device position (browser Geolocation on web)                                                        |
| `@mediapipe/tasks-vision` 1.2.3 (exact)     | Apache-2.0 | Pose Landmarker runtime for the body photo (TRY_ON §11); loaded lazily, never in the initial bundle |

Dev-only (not shipped): `@testing-library/react-native` (MIT), `fake-indexeddb` (Apache-2.0),
`@playwright/test` (Apache-2.0), `serve` (MIT).

## Things the automatic check cannot see

### Models (fetched at build time, never committed)

| Model                                                                                                                                                                                                                                                                                                       | Source                                                                                                                                                   | Licence                                                                                                                                         | Checked    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| U-2-Netp ONNX, 4.6 MB (pinned: commit `7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8`, SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`)                                                                                                                                               | `huggingface.co/BritishWerewolf/U-2-Netp`                                                                                                                | Apache-2.0 — card: "licensed under the Apache License 2.0 to match the original U-2-Net model"; original repo `xuebinqin/U-2-Net` is Apache-2.0 | 2026-11-18 |
| MediaPipe Pose Landmarker (full, float16) `.task`, 9.4 MB (pinned: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`, SHA-256 `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`; never the moving `latest` alias) | Google, `storage.googleapis.com/mediapipe-models`; model card `https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf` | Apache-2.0 — the BlazePose GHUM 3D model card says "LICENSED UNDER Apache License, Version 2.0"                                                 | 2026-11-18 |
| BiRefNet_lite fp16 ONNX, 114.5 MB (optional)                                                                                                                                                                                                                                                                | `huggingface.co/onnx-community/BiRefNet_lite-ONNX`, weights from `ZhengPeng7/BiRefNet_lite`                                                              | MIT on both                                                                                                                                     | 2026-11-18 |

**Attribution (Apache-2.0 NOTICE).** U-2-Netp is derived from U^2-Net, Copyright Xuebin Qin et al.,
https://github.com/xuebinqin/U-2-Net, licensed under the Apache License 2.0
(https://www.apache.org/licenses/LICENSE-2.0). The ONNX export is by `rembg` /
`BritishWerewolf`. The files are changed only by format conversion. `scripts/fetch-models.js` ships a
`NOTICE.txt` next to the model in the web build; the app's About screen must repeat this credit.

**Pose Landmarker (Apache-2.0 NOTICE).** The Pose Landmarker model is based on BlazePose GHUM 3D,
Copyright Google LLC, licensed under the Apache License, Version 2.0
(https://www.apache.org/licenses/LICENSE-2.0); `@mediapipe/tasks-vision` is Copyright The MediaPipe
Authors, Apache-2.0 (https://github.com/google-ai-edge/mediapipe). The files are unchanged.
`scripts/fetch-models.js` ships a `NOTICE.txt` next to the model (`public/models/`) and next to the
runtime (`public/mediapipe/`) in the web build; the app's About screen must repeat this credit. The
runtime script, `vision_wasm_internal.js` and `.wasm` are copied from `node_modules` by the same
script. The model card is the publisher's statement; training-data provenance is on the pre-sale
checklist like the cutout models.

**Test fixture** `e2e/fixtures/silhouette-500x1000.png`: our own `body-a` silhouette artwork
(`src/ui/mannequin/bodyA.ts`) rendered by `e2e/fixtures/make-silhouette-photo.mjs`. It is not a
photograph; no third-party photo of a person is committed (none could be fetched and verified as
CC0 / public domain from this build environment).

**onnxruntime-web 1.31.1** (MIT, Microsoft Corporation; runtime dependency, exact version). Its
`ort.wasm.min.js`, `ort-wasm-simd-threaded.mjs` and `.wasm` are copied into the web build by
`scripts/fetch-models.js`.

A model card's licence is the publisher's own statement. It does not tell us what the model was
trained on. That question is on the pre-sale checklist.

Rejected, with reasons: `@imgly/background-removal` (AGPL-3.0), BRIA RMBG 1.4 / 2.0 / 3.0
(non-commercial), `onnx-community/ISNet-ONNX` (AGPL-3.0).

### Platform APIs (store builds)

| API                                | Status                                                                                                                | Checked                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Apple Vision subject lifting       | Part of iOS 17+; covered by the Apple Developer Program agreement                                                     | 2026-11-18                       |
| Google ML Kit Subject Segmentation | Beta API, model delivered through Google Play services; governed by the ML Kit terms and Google APIs Terms of Service | 2026-11-18 (full terms not read) |

### Online services

| Service             | Use                          | Terms                                                                                                       | Status                                                      |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Open-Meteo free API | Weather forecast             | "You may only use the free API services for non-commercial purposes." Data CC BY 4.0, attribution required. | **OK for the proof of concept only**                        |
| GitHub Pages        | Hosting the proof of concept | Not intended for running a commercial service                                                               | **Proof of concept only**; moving to Cloudflare before sale |

### Assets

| Asset                                          | Source                                                                                                        | Licence | Status |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- | ------ |
| App icon, splash, favicon, web icons           | Original hanger artwork drawn in this repo (`assets/brand/*.svg`, PNGs rendered by `scripts/render-icons.js`) | Ours    | OK     |
| Tab icons (Ionicons, via `@expo/vector-icons`) | Ionic                                                                                                         | MIT     | OK     |
| Fonts                                          | System fonts only                                                                                             | —       | OK     |

## Pre-sale checklist

- [ ] Move weather to Open-Meteo's paid plan (commercial licence) or another provider whose terms
      have been read by the owner; keep the attribution.
- [ ] Move hosting off GitHub Pages.
- [x] Replace placeholder icon and splash artwork with original artwork (M2-7).
- [ ] Lawyer review of this file, including the training-data question for the cutout models and
      the Google ML Kit / Google APIs terms.
- [ ] Generate the third-party notices screen from the installed packages (most permissive
      licences require their notice to be included with the app).
- [ ] Confirm the app name "Fashionable" is free to use (trademark and store-name search).
- [ ] Re-run `npm run licenses` on the exact release build.
