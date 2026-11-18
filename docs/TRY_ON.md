# Try-On Specification (Mannequin)

How outfits are drawn on a body. Phase 1 is a layered "paper doll": transparent garment cutouts
placed on a grey silhouette. No AI and no 3D — placement comes from fixed body landmarks plus a
per-item adjustment the user makes once.

## 1. Why this works without AI

Two things make a paper doll look right:

1. **Consistent cutouts.** Every garment is photographed flat or on a hanger, straight-on, and
   cropped tight to its outline. The capture screen shows a ghost outline per category so the user
   lines the garment up the same way every time.
2. **Anchors, not free placement.** Each slot has a fixed anchor on the body (a shirt hangs from the
   shoulder line; trousers hang from the waist). The cutout is scaled to the anchor's width and
   pinned at its top edge. Height follows from the cutout's own aspect ratio, so a cropped tee and a
   long tunic both come out right.

## 2. Coordinate system

The mannequin canvas is **1000 × 2000 units** (width × height), origin top-left, y downwards.
Everything is stored in these units and scaled to the screen at render time.

## 3. Body templates

`src/core/tryon/bodies.ts` exports body templates. Each has an id, an SVG silhouette asset (drawn in
the 1000 × 2000 box, single flat grey `#C9CCD1`, relaxed A-pose with arms slightly away from the
body so sleeves have room), and a landmark table:

```ts
interface BodyTemplate {
  id: 'body-a' | 'body-b' | 'body-c' | 'body-d';
  landmarks: {
    headTop: Point;
    chin: Point;
    neckBase: Point;
    shoulderL: Point;
    shoulderR: Point;
    waistL: Point;
    waistR: Point;
    hipL: Point;
    hipR: Point;
    kneeL: Point;
    kneeR: Point;
    ankleL: Point;
    ankleR: Point;
    wristL: Point;
    wristR: Point;
    footL: Point;
    footR: Point; // centre of each foot
    eyeLine: Point; // centre between the eyes
  };
}
```

Ship four shapes (straighter / curvier × narrower / broader shoulders), labelled only by a
thumbnail. Start with `body-a`; the others are added once the pipeline works.

## 4. Slot anchors

`anchorFor(slot, body)` returns `{ centerX, topY, width }` derived from landmarks. `S` = shoulder
width (`shoulderR.x − shoulderL.x`), `H` = hip width, `W` = waist width.

| Slot                  | Centre X        | Top Y             | Width                               | Z   |
| --------------------- | --------------- | ----------------- | ----------------------------------- | --- |
| `legs` (socks/tights) | body centre     | `knee.y`          | `H × 1.0`                           | 10  |
| `shoes`               | body centre     | `ankle.y − 30`    | `min((footR.x − footL.x) + 120, H)` | 35  |
| `bottom`              | body centre     | `waist.y − 20`    | `H × 1.25`                          | 30  |
| `base`                | body centre     | `neckBase.y − 10` | `S × 1.55` (includes sleeves)       | 40  |
| `onepiece`            | body centre     | `neckBase.y − 10` | `S × 1.55`                          | 40  |
| `belt`                | body centre     | `waist.y − 15`    | `W × 1.15`                          | 45  |
| `mid`                 | body centre     | `neckBase.y − 20` | `S × 1.65`                          | 50  |
| `outer`               | body centre     | `neckBase.y − 30` | `S × 1.80`                          | 60  |
| `neck` (scarf/tie)    | body centre     | `chin.y`          | `S × 0.6`                           | 70  |
| `jewelry`             | body centre     | `neckBase.y`      | `S × 0.35`                          | 72  |
| `wrist`               | `wristL.x`      | `wristL.y − 30`   | 70                                  | 75  |
| `bag`                 | `wristR.x + 60` | `wristR.y − 60`   | 260                                 | 80  |
| `head`                | `headTop.x`     | `headTop.y − 60`  | head width × 1.3                    | 90  |
| `eyes`                | `eyeLine.x`     | `eyeLine.y − 25`  | head width × 0.9                    | 92  |

Shoes when the photo cuts the feet off: if either foot landmark lies outside the 1000 x 2000
canvas (or within 10 units of its bottom), pose detection extrapolated it and says nothing about
where the shoes belong. The width then comes from the ankle gap (`(ankleR.x − ankleL.x) + 120`)
instead of the foot gap, and `placeItem` clamps a shoe placement to the canvas (x within
0..1000 − width, y within 0..2000 − height), so shoes are always drawn, over the lower legs if
need be (`feetUsable`, `src/core/tryon/anchors.ts`).

These are starting values; expect to tune them against real photos. Keep them in one table
(`src/core/tryon/anchors.ts`) with a snapshot test so changes are deliberate.

**Tucked tops:** an outfit may set `tucked: true`, which draws `base` at Z 25 (under `bottom`).
Default: untucked.

