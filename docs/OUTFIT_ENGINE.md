# Outfit Engine Specification

The engine is deterministic, rule-based TypeScript living in `src/core/engine/`. It has no I/O: it
takes a closet, a context and a seed, and returns ranked outfits with reasons. Same inputs → same
outputs, always. That property is what makes it testable; do not break it (no `Math.random()`, no
`Date.now()` inside `src/core`).

All numeric constants below are **defaults**. They live in one file, `src/core/engine/weights.ts`,
so tuning never requires touching logic.

## 1. Public API

```ts
generateOutfits(input: {
  items: Item[];            // the whole closet
  wearLogs: WearLog[];      // for freshness
  feedback: Feedback[];     // for taste
  context: {
    date: ISODate;
    occasion: Occasion;     // 'any' | 'casual' | 'work' | 'smart' | 'formal' | 'active' | 'lounge'
    weather?: Weather;      // omitted → weather component is skipped
    pinnedItemIds?: ID[];   // must appear in every result
    excludeItemIds?: ID[];
  };
  count: number;            // how many outfits to return (default 5)
  seed: number;
}): OutfitSuggestion[];

scoreOutfit(items: Item[], context, history): ScoreBreakdown;   // used by Mix screen's live meter

interface OutfitSuggestion {
  itemIds: ID[];
  score: number;                 // 0–100
  breakdown: ScoreBreakdown;     // per-component 0–1 values + weights used
  reasons: Reason[];             // { code: ReasonCode; params: Record<string,string|number> }
}
```

Reasons are **codes with parameters**, never English sentences. The UI layer owns the wording
(`src/features/outfits/reasonText.ts`), which keeps the core translatable.

## 2. Slots

`slotOf(item)` maps an item to exactly one slot:

| Slot       | Items                                                           | Max per outfit |
| ---------- | --------------------------------------------------------------- | -------------- |
| `base`     | tops with `layer: 'base'` (tee, shirt, blouse, tank, polo)      | 1              |
| `mid`      | tops with `layer: 'mid'` (sweater, cardigan, hoodie, waistcoat) | 1              |
| `bottom`   | trousers, jeans, shorts, skirts                                 | 1              |
| `onepiece` | dresses, jumpsuits, dungarees                                   | 1              |
| `outer`    | coats, jackets, blazers                                         | 1              |
| `shoes`    | all footwear                                                    | 1              |
| `legs`     | socks, tights                                                   | 1              |
| `belt`     | belts                                                           | 1              |
| `bag`      | bags                                                            | 1              |
| `head`     | hats, caps, beanies                                             | 1              |
| `neck`     | scarves, ties                                                   | 1              |
| `eyes`     | glasses, sunglasses                                             | 1              |
| `wrist`    | watches                                                         | 1              |
| `jewelry`  | necklaces, earrings, bracelets, rings                           | 3              |

## 3. Pipeline

```
closet ─► eligibility filter ─► core combos ─► score ─► keep best K ─► dress up ─► re-score ─► diversify ─► results
```

1. **Eligibility filter (hard rules, per item).** Drop items that are not `status: 'active'`,
   are excluded, fall outside the occasion's formality range (§5), are `sporty` outside the
   occasions `active`, `lounge` and `any` (§5), or break a weather hard rule (§6). Pinned items are never dropped; if a pinned item breaks a hard rule, keep it and emit a
   `PINNED_OVERRIDE` reason.
2. **Core combos.** Two templates:
   - `separates`: `base` × `bottom` × `shoes`
   - `onepiece`: `onepiece` × `shoes`

   If the cartesian product exceeds `MAX_CORE_COMBOS` (5,000), sample that many uniformly with the
   seeded RNG instead of enumerating. Pinned items constrain their slot to a single choice.

3. **Score** each core combo (§4) and keep the best `BEAM_WIDTH` (200).
4. **Dress up.** For each kept combo, consider optional slots in this order: `outer`, `mid`, `belt`,
   `neck`, `head`, `bag`, `wrist`, `eyes`, `legs`, `jewelry`. A slot is:
   - **required** when weather demands it (§6) — pick the best-scoring eligible item; if none
     exists, keep the combo but emit `MISSING_LAYER`;
   - **optional** otherwise — add the best-scoring item only if it raises the outfit score by at
     least `ADD_ON_MIN_GAIN` (1.0 point). A `mid` is never added as an optional piece when
     `feelsLikeC ≥ 20`.
   - **accessory cap:** an outfit holds at most `MAX_ACCESSORY_SLOTS` (3) of the optional accessory
     slots `neck`, `head`, `eyes`, `bag`, `wrist`, `jewelry`; jewelry counts as one slot however many
     pieces. Pinned accessories count towards the cap. Belts and weather-required slots do not. Belts are only considered when the bottom's subcategory is
     belt-compatible (trousers, jeans, chinos, shorts, belt-looped skirts).
