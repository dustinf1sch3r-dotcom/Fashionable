# Fashionable

Photograph your clothes, build a digital closet, and get fun, wearable outfits from what you already
own — previewed on a body silhouette.

**Status:** groundwork. The app runs with five placeholder tabs; features are specified and
ticketed but not built yet.

## Documents

| File                                           | What it covers                                   |
| ---------------------------------------------- | ------------------------------------------------ |
| [docs/PRODUCT.md](docs/PRODUCT.md)             | What the app is, features by phase, idea backlog |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Stack, layers, data model, storage, decisions    |
| [docs/OUTFIT_ENGINE.md](docs/OUTFIT_ENGINE.md) | The rules that build and score outfits           |
| [docs/TRY_ON.md](docs/TRY_ON.md)               | How garments are drawn on the silhouette         |
| [docs/ROADMAP.md](docs/ROADMAP.md)             | Milestones and agent-sized tickets               |
| [CLAUDE.md](CLAUDE.md)                         | Rules and commands for coding agents             |

## Run it

```bash
npm install
npm run web          # dev server in the browser
npm run check        # typecheck + lint + unit tests
npm run build:web    # static site in dist/
npm run e2e          # phone-viewport browser tests against dist/
```

## Open decisions (owner)

1. **Where to host the web build** so it can be opened on phones (ticket M2-7): GitHub Pages,
   Cloudflare Pages, Netlify, Vercel or Expo's EAS Hosting. All have free tiers; each needs an
   account.
2. **Supabase project** for sign-in and sync (milestone M8).
3. **Apple Developer and Google Play accounts** for store builds (milestone M9).
4. **Research tickets R1 and R2** need a session whose network allows `huggingface.co`,
   `developers.google.com`, `developer.apple.com` and `open-meteo.com`.