**Shoes** are photographed as a pair, side by side, toes forward or in three-quarter view; the pair
is drawn as a single image centred between the feet. Because it is one picture, the width is
capped at the hip width `H` (`ANCHOR_RULES.shoes.maxOverHip`, BODY_A's pair is exactly that wide):
a wide stance or a stride (a real photo of someone with their legs apart) widened the pair until
each shoe was nearly twice a foot's width, with the shoes drawn closer together than the feet.
The centre and height never change. (Placing the two shoes separately at the two feet needs the
pair split in two; not done.)

## 5. Placement maths

```ts
placeItem(item, body, override?): Placement
// Placement = { x, y, width, height, rotation, z }  in mannequin units

const a = anchorFor(slotOf(item), body);
const adj = override ?? item.fitAdjust ?? { dx: 0, dy: 0, scale: 1, rotation: 0 };
width    = a.width * adj.scale;
height   = width / item.cutout.aspectRatio;      // aspectRatio = width / height of trimmed cutout
x        = a.centerX - width / 2 + adj.dx;
y        = a.topY + adj.dy;
rotation = adj.rotation;                          // degrees, about the image centre
```

`placeItem` and `anchorFor` are pure functions in `src/core/tryon/` with unit tests. The React
component only maps placements to absolutely-positioned images.

## 6. Fit adjustment

- On the mannequin, tapping a garment selects it; drag moves, pinch scales, two-finger twist
  rotates. On web (no pinch with a mouse) show − / + and rotate buttons as well.
- "Save fit" writes `fitAdjust` to the **item**, so the fix carries to every outfit. An outfit can
  also hold a per-outfit `fitOverrides[itemId]` for one-off tweaks.
- Limits: scale 0.5–2.0, dx/dy ±400 units, rotation ±30°. "Reset" clears the adjustment.

## 7. Garment image pipeline

```
photo ─► downscale (max 1600 px) ─► background removal ─► hanger removal ─► trim to alpha bounding box
      ─► cutout PNG (max 1024 px long side) + thumbnail (256 px) ─► colour extraction ─► save
```

- Background removal sits behind the `BackgroundRemover` interface (see ARCHITECTURE.md). If it
  fails or is unavailable, fall back to the original photo with rounded corners and mark the item
  `cutout.hasAlpha: false`; the mannequin still draws it, just as a rectangle. A manual
  "touch up" eraser/restore brush is a later ticket.
- **Hanger removal** (`src/core/image/hanger.ts`, pure, on the alpha mask only; run on a 256-cell
  grid, then applied to the pixels). Removed, and only above the garment's own top edge:
  1. _thin structures_ (a wire hook and the wire's arms): the mask is opened with a square 3.5% of
     the garment's width; what cannot hold the square is thin. A thin piece goes when it is at
     least 1.2 squares long, centred within 15% of the garment's width, and every cell of it lies
     above the local top edge of the opened mask. Camisole straps (not centred) and a standing
     collar band (thicker than the square) stay.
  2. _a solid hanger neck_: the topmost rows are one run narrower than 20% of the width, centred,
     at most 12% of the height tall, with the shoulders starting on both sides below it and the run
     narrower than 60% of the neckline it rises from. A hood (wider) or a funnel neck (wider than
     any hanger) stays.

  Nothing is removed when it would be more than 10% of the garment. A hanger whose body lies
  _inside_ the garment's silhouette (a plastic hanger seen through an open collar) cannot be told
  from the garment by alpha alone and stays; so does the hanger's wire where it lies against the
  garment. The same removal runs before rig detection for cutouts that were made earlier.

- Trim: find the bounding box of pixels with alpha > 16, add 2% padding, crop.
- Colour extraction reads only pixels with alpha > 128 (see ARCHITECTURE.md §Colour extraction).

## 8. Capture guidance

The add-item screen shows, per category, a faint outline (tee shape, trouser shape, shoe pair…) and
three tips: plain contrasting background, lay flat or hang, shoot straight-on from above. After
background removal, show the cutout on the mannequin immediately so the user can fix the fit while
the garment is still in front of them.

**Capture hints** (`src/core/fit/capture.ts`, shown in the add form as `add-item-capture-hint`,
never blocking). The cutout's alpha (256 px) is checked as soon as the cutout exists, and again
when the category changes or the cutout is touched up. Codes, most important first; the form shows
the first one:

| Code             | Meaning                                                                                                                                                  | Copy (UI layer: `captureHints.ts`)                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `cut-off`        | the garment's pixels reach a border of the cutout (the cutout service pads 2%, so only the photo's edge)                                                 | "The garment looks cut off — for the best fit, photograph the whole piece laid flat."           |
| `several-pieces` | more than one separate piece of at least 15% of the biggest (and 1% of the frame), or a bar above the garment much wider than its hooks (a clothes rail) | "There seem to be other clothes (or a rail) in this photo — …photograph one piece on its own."  |
| `folded`         | trousers or a jumpsuit with no gap between the legs; or a top, dress or jumpsuit with neither sleeves nor a neck dip                                     | trousers: "The legs are not showing apart — …"; others: "This looks folded or hung in half — …" |
| `unclear`        | none of the above, but detection has no rig or one below `FIT_MIN_CONFIDENCE`                                                                            | "We could not read this garment's outline well, so it will keep a simple fit. …"                |

Shoes and other unfitted items only get the `cut-off` check. Hint copy never says "fix"; the photo
is kept either way.

## 9. Rendering

- `src/ui/Mannequin.tsx`: a fixed-aspect (1:2) container; silhouette SVG at the bottom; one
  absolutely-positioned image per placement, sorted by `z`. Plain React Native views and images
  only, so it works identically on web, iOS and Android.
- Props: `body`, `items`, `overrides?`, `selectedItemId?`, `onSelectItem?`, `interactive?`.
- Must render a 12-item outfit at 60 fps while one item is being dragged.
- Export as image (for sharing) is a later ticket.

## 10. Later phases

**Phase 3 — your own photo.** Specified in §11 (tickets T1–T2 in the roadmap).

**Phase 4 — better drape.** Specified in §12 (tickets G1–G2 in the roadmap).

**Out of scope:** generative virtual try-on. It would need a cloud model, which conflicts with the
program-based principle; revisit only if the owner changes that principle.

## 11. Try-on on your own photo (phase 3)

Owner decisions: one body photo; it stays on the device and is included in backups; once added it
is the default backdrop everywhere, with a quick "Me / Silhouette" toggle.

### 11.1 Pose detection

- Model: MediaPipe **Pose Landmarker (full)**, float16 `.task` file (~9.4 MB, Apache-2.0 per the
  BlazePose GHUM 3D model card), run with `@mediapipe/tasks-vision` (Apache-2.0) in IMAGE mode,
  on-device. Model and WASM are fetched at build time by `scripts/fetch-models.js` (pinned URL +
  SHA-256) and served from our own site, like the cutout model. Loaded only when the user sets up
  or redoes their photo.
- Output: 33 BlazePose keypoints, normalised 0–1 in image space with a visibility score.
- Native (later): Apple Vision body pose / ML Kit pose behind the same `PoseDetector` interface.

### 11.2 Keypoints → body landmarks (`src/core/tryon/pose.ts`, pure)

BlazePose "left" is the **person's** left, which in a front-facing photo is the **viewer's right**.
Our `L` landmarks are the viewer's left, so BlazePose left joints map to our `R` and vice versa.

| Landmark                       | From                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| shoulderL / shoulderR          | right / left shoulder (12 / 11)                                                                   |
| hipL / hipR                    | right / left hip (24 / 23)                                                                        |
| kneeL / kneeR, ankleL / ankleR | 26 / 25, 28 / 27                                                                                  |
| wristL / wristR                | 16 / 15                                                                                           |
| footL / footR                  | midpoint of heel and foot index (30+32 / 29+31)                                                   |
| eyeLine                        | midpoint of the eyes (2, 5)                                                                       |
| neckBase                       | shoulder midpoint, raised by 12% of the shoulder-to-hip distance                                  |
| chin                           | eyeLine + 0.45 × (eyeLine-to-neckBase distance), downwards                                        |
| headTop                        | eyeLine − 0.9 × (ear-to-ear width), upwards; fall back to 0.55 × eye-to-chin if ears are hidden   |
| waistL / waistR                | on the line shoulder→hip at 62% of the way down, pulled inwards so waist width = 0.85 × hip width |

All constants live in one table so they can be tuned against real photos.

**Quality checks** return problems the UI explains: `no-person`, `head-missing`, `feet-missing`
(visibility < 0.5 for ankles/feet), `not-facing-camera` (shoulder width < 0.35 × shoulder-to-hip
height), `arms-too-close` (wrists within 0.15 × shoulder width of the hips), `too-small` (person
less than 50% of image height), `landmarks-out-of-order` (vertical order head → feet broken).
`no-person` and `landmarks-out-of-order` block saving; the rest are warnings.

Decisions made while implementing (constants in `POSE_RULES`, `src/core/tryon/pose.ts`):

- `no-person` also covers a torso that is not seen: any shoulder or hip below 0.5 visibility, a
  keypoint array shorter than 33, or non-finite values. No landmarks are returned then; for every
  other problem they are, so the user can still correct by hand.
- `arms-too-close` is measured sideways: a wrist below the shoulder line and less than 0.15 ×
  shoulder width (horizontally) from its own hip. Raised hands never trigger it.
- `not-facing-camera` uses the signed shoulder span, so a person facing away (left and right
  reversed) is caught too. `head-missing` also fires when the computed head top is above the image;
  `feet-missing` also when the lowest foot is below it, or one foot has neither heel nor toe seen.
- Vertical order for `landmarks-out-of-order`: headTop, eyeLine, chin, neckBase, shoulders, waist,
  hips, knees, ankles strictly increasing in y, and the feet no higher than the ankles.
  `checkLandmarks` runs this, `not-facing-camera` and `arms-too-close`; the image-only checks
  (visibility, framing, size) are in `fromBlazePose`.
- The crop window is exactly 1:2 from the vertical margins (§11.3); it is not widened for a very
  wide pose (arms far out), which would change the margins the spec fixes.

### 11.3 Normalising the photo

`bodyCropWindow` picks a 1:2 window around the person: from 6% of body height above `headTop` to
4% below the lower foot, centred on the hip midpoint, widened to 1:2. Parts outside the photo are
filled with the app background colour. The photo is cropped and scaled to **1000 × 2000 px** and
saved as the body image, so landmarks transformed with `toCanvas` are directly in mannequin units
and the existing anchors and placement maths work unchanged. Garment sizes follow the person's
own shoulder, waist and hip widths automatically.

### 11.4 Correction

After detection the user sees the photo with draggable landmark handles (head top, chin, shoulders,
waist, hips, knees, ankles, feet, wrists) and a live preview of a sample outfit. "Reset" returns to
the detected points. Saved: `Profile.bodyPhoto = { imageId, landmarks, detected, takenAt }`.
If detection fails entirely, the user can still place the handles by hand, starting from `BODY_A`
scaled into the photo.

### 11.5 Display

- `useBody()` returns `{ body, backdrop, mode, setMode, hasPhoto }`: with a photo and mode
  `'photo'` the body is `{ id: 'photo', landmarks }` and the backdrop is the photo; otherwise the
  silhouette body template.
- `Mannequin` accepts an optional `backdrop` (image URI) drawn instead of the silhouette, filling
  the 1:2 canvas.
- A small "Me / Silhouette" toggle appears wherever a full-size mannequin is shown (Outfits ideas,
  outfit detail, Mix, calendar day). Mode is stored as `Profile.tryOnMode`.
- Decisions (T2): one toggle per screen, not per card (the mode is global), shown only when a
  usable photo exists. A photo whose image is missing falls back to the silhouette and hides the
  toggle. While the image loads the photo's landmarks are used with no backdrop so garments do not
  jump. Insights keeps the silhouette (it draws archetype art, not the person).
- Setup lives at `/me/photo` (`?step=adjust` opens the correction screen on the saved photo),
  entered from the Profile card or a dismissible hint on Outfits. Where the detector is not
  available the flow places points by hand starting from `defaultPhotoLandmarks()`; where the
  cropper is not available the entry points say so instead of starting.
- Retake saves the new image first and deletes the old one afterwards. Delete removes the image
  and `bodyPhoto` / `tryOnMode` (`profileStore.removeBodyPhoto`).

### 11.6 Capture guide and privacy

Guide before picking: stand straight, arms slightly away from the body, whole body from head to
feet, wearing shorts and a fitted tank top (garments are drawn over the photo and the app does not
remove what the person wears, so anything looser shows around the outfits), plain background, phone
at waist height about 2–3 m away (use a timer or ask
a friend). Copy states plainly that the photo never leaves the phone except in backups the user
exports. "Delete my photo" removes the image and the profile field.

## 12. Fitting garments to the body

Owner decisions: garments follow the body's shape (not just rigid scaling); garment key points are
found automatically and the user only fixes them if needed; first for tops, bottoms, dresses and
outerwear. Shoes, bags, hats, belts and jewellery keep the §4–§5 rigid placement for now.

### 12.1 Garment rigs

Each fitted item has a rig: named key points in the cutout's own space, normalised 0–1
(origin top-left), stored as `Item.fit` (optional; no migration).

| Rig kind   | Used for                                                      | Points                                                                                                           |
| ---------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `top`      | base, mid and outer tops, jackets, coats                      | neckL, neckR, shoulderL, shoulderR, armpitL, armpitR, cuffOuterL, cuffInnerL, cuffOuterR, cuffInnerR, hemL, hemR |
| `trousers` | jeans, trousers, chinos, shorts, leggings                     | waistL, waistR, hipL, hipR, crotch, hemOuterL, hemInnerL, hemOuterR, hemInnerR                                   |
| `skirt`    | skirts                                                        | waistL, waistR, hipL, hipR, hemL, hemR                                                                           |
| `dress`    | dresses (jumpsuits use `top` + `trousers` points: `jumpsuit`) | top points + waistL, waistR, hipL, hipR, hemL, hemR (sleeve points optional for sleeveless)                      |
| `jumpsuit` | jumpsuits, dungarees                                          | top points + trousers points                                                                                     |

`L` is the viewer's left, as for body landmarks. A garment is photographed flat, front up, so its
viewer-left sleeve dresses the body's viewer-left arm.

### 12.2 Automatic detection (`src/core/fit/detect.ts`, pure)

Input: the cutout's alpha mask (width, height, alpha bytes). Per row, the opaque runs give the
outline. Heuristics per kind:

- **top:** neck = ends of the topmost opaque run's inner dip (the collar opening); shoulders = the
  outline points just outside the neck where the top edge turns downward; sleeves = rows where the
  silhouette is wider than the torso; armpit = the deepest concave corner between sleeve and torso
  on each side; cuffs = the two outline points at the far end of each sleeve; hem = the bottom-most
  row's ends.
- **trousers:** waist = top row ends; crotch = the top of the gap where the mask first splits into
  two legs; hips = outline ends at the crotch row; hems = each leg's bottom row, inner and outer.
- **skirt:** waist = top row ends; hips = outline ends at 20% of the height; hem = bottom row ends.
- **dress / jumpsuit:** top part as `top`; waist = the narrowest row between armpits and 60% of the
  height; then skirt or trouser rules below the waist.

Each detection returns a `confidence` 0–1 (outline sanity: symmetry, order, plausible ratios).
**Below `FIT_MIN_CONFIDENCE` (0.6) a detected rig is not used for fitting**: the garment keeps the
§5 rigid placement (a wrong rig warps a jacket into a long dress) and the item detail screen offers
"Check garment points". Points the user has edited (`rig.edited`) are always used, and the points
editor's preview always fits (`fitUsable`, `src/features/shared/fit/rigLifecycle.ts`). Detection
also runs lazily for existing items the first time they are drawn.

Real photos (a hanger, a tilted flat-lay, wrinkles, bent sleeves) taught these rules, all numbers
in `FIT_RULES`:

- A neck dip that is not visible (a hanger's arms or a collar fill it) multiplies confidence by
  `noNeckSleeved` 0.8 when at least one sleeve was found, but still by `noNeck` 0.45 when there
  are no sleeves either (that is how a skirt or trousers read as a "top" stay unconfident).
- The **hem** is the lowest row that is at least 90% as wide as the median row 10–35% of the height
  above the bottom (a wavy or curled hem leaves a few short rows at the very bottom).
- The **armpit** of a sleeve with no gap is the highest point of the sleeve's underside; on a flat
  underside, the column nearest the torso within 3% of the upper height of it, and the columns
  scanned always include the 3 left of the torso edge (a cuff that meets the torso).
- A **cuff jump** is the last leap of a chain of leaps at most 3 rows apart (a ragged, slanted cuff
  edge climbs in steps).
- A sleeve whose **underside is a slant** with no step (a photographed tee: the cuff runs
  diagonally into the torso) is found when no sharp leap exists: the left edge moves in
  monotonically (at least 1.2 jumps over 4 rows, on average at least 0.9 cells a row, ending at
  least 12% of the width inside the outermost point) and the torso below stays put (it drifts by at
  most 0.2 cells a row over 10% of the height). A bust or a waist curves gently and stays unfound.
- Cut off at the photo's edge is a capture hint (§8) and **not** part of confidence: the tight
  fixture cutouts touch their borders and are fine.

`RIG_VERSION` is 2: the hem, armpit, cuff-jump and neckless rules above changed what detection finds,
so unedited rigs of version 1 are detected again the first time they are drawn.

Calibration on real photos (`scripts/real-trial.mjs`): a white tee on a wire hanger scores 0.09
before and 0.71 after hanger removal and these rules (points on the shoulders, cuffs, armpits and
hem); a leather jacket photographed cut off at the chest, a jacket on a clothes rail and folded
jeans stay at or below 0.26 (jeans have no rig at all) and are fitted rigidly.

### 12.3 Body targets (`src/core/fit/targets.ts`, pure)

Fitting takes a `FitBody`: the body landmarks plus optional `elbowL` / `elbowR` (BlazePose 14 / 13,
swapped like the others). They are kept out of `BodyLandmarks` so every core landmark stays
required; photo elbows are stored as `Profile.bodyPhoto.elbows`, and `BODY_A` gets explicit values.
Without them, the elbow is the shoulder–wrist midpoint.

**Physical scaling, then clamping (G3).** Each garment gets one scale `s` = body reference width ÷
garment reference width, in garment units (x × aspect, y):

| Piece                                        | Reference width (garment → body)                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| tops and dresses with sleeves                | shoulder width → body shoulder width × (1 + slot ease)                       |
| sleeveless tops and dresses (no cuff points) | width between the armpit points → chest width = shoulder × 0.85 × (1 + ease) |
| trousers, skirts (and the skirt of a dress)  | waist width → body waist width × (1 + 4% ease)                               |

Every length is the garment's own length (from the rig, in cutout units) × `s`, measured along the
body from the piece's start point, and only then clamped to the hem bounds below (`FIT_RULES.target`):

- **sleeve:** |garment shoulder → cuff middle| × `s` along shoulder → elbow → wrist (and on along the
  forearm), clamped to 25% of the arm up to 102% of it (just past the wrist);
- **top hem:** body shoulder y + (garment shoulder-to-hem) × `s`; dress hem likewise from the shoulders;
- **skirt hem:** body waist y + (garment waist-to-hem) × `s`;
- **trousers:** body waist y + (garment waist-to-hem) × `s`, measured down to the hip and then along
  hip → knee → ankle.

The garment's own proportions therefore decide the length (a knee-length skirt of knee proportions
reaches the knee, a maxi the ankle) and the bounds only stop absurd results (a flat-lay photographed
long for its width must not leave a tee at the knee). Shorts and long trousers are still told apart by
the rig alone (outseam ÷ waist width above `shortsMaxRatio` 1.5 is long), because core does not see
the taxonomy.

| Piece                | Hem bounds (body)                                                      |
| -------------------- | ---------------------------------------------------------------------- |
| top, base and mid    | waist → hip + 15% of hip-to-knee (was 25%: tops end at the hip)        |
| outerwear            | hip → 60% of knee-to-ankle below the knee                              |
| shorts (ratio < 1.5) | hip + 30% of hip-to-knee → knee                                        |
| long trousers        | ankle ± 2% of the hip-to-ankle distance (was 3%), never below the feet |
| skirts and dresses   | hip + 35% of hip-to-knee → ankle                                       |
| sleeves              | 25% of the arm → 102% of the arm (was 104%)                            |

Cuff width (outer ↔ inner at the target) is the garment's cuff width × `s` clamped to
18–32% of the body shoulder width (outerwear 36%); the sleeve centre line stays on the arm polyline
and armpits stay on the torso sides. Neck separation keeps the garment's neck ÷ shoulder ratio,
clamped to 25–60% of the body shoulder width. On sleeveless garments the shoulder targets are the
straps at the garment's own scale (garment shoulder width × `s`, centred), not the shoulder tips.
Other rules: shoulder ease is a _total_ extra width (half on each side); trouser hips are detected
70% of the way from waist to crotch; armpit x on tops comes from the body outline at the armpit
height; armpits sit 22% of shoulder-to-hip below the shoulders; the crotch is 12% of hip-to-knee
below the hips; each leg follows hip → knee → ankle with the hem width the garment's own × `s`.

**Layering.** `nestInside(inner, outer, body)` takes `rigTargets` of two top rigs on the same body.
Inner shoulders and armpits stay 3% of the shoulder width inside the outer's; inner cuffs are at
least 4% of the shoulder width narrower than the outer cuff and, when the outer sleeve is long
(its cuff past the elbow), end 2% of the arm length short of it, on the outer sleeve's line;
sleeves already inside are untouched. Hems are not clamped. Call order: compute the outermost
layer's targets first, then `nestInside(mid, outer)`, then `nestInside(base, nestedMid)`; build
each mesh from its own nested targets.

### 12.4 Warping (`src/core/fit/mls.ts`, pure)

Moving Least Squares image deformation (similarity variant; Schaefer, McPhail & Warren, 2006)
with the rig points as handles, evaluated on a grid mesh over the cutout (default 24 × 48 cells,
plus extra handles along garment edges to stop bulging). Every cell of the grid is kept (culling
by the coarse rig outline cut real edges); transparent pixels draw nothing. Output: a mesh of source/target vertices
and triangles in mannequin units. Pure and deterministic.

### 12.5 Rendering

The web renderer (`src/services/fit/`) draws the mesh triangle by triangle on a canvas with affine
texture mapping (each triangle slightly expanded to hide seams), producing one image per garment
in mannequin space plus its bounding box. Results are cached by item, cutout image, rig version and
body. The Mannequin draws a fitted garment as that image at its box; `fitAdjust` nudges still apply
on top. Items without a usable rig, unsupported kinds, and platforms without the renderer fall back
to §5 rigid placement. Native rendering later via a mesh-capable drawing library behind the same
interface.

### 12.6 Editing

Item detail → "Garment points": the cutout with draggable rig points (same handle and loupe
component as §11.4), a live preview on the current body, and Reset to detected.

### 12.7 Decisions (G2)

- **Renderer** (`src/services/fit/warper.web.ts`): canvas 2D, per triangle clip + affine
  `drawImage` (the triangle grown by half a pixel to hide seams; only the triangle's part of the
  texture is drawn). The cutout is shrunk in halving steps first when it is much larger than the
  output, so edges do not alias. Output is 0.5, 0.75 or 1 pixel per mannequin unit, chosen from the
  mannequin's display width and the device pixel ratio (`fitDensity`). Native and Jest report
  `available: false`.
- **Cache** (`src/features/shared/fit`): key = item id + cutout image id + rig signature (kind,
  version, edited flag, points) + body signature (all landmarks and elbows) + slot + density. An
  in-memory LRU of 60 images; evicted object URLs are revoked through `GarmentWarper.release`.
  Identical requests share one render and at most two renders run at once. Nothing is persisted:
  a render of a 24 x 48 mesh is fast enough to redo on load.
- **Drawing**: while an exact image is being rendered the item shows the newest image it already
  has for another body, else the rigid picture; the first fitted image fades in over the rigid one
  (160 ms) so nothing jumps. `fitAdjust` is applied on top of the fitted bounds (scale about the
  top centre, then nudge and rotate), exactly as for rigid placement, and does not trigger a new
  render. Only tops, bottoms, one-pieces and outerwear are fitted; the Insights art stays rigid.
- **Rig lifecycle**: detected from the cutout's alpha (256 px long side) when an item is added, and
  again after a re-cut or touch-up. A new outline invalidates hand-set points, so they are replaced
  and the item screen says so. Existing items, items re-tagged to another rig kind, and items with
  an older rule-set version get a rig the first time they are drawn; it is saved back to the closet
  after a short pause. A cutout the detector cannot read is tried once per session.
- **Garment points editor** (item detail, "Garment points", highlighted as "Check garment points"
  when detection confidence is below `FIT_MIN_CONFIDENCE` and the points were never edited):
  full-screen overlay with the cutout and a draggable dot per point (44 pt touch area, magnifier
  while dragging, same look as the body landmark handles), a live preview on the current body, "Reset
  to detected" and "Save". Saving stores the rig with `edited: true`. Only shown where the renderer
  is available.

### 12.7 Detection decisions (G1)

Detection works on a cleaned grid of at most 128 cells (stray specks, pinholes removed) after the
tilt is undone (bounding-box search for tops and dresses, top-edge slope for bottoms). Three
tunable choices, all in `FIT_RULES`: sleeve cuff corners come from the pixels farthest along the
sleeve axis (`cuffSlab`); the armpit is the apex of the sleeve–torso gap, or the lowest point of the
sleeve underside when there is no gap; the crotch apex is extrapolated from how the leg gap opens
(`apexFill`, `apexBack`). Confidence is the cleanliness of the mask, reduced by left/right
asymmetry and structural failures (no collar dip, bad order or proportions). Trousers/jumpsuits
need a leg gap and skirts must not have one, otherwise `detectRig` returns undefined.

### 12.8 Decisions (G3, fit tuning)

- **Length rule** replaced the old "garment ratio picks a point inside the range" mapping (§12.3).
  It made every long-for-its-width garment a maxi. Tests: `src/core/fit/targets.test.ts` (physical
  scaling) and `src/core/fit/fixtures.test.ts` (the real PNG fixtures; decoder in
  `fixtureGarments.ts`, Node `zlib`, test-only).
- **Bounds changed** (clearly too loose once lengths are physical): base/mid hem 25% → 15% below the
  hip (a tee is a tee, not a tunic), long-trouser tolerance 3% → 2% and sleeve maximum 104% → 102%
  so results stay inside the 3% / 4% tolerances the owner reviews against.
- **Detection: sleeves that reach the bottom row.** A coat whose sleeves are longer than its body
  has no jump back to the torso below the cuff, so no sleeve was found (no cuffs, armpits on the
  sleeve edge, hem on the sleeve ends) and the coat was fitted as a sleeveless top. Now a slit
  between sleeve and torso that spans at least `openSleeveSlit` (20%) of the height and is open at
  the bottom marks a sleeve ending at the last row, and the hem is clipped to the torso's edges.
  A slit that stays narrow (under `apexMinGap` cells, or opening slower than `apexMinSlope`) is not
  extrapolated upwards: its first row is the armpit (the right armpit of the coat was 20% too high).
- `node scripts/fit-gallery.mjs <out> --debug-rigs` writes `rig-<name>.png`: each fitted garment
  with the rig points the app detected (read back from the closet) drawn and labelled.
- **Fixture proportions.** By their own proportions the olive skirt (360 px long, 138 px at the
  waist: 2.6 waist widths) is a midi and the green dress (360 px long, 75 px between the straps) a
  maxi on this body. The rigid placement (§5) hides this by scaling to the hem width. They are
  tested as such; regenerate the fixtures if a knee-length skirt is wanted in the gallery.

## 13. Compositing: garments merged into the picture

Owner decisions: outfits are drawn as one merged image, not garments pasted on top. Wanted:
lighting and shading, colour matching, soft edges and contact shadows (no extra segmentation model).
Realism first: the layered version shows instantly and the merged image replaces it when ready
(cached). Applies to both the body photo and the silhouette.

### 13.1 Pipeline (`src/core/composite/`, pure)

Input: the backdrop (body photo, or the rendered silhouette) as RGBA at output size; the garment
layers (fitted or rigid images) already positioned in output pixels, in z order; the backdrop kind.
For each layer, bottom to top:

1. **Colour matching (photo only).** Estimate the photo's illuminant cast (robust grey-world over
   the whole photo, clamped to ±15% per channel) and overall exposure; apply the cast to the garment
   and move its exposure part of the way (strength 0.5) toward the photo's. Never change a
   garment's own colour identity: a white tee stays white-ish, just lit like the photo.
