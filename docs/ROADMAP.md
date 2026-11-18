# Roadmap and Tickets

Each ticket is sized for **one agent session**. Tickets in the same milestone marked ∥ can run in
parallel (they touch different folders). Read CLAUDE.md first, then the spec the ticket points to.

Status key: ☐ todo · ◐ in progress · ☑ done. Update the box in the same commit as the work.

Every ticket's definition of done includes the checklist in CLAUDE.md ("Definition of done").

---

## M0 — Groundwork ☑

- ☑ Expo + TypeScript skeleton, five placeholder tabs, lint/test/e2e pipeline, CI workflow.
- ☑ Product brief, architecture, engine spec, try-on spec, this roadmap.
- ☑ Canonical domain types in `src/core/model/types.ts`.

## Research ☑

- ☑ **R1 Cutout model and native API facts.** Settled; see ARCHITECTURE.md "Background removal —
  decision" and docs/LICENSES.md. Still open: prove the models on a real iPhone (part of M3-2), and
  read the MediaPipe pose model card before M9-3.
- ☑ **R2 Weather terms.** Open-Meteo free tier is non-commercial; paid plan or another provider
  needed before sale. See docs/LICENSES.md pre-sale checklist.

---

## M1 — Core domain (pure TypeScript, no UI)

All in `src/core`. Verify with `npm run check`.

- ☑ **M1-1 Taxonomy, factories, validation.** `model/taxonomy.ts` (subcategories per category with
  default `layer`, `formality`, `warmth`, `rainOk`, belt-compatibility; display labels stay in UI),
  `model/slots.ts` (`slotOf`, slot capacities per OUTFIT_ENGINE §2), `model/validate.ts` (runtime
  guards for every entity; used when loading stored data), `model/factories.ts` (`newItem`,
  `newOutfit`… taking `Clock` and `IdGenerator`). Tests for each.
- ☑ **M1-2 Colour.** ∥ `color/classify.ts` (hex → `ColorName`, neutral vs accent, hue families),
  `color/palette.ts` (seeded k-means palette extraction from RGBA per ARCHITECTURE §Image pipeline),
  `color/harmony.ts` (OUTFIT_ENGINE §4.1, returns score + reason). Test every table row; test
  palette extraction on synthetic pixel arrays (two-colour stripes, solid, noisy).
- ☑ **M1-3 Fixture closet.** ∥ `testing/fixtures.ts`: ~30 realistic items covering every slot,
  several colour families, all formality and warmth levels; deterministic `Clock`, `IdGenerator`
  and seeded RNG (`testing/rng.ts`, mulberry32). Depends on M1-1.
- ☑ **M1-4 Scoring components.** `engine/weights.ts`, `engine/score/*.ts` for formality, pattern,
  coordination, freshness, occasion, weather (OUTFIT_ENGINE §4–6), and `engine/scoreOutfit.ts`
  combining them with renormalised weights. Depends on M1-1, M1-2, M1-3.
- ☑ **M1-5 Generator.** `engine/generate.ts`: eligibility, core combos with sampling, beam,
  dress-up, MMR diversity, diagnostics (OUTFIT_ENGINE §3). Property tests, golden test, performance
  test (§9). Depends on M1-4.
- ☑ **M1-6 Taste learning.** ∥ `engine/taste.ts`: affinity tables and taste score (§7); never
  re-suggest an exact disliked set. Depends on M1-4.
- ☑ **M1-7 Try-on maths.** ∥ `tryon/bodies.ts` (landmarks for `body-a`), `tryon/anchors.ts`,
  `tryon/place.ts` (TRY_ON §3–5) with snapshot test of the anchor table. Depends on M1-1.

## M2 — Closet (first thing usable on a phone)

- ☑ **M2-1 Storage services.** `services/storage/` AsyncStorage `Repository` with schema version and
  migrations; `services/images/` `ImageStore` for web (IndexedDB) and native (file system);
  in-memory fakes in `services/testing/`; `services/index.ts` wiring. Tests against fakes and, for
  web, an e2e that reloads the page and finds the data still there.
- ☑ **M2-2 Stores.** `state/closetStore.ts`, `outfitStore.ts`, `wearStore.ts`, `profileStore.ts`:
  hydrate on start, debounced persist, actions (add, update, soft-delete, set status). Store tests
  with fakes. Depends on M2-1, M1-1.
