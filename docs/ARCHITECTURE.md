# Architecture

## Stack

| Concern                   | Choice                                                                              | Why                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| App framework             | **Expo (React Native) + TypeScript**, Expo Router                                   | One codebase → iOS, Android and web. The web build is the proof of concept; the same code later ships to both stores via EAS Build. |
| Proof-of-concept delivery | Expo **static web export** opened in the phone's browser / added to the home screen | No app-store accounts or Mac needed, and agents can run and test it in the cloud with Playwright.                                   |
| Domain logic              | Pure TypeScript in `src/core`                                                       | Outfit rules, colour maths and placement are testable without a device.                                                             |
| State                     | Zustand stores in `src/state`                                                       | Small, no boilerplate, works on web and native.                                                                                     |
| Persistence (P1)          | Local only: JSON documents via AsyncStorage, images via an `ImageStore` adapter     | A closet is hundreds of records, not millions. Simple beats clever.                                                                 |
| Persistence (P2)          | Supabase (Postgres + Auth + Storage) behind the same repository interface           | Sign-in and sync for friends and family; row-level security per user.                                                               |
| Unit tests                | Jest (`jest-expo` preset)                                                           |                                                                                                                                     |
| End-to-end tests          | Playwright against the static web export at a phone viewport                        |                                                                                                                                     |
| Native builds (P3)        | EAS Build with development builds; no `ios/` or `android/` folders in git           | Continuous native generation keeps the repo small.                                                                                  |

## Layers and import rules

```
app/              routes only: compose features, no logic
src/features/     screens and feature-specific components and hooks
src/ui/           shared presentational components + theme
src/state/        Zustand stores: hold domain data, call services, expose actions
src/services/     platform adapters behind interfaces (storage, images, cutouts, weather…)
src/core/         pure domain logic and types
```

Dependencies point **downwards only**:

- `src/core` imports nothing outside `src/core`. No `react`, `react-native`, `expo*`. No
  `Date.now()`, `Math.random()`, network or storage — time, randomness and data are passed in.
  ESLint enforces the import half of this.
- `src/services` may import `core`. Never imports `state`, `features`, `ui`.
- `src/state` may import `core` and `services`.
- `src/ui` may import `core` (types) only. No stores, no services.
- `src/features` may import everything below it.
- `app/` imports `features` and `ui`.

Platform differences live **only** in `src/services`, using Expo's platform file extensions
(`thing.web.ts` / `thing.native.ts`) behind one shared interface file (`thing.ts`).

## Data model

Canonical definitions: `src/core/model/types.ts`. Summary:

```ts
type ID = string; // UUID v4, generated on the client
type ISODate = string; // 'YYYY-MM-DD'
type ISODateTime = string; // UTC, ISO 8601

interface Entity {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;
}

type Category =
  | 'top'
  | 'bottom'
  | 'onepiece'
  | 'outerwear'
  | 'shoes'
  | 'legwear'
  | 'belt'
  | 'bag'
  | 'headwear'
  | 'neckwear'
  | 'jewelry'
  | 'eyewear'
  | 'watch';

interface ColorSwatch {
  hex: string;
  share: number;
  name: ColorName;
} // share 0–1

interface Item extends Entity {
  name?: string;
  category: Category;
  subcategory: string; // from the per-category list in core/model/taxonomy.ts
  layer?: 'base' | 'mid'; // tops only
  colors: ColorSwatch[]; // 1–3, largest share first
  pattern: 'solid' | 'stripe' | 'check' | 'floral' | 'dot' | 'graphic' | 'animal' | 'other';
  patternBold: boolean;
  formality: 1 | 2 | 3 | 4 | 5; // lounge … formal
  warmth: 1 | 2 | 3 | 4 | 5; // summer-light … deep winter
  material?: Material; // cotton, denim, wool, leather, suede, silk, linen, knit, synthetic, other
  rainOk: boolean;
  sporty: boolean;
  metal?: 'gold' | 'silver' | 'rose' | 'mixed';
  status: 'active' | 'laundry' | 'archived';
  favorite: boolean;
  brand?: string;
  notes?: string;
  pricePaid?: number;
  purchasedOn?: ISODate;
  images: { originalId: ID; cutoutId: ID; thumbId: ID };
  cutout: {
    aspectRatio: number; // width / height of the trimmed cutout
    hasAlpha: boolean;
    crop?: { x: number; y: number; width: number; height: number; scale: number };
    // crop: rectangle of the ORIGINAL photo the cutout covers (original px) and the factor from
    // original px to cutout px. Optional; older items have none (touch-up then colour-matches).
  };
  fitAdjust?: FitAdjust; // { dx, dy, scale, rotation } in mannequin units
}

interface Outfit extends Entity {
  itemIds: ID[];
  name?: string;
  occasion?: Occasion;
  source: 'generated' | 'manual';
  favorite: boolean;
  tucked?: boolean;
  fitOverrides?: Record<ID, FitAdjust>;
}

interface WearLog extends Entity {
  date: ISODate;
  itemIds: ID[];
  outfitId?: ID;
  planned: boolean;
  weather?: Weather;
  note?: string;
}
interface Feedback extends Entity {
  itemIds: ID[];
  verdict: 'like' | 'dislike';
} // itemIds sorted

interface Profile extends Entity {
  displayName?: string;
  bodyTemplateId: string;
  location?: { lat: number; lon: number; label: string };
  units: 'metric' | 'imperial';
  bodyPhoto?: { imageId: ID; landmarks: BodyLandmarks }; // phase 3
}
```

Rules that keep sync possible later:

- IDs are client-generated UUIDs. Never use array positions or auto-increment numbers.
- Every write sets `updatedAt`. Deletes are **soft** (`deletedAt`); queries filter them out.
- Records reference images by ID, never by file path or URL.
- Stored data carries a `schemaVersion`; `src/services/storage/migrations.ts` upgrades old data on
  load. Never change the meaning of an existing field without a migration.

## Service interfaces (`src/services`)

```ts
interface Repository<T extends Entity> {
  list(): Promise<T[]>; // excludes soft-deleted
  get(id: ID): Promise<T | undefined>;
  put(entity: T): Promise<void>; // insert or replace; caller sets updatedAt
  remove(id: ID): Promise<void>; // soft delete
}

interface ImageStore {
  save(source: { uri: string } | Blob, opts?: { id?: ID }): Promise<ID>;
  uri(id: ID): Promise<string>; // displayable URI (object URL on web, file URI on native)
  remove(id: ID): Promise<void>;
}

interface BackgroundRemover {
  readonly available: boolean;
  remove(imageUri: string): Promise<{ uri: string; hasAlpha: boolean }>;
}

interface PixelReader {
  // used for colour extraction and alpha trimming
  read(
    imageUri: string,
    maxSize: number,
  ): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }>;
}

interface WeatherProvider {
  forecast(lat: number, lon: number, date: ISODate): Promise<Weather | undefined>;
}

interface Clock {
  now(): Date;
}
interface IdGenerator {
  uuid(): ID;
}
```

Stores receive services through a single `services` object created in `src/services/index.ts`, so
tests can pass in-memory fakes (`src/services/testing/`).

### Storage, phase 1

- **Records:** one AsyncStorage key per collection (`fashionable/v1/items`, `/outfits`, `/wearLogs`,
  `/feedback`, `/profile`), each a JSON array. Loaded once at start-up into the Zustand stores;
  writes are debounced (250 ms) and write the whole collection.
- **Images:** web → IndexedDB blobs; native → files under the app's document directory. Three
  images per item: original (max 1600 px), cutout (max 1024 px), thumbnail (256 px).
- **Export / import:** one JSON file holding every record (soft-deleted ones included) and every
  image as base64, from the Profile tab. Import can merge (newer `updatedAt` wins) or replace, and
  rejects the whole file on any invalid record. Roughly 1 MB per item, so a very large closet will
  need a streaming or zip format before import runs out of memory on a phone.

