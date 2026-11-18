# Fashionable — Product Brief

## One-liner

Photograph the clothes you own; Fashionable turns them into a digital closet, suggests fun,
wearable outfits from it, and shows each outfit on a body silhouette (later: on your own photo).

## Who it is for

- **Now (proof of concept):** the owner plus a handful of friends and family, on their own phones.
- **Later:** a paid app on the Apple App Store and Google Play.

## Product principles

1. **Program-based.** Outfit logic, colour detection and garment cutouts run as ordinary code on the
   device. No LLM or cloud-AI calls. (The engine sits behind an interface, so this can be revisited.)
2. **Your closet, not a shop.** Everything starts from clothes the user already owns.
3. **Thirty seconds per item.** Adding a garment must be quick: snap, confirm the auto-detected
   colour, tap a few chips, done. Anything slower and nobody finishes their closet.
4. **Explain every suggestion.** Each outfit says why it works ("navy and tan are a classic pair",
   "warm enough for 6°C"). Rules the user can see are rules the user can trust.
5. **Private by default.** Photos stay on the device until the user signs in and opts into sync.
6. **Works for every wardrobe.** No gendered modes; categories cover dresses, suits, and everything
   between. Body silhouettes are chosen by shape, not by label.

## The core loop

```
Capture  →  Closet  →  Outfit  →  Wear
 photo      browse     generate    log it
 cutout     filter     or mix      (feeds back into
 tag        edit       preview      suggestions)
```

## Features

Phase tags: **P1** proof of concept (web, opened on the phone) · **P2** friends and family
(accounts, sync) · **P3** store release.

### Closet

- P1 Add an item from camera or photo library.
- P1 Automatic background removal → transparent garment cutout.
- P1 Automatic colour detection (dominant + secondary colours, named).
- P1 Quick tagging with chips: category, sub-type, pattern, formality, warmth, material.
- P1 Categories: tops, bottoms, one-pieces (dresses, jumpsuits), outerwear, shoes, belts, bags,
  headwear, scarves, jewellery, eyewear, watches, legwear (socks, tights).
- P1 Closet grid with category tabs, colour filter, search; item detail and edit.
- P1 Item status: active / in the laundry / archived.
- P2 Batch add (several photos in one go, tag afterwards).
- P3 Optional price and purchase date → cost per wear.

### Outfit preview ("try-on")

- P1 Grey body silhouette with garment cutouts layered in the right places and order.
- P1 Per-item nudge / resize, remembered for every future outfit.
- P1 Choice of a few silhouette body shapes.
- P3 Your own standing photo as the backdrop, garments positioned from detected body landmarks.
- Later: garment warping for a more realistic drape.

### Outfit generator

- P1 "Surprise me" plus occasion picks: casual, work, smart / date, formal, active, lounge.
- P1 Weather-aware: today's forecast changes layers, warmth and rain-safe shoes.
- P1 Pin an item ("build around this skirt") and regenerate.
- P1 Each suggestion shows a score breakdown in plain words.
- P1 Thumbs up / down teaches the engine the user's taste (simple counts, on-device).
- P1 Save outfits to favourites.

### Manual mix and match

- P1 Swipe through each slot (top, bottom, shoes, layers, accessories) on the silhouette.
- P1 Live "how well does this go together" meter using the same scoring as the generator.
- P1 Shuffle one slot at a time; lock slots you like.

### Calendar and wear history

- P1 "Wore this today" on any outfit; calendar view of past outfits.
- P1 Plan ahead: assign an outfit to a future date (uses that day's forecast when available).
- P1 Suggestions avoid recent repeats.
- P2 Stats: most and least worn, items untouched for 90 days, colour breakdown.

### Shopping gaps and closet insights

- P2 "A brown belt would unlock 12 more outfits": test staple pieces against the closet and rank
  them by how many good new outfits each would create.
- P2 Orphans: items that go with almost nothing, and what would rescue them.
- P2 Duplicates: "you own five near-identical black tees".

### Accounts and sharing

- P2 Sign in; closet syncs across the user's devices.
- P2 Share an outfit as an image.
- Later: ask a friend to vote between two outfits; shared closets for households.

## Not doing (for now)

- Selling, affiliate links or a marketplace.
- Social feed or following.
- Generative-AI try-on imagery.
- Body measurements or size recommendations.

## Idea backlog (unscheduled)

- Packing lists: "5 days, 3 dinners, hand luggage" → smallest set of items covering every day.
- Capsule builder: pick N items that maximise outfit count.
- Laundry mode: mark everything worn this week as in the wash with one tap.
- Outfit of the day home-screen widget / morning notification.
- Colour-season profile (which colours suit the user) feeding the scoring.
- "Style dial": classic ↔ adventurous slider that changes how bold the suggestions are.
- Seasonal rotation: prompt to archive summer pieces in autumn.
- Barcode / receipt import for brand and price.
- Import from retailer order emails (later, and only with explicit consent).
- Travel and event presets ("wedding guest", "interview", "festival").
- Dress-code safety checks ("no white at a wedding").

## Glossary

| Term      | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| Item      | One physical garment or accessory in the closet                            |
| Cutout    | The item's photo with the background removed, cropped tight                |
| Slot      | A position an item occupies in an outfit (base top, bottom, shoes, outer…) |
| Outfit    | A set of items, at most one per slot (accessory slots may hold more)       |
| Mannequin | The silhouette canvas that outfits are drawn on                            |
| Wear log  | A record that an outfit (or loose items) was worn on a date                |
| Archetype | A generic staple ("white sneakers") used by gap analysis                   |