- ☑ **M2-3 UI kit.** ∥ `src/ui`: Button, Chip, ChipGroup, Card, TextField, SegmentedControl, Sheet,
  EmptyState, ColorDot, Rating5 (for formality/warmth). Theme tokens only, no hard-coded colours;
  44 pt minimum touch targets; a `/dev/ui` route listing every component for screenshot review.
- ☑ **M2-4 Add item flow.** Camera or library pick (`expo-image-picker`) → preview → colour
  auto-detected (`PixelReader` + `palette.ts`) → tag form prefilled from taxonomy defaults → save.
  Background removal is stubbed with the no-op fallback here. Target: under 30 seconds per item.
  E2E: add an item from a fixture image, see it in the grid. Depends on M2-2, M2-3, M1-2.
- ☑ **M2-5 Closet grid and item detail.** Category tabs, colour filter, search, sort; item detail
  with edit, favourite, laundry/archive, delete with undo. Empty state that invites the first
  photo. Depends on M2-2, M2-3.
- ☑ **M2-6 Backup.** Export closet (JSON + images) to one backup file and import it back; Profile tab entry.
  Depends on M2-2.
- ☑ **M2-7 Deploy the web build.** (live on GitHub Pages; original icon, `app/+html.tsx` + `public/manifest.webmanifest`, no service worker; real-phone install untested) Publish `dist/` on every push to `main` to a static host chosen
  by the owner, with web-app manifest and icons so "Add to Home Screen" gives a full-screen app.
  **Needs the owner to pick and set up the host** (see README "Open decisions").

## M3 — Cutouts

- ◐ **M3-1 Pixel utilities.** (web done; native PNG decode and native cutouts later) `PixelReader` adapters (web canvas; native PNG decode), alpha
  bounding-box trim, cutout + thumbnail generation per TRY_ON §7. Depends on M2-1.
- ◐ **M3-2 Web background removal.** (implemented; still to prove on a real iPhone, worker, offline check) `BackgroundRemover` for web using the model chosen in R1,
  lazy-loaded on first use with progress UI, cached for offline use, running off the main thread.
  Falls back cleanly when unsupported. Wire into the add-item flow; "re-cut" action for existing
  items. Use the models named in ARCHITECTURE.md; test on a real iPhone before calling it done.
- ☑ **M3-3 Touch-up brush.** Erase / restore brush on the cutout for when automatic removal misses.
- ☑ **M3-4 Capture guides.** Per-category ghost outlines and tips on the capture screen (TRY_ON §8).

## M4 — Mannequin and Mix

- ☑ **M4-1 Silhouette asset.** `body-a` SVG drawn to the landmark table from M1-7, plus a debug
  overlay toggle that draws landmarks and anchor boxes.
- ☑ **M4-2 Mannequin component.** `ui/Mannequin.tsx` per TRY_ON §9; component test that placements
  map to the right styles; `/dev/mannequin` route rendering the fixture closet.
- ☑ **M4-3 Fit editor.** Select, drag, scale, rotate; save to item or outfit; reset (TRY_ON §6).
- ☑ **M4-4 Mix screen.** One swipeable row per slot under/over the mannequin, lock and shuffle per
  slot, live harmony meter from `scoreOutfit`, save outfit. Depends on M4-2, M1-4.

## M5 — Outfit generator

- ☑ **M5-1 Weather service.** `WeatherProvider` (Open-Meteo), location permission with typed-city
  fallback, daily cache, attribution on the weather card.
- ☑ **M5-2 Outfits screen.** Occasion chips, weather card, "Surprise me", result cards with
  mannequin preview, score and plain-language reasons (`features/outfits/reasonText.ts`), pin an
  item, regenerate, like / dislike, save. Clear guidance when the closet is too small.
- ☑ **M5-3 Saved outfits.** List, rename, favourite, open in Mix, delete.

## M6 — Calendar and wear history

- ☑ **M6-1 Wear logging.** "Wore this today" from any outfit; quick log of loose items.
- ☑ **M6-2 Calendar screen.** Month grid with outfit thumbnails, day detail, plan an outfit for a
  future date.
