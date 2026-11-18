# Fashionable

Photograph your clothes, build a digital closet, and get fun, wearable outfits from what you already
own — previewed on a body silhouette.

**Status:** proof of concept, live at https://dustinf1sch3r-dotcom.github.io/Fashionable/ (open it
on a phone and use Add to Home Screen). Closet with automatic background removal and touch-up,
outfit ideas by occasion and weather, mix-and-match on a silhouette with fit adjustment, saved
outfits, wear calendar, closet insights, and backup. Everything runs on the device; data stays in
that browser until accounts and sync (M8) exist, so export a backup now and then.

## Documents

| File                                           | What it covers                                   |
| ---------------------------------------------- | ------------------------------------------------ |
| [docs/PRODUCT.md](docs/PRODUCT.md)             | What the app is, features by phase, idea backlog |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Stack, layers, data model, storage, decisions    |
| [docs/OUTFIT_ENGINE.md](docs/OUTFIT_ENGINE.md) | The rules that build and score outfits           |
| [docs/TRY_ON.md](docs/TRY_ON.md)               | How garments are drawn on the silhouette         |
| [docs/ROADMAP.md](docs/ROADMAP.md)             | Milestones and agent-sized tickets               |
| [docs/LICENSES.md](docs/LICENSES.md)           | Licence register and pre-sale checklist          |
| [CLAUDE.md](CLAUDE.md)                         | Rules and commands for coding agents             |

## Run it

```bash
npm install
npm run web          # dev server in the browser
npm run check        # typecheck + lint + unit tests
npm run licenses     # fail if any dependency is not cleared for a sold app
npm run build:web    # static site in dist/
npm run e2e          # phone-viewport browser tests against dist/
```

## Open decisions (owner)

1. **Real-device pass** (roadmap F3): try it on an iPhone and an Android phone and report what feels
   slow or wrong.
2. **Supabase project** for sign-in and sync between devices and friends (milestone M8).
3. **Apple Developer and Google Play accounts** for store builds (milestone M9).
4. **Before selling:** the pre-sale checklist in docs/LICENSES.md (paid weather plan, hosting move
   to Cloudflare, legal review, app-name check).