2. **Shading.** Photo: shading map = low-pass luminance of the backdrop under the garment, divided
   by its mean over the garment area (so it averages 1), clamped [0.6, 1.25]; plus a small
   high-pass component for folds. Multiply the garment by the map with strength 0.7. Silhouette:
   synthetic "pillow" shading from the distance to the garment's own edge (rounded look) plus a
   gentle top-left light; strength 0.35.
3. **Sharpness and grain (photo only).** Blur the garment to the photo's estimated sharpness, then
   add grain matching the photo's noise level (seeded, deterministic).
4. **Soft edges.** Feather the garment alpha by about 1 output pixel (scaled with output density).
5. **Contact shadow.** Before drawing the layer, darken what lies beneath it by a blurred copy of
   its alpha (radius about 1.5% of the canvas width, opacity 0.25; on the silhouette 0.2).
6. Composite the layer (normal alpha "over").

All strengths and sizes live in one `COMPOSITE_RULES` table. Same inputs and seed → same pixels.

### 13.2 Rendering and caching (`src/services/composite/`)

The web compositor decodes the backdrop and layer images to RGBA (canvas), runs the core pipeline,
and encodes one image. It is cached by backdrop, body, the layers' cache keys and density. The
Mannequin shows the layered version until the merged image is ready, then fades to it. While a
garment is being edited (Mix fit editor, garment points), the layered version is shown.