- ☑ **M6-3 Stats.** Most / least worn, untouched for 90 days, colour and category breakdown, cost
  per wear when prices exist.

## M7 — Gaps and insights

- ☐ **M7-1 Core.** `gaps/archetypes.ts`, `findGaps`, `findOrphans`, duplicate detection
  (OUTFIT_ENGINE §8) with tests on the fixture closet.
- ☑ **M7-2 Insights screen.** "Pieces that would unlock the most outfits" with example outfits on
  the mannequin (archetypes drawn as simple flat shapes), orphans, duplicates.

## M8 — Accounts and sync (friends and family)

**Needs the owner to create a Supabase project and supply its URL and anon key as environment
config.**

- ☐ **M8-1 Schema and policies.** SQL migrations, row-level security, storage bucket policies,
  checked into `supabase/`.
- ☐ **M8-2 Auth.** Email magic-link sign-in, sign-out, account deletion.
- ☐ **M8-3 Sync engine.** Supabase `Repository` and `ImageStore`, local cache, last-write-wins,
  tombstones, first-sign-in upload of an existing local closet.
- ☐ **M8-4 Share outfit as image.**

## M9 — Store release

- ☐ **M9-1 Native builds.** EAS project, development builds for iOS and Android, native camera
  flow. Needs the owner's Apple Developer and Google Play accounts.
- ☐ **M9-2 Native background removal.** Expo module wrapping Apple Vision and ML Kit (per R1).
- ☐ **M9-3 Your-photo try-on.** Body photo upload, on-device pose landmarks, landmark correction UI,
  mannequin over the photo (TRY_ON §10).
- ☐ **M9-4 Store readiness.** Icons, splash, privacy policy, data-safety forms, pricing model,
  commercial weather plan (R2), accessibility pass, crash reporting.

---

## Follow-ups found during review

- ☑ **F1 Record the cutout crop.** Store the crop rectangle and scale on `Item.cutout` when a cutout
  is made (optional field, no migration), so touch-up can line the cutout up with the original
  directly. Today it recovers the placement by colour matching (`core/image/align.ts`), which can
  fail on low-contrast photos and briefly blocks the main thread. Keep alignment as the fallback
  for older items.
- ☑ **F2 Capture-guide shoe outline.** The shoe-pair guide reads as two blobs; draw a clearer pair.
- ☐ **F3 Real-device pass.** On an iPhone and an Android phone: background-removal speed and memory,
  touch gestures in Mix and touch-up, Add to Home Screen, safe-area insets, real Open-Meteo data.

## T — Try-on on your own photo (TRY_ON §11)

- ☑ **T1 Pose core and detector.** `src/core/tryon/pose.ts` (keypoints → landmarks, quality checks,
  crop window, canvas transform) with thorough tests; `src/services/pose/` web detector with
  MediaPipe Pose Landmarker served from our site; photo crop-to-canvas in `src/services/pixels`.
- ☑ **T2 Setup, correction and display.** Profile entry and setup flow (guide → photo → detect →
  correct → save; retake; delete), `Mannequin` backdrop, `useBody` with the Me / Silhouette toggle on
  every full-size mannequin, backups include the photo.

## G — Garments that fit the body (TRY_ON §12)

- ☑ **G1 Fit core.** `src/core/fit/` rigs, automatic detection from the alpha mask, body targets
  (with elbows added to body landmarks and pose mapping), MLS mesh deformation; thorough tests on
  procedurally drawn garment masks.
- ☑ **G2 Fit rendering and UI.** Web mesh renderer with caching, Mannequin draws fitted garments,
  rigs computed when cutouts are made (lazily for existing items), "Garment points" editor on item
  detail, screenshots on the silhouette and on a photo.

## Suggested order and parallelism

```
M1-1 ─┬─ M1-2 ∥ M1-3 ∥ M1-7 ─ M1-4 ─┬─ M1-5
      │                             └─ M1-6
      └─ M2-1 ─ M2-2 ─┬─ M2-4 ─ M2-5 ─ M2-6 ─ M2-7   ← first phone-testable build
        M2-3 (∥ from the start)
R1 (any time) ─ M3 ─ M4 ─ M5 ─ M6 ─ M7 ─ M8 ─ M9
```

M1 (core) and M2 (closet UI) do not touch the same folders and can run side by side.