### Storage, phase 2 (accounts and sync)

Supabase implementations of `Repository` and `ImageStore`, with the local stores kept as an offline
cache. Sync is last-write-wins per record on `updatedAt`; soft deletes propagate as tombstones.
Row-level security: every table has `user_id = auth.uid()`. Images go to a private bucket under
`{user_id}/{image_id}`. The owner must create the Supabase project; no keys are committed.

## Image pipeline

See TRY_ON.md §7 for the steps. Implementation notes:

- Resize and crop with `expo-image-manipulator` (works on web and native).
- **Colour extraction** is pure core code (`src/core/color/palette.ts`): k-means (k = 4, seeded) over
  RGBA pixels with alpha > 128, merge clusters closer than ΔE 12, drop clusters with share < 0.08,
  return up to 3 swatches with names from `classify.ts`. The `PixelReader` adapter supplies pixels
  from a 64 × 64 downscale: on web via a canvas, on native by decoding a small PNG in JavaScript.
- **Alpha trim** uses the same `PixelReader` at higher resolution to find the bounding box.

### Background removal — decision

Requirement: on-device, no cloud service, and both code and model weights licensed for a
closed-source commercial app. Sources and quotes are in docs/LICENSES.md.

| Platform                        | Choice                                                                                                                           | Notes                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Web (proof of concept), default | **U-2-Netp** ONNX weights (`BritishWerewolf/U-2-Netp`, `onnx/model.onnx`, 4.6 MB, Apache-2.0) run with **onnxruntime-web** (MIT) | Small enough for iPhone Safari's memory limits. Quality is adequate for a garment on a plain background.       |
| Web, optional "high quality"    | **BiRefNet_lite** fp16 ONNX (`onnx-community/BiRefNet_lite-ONNX`, 114.5 MB, MIT)                                                 | Only as an opt-in download, and only after it has been proven on a real iPhone. Not yet tested there.          |
| iOS store build                 | Apple Vision subject lifting (`VNGenerateForegroundInstanceMaskRequest`, **iOS 17+**) via a small Expo native module             | Part of the OS; nothing to license.                                                                            |
| Android store build             | Google ML Kit Subject Segmentation (`play-services-mlkit-subject-segmentation`, min API 24)                                      | **Still a beta API** with no stability guarantee. Keep the U-2-Netp path available on Android as the fallback. |
| Any                             | No removal: keep the photo as a rounded rectangle, `hasAlpha: false`                                                             | Always available.                                                                                              |

Hosting (web): the model is never committed and phones never contact Hugging Face.
`scripts/fetch-models.js` (run by `npm run build:web` / `npm run web`) downloads the model at a
pinned commit, verifies its SHA-256, caches it in `.cache/models/` and copies it to
`public/models/`; it also copies the three onnxruntime-web browser files to `public/ort/`. Expo
puts `public/` into the export, so everything is served from our own site under the base path
(`EXPO_BASE_URL`, e.g. `/Fashionable`). Both folders are gitignored. At run time `cutout.web.ts`
loads `ort.wasm.min.js` with a script tag (nothing from onnxruntime is in the app bundle),
downloads the WASM and model on the first cut-out only, and keeps them in the Cache API.
GitHub Pages sends no COOP/COEP headers, so there is no SharedArrayBuffer: the runtime is
single-threaded (`numThreads = 1`). Inference runs in a dedicated Web Worker, the hand-written
static file `public/workers/cutout-worker.js` (it `importScripts` the ORT build from `/ort/`), so the
UI keeps animating (longest frame gap on desktop: 2.0 s on the main thread, about 50 ms with the
worker). The page downloads and caches the bytes and runs all image maths from `src/core/image`
(one source of truth, no bundler for the worker); only the 1x3x320x320 tensors cross over as
transferred buffers. The protocol in `inferenceWorker.ts` has request ids, stage events,
timeouts and an idle shutdown (3 min) that frees the model; without `Worker`, or if it fails, the
same steps run on the main thread. The model runs at 320 x 320 and the mask is scaled up to the photo. The WASM is 14.8 MB (about 20 MB with the model).

