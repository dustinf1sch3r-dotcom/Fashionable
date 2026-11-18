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

| Slot                  | Centre X        | Top Y             | Width                         | Z   |
| --------------------- | --------------- | ----------------- | ----------------------------- | --- |
| `legs` (socks/tights) | body centre     | `knee.y`          | `H × 1.0`                     | 10  |
| `shoes`               | body centre     | `ankle.y − 30`    | `(footR.x − footL.x) + 120`   | 35  |
| `bottom`              | body centre     | `waist.y − 20`    | `H × 1.25`                    | 30  |
| `base`                | body centre     | `neckBase.y − 10` | `S × 1.55` (includes sleeves) | 40  |
| `onepiece`            | body centre     | `neckBase.y − 10` | `S × 1.55`                    | 40  |
| `belt`                | body centre     | `waist.y − 15`    | `W × 1.15`                    | 45  |
| `mid`                 | body centre     | `neckBase.y − 20` | `S × 1.65`                    | 50  |
| `outer`               | body centre     | `neckBase.y − 30` | `S × 1.80`                    | 60  |
| `neck` (scarf/tie)    | body centre     | `chin.y`          | `S × 0.6`                     | 70  |
| `jewelry`             | body centre     | `neckBase.y`      | `S × 0.35`                    | 72  |
| `wrist`               | `wristL.x`      | `wristL.y − 30`   | 70                            | 75  |
| `bag`                 | `wristR.x + 60` | `wristR.y − 60`   | 260                           | 80  |
| `head`                | `headTop.x`     | `headTop.y − 60`  | head width × 1.3              | 90  |
| `eyes`                | `eyeLine.x`     | `eyeLine.y − 25`  | head width × 0.9              | 92  |

These are starting values; expect to tune them against real photos. Keep them in one table
(`src/core/tryon/anchors.ts`) with a snapshot test so changes are deliberate.

**Tucked tops:** an outfit may set `tucked: true`, which draws `base` at Z 25 (under `bottom`).
Default: untucked.

**Shoes** are photographed as a pair, side by side, toes forward or in three-quarter view; the pair
is drawn as a single image centred between the feet.

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
photo ─► downscale (max 1600 px) ─► background removal ─► trim to alpha bounding box
      ─► cutout PNG (max 1024 px long side) + thumbnail (256 px) ─► colour extraction ─► save
```

- Background removal sits behind the `BackgroundRemover` interface (see ARCHITECTURE.md). If it
  fails or is unavailable, fall back to the original photo with rounded corners and mark the item
  `cutout.hasAlpha: false`; the mannequin still draws it, just as a rectangle. A manual
  "touch up" eraser/restore brush is a later ticket.
- Trim: find the bounding box of pixels with alpha > 16, add 2% padding, crop.
- Colour extraction reads only pixels with alpha > 128 (see ARCHITECTURE.md §Colour extraction).

## 8. Capture guidance

The add-item screen shows, per category, a faint outline (tee shape, trouser shape, shoe pair…) and
three tips: plain contrasting background, lay flat or hang, shoot straight-on from above. After
background removal, show the cutout on the mannequin immediately so the user can fix the fit while
the garment is still in front of them.

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
feet, plain background, fitted clothes, phone at waist height about 2–3 m away (use a timer or ask
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
Below `FIT_MIN_CONFIDENCE` the item still uses the rig but the item detail screen offers "Check
garment points". Detection also runs lazily for existing items the first time they are drawn.

### 12.3 Body targets (`src/core/fit/targets.ts`, pure)

Fitting takes a `FitBody`: the body landmarks plus optional `elbowL` / `elbowR` (BlazePose 14 / 13,
swapped like the others). They are kept out of `BodyLandmarks` so every core landmark stays
required; photo elbows are stored as `Profile.bodyPhoto.elbows`, and `BODY_A` gets explicit values.
Without them, the elbow is the shoulder–wrist midpoint.

Garment lengths keep the garment's own proportions relative to its width, so a cropped tee stays
cropped and a maxi skirt stays long. Key rules (constants in one `FIT_RULES` table):

- **top:** neck points → either side of `neckBase`; shoulders → shoulder landmarks pushed out by
  an ease of 6% of shoulder width (mid +10%, outer +16%); armpits → on the torso sides, 22% of the
  shoulder-to-hip distance below the shoulders; sleeves → along the arm polyline
  shoulder → elbow → wrist, sleeve length in body units = garment sleeve length ÷ garment shoulder
  width × body shoulder width; hem → straight down, hem depth likewise from the garment's
  shoulder-to-hem / shoulder-width ratio.
- **trousers:** waist → waist landmarks with ease; hips → hip landmarks with ease; crotch → hip
  midpoint, 12% of hip-to-knee below; each leg follows hip → knee → ankle, length from the garment's
  outseam / waist-width ratio; hems straddle the leg line with the garment's hem width ratio.
- **skirt / dress below the waist:** waist and hips as trousers; hem width and length from the
  garment's own ratios, centred on the body.

### 12.4 Warping (`src/core/fit/mls.ts`, pure)

Moving Least Squares image deformation (similarity variant; Schaefer, McPhail & Warren, 2006)
with the rig points as handles, evaluated on a grid mesh over the cutout (default 24 × 48 cells,
plus extra handles along garment edges to stop bulging). Output: a mesh of source/target vertices
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