### 13.3 Decisions (C2)

- **Where it runs.** `compositor.web.ts` decodes the backdrop and every layer on the main thread
  (one macrotask yield per layer), then runs `compositeOutfit` in a dedicated Web Worker
  (`pipeline.worker.ts`, bundled by Metro through `new Worker(new URL(...))`, so it works under the
  GitHub Pages base path) and encodes a JPEG (quality 0.9) object URL. Measured in headless
  Chromium: the pipeline alone blocks the main thread for about 100 ms on the silhouette and
  270–290 ms on a photo at 500 × 1000 (first merge), 50–110 ms once warm; threshold was 150 ms, so
  it moved to the worker, after which no long task came from compositing (the longest remaining
  main-thread slices are decoding and encoding, 50–110 ms). Without `Worker`, or if it fails to
  start, the same function runs on the main thread. In the real trial (phone-sized photos, machine under load) the pipeline took 220–560 ms inside the worker and a whole merge 1.2–1.6 s; the page stayed responsive meanwhile. The worker is dropped after 60 s idle.
- **Layers.** The compositor receives each garment as one image already placed in mannequin units
  (`mergeLayers` in `src/features/shared/composite/layers.ts`): warped images at their own bounds,
  rigid cutouts shrunk to their aspect inside the placement box ("contain"), `fitAdjust` and tuck
  applied, bottom to top. Rotated layers are drawn into the bounding box of the rotated rectangle.
