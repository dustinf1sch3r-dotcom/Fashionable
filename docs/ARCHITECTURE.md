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
  cutout: { aspectRatio: number; hasAlpha: boolean }; // width / height of the trimmed cutout
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
- **Export / import:** a zip of the JSON plus images, as the phase-1 backup and
  device-to-device path. Needed because browser storage can be evicted.

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

### Background removal — decision and open questions

Requirement: on-device, no cloud service, and both code and model weights licensed for a
closed-source commercial app.

| Platform               | Plan                                                                                                                                         | Status                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Web (proof of concept) | ONNX model run in the browser through Transformers.js or ONNX Runtime Web (both permissively licensed), using a U²-Net-family or ISNet model | **Model-weight licence, download size and iOS Safari behaviour not yet confirmed** — ticket R1 must settle this before M3 code is written |
| iOS (store build)      | Apple Vision subject lifting through a small Expo native module                                                                              | Reported as iOS 17+ by wrapper libraries; confirm against Apple's docs (R1)                                                               |
| Android (store build)  | Google ML Kit Subject Segmentation through the same module                                                                                   | Was a beta release in the wrapper libraries we found; confirm current status (R1)                                                         |
| Any, as fallback       | No removal: keep the photo as a rounded rectangle, `hasAlpha: false`                                                                         | Always available                                                                                                                          |

Ruled out:

- `@imgly/background-removal` — AGPL-3.0; cannot be used in a closed-source app without buying a
  licence from IMG.LY.
- BRIA RMBG models — treat as non-commercial until someone reads the model card and proves
  otherwise.

Native options need an Expo **development build**; none work in Expo Go.

## Weather

`WeatherProvider` implementation for phase 1: Open-Meteo forecast API (no key). Its README states
the free API is for non-commercial use, asks for an attribution link wherever data is shown, and
asks commercial users to get in touch. So: fine for the proof of concept with attribution on the
weather card; **a commercial plan or another provider is required before store release**. Cache one
forecast per location per day. If location permission is refused, the user types a city (geocoded
by the provider) or the engine runs without weather.

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