5. **Re-score** complete outfits.
6. **Diversify** with maximal marginal relevance: repeatedly pick the candidate maximising
   `λ·score − (1−λ)·100·maxJaccard(candidate, alreadyPicked)` with `λ = 0.7`, until `count` are
   chosen. Ties break by seeded RNG.

If the closet cannot fill a template (e.g. no shoes), return an empty list plus a
`ClosetTooSmall` diagnostic naming the missing slots, so the UI can say "add some shoes".

### Performance limits

All constants are in `weights.ts`. They only bite on large closets; a closet with at most about a
thousand core combos follows the pipeline above exactly.

- **Pre-score:** above `CORE_PRESCORE_THRESHOLD` (1000) core combos, a cheap score (formality,
  weather, pattern, occasion, coordination; no colour, no history) keeps the best
  `CORE_PRESCORE_KEEP` (300), and only those get the full score before the beam.
- **Candidate window:** dress-up tries at most `DRESS_UP_CANDIDATES_PER_SLOT` (8) candidates per slot;
  larger pools are sampled by a window that rotates with the combo's beam rank.
- **Budget:** dress-up stops after `DRESS_UP_EVAL_BUDGET` (1000) outfit evaluations, but always
  dresses at least `DRESS_UP_MIN_COMBOS` (8) combos.
- Wear logs are pruned once per run to worn logs inside the 14-day freshness window (plus one older
  log so "has history" still holds); the score is unchanged.

### Decisions

1. A pin that is also excluded is ignored: exclusion wins.
2. A pinned item is kept whatever its status and placed even in a slot the occasion or weather
   would skip; `PINNED_OVERRIDE` is emitted when it breaks an occasion or weather hard rule.
3. Pins that cannot coexist (two in one single-capacity slot, more than 3 jewelry, a onepiece with a
   base or bottom) yield no outfits and no `missingSlots`.
4. "Mid or outer" requirement: outer is tried first as an ordinary add-on; mid becomes required only
   if the group is still unmet and no later slot in it has candidates. In the cold band a required
   outer needs warmth ≥ 4; if none exists the combo is kept and scoring emits `MISSING_LAYER`.
5. Belts are considered only with a separate bottom whose `beltCompatible` is true; a onepiece never
   gets a belt.
6. `missingSlots` names the template with fewer missing slots (separates win ties).
7. Seeded ties: the seed shuffles each slot pool once, so every stable-sort tie and "first best"
   choice depends on it; it also drives sampling above `MAX_CORE_COMBOS`.
8. The taste model is built once per run over the whole closet and shared by all scoring calls.

## 4. Scoring

Outfit score = 100 × weighted mean of components, each in [0, 1]. A component that does not apply
(no weather supplied, no history yet) is left out and the remaining weights are renormalised.

| Component      | Weight | What it measures                                  |
| -------------- | ------ | ------------------------------------------------- |
| `colour`       | 0.30   | Colour harmony across the visible pieces (§4.1)   |
| `formality`    | 0.20   | Pieces sit at a similar dress level (§4.2)        |
| `weather`      | 0.15   | Warmth and rain suitability for the forecast (§6) |
| `pattern`      | 0.10   | Pattern mixing is under control (§4.3)            |
| `occasion`     | 0.10   | Closeness to the occasion's ideal formality (§5)  |
| `coordination` | 0.05   | Leathers and metals agree (§4.4)                  |
| `freshness`    | 0.05   | Not a recent repeat (§4.5)                        |
| `taste`        | 0.05   | Learned from thumbs up / down (§7)                |

### 4.1 Colour harmony

Each item contributes its **primary colour** (largest `share`), plus its secondary colour if that
share ≥ 0.25. Jewellery, watches and eyewear are ignored for colour.

Classify each colour (in `src/core/color/classify.ts`):

- **neutral**: black, white, grey (saturation < 0.12), navy, beige / tan / khaki / cream, brown,
  olive. Items with `material: 'denim'` count as neutral whatever their hue.
- **accent**: everything else, described by hue (0–360°), saturation and lightness.

Group accents into **hue families**: two accents belong to one family if their hue distance ≤ 30°.

| Situation                                                            | Score |
| -------------------------------------------------------------------- | ----- |
| Only neutrals                                                        | 0.80  |
| Neutrals + one accent family                                         | 0.92  |
| One accent family, no neutrals (monochrome), lightness spread ≥ 0.15 | 0.90  |
| One accent family, no neutrals, flat lightness                       | 0.70  |
| Two families, hue distance 150–180° (complementary)                  | 0.82  |
| Two families, hue distance 105–135° (triadic-ish)                    | 0.68  |
| Two families, hue distance 31–60° (near-analogous)                   | 0.75  |
| Two families, anything else                                          | 0.45  |
| Three or more families                                               | 0.20  |