- **Backdrop.** Photo: the body photo drawn "cover". Silhouette: the art in
  `src/core/tryon/silhouetteArt.ts` (moved from `ui/mannequin/bodyA.ts`, which re-exports it) drawn
  as SVG, on the colour of the surface the Mannequin sits on (`palette`; the JPEG has no alpha).
- **Cache** (`compositeEngine.ts`). LRU of 30 pictures keyed by backdrop (photo URL or silhouette
  id and surface colour), body signature, each layer's identity (warped image URL and placement, or
  item, cutout id and placement; this includes `fitAdjust`) and density. Identical requests share
  one render, renders run one at a time, a key that failed is not retried. Evicted pictures are
  released unless still on screen (pinned by the hook). A cached picture is returned on the first
  render, so coming back to an outfit shows it instantly.
- **When it starts.** `useComposite` waits until the inputs have not changed for 250 ms (warped
  garments arrive one after another) and until every garment has a picture. While a garment is
  selected for editing in Mix the hook is off and the Mannequin shows the layers; deselecting
  brings the merged picture back (from the cache if nothing changed).
- **Mannequin.** `merged` is drawn as one image over the layered drawing, fading in once decoded.
  The layers stay mounted underneath, so taps still reach the garments through it (it takes no
  pointer events) and nothing reloads when it goes away. Not used by Insights (stays layered).