Not allowed:

- `@imgly/background-removal` — AGPL-3.0.
- Any BRIA RMBG model (1.4, 2.0, 3.0) — non-commercial licence.
- `onnx-community/ISNet-ONNX` — AGPL-3.0.
- `Xenova/modnet` — licence is fine, but it only handles portraits of people.

Native options need an Expo **development build**; none work in Expo Go.

## Weather

`WeatherProvider` implementation for the proof of concept: Open-Meteo's free forecast API (no
key). Its terms say "You may only use the free API services for non-commercial purposes", and count
apps with subscriptions or adverts as commercial. Data is CC BY 4.0, so the weather card shows
"Weather data by Open-Meteo.com" with a link.

**Before the app is sold**, switch the provider's base URL and key to Open-Meteo's paid plan
(`customer-api.open-meteo.com`, same request format, includes a commercial licence) or to another
provider whose terms the owner has read. This is a config change, not a rewrite, because the app
only talks to `WeatherProvider`. `npm run licenses` cannot detect this; it is on the pre-sale
checklist in docs/LICENSES.md.

Implementation: endpoints live only in `src/services/weather/config.ts`; mapping is pure code in
`src/core/weather`. `feelsLikeC` = `0.7 * apparent_temperature_max + 0.3 * apparent_temperature_min`
(daytime-weighted); `isSunny` = WMO weather code 0-2; `precipProbability` = Open-Meteo percent / 100.
The provider never rejects: offline, timeout (8 s) or an error status gives `undefined` and the
engine runs without weather. Cache (key-value store, key `weather:<lat>,<lon>` at 2 decimals):
14 days per fetch; today is stale after 3 hours, other days when the local date changes; a stale
entry is still used when a refresh fails.

Cache one forecast per location per day. If location permission is refused, the user types a city
(geocoded by the provider) or the engine runs without weather.

## Testing strategy

| Level      | Tool                                | What                                                                      | Where                       |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| Unit       | Jest                                | Everything in `src/core`; aim for near-complete coverage of rule tables   | `*.test.ts` beside the code |
| Store      | Jest + in-memory fakes              | Store actions against fake services                                       | `src/state/*.test.ts`       |
| Component  | Jest + React Native Testing Library | Non-trivial components (forms, mannequin placement mapping)               | `*.test.tsx`                |
| End-to-end | Playwright, phone viewport          | One happy path per feature against the static web build, with screenshots | `e2e/*.spec.ts`             |

End-to-end tests seed data through the UI or through a debug-only `window.__seed()` hook that is
compiled out of production builds.

## Decisions log

| #   | Decision                                    | Alternatives considered              | Reason                                                                                                                             |
| --- | ------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Expo with web-first proof of concept        | PWA + Capacitor; native Swift/Kotlin | Store target for both platforms from one codebase; native camera and on-device vision APIs later; web build testable by agents now |
| 2   | Rule-based engine, no LLM                   | Claude API for tagging and styling   | Owner's requirement. Engine and tagging sit behind interfaces so this can change                                                   |
| 3   | AsyncStorage JSON + image store, not SQLite | expo-sqlite                          | Tiny data volumes; avoids web SQLite caveats; repository interface hides the choice                                                |
| 4   | 2D paper-doll try-on with anchors           | Generative try-on; 3D avatar         | Achievable on-device without AI; upgrades cleanly to the user's photo using pose landmarks                                         |
| 5   | Reasons as codes, text in UI                | Engine returns sentences             | Keeps core pure and translatable                                                                                                   |
| 6   | Supabase for phase 2                        | Firebase; custom backend             | Postgres + auth + storage with row-level security, generous free tier, good Expo support                                           |