Adjustments, then clamp to [0, 1]:

- **+0.05** if the lightest and darkest large pieces (`base`/`bottom`/`onepiece`/`outer`) differ in
  lightness by ≥ 0.35 (contrast reads as intentional).
- **−0.15** if two accents differ in saturation by ≥ 0.5 (neon next to pastel).
- **−0.10** if top and bottom are the same neutral at nearly the same lightness (< 0.08 apart) and
  it is not black-on-black or a matching set — near-misses look like a mistake.
- **+0.05** if shoes, belt or bag repeat an accent family found in a main piece (colour echo).

**Tuning note:** hue distances 61–104° and 136–149° fall through to 0.45. This means, for example,
a warm red with a bluish green scores as a clash rather than complementary. Revisit once real
closets are in the app.

Emit one reason: `COLOR_NEUTRAL_BASE`, `COLOR_ACCENT_POP`, `COLOR_MONOCHROME`,
`COLOR_COMPLEMENTARY`, `COLOR_ANALOGOUS`, `COLOR_TRIADIC`, `COLOR_CLASH`, with colour names as
params.

### 4.2 Formality cohesion

Formality is 1 (lounge) to 5 (formal). Take the items in `base`, `mid`, `bottom`, `onepiece`,
`outer`, `shoes`; let `spread = max − min`.

| Spread | Score |
| ------ | ----- |
| 0      | 1.00  |
| 1      | 0.90  |
| 2      | 0.55  |
| 3      | 0.20  |
| 4      | 0.00  |

One deliberate high-low pairing is fashionable: if spread is 2 and exactly one item is the outlier
(e.g. blazer with tee and jeans, sneakers with a suit), use 0.75 and emit `FORMALITY_HIGH_LOW`.

### 4.3 Pattern balance

Count patterned pieces among `base`, `mid`, `bottom`, `onepiece`, `outer`, `neck`.

| Patterned pieces                                      | Score |
| ----------------------------------------------------- | ----- |
| 0                                                     | 0.85  |
| 1                                                     | 1.00  |
| 2, different pattern types, at most one `patternBold` | 0.70  |
| 2, same type or both bold                             | 0.35  |
| 3+                                                    | 0.10  |

### 4.4 Coordination

Average of the checks that apply (if none apply, the component is skipped):

- **Leathers:** belt and shoes both leather/suede → 1.0 if their colours are the same neutral
  family (black with black, brown with brown/tan), else 0.3.
- **Metals:** all items with a `metal` value share it → 1.0; mixed → 0.5.
- **Bag:** bag colour matches shoes or belt family, or is a neutral → 1.0; else 0.6.

### 4.5 Freshness

Let `d` = days since this exact item set was last worn, and `r` = share of the outfit's main pieces
worn in the last 3 days.

`freshness = clamp(min(d, 14) / 14, 0, 1) × (1 − 0.5·r)`; never worn → 1.0.

## 5. Occasions

| Occasion | Allowed formality | Ideal | Notes                                                              |
| -------- | ----------------- | ----- | ------------------------------------------------------------------ |
| `any`    | 1–5               | —     | occasion component skipped                                         |
| `lounge` | 1–2               | 1     |                                                                    |
| `casual` | 1–3               | 2     |                                                                    |
| `active` | 1–2               | 1     | only items flagged `sporty`; skip `belt`, `jewelry`, `neck`        |
| `work`   | 3–4               | 3.5   |                                                                    |
| `smart`  | 3–4               | 3.5   | date night / dinner; pattern score of 1 patterned piece gets +0.05 |
| `formal` | 4–5               | 4.5   |                                                                    |

Sporty items (`sporty: true`) are only eligible for `active`, `lounge` and `any`; for every other
occasion they are excluded unless pinned (then `PINNED_OVERRIDE`).

Occasion score = `1 − |mean formality of main pieces − ideal| / 2`, clamped to [0, 1].

## 6. Weather

`Weather = { tempMinC, tempMaxC, feelsLikeC, precipProbability (0–1), windKph, isSunny }`.

Warmth is 1 (sheer / summer) to 5 (heavy winter). Bands use `feelsLikeC`:

| Feels like | Layers                                                            | Hard rules                 | Target mean warmth |
| ---------- | ----------------------------------------------------------------- | -------------------------- | ------------------ |
| ≥ 27°C     | no `mid`, no `outer`                                              | exclude warmth ≥ 4         | 1.5                |
| 20–26°C    | `outer` optional (warmth ≤ 2)                                     | exclude warmth ≥ 4         | 2                  |
| 13–19°C    | `mid` or `outer` required                                         | exclude warmth 1 bottoms   | 3                  |
| 5–12°C     | `outer` required, `mid` optional                                  | exclude open shoes, shorts | 3.5                |
| < 5°C      | `outer` (warmth ≥ 4) and `mid` required; `neck`/`head` encouraged | as above                   | 4.5                |

Warm weather (`feelsLikeC ≥ 20`): additionally exclude `neck` and `head` items with warmth ≥ 3
(wool scarves, beanies), and never add a `mid` as an optional piece.

Rain (`precipProbability ≥ 0.5`): exclude items with `rainOk: false` from `shoes`, `outer`, `bag`.
Sun (`isSunny` and ≥ 20°C): `eyes` (sunglasses) and `head` items with warmth ≤ 2 (caps, sun hats)
gain +1 point when added.

Weather score = `1 − |mean warmth of worn layers − target| / 2`, clamped; multiply by 0.5 if a
required layer is missing, and by 0.3 if any item breaks a hard rule for the band (emit
`WEATHER_UNSUITED` per item; matters for manual outfits, since the generator filters those items).

## 7. Learning taste (no AI)

`Feedback = { itemIds, verdict: 'like' | 'dislike' }`. Build two affinity tables from all feedback:

- **Item pairs:** for each unordered pair in the outfit, +1 for like, −1 for dislike.
- **Attribute pairs:** the same, keyed by `(slot:colourFamily, slot:colourFamily)` so that taste
  generalises to items the user has never rated together.

`taste = sigmoid(0.6 · meanItemPairAffinity + 0.4 · meanAttrPairAffinity)`. With no feedback the
component is skipped. An outfit explicitly disliked (exact same item set) is never suggested again.

## 8. Gap analysis (`src/core/gaps/`)

```ts
findGaps(items, opts): GapSuggestion[]   // { archetype, unlockedCount, exampleOutfit }
findOrphans(items, opts): OrphanReport[] // { itemId, goodOutfitCount, wouldHelp: Archetype[] }
```

- `archetypes.ts` holds ~40 staple pieces as attribute-only virtual items (white tee, dark jeans,
  white sneakers, brown leather belt, navy blazer, black ankle boots, beige trench…).
- An archetype is **covered** if the closet has an active item with the same subcategory and
  colour family: both neutral (denim counts as neutral) with the same colour name, or both accents
  with hues within 30°. Covered archetypes are skipped.
- **Core archetypes** (base, bottom, one-piece, shoes): count core combos (base × bottom × shoes,
  one-piece × shoes) scoring ≥ `GOOD_OUTFIT_THRESHOLD` (80, roughly the better 60% of the fixture
  closet's combos; 85 was tried and wrongly called classic all-neutral outfits such as navy tee +
  dark jeans + brown loafers, ≈84 without weather or occasion, not good) with and without it (occasion `any`, no weather, core pieces only, sampled with
  a seed above the caps). The difference is `unlockedCount` (equal to the good combos containing
  the archetype). Top 5, ties broken by mean score of those combos, then `archetypeId`.
- **Add-on archetypes** (outer, mid, belt, bag, accessories): `improvedCount` = good core combos
  where adding the archetype raises the score by ≥ `ADD_ON_MIN_GAIN` (belts only with
  belt-compatible bottoms). Top 3, same tie-breaks. Each suggestion carries one example outfit.
- **Orphans:** active main-slot items in fewer than 3 good combos; `wouldHelp` lists up to 3 core
  archetypes that lift the item's count most.
- **Duplicates:** active items with the same subcategory, primary colour name and pattern whose
  primary colours differ by ΔE < 10.

**Performance note.** Gap analysis scores core combos with `gaps/fastScore.ts`, a fast mirror of
`scoreOutfit` for occasion `any`, no weather and no history (colour, formality, pattern,
coordination only), with per-item data prepared once. A property test asserts it equals
`scoreOutfit` to 1e-9; any change to those four components must be made in both places.

## 9. Testing requirements

- A fixture closet of ~30 realistic items in `src/core/testing/fixtures.ts`, shared by all tests.
- Unit tests per scoring component, each table row above covered by at least one case.
- Property tests: results never contain two items in one single-capacity slot; pinned items always
  present; excluded items never present; same seed → identical output; different seeds → not all
  identical.
- Golden test: fixture closet + fixed context + seed → snapshot of the top 5 item-ID lists. A
  golden change must be explained in the PR description.
- Performance: 300-item closet generates 5 outfits in under 150 ms on the CI runner.
