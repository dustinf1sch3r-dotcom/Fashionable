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

## Things the automatic check cannot see

### Models (downloaded at run time, never committed)

| Model                                        | Source                                                                                      | Licence                                                                                                                                         | Checked    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| U-2-Netp ONNX, 4.6 MB                        | `huggingface.co/BritishWerewolf/U-2-Netp`                                                   | Apache-2.0 — card: "licensed under the Apache License 2.0 to match the original U-2-Net model"; original repo `xuebinqin/U-2-Net` is Apache-2.0 | 2026-11-18 |
| BiRefNet_lite fp16 ONNX, 114.5 MB (optional) | `huggingface.co/onnx-community/BiRefNet_lite-ONNX`, weights from `ZhengPeng7/BiRefNet_lite` | MIT on both                                                                                                                                     | 2026-11-18 |

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

| Asset                                          | Source                          | Licence | Status                                                      |
| ---------------------------------------------- | ------------------------------- | ------- | ----------------------------------------------------------- |
| App icon, splash, favicon in `assets/images/`  | Expo's default project template | MIT     | **Placeholders — replace with our own artwork before sale** |
| Tab icons (Ionicons, via `@expo/vector-icons`) | Ionic                           | MIT     | OK                                                          |
| Fonts                                          | System fonts only               | —       | OK                                                          |

## Pre-sale checklist

- [ ] Move weather to Open-Meteo's paid plan (commercial licence) or another provider whose terms
      have been read by the owner; keep the attribution.
- [ ] Move hosting off GitHub Pages.
- [ ] Replace placeholder icon and splash artwork with original artwork.
- [ ] Lawyer review of this file, including the training-data question for the cutout models and
      the Google ML Kit / Google APIs terms.
- [ ] Generate the third-party notices screen from the installed packages (most permissive
      licences require their notice to be included with the app).
- [ ] Confirm the app name "Fashionable" is free to use (trademark and store-name search).
- [ ] Re-run `npm run licenses` on the exact release build.
